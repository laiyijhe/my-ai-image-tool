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
/**
 * Inside the hysteresis band `|gap| ≤ EXTRACT_GAP`, treat small |gap| as **0** (extract path only).
 * Avoids noise pushing weak positives past `gap > 0` → excessive 1s in hex (e.g. F7-heavy heads).
 */
const EXTRACT_GAP_AMBIGUOUS_SIGN_EPSILON = 1.0;
const GAP_ENFORCE_MAX_STEPS = 192;

/** Same logical payload bit is written to 3 consecutive physical stream slots (then cyclic). */
const TRIPLE_REDUNDANCY = 3;

/**
 * Fallback collapsed-skip if brute-force scan (start indices 0..`MAGIC_BRUTE_FORCE_MAX_START_BIT`)
 * finds no `0x43475703` within Hamming distance `MAGIC_HAMMING_MAX_ERRORS` MSB-first.
 * Discovered index `i` becomes `magicSkipBits` for `sliceCollapsedPayloadBits` (preamble length).
 */
const EXTRACT_COLLAPSED_LEADING_SKIP_FALLBACK = 5;

/**
 * Extract-only: XOR every gap-decoded bit (embed / `readBitFromBlock` unchanged).
 * When true, collapsed bits are already polarity-aligned to the embed protocol; brute-force must not
 * apply a second whole-stream invert (`streamInvertCollapsed`) for the same correction.
 * Set **false** when diagnostics show bit-saturation (too many 1s / F7-heavy magic hex).
 */
const EXTRACT_INVERT_DCT_GAP_DECODER = false;

/** Inclusive max start index for magic alignment scan: `i` = 0 … 128. */
const MAGIC_BRUTE_FORCE_MAX_START_BIT = 128;

/** Max Hamming distance vs `WATERMARK_MAGIC_V3` first 32 bits to accept a magic window. */
const MAGIC_HAMMING_MAX_ERRORS = 16;

/** Hamming distance at `collapsed[start..start+32)` vs `magic32`, optional per-bit invert before compare. */
function hamming32VsMagic(
  collapsed: number[],
  start: number,
  magic32: number[],
  invertStreamBits: boolean
): number {
  let errors = 0;
  for (let j = 0; j < 32; j++) {
    const b = (collapsed[start + j]! & 1) ^ (invertStreamBits ? 1 : 0);
    if (b !== magic32[j]!) errors++;
  }
  return errors;
}

/** Same 4 magic bytes as stream bits but LSB-first within each byte (bit order inside byte reversed). */
function watermarkMagicV3FirstFourBytesLsbFirstBits(): number[] {
  const bits: number[] = [];
  for (let i = 0; i < 4; i++) {
    const byte = WATERMARK_MAGIC_V3[i]!;
    for (let j = 0; j < 8; j++) {
      bits.push((byte >> j) & 1);
    }
  }
  return bits;
}

function collapsedBitsPrefixBinaryString(
  collapsedBits: number[],
  bitCount: number
): string {
  const n = Math.min(bitCount, collapsedBits.length);
  let s = "";
  for (let i = 0; i < n; i++) {
    s += (collapsedBits[i]! & 1) ? "1" : "0";
  }
  return s;
}

type MagicSkipCandidate = {
  err: number;
  streamInvert: boolean;
  magicByteRev: boolean;
};

type MagicBruteForceScanStats = {
  bestHamming: number;
  bestIndex: number;
};

type BruteForceMagicSkipResult = {
  match: { offset: number; streamInvert: boolean } | null;
  scanStats: MagicBruteForceScanStats;
};

/**
 * Scan `bits[i..i+32)` vs CGW\\x03 with Hamming ≤ `MAGIC_HAMMING_MAX_ERRORS`.
 * Tries MSB-first-per-byte magic and LSB-first-per-byte magic; optional stream invert when
 * `!gapDecoderInverts`. Tracks global best Hamming for failure diagnostics.
 */
