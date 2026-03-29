import { Buffer } from "node:buffer";

/** Magic: "CGW" + version byte */
export const WATERMARK_MAGIC = Buffer.from([0x43, 0x47, 0x57, 0x01]);

const MAX_USER_ID_BYTES = 512;

type BitmapLike = {
  bitmap: { data: Buffer; width: number; height: number };
};

/**
 * Embeds UTF-8 Member ID in RGB LSBs (alpha untouched).
 * Output should be saved as PNG — JPEG recompression destroys the payload.
 */
export function embedMemberIdInBitmap(image: BitmapLike, userId: string): void {
  const utf8 = Buffer.from(userId, "utf8");
  if (utf8.length > MAX_USER_ID_BYTES) {
    throw new Error("Member ID too long for watermark");
  }
  const payload = Buffer.alloc(4 + 2 + utf8.length);
  WATERMARK_MAGIC.copy(payload, 0);
  payload.writeUInt16BE(utf8.length, 4);
  utf8.copy(payload, 6);

  const totalBits = payload.length * 8;
  const { data } = image.bitmap;
  const capacityBits = Math.floor(data.length / 4) * 3;
  if (totalBits > capacityBits) {
    throw new Error("Image too small to embed watermark");
  }

  let bitIndex = 0;
  for (let i = 0; i < data.length && bitIndex < totalBits; i += 4) {
    for (const ch of [0, 1, 2] as const) {
      if (bitIndex >= totalBits) break;
      const byte = payload[bitIndex >> 3]!;
      const bit = (byte >> (7 - (bitIndex & 7))) & 1;
      data[i + ch] = (data[i + ch]! & 0xfe) | bit;
      bitIndex++;
    }
  }
}

/**
 * Reads Member ID from RGB LSBs. Returns null if magic/length invalid or payload missing.
 */
export function extractMemberIdFromBitmap(image: BitmapLike): string | null {
  const { data } = image.bitmap;
  const bits: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    for (const ch of [0, 1, 2] as const) {
      bits.push(data[i + ch]! & 1);
    }
  }

  let idx = 0;
  const readBits = (n: number): Buffer | null => {
    const out = Buffer.alloc(Math.ceil(n / 8));
    out.fill(0);
    for (let b = 0; b < n; b++) {
      if (idx >= bits.length) return null;
      const bit = bits[idx++]!;
      const bi = b >> 3;
      const bp = 7 - (b & 7);
      out[bi]! |= bit << bp;
    }
    return out;
  };

  const magicBlock = readBits(32);
  if (!magicBlock || !magicBlock.subarray(0, 4).equals(WATERMARK_MAGIC)) {
    return null;
  }

  const lenBlock = readBits(16);
  if (!lenBlock) return null;
  const len = lenBlock.readUInt16BE(0);
  if (len === 0 || len > MAX_USER_ID_BYTES) return null;

  const strBuf = readBits(len * 8);
  if (!strBuf) return null;

  try {
    return strBuf.subarray(0, len).toString("utf8");
  } catch {
    return null;
  }
}
