import { Buffer } from "node:buffer";

/** DCT-domain v3 — mid-band coefficient pairing + repetition for JPEG-ish robustness */
export const WATERMARK_MAGIC_V3 = Buffer.from([0x43, 0x47, 0x57, 0x03]);

const MAX_USER_ID_BYTES = 256;
/** Repetition factor: same bit embedded in R blocks; decode by majority vote */
const REDUNDANCY = 4;
/** Minimum spatial variance (0–255 scale) to use a block — flat sky regions are skipped */
const VARIANCE_MIN = 8;
/** Coefficient indices (row-major 8×8) in DCT block — mid-frequency, not DC */
const COEFF_A = 12; // ~(1,4)
const COEFF_B = 19; // ~(2,3)
/** Embedding strength in DCT magnitude space (larger = more visible, more robust vs JPEG) */
const ALPHA = 42;

export type WatermarkExtractFailureCode =
  | "magic_missing"
  | "unsupported_version"
  | "length_invalid"
  | "payload_truncated"
  | "utf8_corrupt"
  | "capacity";

export type WatermarkExtractResult =
  | { ok: true; userId: string }
  | { ok: false; code: WatermarkExtractFailureCode };

type BitmapLike = {
  bitmap: { data: Buffer; width: number; height: number };
};

/**
 * Composite onto opaque white and set alpha=255 so DCT sees the same RGB as a 24-bit display
 * (avoids premultiply / transparency skewing mid-frequency coefficients).
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
      data[o] = 255;
      data[o + 1] = 255;
      data[o + 2] = 255;
      data[o + 3] = 255;
    } else if (a < 1) {
      const r = data[o]!;
      const g = data[o + 1]!;
      const b = data[o + 2]!;
      data[o] = Math.round(r * a + 255 * (1 - a));
      data[o + 1] = Math.round(g * a + 255 * (1 - a));
      data[o + 2] = Math.round(b * a + 255 * (1 - a));
      data[o + 3] = 255;
    } else {
      data[o + 3] = 255;
    }
  }
}

/** JPEG-style 2D DCT-II on 8×8, row-major samples (orthonormal scaling). */
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

function blockVariance(pixels: Float64Array): number {
  let mean = 0;
  for (let i = 0; i < 64; i++) mean += pixels[i]!;
  mean /= 64;
  let v = 0;
  for (let i = 0; i < 64; i++) {
    const d = pixels[i]! - mean;
    v += d * d;
  }
  return v / 64;
}

function readGrayBlock(
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
      const o = (y * width + x) * 4;
      const r = data[o]!;
      const g = data[o + 1]!;
      const b = data[o + 2]!;
      p[i++] = 0.299 * r + 0.587 * g + 0.114 * b;
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
  delta: Float64Array
): void {
  let i = 0;
  for (let dx = 0; dx < 8; dx++) {
    for (let dy = 0; dy < 8; dy++) {
      const x = bx * 8 + dx;
      const y = by * 8 + dy;
      const o = (y * width + x) * 4;
      const d = delta[i++]!;
      data[o] = Math.max(0, Math.min(255, Math.round(data[o]! + d)));
      data[o + 1] = Math.max(0, Math.min(255, Math.round(data[o + 1]! + d)));
      data[o + 2] = Math.max(0, Math.min(255, Math.round(data[o + 2]! + d)));
    }
  }
}

function collectValidBlocks(
  data: Buffer,
  width: number,
  height: number
): { bx: number; by: number }[] {
  const bw = Math.floor(width / 8);
  const bh = Math.floor(height / 8);
  const list: { bx: number; by: number }[] = [];
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      const gray = readGrayBlock(data, width, height, bx, by);
      if (blockVariance(gray) >= VARIANCE_MIN) list.push({ bx, by });
    }
  }
  return list;
}

function embedBitInBlock(
  data: Buffer,
  width: number,
  height: number,
  bx: number,
  by: number,
  bit: number
): void {
  const gray = readGrayBlock(data, width, height, bx, by);
  const coeff = dct8x8(gray);
  const a = coeff[COEFF_A]!;
  const b = coeff[COEFF_B]!;
  if (bit === 1) {
    coeff[COEFF_A] = a + ALPHA;
    coeff[COEFF_B] = b - ALPHA;
  } else {
    coeff[COEFF_A] = a - ALPHA;
    coeff[COEFF_B] = b + ALPHA;
  }
  const newGray = idct8x8(coeff);
  const d = new Float64Array(64);
  for (let i = 0; i < 64; i++) d[i] = newGray[i]! - gray[i]!;
  applyBlockDeltaToRgb(data, width, height, bx, by, d);
}