function bruteForceMagicSkip0To32(
  collapsedBits: number[],
  gapDecoderInverts: boolean
): BruteForceMagicSkipResult {
  console.log(
    "[Creator Guard DCT] bruteForceMagicSkip0To32 collapsedBits.length:",
    collapsedBits.length
  );

  const magic32Msb = payloadBufferToBigEndianBits(
    WATERMARK_MAGIC_V3.subarray(0, 4)
  );
  const magic32Lsb = watermarkMagicV3FirstFourBytesLsbFirstBits();

  let globalBestErr = 33;
  let globalBestIndex = -1;

  function noteGlobalBest(err: number, idx: number): void {
    if (err < globalBestErr) {
      globalBestErr = err;
      globalBestIndex = idx;
    }
  }

  function pickAcceptable(
    candidates: MagicSkipCandidate[]
  ): MagicSkipCandidate | null {
    const ok = candidates.filter((c) => c.err <= MAGIC_HAMMING_MAX_ERRORS);
    if (ok.length === 0) return null;
    ok.sort((a, b) => {
      if (a.err !== b.err) return a.err - b.err;
      if (a.magicByteRev !== b.magicByteRev)
        return a.magicByteRev ? 1 : -1;
      if (a.streamInvert !== b.streamInvert) return a.streamInvert ? 1 : -1;
      return 0;
    });
    return ok[0]!;
  }

  for (let i = 0; i <= MAGIC_BRUTE_FORCE_MAX_START_BIT; i++) {
    if (collapsedBits.length < i + 32) break;

    if (gapDecoderInverts) {
      const e0 = hamming32VsMagic(collapsedBits, i, magic32Msb, false);
      const e1 = hamming32VsMagic(collapsedBits, i, magic32Lsb, false);
      noteGlobalBest(e0, i);
      noteGlobalBest(e1, i);
      const chosen = pickAcceptable([
        { err: e0, streamInvert: false, magicByteRev: false },
        { err: e1, streamInvert: false, magicByteRev: true },
      ]);
      if (chosen) {
        console.log(
          "FOUND MAGIC AT BIT:",
          i,
          "ERROR_BITS:",
          chosen.err,
          "INVERTED:",
          chosen.streamInvert,
          "MAGIC_LSB_FIRST_PER_BYTE:",
          chosen.magicByteRev
        );
        return {
          match: { offset: i, streamInvert: chosen.streamInvert },
          scanStats: {
            bestHamming: globalBestErr,
            bestIndex: globalBestIndex,
          },
        };
      }
      continue;
    }

    const e0 = hamming32VsMagic(collapsedBits, i, magic32Msb, false);
    const e1 = hamming32VsMagic(collapsedBits, i, magic32Msb, true);
    const e2 = hamming32VsMagic(collapsedBits, i, magic32Lsb, false);
    const e3 = hamming32VsMagic(collapsedBits, i, magic32Lsb, true);
    noteGlobalBest(e0, i);
    noteGlobalBest(e1, i);
    noteGlobalBest(e2, i);
    noteGlobalBest(e3, i);
    const chosen = pickAcceptable([
      { err: e0, streamInvert: false, magicByteRev: false },
      { err: e1, streamInvert: true, magicByteRev: false },
      { err: e2, streamInvert: false, magicByteRev: true },
      { err: e3, streamInvert: true, magicByteRev: true },
    ]);
    if (chosen) {
      console.log(
        "FOUND MAGIC AT BIT:",
        i,
        "ERROR_BITS:",
        chosen.err,
        "INVERTED:",
        chosen.streamInvert,
        "MAGIC_LSB_FIRST_PER_BYTE:",
        chosen.magicByteRev
      );
      return {
        match: { offset: i, streamInvert: chosen.streamInvert },
        scanStats: {
          bestHamming: globalBestErr,
          bestIndex: globalBestIndex,
        },
      };
    }
  }

  if (globalBestIndex >= 0) {
    console.log(
      `[Creator Guard] Scan failed. Best match was ${globalBestErr} errors at index ${globalBestIndex}.`
    );
  } else {
    console.log(
      `[Creator Guard] Scan failed. No 32-bit window scanned (collapsedBits.length ${collapsedBits.length}).`
    );
  }
  console.log(
    "[Creator Guard] collapsedBits first 64 bits:",
    collapsedBitsPrefixBinaryString(collapsedBits, 64)
  );

  return {
    match: null,
    scanStats: { bestHamming: globalBestErr, bestIndex: globalBestIndex },
  };
}

