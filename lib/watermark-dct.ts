import { Buffer } from "node:buffer";

/** Eight MSB-first 32-bit windows (4 bytes) as 8-char uppercase hex, shift 0..7. */
export interface BitShiftHex0to7 {
  offset_0_hex: string | null;
  offset_1_hex: string | null;
  offset_2_hex: string | null;
  offset_3_hex: string | null;
  offset_4_hex: string | null;
  offset_5_hex: string | null;
  offset_6_hex: string | null;
  offset_7_hex: string | null;
}

/** Serializable verify-page diagnostics (API + UI). Exported for route handlers. */
export interface WatermarkVerifyExtractDebug {
  bitShiftHex0to7: BitShiftHex0to7;
  bitShiftHex0to7Source: string;
  physicalFirst64: string | null;
  collapsedFirst64: string | null;
  /** Extended row (note, expectedMagicHead4, warn, lowercase hex) for len=1 stream. */
  bitShiftHex0to7CollapsedLen1: Record<string, unknown>;
  grid: {
    interiorBw: number;
    interiorBh: number;
    interiorCount: number;
    fullBw: number;
    fullBh: number;
  };
  expectedMagicHead4: string;
}

/**
 * Creator Guard — DCT v3 (production)
 * Cyclic 8×8 blocks, integer BT.601 luma, coefficients (3,1) vs (1,3) only, majority decode.
 */
export const WATERMARK_MAGIC_V3 = Buffer.from([0x43, 0x47, 0x57, 0x03]);

const MAX_USER_ID_BYTES = 256;

/**
 * Mid-frequency AC pair (typical DCT watermark band): (u,v) = (3,1) vs (1,3).
 * Row-major u*8+v — index 25 = (3,1), index 11 = (1,3). No other ACs participate.
 */
const COEFF_A = 3 * 8 + 1; // 25
const COEFF_B = 1 * 8 + 3; // 11

const ALPHA = 42;
const EMBED_SCALE_MAX = 8;
const EMBED_VERIFY_ITERS = 14;
const EMBED_SCALE_GROWTH = 1.12;

/**
 * Embed: DCT margin target after clamp (was 25). **Temporarily 60** — quantization / PNG survival
 * experiment (user: if 60 works and ~25 didn’t, treat as quant/decode loss).
 * Extract: read threshold (unchanged).
 */
const EMBED_GAP = 60;
/**
 * Decode hysteresis on (coeff_A − coeff_B). Outside ±this band we use hard 0/1; inside (after PNG
 * etc.) we still use the **sign** of the gap so attenuated marks do not collapse to all-zero bits.
 */
const EXTRACT_GAP = 2;
const GAP_ENFORCE_MAX_STEPS = 192;

/** Same logical payload bit is written to 3 consecutive physical stream slots (then cyclic). */
const TRIPLE_REDUNDANCY = 3;

export type WatermarkExtractFailureCode =
  | "magic_missing"
  | "unsupported_version"
  | "length_invalid"
  | "payload_truncated"
  | "utf8_corrupt"
  | "capacity"
  | "sync_offset";

export type WatermarkExtractResult =
  | { ok: true; userId: string }
  | {
      ok: false;
      code: WatermarkExtractFailureCode;
      debug?: WatermarkVerifyExtractDebug;
    };

type BitmapLike = {
  bitmap: { data: Buffer; width: number; height: number };
};

/**
 * Premultiply onto opaque **black** (#000) so transparent/semi-transparent pixels match
 * browser canvas `fillRect(black)` + `drawImage` (verify) and keep embed/extract luma aligned.
 */
export function flattenBitmapToOpaqueRgb(bitmap: {
  data: Buffer;
  width: number;
  height: number;
}): void {
  const { data, width, height } = bitmap;
  const n = width * height;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const a = data[o + 3]! / 255;
    if (a <= 0) {
      data[o] = 0;
      data[o + 1] = 0;
      data[o + 2] = 0;
      data[o + 3] = 255;
    } else if (a < 1) {
      const r = data[o]!;
      const g = data[o + 1]!;
      const b = data[o + 2]!;
      data[o] = Math.round(r * a);
      data[o + 1] = Math.round(g * a);
      data[o + 2] = Math.round(b * a);
      data[o + 3] = 255;
    } else {
      data[o + 3] = 255;
    }
  }
}

/** Every pixel opaque — frequency pipeline never sees non-255 alpha. */
function enforceBitmapOpaque(data: Buffer, width: number, height: number): void {
  const n = width * height;
  for (let i = 0; i < n; i++) {
    data[i * 4 + 3] = 255;
  }
}

function dct8x8(pixels: Float64Array): Float64Array {
  const out = new Float64Array(64);
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      let sum = 0;
      for (let x = 0; x < 8; x++) {
        for (let y = 0; y < 8; y++) {
          sum +=
            pixels[x * 8 + y]! *
            Math.cos(((2 * x + 1) * u * Math.PI) / 16) *
            Math.cos(((2 * y + 1) * v * Math.PI) / 16);
        }
      }
      const cu = u === 0 ? 1 / Math.SQRT2 : 1;
      const cv = v === 0 ? 1 / Math.SQRT2 : 1;
      out[u * 8 + v] = 0.25 * cu * cv * sum;
    }
  }
  return out;
}

function idct8x8(coeffs: Float64Array): Float64Array {
  const out = new Float64Array(64);
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      let sum = 0;
      for (let u = 0; u < 8; u++) {
        for (let v = 0; v < 8; v++) {
          const cu = u === 0 ? 1 / Math.SQRT2 : 1;
          const cv = v === 0 ? 1 / Math.SQRT2 : 1;
          sum +=
            cu *
            cv *
            coeffs[u * 8 + v]! *
            Math.cos(((2 * x + 1) * u * Math.PI) / 16) *
            Math.cos(((2 * y + 1) * v * Math.PI) / 16);
        }
      }
      out[x * 8 + y] = 0.25 * sum;
    }
  }
  return out;
}

/**
 * BT.601 luma: `round((77*r + 150*g + 29*b) / 256)` — closer to browser float Y than `>> 8` trunc.
 */
function bt601LumaFromRgb(r: number, g: number, b: number): number {
  const ri = r | 0;
  const gi = g | 0;
  const bi = b | 0;
  return Math.min(
    255,
    Math.max(0, Math.round((77 * ri + 150 * gi + 29 * bi) / 256))
  );
}

/** 8×8 luma samples; layout x*8+y matches dct8x8. Raster walk: dx 0..7, dy 0..7. */
function readLumaBlock(
  data: Buffer,
  width: number,
  height: number,
  bx: number,
  by: number
): Float64Array {
  const p = new Float64Array(64);
  let i = 0;
  for (let dx = 0; dx < 8; dx++) {
    for (let dy = 0; dy < 8; dy++) {
      const x = bx * 8 + dx;
      const y = by * 8 + dy;
      if (x < 0 || x >= width || y < 0 || y >= height) {
        p[i++] = 0;
        continue;
      }
      const o = (y * width + x) * 4;
      p[i++] = bt601LumaFromRgb(data[o]!, data[o + 1]!, data[o + 2]!);
    }
  }
  return p;
}

