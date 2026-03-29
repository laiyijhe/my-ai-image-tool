import { Buffer } from "node:buffer";

/** v2: "CGW" + 0x02 = two LSBs of blue channel per pixel (more energy per bit). */
export const WATERMARK_MAGIC_V2 = Buffer.from([0x43, 0x47, 0x57, 0x02]);

const MAX_USER_ID_BYTES = 512;

type BitmapLike = {
  bitmap: { data: Buffer; width: number; height: number };
};

export type WatermarkExtractFailureCode =
  | "magic_missing"
  | "unsupported_version"
  | "length_invalid"
  | "payload_truncated"
  | "utf8_corrupt";

export type WatermarkExtractResult =
  | { ok: true; userId: string }
  | { ok: false; code: WatermarkExtractFailureCode };

/**
 * Embeds UTF-8 Member ID in the **two least significant bits** of the **blue** channel only.
 * Alpha and R/G unchanged in those positions (R,G full; B uses bits 0–1).
 * Output must be **PNG** — lossy codecs destroy the payload.
 */
export function embedMemberIdInBitmap(image: BitmapLike, userId: string): void {
  const utf8 = Buffer.from(userId, "utf8");
  if (utf8.length > MAX_USER_ID_BYTES) {
    throw new Error("Member ID too long for watermark");
  }
  const payload = Buffer.alloc(4 + 2 + utf8.length);
  WATERMARK_MAGIC_V2.copy(payload, 0);
  payload.writeUInt16BE(utf8.length, 4);
  utf8.copy(payload, 6);

  const totalBits = payload.length * 8;
  const { data } = image.bitmap;
  /** 2 payload bits per pixel (blue channel). */
  const capacityBits = Math.floor(data.length / 4) * 2;
  if (totalBits > capacityBits) {
    throw new Error("Image too small to embed watermark");
  }

  let bitIndex = 0;
  for (let i = 0; i < data.length && bitIndex < totalBits; i += 4) {
    let blue = data[i + 2]! & ~3;
    for (let sub = 0; sub < 2 && bitIndex < totalBits; sub++) {
      const byte = payload[bitIndex >> 3]!;
      const bit = (byte >> (7 - (bitIndex & 7))) & 1;
      blue |= bit << sub;
      bitIndex++;
    }
    data[i + 2] = blue;
  }
}

function extractBitsFromBlue2Bit(data: Buffer): number[] {
  const bits: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    const pair = data[i + 2]! & 3;
    bits.push(pair & 1);
    bits.push((pair >> 1) & 1);
  }
  return bits;
}

function readBitsFromStream(
  bits: number[],
  startIdx: number,
  n: number
): { buf: Buffer; nextIdx: number } | null {
  let idx = startIdx;
  const out = Buffer.alloc(Math.ceil(n / 8));
  out.fill(0);
  for (let b = 0; b < n; b++) {
    if (idx >= bits.length) return null;
    const bit = bits[idx]!;
    idx++;
    const bi = b >> 3;
    const bp = 7 - (b & 7);
    out[bi]! |= bit << bp;
  }
  return { buf: out, nextIdx: idx };
}

/**
 * Decodes v2 (2-bit blue) watermark. Returns structured failure codes for debugging.
 */
export function extractMemberIdFromBitmapDetailed(
  image: BitmapLike
): WatermarkExtractResult {
  const bits = extractBitsFromBlue2Bit(image.bitmap.data);
  let idx = 0;

  const magicRead = readBitsFromStream(bits, idx, 32);
  if (!magicRead) {
    return { ok: false, code: "payload_truncated" };
  }
  idx = magicRead.nextIdx;
  const magicBlock = magicRead.buf.subarray(0, 4);

  if (magicBlock.length < 4) {
    return { ok: false, code: "magic_missing" };
  }

  const cg = Buffer.from([0x43, 0x47]);
  if (magicBlock[0] !== cg[0] || magicBlock[1] !== cg[1]) {
    return { ok: false, code: "magic_missing" };
  }

  if (magicBlock[2] !== 0x57) {
    return { ok: false, code: "magic_missing" };
  }

  if (magicBlock[3] !== 0x02) {
    return { ok: false, code: "unsupported_version" };
  }

  const lenRead = readBitsFromStream(bits, idx, 16);
  if (!lenRead) {
    return { ok: false, code: "payload_truncated" };
  }
  idx = lenRead.nextIdx;
  const len = lenRead.buf.readUInt16BE(0);

  if (len === 0 || len > MAX_USER_ID_BYTES) {
    return { ok: false, code: "length_invalid" };
  }

  const strRead = readBitsFromStream(bits, idx, len * 8);
  if (!strRead) {
    return { ok: false, code: "payload_truncated" };
  }

  const raw = strRead.buf.subarray(0, len);
  try {
    const userId = new TextDecoder("utf-8", { fatal: true }).decode(raw);
    return { ok: true, userId };
  } catch {
    return { ok: false, code: "utf8_corrupt" };
  }
}

/** @deprecated Prefer extractMemberIdFromBitmapDetailed for API responses */
export function extractMemberIdFromBitmap(image: BitmapLike): string | null {
  const r = extractMemberIdFromBitmapDetailed(image);
  return r.ok ? r.userId : null;
}