function applyCollapsedStreamInvert(
  bits: number[],
  invert: boolean
): number[] {
  if (!invert) return bits;
  return bits.map((b) => (b & 1) ^ 1);
}

function collapsedLogicalBitCountForLen(len: number, collapsedSkipBits: number): number {
  return (6 + len) * 8 + collapsedSkipBits;
}

/** Physical stream length (bits) for one candidate UTF-8 length `len`, including preamble logical bits. */
function physicalStreamBitLengthForLen(
  len: number,
  collapsedSkipBits: number
): number {
  return TRIPLE_REDUNDANCY * collapsedLogicalBitCountForLen(len, collapsedSkipBits);
}

/** Payload bits only: magic(4) + uint16BE len + utf8 id — after leading skip on collapsed stream. */
function sliceCollapsedPayloadBits(
  collapsed: number[],
  payloadByteLen: number,
  collapsedSkipBits: number
): number[] | null {
  if (payloadByteLen < 1 || collapsed.length === 0) return null;
  const payloadBitCount = payloadByteLen * 8;
  const totalNeeded = collapsedSkipBits + payloadBitCount;
  if (collapsed.length < totalNeeded) return null;
  const start = collapsedSkipBits;
  const end = start + payloadBitCount;
  if (start < 0 || start > end || end > collapsed.length) return null;
  return collapsed.slice(start, end);
}

function collapsedBitsAlignedForMagicHex(
  bits: number[] | null,
  collapsedSkipBits: number
): number[] | null {
  if (!bits || bits.length < collapsedSkipBits + 32) return bits;
  return bits.slice(collapsedSkipBits);
}

export type WatermarkExtractFailureCode =
  | "magic_missing"
  | "unsupported_version"
  | "length_invalid"
  | "payload_truncated"
  | "utf8_corrupt"
  | "capacity"
  | "sync_offset";

/** Collapsed-stream diagnostic from magic brute-force (API / browser visibility). */
export type WatermarkExtractDebugSnapshot = {
  collapsedLen: number;
  first64: string;
  bestHamming: number;
  bestIndex: number;
};