function applyBlockDeltaToRgb(
  data: Buffer,
  width: number,
  height: number,
  bx: number,
  by: number,
  delta: Float64Array,
  opts?: { targetBit?: number }
): void {
  let i = 0;
  for (let dx = 0; dx < 8; dx++) {
    for (let dy = 0; dy < 8; dy++) {
      const x = bx * 8 + dx;
      const y = by * 8 + dy;
      if (x < 0 || x >= width || y < 0 || y >= height) {
        i++;
        continue;
      }
      const o = (y * width + x) * 4;
      const d = delta[i++]!;
      data[o] = Math.max(0, Math.min(255, Math.round(data[o]! + d)));
      data[o + 1] = Math.max(0, Math.min(255, Math.round(data[o + 1]! + d)));
      data[o + 2] = Math.max(0, Math.min(255, Math.round(data[o + 2]! + d)));
      data[o + 3] = 255;
    }
  }

  // Zero-tolerance: integer RGB clamp shrinks the DCT margin from the ideal IDCT delta.
  // Re-read luma → DCT and widen until margin ≥ EMBED_GAP while readBit (EXTRACT_GAP) still matches.
  const tb = opts?.targetBit;
  if (
    tb !== undefined &&
    readBitFromBlock(data, width, height, bx, by) === tb
  ) {
    for (let guard = 0; guard < 8; guard++) {
      const gap = blockCoeffGap(data, width, height, bx, by);
      const ok = tb === 1 ? gap > EMBED_GAP : gap < -EMBED_GAP;
      if (ok && readBitFromBlock(data, width, height, bx, by) === tb) break;
      enforceMinDctGapAfterClamp(data, width, height, bx, by, tb);
    }
  }
}

function copyBlockRgb(
  data: Buffer,
  width: number,
  height: number,
  bx: number,
  by: number,
  out: Uint8Array
): void {
  let i = 0;
  for (let dx = 0; dx < 8; dx++) {
    for (let dy = 0; dy < 8; dy++) {
      const x = bx * 8 + dx;
      const y = by * 8 + dy;
      if (x < 0 || x >= width || y < 0 || y >= height) {
        out[i++] = 0;
        out[i++] = 0;
        out[i++] = 0;
        continue;
      }
      const o = (y * width + x) * 4;
      out[i++] = data[o]!;
      out[i++] = data[o + 1]!;
      out[i++] = data[o + 2]!;
    }
  }
}

function pasteBlockRgb(
  data: Buffer,
  width: number,
  height: number,
  bx: number,
  by: number,
  src: Uint8Array
): void {
  let i = 0;
  for (let dx = 0; dx < 8; dx++) {
    for (let dy = 0; dy < 8; dy++) {
      const x = bx * 8 + dx;
      const y = by * 8 + dy;
      if (x < 0 || x >= width || y < 0 || y >= height) {
        i += 3;
        continue;
      }
      const o = (y * width + x) * 4;
      data[o] = src[i++]!;
      data[o + 1] = src[i++]!;
      data[o + 2] = src[i++]!;
      data[o + 3] = 255;
    }
  }
}

/**
 * Add delta to R,G,B (same sign) per pixel, clamp, alpha 255.
 * Returns true if any sample changed (headroom existed).
 */
function bumpBlockRgbUniform(
  data: Buffer,
  width: number,
  height: number,
  bx: number,
  by: number,
  delta: -1 | 1
): boolean {
  let changed = false;
  for (let dx = 0; dx < 8; dx++) {
    for (let dy = 0; dy < 8; dy++) {
      const x = bx * 8 + dx;
      const y = by * 8 + dy;
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      const o = (y * width + x) * 4;
      const r = data[o]!;
      const g = data[o + 1]!;
      const b = data[o + 2]!;
      const nr = Math.max(0, Math.min(255, r + delta));
      const ng = Math.max(0, Math.min(255, g + delta));
      const nb = Math.max(0, Math.min(255, b + delta));
      if (nr !== r || ng !== g || nb !== b) changed = true;
      data[o] = nr;
      data[o + 1] = ng;
      data[o + 2] = nb;
      data[o + 3] = 255;
    }
  }
  return changed;
}

function blockCoeffGap(
  data: Buffer,
  width: number,
  height: number,
  bx: number,
  by: number
): number {
  const coeff = dct8x8(readLumaBlock(data, width, height, bx, by));
  return coeff[COEFF_A]! - coeff[COEFF_B]!;
}

/**
 * After IDCT+clamp, widen coeff_A - coeff_B margin without flipping the stored bit.
 * Rolls back any nudge that breaks protocol symmetry.
 */
function enforceMinDctGapAfterClamp(
  data: Buffer,
  width: number,
  height: number,
  bx: number,
  by: number,
  bit: number
): void {
  const snap = new Uint8Array(64 * 3);

  for (let step = 0; step < GAP_ENFORCE_MAX_STEPS; step++) {
    const gap = blockCoeffGap(data, width, height, bx, by);
    const ok = bit === 1 ? gap > EMBED_GAP : gap < -EMBED_GAP;
    if (ok && readBitFromBlock(data, width, height, bx, by) === bit) return;

    copyBlockRgb(data, width, height, bx, by, snap);
    const dir = (bit === 1 ? 1 : -1) as -1 | 1;
    if (!bumpBlockRgbUniform(data, width, height, bx, by, dir)) return;

    if (readBitFromBlock(data, width, height, bx, by) !== bit) {
      pasteBlockRgb(data, width, height, bx, by, snap);
      return;
    }
    const gap2 = blockCoeffGap(data, width, height, bx, by);
    const better =
      bit === 1 ? gap2 > gap : gap2 < gap;
    if (!better) {
      pasteBlockRgb(data, width, height, bx, by, snap);
      return;
    }
  }
}

/**
 * **Interior 8×8 grid** — skip block row 0 and block col 0 (edge tiles). First embedded block is
 * **bx=1, by=1** → pixels **[8,8)..[15,15)**, avoiding common border/canvas/PNG edge artifacts.
 * `bw`×`bh` here = **interior** block counts `(fullBw-1)×(fullBh-1)`.
 */
function blockGridDims(width: number, height: number): {
  bw: number;
  bh: number;
  count: number;
  usableW: number;
  usableH: number;
  fullBw: number;
  fullBh: number;
} {
  if (width < 16 || height < 16) {
    return {
      bw: 0,
      bh: 0,
      count: 0,
      usableW: 0,
      usableH: 0,
      fullBw: 0,
      fullBh: 0,
    };
  }
  const usableW = Math.floor(width / 8) * 8;
  const usableH = Math.floor(height / 8) * 8;
  const fullBw = usableW / 8;
  const fullBh = usableH / 8;
  if (fullBw < 2 || fullBh < 2) {
    return {
      bw: 0,
      bh: 0,
      count: 0,
      usableW,
      usableH,
      fullBw,
      fullBh,
    };
  }
  const bw = fullBw - 1;
  const bh = fullBh - 1;
  return {
    bw,
    bh,
    count: bw * bh,
    usableW,
    usableH,
    fullBw,
    fullBh,
  };
}