function readBitFromBlock(
  data: Buffer,
  width: number,
  height: number,
  bx: number,
  by: number
): number {
  const gray = readGrayBlock(data, width, height, bx, by);
  const coeff = dct8x8(gray);
  return coeff[COEFF_A]! > coeff[COEFF_B]! ? 1 : 0;
}

function payloadToBits(buf: Buffer): number[] {
  const bits: number[] = [];
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i]!;
    for (let j = 0; j < 8; j++) {
      bits.push((byte >> (7 - j)) & 1);
    }
  }
  return bits;
}

function bitsToBuffer(bits: number[], byteLen: number): Buffer | null {
  if (bits.length < byteLen * 8) return null;
  const out = Buffer.alloc(byteLen);
  for (let i = 0; i < byteLen; i++) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | (bits[i * 8 + j]! & 1);
    out[i] = v;
  }
  return out;
}

/** Majority vote over R values in {0,1} */
function majority(bits: number[]): number {
  let s = 0;
  for (const b of bits) s += b;
  return s >= bits.length / 2 ? 1 : 0;
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

  const bits = payloadToBits(payload);
  const { data, width, height } = image.bitmap;
  const valid = collectValidBlocks(data, width, height);
  const need = bits.length * REDUNDANCY;
  if (valid.length < need) {
    throw new Error("Image too small or too flat for DCT watermark");
  }

  for (let i = 0; i < bits.length; i++) {
    const bit = bits[i]!;
    for (let r = 0; r < REDUNDANCY; r++) {
      const { bx, by } = valid[i * REDUNDANCY + r]!;
      embedBitInBlock(data, width, height, bx, by, bit);
    }
  }
}

export function extractMemberIdDctDetailed(
  image: BitmapLike
): WatermarkExtractResult {
  flattenBitmapToOpaqueRgb(image.bitmap);
  const { data, width, height } = image.bitmap;
  if (width < 8 || height < 8) {
    return { ok: false, code: "capacity" };
  }

  const valid = collectValidBlocks(data, width, height);

  const readBit = (bitIndex: number): number => {
    const chunk: number[] = [];
    for (let r = 0; r < REDUNDANCY; r++) {
      const { bx, by } = valid[bitIndex * REDUNDANCY + r]!;
      chunk.push(readBitFromBlock(data, width, height, bx, by));
    }
    return majority(chunk);
  };

  const needHeader = 48 * REDUNDANCY;
  if (valid.length < needHeader) {
    return { ok: false, code: "magic_missing" };
  }

  const headerBits: number[] = [];
  for (let i = 0; i < 48; i++) headerBits.push(readBit(i));
  const headerBuf = bitsToBuffer(headerBits, 6);
  if (!headerBuf) return { ok: false, code: "payload_truncated" };

  if (!headerBuf.subarray(0, 4).equals(WATERMARK_MAGIC_V3)) {
    if (
      headerBuf[0] === 0x43 &&
      headerBuf[1] === 0x47 &&
      headerBuf[2] === 0x57 &&
      headerBuf[3] !== 0x03
    ) {
      return { ok: false, code: "unsupported_version" };
    }
    return { ok: false, code: "magic_missing" };
  }

  const len = headerBuf.readUInt16BE(4);
  if (len === 0 || len > MAX_USER_ID_BYTES) {
    return { ok: false, code: "length_invalid" };
  }

  const totalBits = (6 + len) * 8;
  if (valid.length < totalBits * REDUNDANCY) {
    return { ok: false, code: "payload_truncated" };
  }

  const allBits: number[] = [];
  for (let i = 0; i < totalBits; i++) allBits.push(readBit(i));

  const full = bitsToBuffer(allBits, 6 + len);
  if (!full || full.length < 6 + len) {
    return { ok: false, code: "payload_truncated" };
  }

  const raw = full.subarray(6, 6 + len);
  try {
    const userId = new TextDecoder("utf-8", { fatal: true }).decode(raw);
    return { ok: true, userId };
  } catch {
    return { ok: false, code: "utf8_corrupt" };
  }
}