export type WatermarkExtractResult =
  | { ok: true; userId: string }
  | {
      ok: false;
      code: WatermarkExtractFailureCode;
      debug?: WatermarkVerifyExtractDebug;
      debugSnapshot?: WatermarkExtractDebugSnapshot;
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
 * Minimum interior **block** count before `primaryCollapsedBitsForShiftScan` falls back to linear
 * `blockBits` padding (was `magicSkipBits + 32`). **Lower** = use real block bits sooner → wider
 * raw collapsed stream for magic / shift diagnostics (`8` requested for Vercel / noisy decode).
 */
const INTERIOR_PADDING = 8;

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

/** Decode one bit from mid-frequency DCT gap (embed + readBitFromBlock verify). */
function decodeBitFromMidfreqGap(gap: number): number {
  if (gap > EXTRACT_GAP) return 1;
  if (gap < -EXTRACT_GAP) return 0;
  if (gap > 0) return 1;
  if (gap < 0) return 0;
  return 0;
}

/** Extract-only: optional polarity flip vs channel (does not affect embed). */
function decodeBitFromMidfreqGapForExtract(gap: number): number {
  const b = decodeBitFromMidfreqGap(gap);
  return EXTRACT_INVERT_DCT_GAP_DECODER ? b ^ 1 : b;
}

/**
 * Protocol: bit 1 iff (A−B) > EXTRACT_GAP; bit 0 iff (A−B) < −EXTRACT_GAP.
 * In the ambiguous band |gap| ≤ EXTRACT_GAP, decode by **sign** of gap with ε=0 (embed/verify).
 * Extract uses `decodeBitFromMidfreqGapForExtract` → larger ε to suppress noise 1s.
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
  magicSkipBits: number;
  minInteriorBlocksForPad: number;
}): number[] {
  const {
    auditCollapsedLen10,
    auditCollapsedLen1,
    blockBits,
    count,
    magicSkipBits,
    minInteriorBlocksForPad,
  } = opts;
  const minCollapsedBitsForShiftHex = magicSkipBits + 39;
  let primaryCollapsed: number[] | null =
    auditCollapsedLen10 &&
    auditCollapsedLen10.length >= minCollapsedBitsForShiftHex
      ? auditCollapsedLen10
      : auditCollapsedLen1 &&
          auditCollapsedLen1.length >= minCollapsedBitsForShiftHex
        ? auditCollapsedLen1
        : null;

  if (
    !primaryCollapsed ||
    primaryCollapsed.length < minCollapsedBitsForShiftHex
  ) {
    if (count < minInteriorBlocksForPad) {
      console.warn(
        "[Creator Guard DCT] primaryCollapsed_pad_skipped_insufficient_blocks",
        {
          count,
          needBlocksAtLeast: minInteriorBlocksForPad,
          note: "Avoid padding to all-zero tail in debug when grid is too small for aligned magic",
        }
      );
      return [];
    }
    const linear: number[] = [];
    for (let i = 0; i < count; i++) linear.push(blockBits[i]! & 1);
    while (linear.length < minCollapsedBitsForShiftHex) linear.push(0);
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
  magicSkipBits: number;
  streamInvertCollapsed: boolean;
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
    magicSkipBits,
    streamInvertCollapsed,
  } = opts;

  const physicalFirst64 =
    auditPhysicalLen1 && auditPhysicalLen1.length >= 64
      ? auditPhysicalLen1.slice(0, 64).join("")
      : null;

  const minInteriorBlocksForPad = magicSkipBits + INTERIOR_PADDING;
  const collapsedForShiftHex = primaryCollapsedBitsForShiftScan({
    auditCollapsedLen10,
    auditCollapsedLen1,
    blockBits,
    count,
    magicSkipBits,
    minInteriorBlocksForPad,
  });
  const forHex = applyCollapsedStreamInvert(
    collapsedForShiftHex,
    streamInvertCollapsed
  );
  const alignedForMagicHex =
    collapsedBitsAlignedForMagicHex(forHex, magicSkipBits) ?? forHex;

  const collapsedFor64 =
    auditCollapsedLen10 &&
    auditCollapsedLen10.length >= magicSkipBits + 64
      ? auditCollapsedLen10.slice(magicSkipBits, magicSkipBits + 64)
      : auditCollapsedLen1 &&
          auditCollapsedLen1.length >= magicSkipBits + 64
        ? auditCollapsedLen1.slice(magicSkipBits, magicSkipBits + 64)
        : null;
  const collapsedFirst64 = collapsedFor64
    ? applyCollapsedStreamInvert(
        collapsedFor64,
        streamInvertCollapsed
      ).join("")
    : null;

  const len1ForObj = auditCollapsedLen1
    ? applyCollapsedStreamInvert(auditCollapsedLen1, streamInvertCollapsed)
    : null;

  return {
    physicalFirst64,
    collapsedFirst64,
    bitShiftHex0to7: buildBitShiftHex0to7Struct(alignedForMagicHex),
    bitShiftHex0to7Source: "scan_v4",
    bitShiftHex0to7CollapsedLen1: bitShiftHex0to7Object(
      collapsedBitsAlignedForMagicHex(len1ForObj, magicSkipBits) ?? len1ForObj,
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
  const { bw, bh, count, fullBw, fullBh } = blockGridDims(width, height);

  if (count < Lphy) {
    throw new Error(
      `Image too small for cyclic DCT watermark: need at least ${Lphy} interior 8×8 blocks (triple stream), have ${count} (${bw}×${bh} interior; full ${fullBw}×${fullBh})`
    );
  }

  for (let k = 0; k < count; k++) {
    const { bx, by } = blockIndexToCoords(k, bw);
    const bit = expandedBits[k % Lphy]!;
    embedBitInBlock(data, width, height, bx, by, bit);
  }

  enforceBitmapOpaque(data, width, height);
  flattenBitmapToOpaqueRgb(image.bitmap);
}

export function extractMemberIdDctDetailed(
  image: BitmapLike,
  _options?: { includeDebug?: boolean }
): WatermarkExtractResult {
  flattenBitmapToOpaqueRgb(image.bitmap);
  const { data, width, height } = image.bitmap;
  enforceBitmapOpaque(data, width, height);

  const { bw, bh, count, fullBw, fullBh } = blockGridDims(width, height);

  if (width < 16 || height < 16 || count === 0) {
    return { ok: false, code: "capacity" };
  }

  /**
   * Auto-align: search first ≤128 collapsed logical bits for CGW\\x03 (raw + stream XOR).
   * `magicSkipBits` + `streamInvertCollapsed` are the production settings for this image.
   */
  const blockBits: number[] = new Array(count);
  for (let k = 0; k < count; k++) {
    const { bx, by } = blockIndexToCoords(k, bw);
    const coeff = dct8x8(readLumaBlock(data, width, height, bx, by));
    const gap = coeff[COEFF_A]! - coeff[COEFF_B]!;
    blockBits[k] = decodeBitFromMidfreqGapForExtract(gap);
  }

  let magicSkipBits = EXTRACT_COLLAPSED_LEADING_SKIP_FALLBACK;
  let streamInvertCollapsed = false;

  function loadAuditsForSkip(skip: number): {
    auditPhysicalLen1: number[] | null;
    auditCollapsedLen1: number[] | null;
    auditCollapsedLen10: number[] | null;
  } {
    const Lphy1 = physicalStreamBitLengthForLen(1, skip);
    const Lphy10 = physicalStreamBitLengthForLen(10, skip);
    let auditPhysicalLen1: number[] | null = null;
    let auditCollapsedLen1: number[] | null = null;
    let auditCollapsedLen10: number[] | null = null;
    if (count >= Lphy1) {
      auditPhysicalLen1 = reconstructBigEndianBitsFromBlocks(
        blockBits,
        count,
        Lphy1
      );
      if (auditPhysicalLen1) {
        auditCollapsedLen1 = collapseTriplePhysicalBits(auditPhysicalLen1);
      }
    }
    if (count >= Lphy10) {
      const p10 = reconstructBigEndianBitsFromBlocks(
        blockBits,
        count,
        Lphy10
      );
      if (p10) {
        auditCollapsedLen10 = collapseTriplePhysicalBits(p10);
      }
    }
    return {
      auditPhysicalLen1,
      auditCollapsedLen1,
      auditCollapsedLen10,
    };
  }

  let { auditPhysicalLen1, auditCollapsedLen1, auditCollapsedLen10 } =
    loadAuditsForSkip(magicSkipBits);

  let magicBruteScanStats: MagicBruteForceScanStats = {
    bestHamming: 33,
    bestIndex: -1,
  };
  if (auditCollapsedLen10 !== null && auditCollapsedLen10.length >= 32) {
    const brute = bruteForceMagicSkip0To32(
      auditCollapsedLen10,
      EXTRACT_INVERT_DCT_GAP_DECODER
    );
    magicBruteScanStats = brute.scanStats;
    if (brute.match) {
      const found = brute.match;
      if (found.offset !== magicSkipBits) {
        magicSkipBits = found.offset;
        ({ auditPhysicalLen1, auditCollapsedLen1, auditCollapsedLen10 } =
          loadAuditsForSkip(magicSkipBits));
      }
      streamInvertCollapsed = found.streamInvert;
    }
  }

  const minInteriorBlocks = magicSkipBits + 32;

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
      magicSkipBits,
      streamInvertCollapsed,
    });

  if (count < minInteriorBlocks) {
    console.warn(
      "[Creator Guard DCT] interior_blocks_below_magic_skip_plus_32",
      {
        count,
        minInteriorBlocks,
        magicSkipBits,
      }
    );
    return { ok: false, code: "capacity", debug: verifyDebug };
  }

  const minBlocksPhysicalLen1 = physicalStreamBitLengthForLen(1, magicSkipBits);
  if (count < minBlocksPhysicalLen1) {
    console.warn(
      "[Creator Guard DCT] insufficient_interior_blocks_for_physical_stream_len1",
      {
        count,
        requiredPhysicalStreamBits: minBlocksPhysicalLen1,
        magicSkipBits,
      }
    );
    return { ok: false, code: "capacity", debug: verifyDebug };
  }

  const syncOk =
    data[0] === 255 &&
    data[1] === 0 &&
    data[2] === 0 &&
    data[3] === 255;
  const enforceSyncMarker =
    process.env.CREATOR_GUARD_ENFORCE_SYNC_MARKER === "1";
  if (!syncOk) {
    if (enforceSyncMarker) {
      return { ok: false, code: "sync_offset", debug: verifyDebug };
    }
  }

  for (let len = 1; len <= MAX_USER_ID_BYTES; len++) {
    const Lphy = physicalStreamBitLengthForLen(len, magicSkipBits);
    if (count < Lphy) continue;

    const allBits = reconstructBigEndianBitsFromBlocks(blockBits, count, Lphy);
    if (!allBits || allBits.length !== Lphy) continue;

    const collapsedRaw = collapseTriplePhysicalBits(allBits);
    const needCollapsed = collapsedLogicalBitCountForLen(len, magicSkipBits);
    if (!collapsedRaw || collapsedRaw.length !== needCollapsed) continue;

    const collapsed = applyCollapsedStreamInvert(
      collapsedRaw,
      streamInvertCollapsed
    );

    const payloadBits = sliceCollapsedPayloadBits(
      collapsed,
      6 + len,
      magicSkipBits
    );
    if (!payloadBits || payloadBits.length !== (6 + len) * 8) continue;

    const buf = bigEndianBitsToBuffer(payloadBits, 6 + len);
    if (!buf || buf.length < 6 + len) continue;

    const declaredLenBits32_47 = uint16BEFromBits32Through47(payloadBits);
    if (declaredLenBits32_47 === null || declaredLenBits32_47 !== len) {
      continue;
    }

    const declaredFromPacked = buf.readUInt16BE(4);
    if (declaredFromPacked !== declaredLenBits32_47) {
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

  const rawCollapsed = primaryCollapsedBitsForShiftScan({
    auditCollapsedLen10,
    auditCollapsedLen1,
    blockBits,
    count,
    magicSkipBits,
    minInteriorBlocksForPad: magicSkipBits + INTERIOR_PADDING,
  });
  if (rawCollapsed.length === 0) {
    return { ok: false, code: "capacity", debug: verifyDebug };
  }
  const forMagicMissing = applyCollapsedStreamInvert(
    rawCollapsed,
    streamInvertCollapsed
  );
  const alignedMagic =
    collapsedBitsAlignedForMagicHex(forMagicMissing, magicSkipBits) ??
    forMagicMissing;
  const debugData: WatermarkVerifyExtractDebug = {
    ...verifyDebug,
    bitShiftHex0to7: buildBitShiftHex0to7Struct(alignedMagic),
    bitShiftHex0to7Source: "scan_v4",
  };

  const collapsedForSnapshot =
    auditCollapsedLen10 && auditCollapsedLen10.length > 0
      ? auditCollapsedLen10
      : rawCollapsed.length > 0
        ? rawCollapsed
        : blockBits;
  const debugSnapshot: WatermarkExtractDebugSnapshot = {
    collapsedLen: collapsedForSnapshot.length,
    first64: Array.from(collapsedForSnapshot.slice(0, 64))
      .map((b) => String(b & 1))
      .join(""),
    bestHamming: magicBruteScanStats.bestHamming,
    bestIndex: magicBruteScanStats.bestIndex,
  };

  return {
    ok: false,
    code: "magic_missing",
    debug: debugData,
    debugSnapshot,
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