/** Interior linear k → block coords; k=0 is tile (1,1), pixel origin (8,8). */
function blockIndexFromTile(bx: number, by: number, ibw: number): number {
  return (by - 1) * ibw + (bx - 1);
}

function blockIndexToCoords(
  k: number,
  ibw: number
): { bx: number; by: number } {
  const bx = (k % ibw) + 1;
  const by = Math.floor(k / ibw) + 1;
  return { bx, by };
}

function embedBitInBlock(
  data: Buffer,
  width: number,
  height: number,
  bx: number,
  by: number,
  bit: number
): void {
  const saved = new Uint8Array(64 * 3);
  copyBlockRgb(data, width, height, bx, by, saved);

  let scale = 1;
  for (let iter = 0; iter < EMBED_VERIFY_ITERS; iter++) {
    pasteBlockRgb(data, width, height, bx, by, saved);

    const luma = readLumaBlock(data, width, height, bx, by);
    const coeff = dct8x8(luma);
    const a = coeff[COEFF_A]!;
    const b = coeff[COEFF_B]!;
    const mag = ALPHA * scale;
    if (bit === 1) {
      coeff[COEFF_A] = a + mag;
      coeff[COEFF_B] = b - mag;
    } else {
      coeff[COEFF_A] = a - mag;
      coeff[COEFF_B] = b + mag;
    }
    const newLuma = idct8x8(coeff);
    const d = new Float64Array(64);
    for (let i = 0; i < 64; i++) d[i] = newLuma[i]! - luma[i]!;
    applyBlockDeltaToRgb(data, width, height, bx, by, d, { targetBit: bit });

    if (readBitFromBlock(data, width, height, bx, by) === bit) {
      return;
    }
    scale = Math.min(scale * EMBED_SCALE_GROWTH, EMBED_SCALE_MAX);
  }
}

/**
 * Decode one bit from mid-frequency DCT gap (coeff (3,1) minus (1,3)).
 * TEMP diagnostic: no threshold — sign-only (magic / noise probe on Vercel).
 */
function decodeBitFromMidfreqGap(gap: number): number {
  return gap >= 0 ? 1 : 0;
}

/**
 * Protocol: bit 1 iff (A−B) > EXTRACT_GAP; bit 0 iff (A−B) < −EXTRACT_GAP.
 * In the ambiguous band |gap| ≤ EXTRACT_GAP (common after lossy recompression), decode by **sign**
 * of gap — embed pushes A>B for 1 and A<B for 0, so residual direction still carries information.
 * Exact tie (gap===0) → 0.
 */
function readBitFromBlock(
  data: Buffer,
  width: number,
  height: number,
  bx: number,
  by: number
): number {
  const coeff = dct8x8(readLumaBlock(data, width, height, bx, by));
  const gap = coeff[COEFF_A]! - coeff[COEFF_B]!;
  return decodeBitFromMidfreqGap(gap);
}

/**
 * Same layout as canvas `ImageData.data`: row-major RGBA, `(y*width+x)*4 + {0:R,1:G,2:B,3:A}`.
 * Pixel (0,0) is always `data[0..3]` — if embed vs extract differ, suspect row stride, crop, or color pipeline.
 */
function logFirstPixelRgbaImageDataOrder(
  phase: "embed" | "extract",
  data: Buffer,
  width: number,
  extras?: Record<string, unknown>
): void {
  const o = 0;
  const r = data[o]!;
  const g = data[o + 1]!;
  const b = data[o + 2]!;
  const a = data[o + 3]!;
  const protectRedMarker =
    r === 255 && g === 0 && b === 0 && a === 255;
  console.log("[Creator Guard DCT] first_pixel_rgba_ImageData.data[0..3]", {
    phase,
    data0_R: r,
    data1_G: g,
    data2_B: b,
    data3_A: a,
    tuple: [r, g, b, a],
    rowStrideBytes: width * 4,
    protectRedMarker_syncProbe:
      phase === "extract"
        ? protectRedMarker
        : undefined,
    protectRedMarker_note:
      phase === "extract"
        ? protectRedMarker
          ? "matches /api/protect TEMP (0,0) red marker — top-left indexing aligned"
          : "no red at (0,0); not from protect API, marker stripped, or buffer shifted"
        : undefined,
    ...extras,
  });
}

/** First **interior** embed tile (bx=1,by=1) — pixel origin (8,8); edge block (0,0) is skipped. */
function logFirstInteriorBlockDctCoefficients(
  phase: "embed" | "extract",
  data: Buffer,
  width: number,
  height: number
): void {
  const coeff = dct8x8(readLumaBlock(data, width, height, 1, 1));
  const dc = coeff[0]!;
  const a = coeff[COEFF_A]!;
  const b = coeff[COEFF_B]!;
  const label = phase === "embed" ? "Embed" : "Extract";
  console.log(
    `[Creator Guard DCT] coeff_compare_interior_block11 ${label}: A=${a}, B=${b}`
  );
  console.log("[Creator Guard DCT] block(1,1)_interior_first_embed_tile", phase, {
    width,
    height,
    pixelOrigin: { x: 8, y: 8 },
    dcCoefficient: dc,
    coeffA: a,
    coeffB: b,
    gapAB: a - b,
    all64: Array.from(coeff),
  });
}

/**
 * idToBits — **big-endian per byte** (MSB first): stream bit `8*i + j` = bit `(7-j)` of `buf[i]`.
 * **Embed only:** pass the **full** v3 payload buffer (magic + **uint16BE length at bytes 4–5** + utf8 id);
 * there is no “skip length prefix” — every payload byte expands to 8 stream bits in order.
 */
function payloadBufferToBigEndianBits(buf: Buffer): number[] {
  const bits: number[] = [];
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i]!;
    for (let j = 0; j < 8; j++) {
      bits.push((byte >> (7 - j)) & 1);
    }
  }
  return bits;
}

/**
 * Pack 8 stream bits → one byte, **MSB = bits[base]**, LSB = bits[base+7].
 * `shift` and `or` forms are algebraically identical when bit order is MSB-first.
 */
function pack8BitsToByteShift(bits: number[], base: number): number {
  let v = 0;
  for (let j = 0; j < 8; j++) v = (v << 1) | (bits[base + j]! & 1);
  return v & 255;
}

function pack8BitsToByteOrMsbFirst(bits: number[], base: number): number {
  let v = 0;
  for (let j = 0; j < 8; j++) v |= (bits[base + j]! & 1) << (7 - j);
  return v & 255;
}

/**
 * bitsToBuffer — big-endian per byte: byte `i` uses `bits[8*i..8*i+7]` with MSB first.
 */
function bigEndianBitsToBuffer(bits: number[], byteLen: number): Buffer | null {
  if (bits.length < byteLen * 8) return null;
  const out = Buffer.alloc(byteLen);
  for (let i = 0; i < byteLen; i++) {
    const base = i * 8;
    out[i] = pack8BitsToByteOrMsbFirst(bits, base);
  }
  return out;
}

/**
 * **Zero byte offset** after magic: stream bits **[32,47]** are exactly the uint16BE length field
 * (high byte = bits 32–39, low byte = bits 40–47). Does not overlap magic bits [0,31].
 */
function uint16BEFromBits32Through47(bits: number[]): number | null {
  if (bits.length < 48) return null;
  const hi = pack8BitsToByteOrMsbFirst(bits, 32);
  const lo = pack8BitsToByteOrMsbFirst(bits, 40);
  return (hi << 8) | lo;
}

/** MSB-first bit string for `CGW` only (24 bits) — used for sliding alignment search. */
function cgwMsbFirst24BitPattern(): string {
  return payloadBufferToBigEndianBits(WATERMARK_MAGIC_V3.subarray(0, 3)).join("");
}

function findAllBitSubstringStarts(
  haystack: number[],
  needleBitStr: string,
  maxHaystackBits: number
): number[] {
  const needle = needleBitStr.split("").map((c) => (c === "1" ? 1 : 0));
  const hlen = Math.min(haystack.length, maxHaystackBits);
  if (needle.length === 0 || hlen < needle.length) return [];
  const hits: number[] = [];
  for (let start = 0; start <= hlen - needle.length; start++) {
    let ok = true;
    for (let i = 0; i < needle.length; i++) {
      if ((haystack[start + i]! & 1) !== needle[i]!) {
        ok = false;
        break;
      }
    }
    if (ok) hits.push(start);
  }
  return hits;
}

/** Interpret 32 bits starting at `bitShift` as 4 big-endian bytes; return lowercase hex. */
function firstFourBytesHexAtBitShift(
  bits: number[],
  bitShift: number
): string | null {
  if (bitShift < 0 || bits.length < bitShift + 32) return null;
  const out = Buffer.alloc(4);
  for (let bi = 0; bi < 4; bi++) {
    let v = 0;
    for (let j = 0; j < 8; j++) {
      v = (v << 1) | (bits[bitShift + bi * 8 + j]! & 1);
    }
    out[bi] = v;
  }
  return out.toString("hex");
}

/** 32 contiguous bits MSB-first → 8-char uppercase hex (unsigned). */
function getHexAtShift(bits: number[], shift: number): string | null {
  if (bits.length < shift + 32) return null;
  let val = 0;
  for (let i = 0; i < 32; i++) {
    val = (val << 1) | (bits[shift + i]! & 1);
  }
  return (val >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

function buildBitShiftHex0to7Struct(bits: number[]): BitShiftHex0to7 {
  return {
    offset_0_hex: getHexAtShift(bits, 0),
    offset_1_hex: getHexAtShift(bits, 1),
    offset_2_hex: getHexAtShift(bits, 2),
    offset_3_hex: getHexAtShift(bits, 3),
    offset_4_hex: getHexAtShift(bits, 4),
    offset_5_hex: getHexAtShift(bits, 5),
    offset_6_hex: getHexAtShift(bits, 6),
    offset_7_hex: getHexAtShift(bits, 7),
  };
}

function bitShiftHex0to7Object(
  bits: number[] | null,
  note: string
): Record<string, unknown> {
  const expected = WATERMARK_MAGIC_V3.subarray(0, 4).toString("hex");
  const o: Record<string, unknown> = { note, expectedMagicHead4: expected };
  const work: number[] =
    bits && bits.length > 0 ? bits.map((b) => b & 1) : [];
  const origLen = work.length;
  while (work.length < 39) work.push(0);
  for (let s = 0; s < 8; s++) {
    o[`offset_${s}_hex`] = firstFourBytesHexAtBitShift(work, s);
  }
  if (!bits || origLen < 39) {
    o.warn =
      bits == null
        ? "stream_missing_used_zero_pad"
        : `stream_short_${origLen}_padded_to_${work.length}`;
  }
  return o;
}

/** Same collapsed stream used for verify `bitShiftHex0to7` (len10 → len1 → padded linear). */
function primaryCollapsedBitsForShiftScan(opts: {
  auditCollapsedLen10: number[] | null;
  auditCollapsedLen1: number[] | null;
  blockBits: number[];
  count: number;
}): number[] {
  const { auditCollapsedLen10, auditCollapsedLen1, blockBits, count } = opts;
  let primaryCollapsed: number[] | null =
    auditCollapsedLen10 && auditCollapsedLen10.length >= 39
      ? auditCollapsedLen10
      : auditCollapsedLen1 && auditCollapsedLen1.length >= 39
        ? auditCollapsedLen1
        : null;

  if (!primaryCollapsed || primaryCollapsed.length < 39) {
    const linear: number[] = [];
    for (let i = 0; i < count; i++) linear.push(blockBits[i]! & 1);
    while (linear.length < 40) linear.push(0);
    primaryCollapsed = linear;
  }

  return primaryCollapsed;
}

function buildWatermarkVerifyExtractDebug(opts: {
  auditPhysicalLen1: number[] | null;
  auditCollapsedLen1: number[] | null;
  auditCollapsedLen10: number[] | null;
  blockBits: number[];
  bw: number;
  bh: number;
  count: number;
  fullBw: number;
  fullBh: number;
}): WatermarkVerifyExtractDebug {
  const {
    auditPhysicalLen1,
    auditCollapsedLen1,
    auditCollapsedLen10,
    blockBits,
    bw,
    bh,
    count,
    fullBw,
    fullBh,
  } = opts;

  const physicalFirst64 =
    auditPhysicalLen1 && auditPhysicalLen1.length >= 64
      ? auditPhysicalLen1.slice(0, 64).join("")
      : null;

  const collapsedForShiftHex = primaryCollapsedBitsForShiftScan({
    auditCollapsedLen10,
    auditCollapsedLen1,
    blockBits,
    count,
  });

  const collapsedFor64 =
    auditCollapsedLen10 && auditCollapsedLen10.length >= 64
      ? auditCollapsedLen10
      : auditCollapsedLen1 && auditCollapsedLen1.length >= 64
        ? auditCollapsedLen1
        : null;
  const collapsedFirst64 = collapsedFor64
    ? collapsedFor64.slice(0, 64).join("")
    : null;

  return {
    physicalFirst64,
    collapsedFirst64,
    bitShiftHex0to7: buildBitShiftHex0to7Struct(collapsedForShiftHex),
    bitShiftHex0to7Source: "scan_v4",
    bitShiftHex0to7CollapsedLen1: bitShiftHex0to7Object(
      auditCollapsedLen1,
      "verify collapsed len=1"
    ),
    grid: {
      interiorBw: bw,
      interiorBh: bh,
      interiorCount: count,
      fullBw,
      fullBh,
    },
    expectedMagicHead4: WATERMARK_MAGIC_V3.subarray(0, 4).toString("hex"),
  };
}

function expectedMagicBigEndian32(): string {
  return payloadBufferToBigEndianBits(WATERMARK_MAGIC_V3.subarray(0, 4)).join("");
}

function majority(votes: number[]): number {
  if (votes.length === 0) return 0;
  let s = 0;
  for (const b of votes) s += b;
  return s * 2 >= votes.length ? 1 : 0;
}

/** Each logical payload bit → `TRIPLE_REDUNDANCY` identical physical bits (cyclic in blocks). */
function tripleExpandPayloadBits(bits: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < bits.length; i++) {
    const b = bits[i]! & 1;
    for (let t = 0; t < TRIPLE_REDUNDANCY; t++) out.push(b);
  }
  return out;
}

/** Invert triple-expand: one logical bit per `TRIPLE_REDUNDANCY` physical slots. */
function collapseTriplePhysicalBits(physical: number[]): number[] | null {
  if (physical.length % TRIPLE_REDUNDANCY !== 0) return null;
  const out: number[] = [];
  for (let i = 0; i < physical.length; i += TRIPLE_REDUNDANCY) {
    const chunk = physical.slice(i, i + TRIPLE_REDUNDANCY);
    out.push(majority(chunk));
  }
  return out;
}

/**
 * Reconstruct **physical** stream: index `j` = MSB-first, majority over blocks `j, j+L, j+2L, …`.
 * (Tail indices may have only one vote when `B` is small — triple redundancy is in **consecutive**
 * physical slots, collapsed after this step.)
 */
function reconstructBigEndianBitsFromBlocks(
  blockBits: number[],
  B: number,
  L: number
): number[] | null {
  if (L <= 0 || B < L) return null;
  const out: number[] = [];
  for (let j = 0; j < L; j++) {
    const votes: number[] = [];
    for (let k = j; k < B; k += L) {
      votes.push(blockBits[k]!);
    }
    if (votes.length === 0) return null;
    out.push(majority(votes));
  }
  return out;
}

export function embedMemberIdDct(image: BitmapLike, userId: string): void {
  flattenBitmapToOpaqueRgb(image.bitmap);

  const utf8 = Buffer.from(userId, "utf8");
  if (utf8.length > MAX_USER_ID_BYTES) {
    throw new Error("Member ID too long for DCT watermark");
  }
  const payload = Buffer.alloc(4 + 2 + utf8.length);
  WATERMARK_MAGIC_V3.copy(payload, 0);
  payload.writeUInt16BE(utf8.length, 4);
  utf8.copy(payload, 6);

  const payloadBits = payloadBufferToBigEndianBits(payload);
  const expandedBits = tripleExpandPayloadBits(payloadBits);
  const Lphy = expandedBits.length;
  const { data, width, height } = image.bitmap;
  const { bw, bh, count, usableW, usableH, fullBw, fullBh } = blockGridDims(
    width,
    height
  );

  if (count < Lphy) {
    throw new Error(
      `Image too small for cyclic DCT watermark: need at least ${Lphy} interior 8×8 blocks (triple stream), have ${count} (${bw}×${bh} interior; full ${fullBw}×${fullBh})`
    );
  }

  const head16 = payloadBits.slice(0, 16).join("");
  const b0 = blockIndexToCoords(0, bw);
  console.log("[Creator Guard DCT] embed_bitstream_head16", {
    first16Bits_logicalPayload: head16,
    expectedMagicPrefix16: expectedMagicBigEndian32().slice(0, 16),
    prefixMatchesMagic: head16 === expectedMagicBigEndian32().slice(0, 16),
    logicalBitLen: payloadBits.length,
    physicalExpandedLen: Lphy,
    TRIPLE_REDUNDANCY,
    EMBED_GAP,
    grid: {
      interiorBw: bw,
      interiorBh: bh,
      interiorCount: count,
      fullBw,
      fullBh,
      usableW,
      usableH,
      bitmapW: width,
      bitmapH: height,
      skipEdgeRowCol: "blocks bx=0 or by=0 skipped; first tile bx=1,by=1 → pixel (8,8)",
    },
    interiorLinear0: { bx: b0.bx, by: b0.by, x0: b0.bx * 8, y0: b0.by * 8 },
    tileRule:
      "k → bx=1+k%ibw, by=1+floor(k/ibw); interior only (ibw=fullBw-1, ibh=fullBh-1)",
  });

  for (let k = 0; k < count; k++) {
    const { bx, by } = blockIndexToCoords(k, bw);
    const bit = expandedBits[k % Lphy]!;
    embedBitInBlock(data, width, height, bx, by, bit);
  }

  enforceBitmapOpaque(data, width, height);
  flattenBitmapToOpaqueRgb(image.bitmap);
  logFirstPixelRgbaImageDataOrder("embed", data, width, {
    note: "/api/protect may overwrite (0,0) with red AFTER embed — compare extract to that PNG",
  });
  logFirstInteriorBlockDctCoefficients("embed", data, width, height);
}

export function extractMemberIdDctDetailed(
  image: BitmapLike,
  _options?: { includeDebug?: boolean }
): WatermarkExtractResult {
  flattenBitmapToOpaqueRgb(image.bitmap);
  const { data, width, height } = image.bitmap;
  enforceBitmapOpaque(data, width, height);

  const { bw, bh, count, usableW, usableH, fullBw, fullBh } = blockGridDims(
    width,
    height
  );

  if (width < 16 || height < 16 || count === 0) {
    return { ok: false, code: "capacity" };
  }

  logFirstPixelRgbaImageDataOrder("extract", data, width);

  /**
   * Extract does **not** call `payloadBufferToBigEndianBits` on a substring.
   * For candidate utf8 length `len`, we pack **full** `6+len` bytes: magic(4) + uint16BE length(2) + id(len).
   * `bigEndianBitsToBuffer(allBits, 6+len)` includes those bits; `readUInt16BE(4)` must equal `len` to accept.
   */
  console.log("[Creator Guard DCT] extract_bitstream_layout", {
    payloadBufferToBigEndianBits_usedOnEmbedOnly: true,
    physicalStreamLen: "3 × (6+len)×8 bits per candidate; collapseTriplePhysicalBits → logical (6+len)×8",
    extractPacksFullPayloadBytes: "6 + len (magic + length field + utf8 id) after collapse",
    lengthFieldNotSkipped:
      "uint16 read from collapsed bits [32,47]; cross-checked with buf.readUInt16BE(4)",
    bitIndexBoundaries: {
      magic:
        "collapsed bits [0,31] → payload bytes [0..3] (CGW\\x03); length starts at bit 32",
      lengthUint16BE:
        "collapsed bits [32,47] → uint16BE; must equal candidate len",
      memberIdUtf8: "collapsed bits [48, …] → utf8 id",
    },
  });

  logFirstInteriorBlockDctCoefficients("extract", data, width, height);

  const blockBits: number[] = new Array(count);
  const gapsFirst32: number[] = [];
  const gapsFirst10: number[] = [];
  const coeffA_first8: number[] = [];
  const coeffB_first8: number[] = [];
  for (let k = 0; k < count; k++) {
    const { bx, by } = blockIndexToCoords(k, bw);
    const coeff = dct8x8(readLumaBlock(data, width, height, bx, by));
    const a = coeff[COEFF_A]!;
    const b = coeff[COEFF_B]!;
    const gap = a - b;
    if (k < 10) {
      gapsFirst10.push(gap);
      if (Math.abs(gap) < 0.0001) {
        console.log("QUANTIZATION_WIPE_DETECTED at block", k);
      }
    }
    if (k < 32) gapsFirst32.push(gap);
    if (k < 8) {
      coeffA_first8.push(a);
      coeffB_first8.push(b);
    }
    blockBits[k] = decodeBitFromMidfreqGap(gap);
  }

  console.log(
    "RAW_GAPS_CHECK:",
    gapsFirst10.map((g) => g.toFixed(6))
  );

  if (gapsFirst32.length > 0) {
    const maxAbs = gapsFirst32.reduce((m, g) => Math.max(m, Math.abs(g)), 0);
    const inAmbiguousBand = gapsFirst32.filter(
      (g) => Math.abs(g) <= EXTRACT_GAP
    ).length;
    if (maxAbs <= EXTRACT_GAP * 2 || inAmbiguousBand >= gapsFirst32.length * 0.75) {
      console.warn("[Creator Guard DCT] extract_midfreq_gap_weak_signal", {
        EXTRACT_GAP,
        COEFF_A,
        COEFF_B,
        gapsFirst32_min: Math.min(...gapsFirst32),
        gapsFirst32_max: Math.max(...gapsFirst32),
        gapsFirst32_maxAbs: maxAbs,
        ambiguousBandCount_first32: inAmbiguousBand,
        coeffA_first8,
        coeffB_first8,
        note:
          "Raw DCT (3,1) vs (1,3); |gap| small → was collapsing to all 0; now sign-based in band",
      });
    }
  }

  const coeffI = dct8x8(readLumaBlock(data, width, height, 1, 1));
  const gapI = coeffI[COEFF_A]! - coeffI[COEFF_B]!;
  if (Math.abs(gapI) <= EXTRACT_GAP * 2) {
    console.warn("[Creator Guard DCT] block(1,1)_emergency_near_zero_gap", {
      coeffA: coeffI[COEFF_A],
      coeffB: coeffI[COEFF_B],
      gap: gapI,
      readBit_interiorLinear0: blockBits[0],
      EXTRACT_GAP,
    });
  }

  const raw32Blocks = blockBits.slice(0, Math.min(32, blockBits.length));
  console.log(
    "[Creator Guard DCT] raw_blockBits_first32_no_byte_conversion",
    JSON.stringify(raw32Blocks)
  );

  const maxLphyBruteforce =
    TRIPLE_REDUNDANCY * (6 + MAX_USER_ID_BYTES) * 8;
  const Lphy_len1 = TRIPLE_REDUNDANCY * (6 + 1) * 8;
  const Lphy_len10 = TRIPLE_REDUNDANCY * (6 + 10) * 8;

  const interiorGapsFirst10: {
    k: number;
    bx: number;
    by: number;
    gapAB: number;
  }[] = [];
  for (let k = 0; k < Math.min(10, count); k++) {
    const { bx, by } = blockIndexToCoords(k, bw);
    interiorGapsFirst10.push({
      k,
      bx,
      by,
      gapAB: blockCoeffGap(data, width, height, bx, by),
    });
  }

  let auditPhysicalLen1: number[] | null = null;
  let auditCollapsedLen1: number[] | null = null;
  let auditCollapsedLen10: number[] | null = null;

  if (count >= Lphy_len1) {
    auditPhysicalLen1 = reconstructBigEndianBitsFromBlocks(
      blockBits,
      count,
      Lphy_len1
    );
    if (auditPhysicalLen1 && auditPhysicalLen1.length >= 32) {
      console.log(
        "[Creator Guard DCT] reconstructed_physical_first32_len1",
        JSON.stringify(auditPhysicalLen1.slice(0, 32))
      );
      auditCollapsedLen1 = collapseTriplePhysicalBits(auditPhysicalLen1);
      if (auditCollapsedLen1 && auditCollapsedLen1.length >= 32) {
        console.log(
          "[Creator Guard DCT] collapsed_logical_first32_len1_candidate",
          JSON.stringify(auditCollapsedLen1.slice(0, 32))
        );
        let mismatch = false;
        const cmp: { byteIndex: number; shift: number; orMsb: number }[] = [];
        for (let bi = 0; bi < 4; bi++) {
          const base = bi * 8;
          const a = pack8BitsToByteShift(auditCollapsedLen1, base);
          const b = pack8BitsToByteOrMsbFirst(auditCollapsedLen1, base);
          if (a !== b) mismatch = true;
          cmp.push({ byteIndex: bi, shift: a, orMsb: b });
        }
        console.log("[Creator Guard DCT] pack8_shift_vs_orMsbFirst_first4bytes", {
          mismatch,
          note: "on collapsed logical stream; first bit is MSB of magic byte 0",
          cmp,
        });
      }
    }
  }

  if (count >= Lphy_len10) {
    const p10 = reconstructBigEndianBitsFromBlocks(
      blockBits,
      count,
      Lphy_len10
    );
    if (p10) auditCollapsedLen10 = collapseTriplePhysicalBits(p10);
  }

  const cgw24 = cgwMsbFirst24BitPattern();
  const phys128 =
    auditPhysicalLen1 && auditPhysicalLen1.length >= 128
      ? auditPhysicalLen1.slice(0, 128)
      : (auditPhysicalLen1 ?? []).slice(0, 128);
  const hitsCgwPhysical = findAllBitSubstringStarts(phys128, cgw24, 128);

  const collapsedSearch =
    auditCollapsedLen10 && auditCollapsedLen10.length >= 128
      ? auditCollapsedLen10.slice(0, 128)
      : auditCollapsedLen1 && auditCollapsedLen1.length >= 128
        ? auditCollapsedLen1.slice(0, 128)
        : auditCollapsedLen10 ?? auditCollapsedLen1 ?? [];
  const hitsCgwCollapsed = findAllBitSubstringStarts(
    collapsedSearch,
    cgw24,
    Math.min(128, collapsedSearch.length)
  );

  console.log("[Creator Guard DCT] extract_bit_sync_audit", {
    bruteForcePhysicalStream: {
      interiorBlockCount: count,
      Lphy_len1: Lphy_len1,
      maxLphy_allLens: maxLphyBruteforce,
      count_covers_full_bruteforce_loop: count >= maxLphyBruteforce,
      note: "each len needs reconstruct length Lphy = 3*(6+len)*8; count must be >= Lphy",
    },
    luma_gapAB_first10_interior_blocks: interiorGapsFirst10,
    smallGapHint:
      "if |gapAB| < 5 on most blocks, mark may be quantized away (check EMBED_GAP vs PNG)",
    cgw24BitPattern_msbFirst: cgw24,
    search_cgw24_in_first128_physical_len1: {
      bitsAvailable: phys128.length,
      hitStartIndices: hitsCgwPhysical,
      suspectBitAlignment_shift1to3: hitsCgwPhysical.filter(
        (i) => i >= 1 && i <= 3
      ),
    },
    search_cgw24_collapsed_first128: {
      collapsedSource:
        auditCollapsedLen10 && auditCollapsedLen10.length >= 128
          ? "len10"
          : auditCollapsedLen1 && auditCollapsedLen1.length >= 128
            ? "len1"
            : "short_stream",
      bitsSearched: Math.min(128, collapsedSearch.length),
      hitStartIndices: hitsCgwCollapsed,
    },
    first4bytes_hex_offsets_0_to_7_collapsed_len1: bitShiftHex0to7Object(
      auditCollapsedLen1,
      "collapsed len=1"
    ),
    first4bytes_hex_offsets_0_to_7_collapsed_len10: bitShiftHex0to7Object(
      auditCollapsedLen10 && auditCollapsedLen10.length >= 39
        ? auditCollapsedLen10
        : null,
      "collapsed len=10"
    ),
  });

  const verifyDebug: WatermarkVerifyExtractDebug =
    buildWatermarkVerifyExtractDebug({
      auditPhysicalLen1,
      auditCollapsedLen1,
      auditCollapsedLen10,
      blockBits,
      bw,
      bh,
      count,
      fullBw,
      fullBh,
    });

  const syncOk =
    data[0] === 255 &&
    data[1] === 0 &&
    data[2] === 0 &&
    data[3] === 255;
  const enforceSyncMarker =
    process.env.CREATOR_GUARD_ENFORCE_SYNC_MARKER === "1";
  if (!syncOk) {
    console.error("[Creator Guard DCT] sync_probe_false", {
      rgba0: [data[0], data[1], data[2], data[3]],
      expectedProtectDebug: [255, 0, 0, 255],
      hint: "Fix canvas / stride / 1px offset at (0,0) before trusting DCT — a shifted buffer makes all blocks wrong.",
      setEnforce:
        "Set CREATOR_GUARD_ENFORCE_SYNC_MARKER=1 to abort extract when marker is missing (debug).",
      enforceSyncMarker,
    });
    if (enforceSyncMarker) {
      return { ok: false, code: "sync_offset", debug: verifyDebug };
    }
  }

  const raw16 =
    count >= 16 ? blockBits.slice(0, 16) : blockBits.slice(0, Math.min(16, count));
  const raw16Str = raw16.join("");
  const magicPrefix16 = expectedMagicBigEndian32().slice(0, 16);
  const b0ex = blockIndexToCoords(0, bw);
  console.log("[Creator Guard DCT] extract_blockstream_head16_pre_majority", {
    rawBits_blocks0to15: raw16,
    bitString16: raw16Str,
    expectedMagicPrefix16: magicPrefix16,
    matchesEmbedMagicPrefix16: raw16Str === magicPrefix16,
    compareToLog_embed_bitstream_head16_first16Bits: raw16Str,
    grid: {
      width,
      height,
      interiorBw: bw,
      interiorBh: bh,
      interiorCount: count,
      fullBw,
      fullBh,
      usableW,
      usableH,
      interiorLinear0: {
        bx: b0ex.bx,
        by: b0ex.by,
        x0: b0ex.bx * 8,
        y0: b0ex.by * 8,
      },
      dataRowStrideBytes: width * 4,
      originTopLeft: true,
    },
  });

  const lenHead4Dump: {
    len: number;
    L: number;
    ok: boolean;
    skipReason?: string;
    head4Hex?: string;
    head4Bytes?: number[];
    escLiteral?: string;
    smoke_reversed_x03WGC?: boolean;
    smoke_null_x00_CGW?: boolean;
  }[] = [];
  for (let len = 1; len <= MAX_USER_ID_BYTES; len++) {
    const Lphy = TRIPLE_REDUNDANCY * (6 + len) * 8;
    if (count < Lphy) {
      lenHead4Dump.push({ len, L: Lphy, ok: false, skipReason: "count_lt_Lphy" });
      continue;
    }
    const allBits = reconstructBigEndianBitsFromBlocks(blockBits, count, Lphy);
    if (!allBits || allBits.length !== Lphy) {
      lenHead4Dump.push({ len, L: Lphy, ok: false, skipReason: "reconstruct" });
      continue;
    }
    const collapsed = collapseTriplePhysicalBits(allBits);
    if (!collapsed || collapsed.length !== (6 + len) * 8) {
      lenHead4Dump.push({ len, L: Lphy, ok: false, skipReason: "collapse" });
      continue;
    }
    const buf = bigEndianBitsToBuffer(collapsed, 6 + len);
    if (!buf || buf.length < 4) {
      lenHead4Dump.push({ len, L: Lphy, ok: false, skipReason: "pack_buffer" });
      continue;
    }
    const h0 = buf[0]!;
    const h1 = buf[1]!;
    const h2 = buf[2]!;
    const h3 = buf[3]!;
    const escLiteral = `\\x${h0.toString(16).padStart(2, "0")}\\x${h1
      .toString(16)
      .padStart(2, "0")}\\x${h2.toString(16).padStart(2, "0")}\\x${h3
      .toString(16)
      .padStart(2, "0")}`;
    lenHead4Dump.push({
      len,
      L: Lphy,
      ok: true,
      head4Hex: buf.subarray(0, 4).toString("hex"),
      head4Bytes: [h0, h1, h2, h3],
      escLiteral,
      smoke_reversed_x03WGC:
        h0 === 0x03 && h1 === 0x57 && h2 === 0x47 && h3 === 0x43,
      smoke_null_x00_CGW:
        h0 === 0x00 && h1 === 0x43 && h2 === 0x47 && h3 === 0x57,
    });
  }
  console.log("[Creator Guard DCT] extract_all_len_reconstruct_head4_dump", {
    expectedMagicHead4: WATERMARK_MAGIC_V3.subarray(0, 4).toString("hex"),
    note: "smoke_reversed_x03WGC ~ \\x03WGC order; smoke_null_x00_CGW ~ \\x00CGW byte-offset",
    rows: lenHead4Dump,
  });

  const expectedHdr32 = expectedMagicBigEndian32();

  for (let len = 1; len <= MAX_USER_ID_BYTES; len++) {
    const Lphy = TRIPLE_REDUNDANCY * (6 + len) * 8;
    if (count < Lphy) continue;

    const allBits = reconstructBigEndianBitsFromBlocks(blockBits, count, Lphy);
    if (!allBits || allBits.length !== Lphy) continue;

    const collapsed = collapseTriplePhysicalBits(allBits);
    if (!collapsed || collapsed.length !== (6 + len) * 8) continue;

    const buf = bigEndianBitsToBuffer(collapsed, 6 + len);
    if (!buf || buf.length < 6 + len) continue;

    const declaredLenBits32_47 = uint16BEFromBits32Through47(collapsed);
    if (declaredLenBits32_47 === null || declaredLenBits32_47 !== len) {
      continue;
    }

    const declaredFromPacked = buf.readUInt16BE(4);
    if (declaredFromPacked !== declaredLenBits32_47) {
      console.error(
        "[Creator Guard DCT] length_uint16_mismatch_bits32_47_vs_buffer",
        {
          lenCandidate: len,
          declaredLenBits32_47,
          readUInt16BE_at_byte4: declaredFromPacked,
        }
      );
      continue;
    }

    if (buf[0] === 0x43 && buf[1] === 0x47 && buf[2] === 0x57) {
      if (buf[3] !== 0x03) {
        return {
          ok: false,
          code: "unsupported_version",
          debug: verifyDebug,
        };
      }
    } else {
      continue;
    }
    const raw = buf.subarray(6, 6 + len);
    try {
      const userId = new TextDecoder("utf-8", { fatal: true }).decode(raw);
      return { ok: true, userId };
    } catch {
      return {
        ok: false,
        code: "utf8_corrupt",
        debug: verifyDebug,
      };
    }
  }

  const hdrDebug: {
    len: number;
    Lphy: number;
    hdr32: string;
    magic32Match: boolean;
  }[] = [];
  for (let len = 1; len <= MAX_USER_ID_BYTES; len++) {
    const Lphy = TRIPLE_REDUNDANCY * (6 + len) * 8;
    if (count < Lphy) continue;
    const allBits = reconstructBigEndianBitsFromBlocks(blockBits, count, Lphy);
    if (!allBits || allBits.length !== Lphy) continue;
    const collapsed = collapseTriplePhysicalBits(allBits);
    if (!collapsed || collapsed.length < 32) continue;
    const hdr32 = collapsed.slice(0, 32).join("");
    hdrDebug.push({
      len,
      Lphy,
      hdr32,
      magic32Match: hdr32 === expectedHdr32,
    });
  }

  const bitShiftProbe: {
    len: number;
    collapsedFirst64: string;
    physicalFirst64: string;
  }[] = [];
  for (let len = 1; len <= Math.min(8, MAX_USER_ID_BYTES); len++) {
    const Lphy = TRIPLE_REDUNDANCY * (6 + len) * 8;
    if (count < Lphy) continue;
    const physical = reconstructBigEndianBitsFromBlocks(blockBits, count, Lphy);
    if (!physical || physical.length < 64) continue;
    const collapsed = collapseTriplePhysicalBits(physical);
    bitShiftProbe.push({
      len,
      physicalFirst64: physical.slice(0, 64).join(""),
      collapsedFirst64:
        collapsed && collapsed.length >= 64
          ? collapsed.slice(0, 64).join("")
          : "(collapse_short)",
    });
  }

  console.error("[Creator Guard DCT] magic_missing", {
    grid: { interiorBw: bw, interiorBh: bh, interiorCount: count, fullBw, fullBh },
    interiorBlock0_is_tile_11: blockIndexFromTile(1, 1, bw) === 0,
    TRIPLE_REDUNDANCY,
    maxLphy_bruteforce: maxLphyBruteforce,
    count_covers_max_bruteforce: count >= maxLphyBruteforce,
    expectedHdr32,
    expectedMagicHex: WATERMARK_MAGIC_V3.subarray(0, 4).toString("hex"),
    headerSnapshots: hdrDebug.slice(0, 24),
    stream_first64bits_msbFirst: {
      physical_len1:
        auditPhysicalLen1 && auditPhysicalLen1.length >= 64
          ? auditPhysicalLen1.slice(0, 64).join("")
          : null,
      collapsed_len1:
        auditCollapsedLen1 && auditCollapsedLen1.length >= 64
          ? auditCollapsedLen1.slice(0, 64).join("")
          : null,
      collapsed_len10:
        auditCollapsedLen10 && auditCollapsedLen10.length >= 64
          ? auditCollapsedLen10.slice(0, 64).join("")
          : null,
    },
    first4bytes_hex_offsets_0_to_7_magic_missing: {
      collapsed_len1: bitShiftHex0to7Object(
        auditCollapsedLen1,
        "magic_missing collapsed len=1"
      ),
      collapsed_len10: bitShiftHex0to7Object(
        auditCollapsedLen10 && auditCollapsedLen10.length >= 39
          ? auditCollapsedLen10
          : null,
        "magic_missing collapsed len=10"
      ),
      physical_len1: bitShiftHex0to7Object(
        auditPhysicalLen1 && auditPhysicalLen1.length >= 39
          ? auditPhysicalLen1
          : null,
        "magic_missing physical len=1 (triple stream; head is not single CGW bytes)"
      ),
    },
    bitShiftProbe_collapsed_vs_physical_first64:
      "if magic appears shifted in collapsedFirst64 vs expectedHdr32, check bit alignment",
    bitShiftProbe,
  });

  const extractedBits = primaryCollapsedBitsForShiftScan({
    auditCollapsedLen10,
    auditCollapsedLen1,
    blockBits,
    count,
  });
  const debugData: WatermarkVerifyExtractDebug = {
    ...verifyDebug,
    bitShiftHex0to7: {
      offset_0_hex: getHexAtShift(extractedBits, 0),
      offset_1_hex: getHexAtShift(extractedBits, 1),
      offset_2_hex: getHexAtShift(extractedBits, 2),
      offset_3_hex: getHexAtShift(extractedBits, 3),
      offset_4_hex: getHexAtShift(extractedBits, 4),
      offset_5_hex: getHexAtShift(extractedBits, 5),
      offset_6_hex: getHexAtShift(extractedBits, 6),
      offset_7_hex: getHexAtShift(extractedBits, 7),
    },
    bitShiftHex0to7Source: "scan_v4",
  };

  return {
    ok: false,
    code: "magic_missing",
    debug: debugData,
  };
}

void (function assertBigEndianBitsRoundTrip(): void {
  const bits = payloadBufferToBigEndianBits(WATERMARK_MAGIC_V3.subarray(0, 4));
  const packed = bigEndianBitsToBuffer(bits, 4);
  if (!packed || !packed.equals(WATERMARK_MAGIC_V3.subarray(0, 4))) {
    throw new Error(
      "Creator Guard DCT: big-endian idToBits / bitsToBuffer invariant failed (would break CGW\\x03)"
    );
  }
  const expanded = tripleExpandPayloadBits(bits);
  const collapsed = collapseTriplePhysicalBits(expanded);
  if (!collapsed || collapsed.length !== bits.length || collapsed.join("") !== bits.join("")) {
    throw new Error("Creator Guard DCT: triple expand/collapse must preserve logical bits");
  }
  for (let v = 0; v < 256; v++) {
    const b = payloadBufferToBigEndianBits(Buffer.from([v]));
    const s = pack8BitsToByteShift(b, 0);
    const o = pack8BitsToByteOrMsbFirst(b, 0);
    if (s !== o || s !== v) {
      throw new Error(
        "Creator Guard DCT: pack8 shift vs or MSB-first mismatch (byte " + v + ")"
      );
    }
  }
})();
