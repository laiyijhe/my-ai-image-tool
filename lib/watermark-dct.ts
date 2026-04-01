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
 * Creator Guard — DCT v4 (production embed) / v3 (legacy extract)
 * Cyclic **sparse** interior blocks (odd bx+by checkerboard + central 70% only), BT.601 luma,
 * **mid-diagonal** DCT (2,3) vs (3,2), 5× Steel redundancy (**10×** on the first 32 logical bits = 4-byte magic),
 * texture-adaptive magnitude gap, **Hamming(7,4)** on the ID body (v4), magnitude gap decode.
 */
export const WATERMARK_MAGIC_V3 = Buffer.from([0x43, 0x47, 0x57, 0x03]);
/** v4: same CGW prefix, `0x04` = Hamming-wrapped UTF-8 ID after header. */
export const WATERMARK_MAGIC_V4 = Buffer.from([0x43, 0x47, 0x57, 0x04]);

/** Interior block grid too small for the physical bit stream (payload length × Steel redundancy). */
export class WatermarkEmbedCapacityError extends Error {
  readonly code = "capacity" as const;
  constructor(
    message: string,
    public readonly blocksNeeded: number,
    public readonly blocksHave: number
  ) {
    super(message);
    this.name = "WatermarkEmbedCapacityError";
  }
}

const MAX_USER_ID_BYTES = 256;

/** Reject very short bitmaps before DCT work (e.g. after API downscale). */
const MIN_EMBED_HEIGHT_PX = 200;

/**
 * Mid-frequency **diagonal** pair u+v=5 — (2,3) vs (3,2); zig-zag mid band, resilient to JPEG re-quant.
 * Row-major u*8+v: (2,3)=19, (3,2)=26.
 */
const COEFF_A = 2 * 8 + 3; // 19  (2,3)
const COEFF_B = 3 * 8 + 2; // 26  (3,2)

const ALPHA = 42;
const EMBED_SCALE_MAX = 8;
const EMBED_VERIFY_ITERS = 14;
const EMBED_SCALE_GROWTH = 1.12;

/**
 * Embed (Steel): **magnitude** separation `|DCT(COEFF_A)| − |DCT(COEFF_B)|`.
 * **Adaptive perceptual masking** via `getAdaptiveMagnitude` (HVS): weak in shadows/highlights
 * and smooth regions; strong in textured areas. Relaxed pass uses a lower floor if primary fails.
 */
/** Below this mean luma → shadow protection mag **8**. */
const LUMA_AVG_SHADOW_MAX = 40;
/** Ramp luma anchor (mag **8** at **Y → 140⁺**); blocks with **`yAvg >` this** take the ramp before variance tiering. */
const BRIGHT_RAMP_Y_LO = 140;
/** Inclusive high end of ramp; **`Y >` this** → flat absolute stealth **3**. */
const BRIGHT_RAMP_Y_HI = 250;
/** Smooth vs textured split (population variance of 8×8 BT.601 luma). */
const BLOCK_VAR_SMOOTH_LT = 100;
/** Above this variance → high-contrast edge (e.g. logo boundary). On **`Y > 140`** blocks, linen/texture must stay below this to use the bright ramp only. */
const BLOCK_VAR_HIGH_CONTRAST_GT = 500;

/**
 * Near-white blocks: smallest practical gap for stealth (prioritize invisibility over BER).
 * Expect higher bit errors on flat white; 10× physical redundancy on the magic header absorbs much of it.
 */
const EMBED_MAG_GAP_NEAR_WHITE = 3;
const EMBED_MAG_GAP_LUMA_EXTREME = 8;
/** Skin / flat mid-luma smooth tier (was 10). */
const EMBED_MAG_GAP_SMOOTH = 8;
const EMBED_MAG_GAP_TEXTURED = 20;
/** Logo-edge / high-contrast 8×8 blocks (`variance > BLOCK_VAR_HIGH_CONTRAST_GT`). */
const EMBED_MAG_GAP_EDGE_CONTRAST = 25;
/** Fallback when primary target cannot be met after clamp (step toward weaker gap). */
const EMBED_MAG_GAP_RELAXED_STEP = 8;
/** Last resort rung below `EMBED_MAG_GAP_LUMA_EXTREME` when primary is already 8. */
const EMBED_MAG_GAP_ULTRA_RELAXED = 6;

const GAP_ENFORCE_MAX_STEPS = 192;

/**
 * Signed gap `|A|−|B|` vs ±threshold for bit 1 / 0; tie band uses sign of gap.
 * **`magTarget < 8`** (e.g. ramp **3–7**) → **1**; **`8 ≤ magTarget < 14`** → **2** (covers ramp top **8**).
 * **`≥14`** → **3**, **`≥18`** → **5** (textured **20** / edge **25**). Deep-scan **`bias -1`** can reach **0** when base **t === 1**.
 */
export function extractBitThresholdForMagTarget(
  magTarget: number,
  thresholdBias = 0
): number {
  let t: number;
  if (magTarget >= 18) t = 5;
  else if (magTarget >= 14) t = 3;
  else if (magTarget >= 8) t = 2;
  else t = 1;

  t += thresholdBias;
  if (t < 0) t = 0;
  return t;
}

/**
 * Extract-only: logical **1** only if **all** redundant physical reads are 1 (see `PHYSICAL_REDUNDANCY`).
 */
const EXTRACT_TRIPLE_REQUIRE_UNANIMOUS_FOR_ONE = true;

/** One logical payload bit → `PHYSICAL_REDUNDANCY` identical physical slots (cyclic across blocks). */
const PHYSICAL_REDUNDANCY = 5;

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

/** Inclusive max start index for magic alignment scan (wider window for slight resize / misalignment). */
const MAGIC_BRUTE_FORCE_MAX_START_BIT = 256;

/** Max Hamming distance vs CGW magic (v3 `\\x03` or v4 `\\x04`) first 32 bits to accept a window. */
const MAGIC_HAMMING_MAX_ERRORS = 22;

function hammingWithinMagicTolerance(err: number): boolean {
  return err <= MAGIC_HAMMING_MAX_ERRORS;
}

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

/** Same 4 magic bytes as stream bits but LSB-first within each byte. */
function watermarkMagicFirstFourBytesLsbFirstBits(magic4: Buffer): number[] {
  const bits: number[] = [];
  for (let i = 0; i < 4; i++) {
    const byte = magic4[i]!;
    for (let j = 0; j < 8; j++) {
      bits.push((byte >> j) & 1);
    }
  }
  return bits;
}

/** Hamming(7,4): parity bits p1,p2,p3 at indices 0,1,3; data d1..d4 at 2,4,5,6. Single-bit correct per codeword. */
function hamming74EncodeNibble(b0: number, b1: number, b2: number, b3: number): number[] {
  const d1 = b0 & 1;
  const d2 = b1 & 1;
  const d3 = b2 & 1;
  const d4 = b3 & 1;
  const p1 = d1 ^ d2 ^ d4;
  const p2 = d1 ^ d3 ^ d4;
  const p3 = d2 ^ d3 ^ d4;
  return [p1, p2, d1, p3, d2, d3, d4];
}

function hamming74EncodeStream(idBits: number[]): number[] {
  const pad = (4 - (idBits.length % 4)) % 4;
  const bits = idBits.slice();
  for (let i = 0; i < pad; i++) bits.push(0);
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 4) {
    out.push(
      ...hamming74EncodeNibble(
        bits[i]!,
        bits[i + 1]!,
        bits[i + 2]!,
        bits[i + 3]!
      )
    );
  }
  return out;
}

function hamming74DecodeBlock(c: number[]): number[] {
  const w = c.map((x) => x & 1);
  const s1 = w[0]! ^ w[2]! ^ w[4]! ^ w[6]!;
  const s2 = w[1]! ^ w[2]! ^ w[5]! ^ w[6]!;
  const s3 = w[3]! ^ w[4]! ^ w[5]! ^ w[6]!;
  const syn = s1 | (s2 << 1) | (s3 << 2);
  if (syn >= 1 && syn <= 7) {
    w[syn - 1] = w[syn - 1]! ^ 1;
  }
  return [w[2]!, w[4]!, w[5]!, w[6]!];
}

/** Decode `eccBits` (multiple of 7); keep first `dataBitLen` data bits (rest is padding). */
function hamming74DecodeStream(eccBits: number[], dataBitLen: number): number[] | null {
  if (dataBitLen < 0 || eccBits.length % 7 !== 0) return null;
  const needCw = Math.ceil(dataBitLen / 4);
  if (eccBits.length < needCw * 7) return null;
  const out: number[] = [];
  for (let i = 0; i < needCw * 7; i += 7) {
    const block = eccBits.slice(i, i + 7);
    if (block.length < 7) return null;
    out.push(...hamming74DecodeBlock(block));
  }
  if (out.length < dataBitLen) return null;
  return out.slice(0, dataBitLen);
}

function idEccLogicalBitCountV4(idByteLen: number): number {
  const idBits = idByteLen * 8;
  const groups = Math.ceil(idBits / 4);
  return groups * 7;
}

type MagicSkipCandidate = {
  err: number;
  streamInvert: boolean;
  magicByteRev: boolean;
  payloadVersion: 3 | 4;
};

type MagicBruteForceScanStats = {
  bestHamming: number;
  bestIndex: number;
  /** True if `bestHamming` came from a stream-bit-inverted window vs magic (diagnostic). */
  bestFromInvertedStream: boolean;
};

type BruteForceMagicSkipResult = {
  match: {
    offset: number;
    streamInvert: boolean;
    payloadVersion: 3 | 4;
  } | null;
  scanStats: MagicBruteForceScanStats;
};

/**
 * Scan `bits[i..i+32)` vs CGW\\x03 **or** CGW\\x04 with Hamming ≤ `MAGIC_HAMMING_MAX_ERRORS`.
 * Tries MSB-first-per-byte magic and LSB-first-per-byte magic; optional stream invert when
 * `!gapDecoderInverts`. Tracks global best Hamming for failure diagnostics.
 */
function bruteForceMagicSkip0To32(
  collapsedBits: number[],
  gapDecoderInverts: boolean
): BruteForceMagicSkipResult {
  const magic32MsbV3 = payloadBufferToBigEndianBits(
    WATERMARK_MAGIC_V3.subarray(0, 4)
  );
  const magic32LsbV3 = watermarkMagicFirstFourBytesLsbFirstBits(
    WATERMARK_MAGIC_V3.subarray(0, 4)
  );
  const magic32MsbV4 = payloadBufferToBigEndianBits(
    WATERMARK_MAGIC_V4.subarray(0, 4)
  );
  const magic32LsbV4 = watermarkMagicFirstFourBytesLsbFirstBits(
    WATERMARK_MAGIC_V4.subarray(0, 4)
  );

  let globalBestErr = 33;
  let globalBestIndex = -1;
  let globalBestFromInvertedStream = false;

  /** Prefer **stream-inverted** windows when Hamming ties (diagnostic + alignment). */
  function noteGlobalBest(
    err: number,
    idx: number,
    streamInverted: boolean
  ): void {
    if (
      err < globalBestErr ||
      (err === globalBestErr && streamInverted && !globalBestFromInvertedStream)
    ) {
      globalBestErr = err;
      globalBestIndex = idx;
      globalBestFromInvertedStream = streamInverted;
    }
  }

  /**
   * Any candidate with `err <= MAGIC_HAMMING_MAX_ERRORS` is accepted; pick best by lowest err,
   * then tie-break (when `gapDecoderInverts`, prefer **no** stream XOR to limit double-invert).
   * Prefer **v4** on tie (new embed format).
   */
  function pickAcceptable(
    candidates: MagicSkipCandidate[]
  ): MagicSkipCandidate | null {
    const ok = candidates.filter((c) =>
      hammingWithinMagicTolerance(Number(c.err))
    );
    if (ok.length === 0) return null;
    const preferStreamInvertOnTie = !gapDecoderInverts;
    ok.sort((a, b) => {
      if (a.err !== b.err) return a.err - b.err;
      if (a.payloadVersion !== b.payloadVersion)
        return b.payloadVersion - a.payloadVersion;
      if (a.streamInvert !== b.streamInvert) {
        if (preferStreamInvertOnTie) return a.streamInvert ? -1 : 1;
        return a.streamInvert ? 1 : -1;
      }
      if (a.magicByteRev !== b.magicByteRev)
        return a.magicByteRev ? 1 : -1;
      return 0;
    });
    return ok[0]!;
  }

  function candidatesAt(
    i: number,
    magic32Msb: number[],
    magic32Lsb: number[],
    payloadVersion: 3 | 4
  ): MagicSkipCandidate[] {
    const e0 = hamming32VsMagic(collapsedBits, i, magic32Msb, false);
    const e1 = hamming32VsMagic(collapsedBits, i, magic32Msb, true);
    const e2 = hamming32VsMagic(collapsedBits, i, magic32Lsb, false);
    const e3 = hamming32VsMagic(collapsedBits, i, magic32Lsb, true);
    noteGlobalBest(e1, i, true);
    noteGlobalBest(e3, i, true);
    noteGlobalBest(e0, i, false);
    noteGlobalBest(e2, i, false);
    return [
      { err: e0, streamInvert: false, magicByteRev: false, payloadVersion },
      { err: e1, streamInvert: true, magicByteRev: false, payloadVersion },
      { err: e2, streamInvert: false, magicByteRev: true, payloadVersion },
      { err: e3, streamInvert: true, magicByteRev: true, payloadVersion },
    ];
  }

  for (let i = 0; i <= MAGIC_BRUTE_FORCE_MAX_START_BIT; i++) {
    if (collapsedBits.length < i + 32) break;

    const candidates: MagicSkipCandidate[] = [
      ...candidatesAt(i, magic32MsbV3, magic32LsbV3, 3),
      ...candidatesAt(i, magic32MsbV4, magic32LsbV4, 4),
    ];

    const chosen = pickAcceptable(candidates);

    if (chosen) {
      return {
        match: {
          offset: i,
          streamInvert: chosen.streamInvert,
          payloadVersion: chosen.payloadVersion,
        },
        scanStats: {
          bestHamming: globalBestErr,
          bestIndex: globalBestIndex,
          bestFromInvertedStream: globalBestFromInvertedStream,
        },
      };
    }
  }

  return {
    match: null,
    scanStats: {
      bestHamming: globalBestErr,
      bestIndex: globalBestIndex,
      bestFromInvertedStream: globalBestFromInvertedStream,
    },
  };
}

function applyCollapsedStreamInvert(
  bits: number[],
  invert: boolean
): number[] {
  if (!invert) return bits;
  return bits.map((b) => (b & 1) ^ 1);
}

function collapsedLogicalBitCountForPayloadVersion(
  len: number,
  collapsedSkipBits: number,
  ver: 3 | 4
): number {
  if (ver === 3) return (6 + len) * 8 + collapsedSkipBits;
  return collapsedSkipBits + 48 + idEccLogicalBitCountV4(len);
}

/** First 32 logical bits of v4 payload = 4-byte magic (MSB-first stream); extra physical redundancy only there. */
const V4_MAGIC_HEADER_LOGICAL_BITS = 32;

/** v4 payload-only physical bits (after collapsed skip): magic × 2×R, remainder × R. */
function v4PayloadPhysicalBitCount(len: number): number {
  const Lc = 48 + idEccLogicalBitCountV4(len);
  return (
    V4_MAGIC_HEADER_LOGICAL_BITS * (2 * PHYSICAL_REDUNDANCY) +
    (Lc - V4_MAGIC_HEADER_LOGICAL_BITS) * PHYSICAL_REDUNDANCY
  );
}

/** All-0 / all-1 magic would repeat identical weak DCT tweaks across many blocks (visible grid). */
function assertV4MagicHeaderLogicalBitsNotDegenerate(
  logicalBits: number[]
): void {
  if (logicalBits.length < V4_MAGIC_HEADER_LOGICAL_BITS) {
    throw new Error(
      "Creator Guard DCT: v4 logical stream shorter than magic header"
    );
  }
  let ones = 0;
  for (let i = 0; i < V4_MAGIC_HEADER_LOGICAL_BITS; i++) {
    ones += logicalBits[i]! & 1;
  }
  if (ones === 0 || ones === V4_MAGIC_HEADER_LOGICAL_BITS) {
    throw new Error(
      "Creator Guard DCT: magic header (first 32 logical bits) cannot be all 0 or all 1"
    );
  }
}

function maxCollapsedLogicalBitCountForLen(
  len: number,
  collapsedSkipBits: number
): number {
  return Math.max(
    collapsedLogicalBitCountForPayloadVersion(len, collapsedSkipBits, 3),
    collapsedLogicalBitCountForPayloadVersion(len, collapsedSkipBits, 4)
  );
}

/** Physical stream length for payload version `ver`. */
function physicalStreamBitLengthForPayloadVersion(
  len: number,
  collapsedSkipBits: number,
  ver: 3 | 4
): number {
  if (ver === 3) {
    return (
      PHYSICAL_REDUNDANCY *
      collapsedLogicalBitCountForPayloadVersion(len, collapsedSkipBits, 3)
    );
  }
  return (
    collapsedSkipBits * PHYSICAL_REDUNDANCY + v4PayloadPhysicalBitCount(len)
  );
}

/** Worst-case physical bits for `len` (max of v3 raw vs v4 Hamming + magic redundancy). */
function maxPhysicalStreamBitLengthForLen(
  len: number,
  collapsedSkipBits: number
): number {
  return Math.max(
    PHYSICAL_REDUNDANCY *
      collapsedLogicalBitCountForPayloadVersion(len, collapsedSkipBits, 3),
    physicalStreamBitLengthForPayloadVersion(len, collapsedSkipBits, 4)
  );
}

/** v3: magic(4) + uint16BE len + utf8 id — contiguous stream bits after skip. */
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

/** v4: 48-bit header + Hamming(7,4) body for `len` UTF-8 bytes. */
function sliceCollapsedHeaderAndEccV4(
  collapsed: number[],
  idUtf8ByteLen: number,
  collapsedSkipBits: number
): { headerBits: number[]; eccBits: number[] } | null {
  if (idUtf8ByteLen < 1) return null;
  const eccLen = idEccLogicalBitCountV4(idUtf8ByteLen);
  const total = 48 + eccLen;
  const start = collapsedSkipBits;
  if (collapsed.length < start + total) return null;
  return {
    headerBits: collapsed.slice(start, start + 48),
    eccBits: collapsed.slice(start + 48, start + 48 + eccLen),
  };
}

/**
 * Per-block perceptual magnitude target (DCT gap).
 * **V4.8 luma ramp (140–250):** if **`yAvg > 140`** and **`variance ≤ 500`**, mag is **only** the bright ramp **[3, 8]** (then **`Y > 250` → 3**).
 * If **`yAvg > 140`** and **`variance > 500`**, **25** (edge). For **`yAvg ≤ 140`**: **`variance > 500` → 25**; **`Y < 40` → 8**; else **smooth 8 / textured 20**.
 * Independent of embedded **Member ID** / **userId** — uses only the 8×8 luma block.
 */
export function getAdaptiveMagnitude(luma: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < 64; i++) sum += luma[i]!;
  const yAvg = sum * (1 / 64);

  let varAcc = 0;
  for (let i = 0; i < 64; i++) {
    const d = luma[i]! - yAvg;
    varAcc += d * d;
  }
  const variance = varAcc * (1 / 64);

  if (yAvg > BRIGHT_RAMP_Y_LO) {
    if (variance > BLOCK_VAR_HIGH_CONTRAST_GT) {
      return EMBED_MAG_GAP_EDGE_CONTRAST;
    }
    if (yAvg > BRIGHT_RAMP_Y_HI) {
      return EMBED_MAG_GAP_NEAR_WHITE;
    }
    const span = BRIGHT_RAMP_Y_HI - BRIGHT_RAMP_Y_LO;
    const ramp = Math.round(
      EMBED_MAG_GAP_LUMA_EXTREME -
        ((yAvg - BRIGHT_RAMP_Y_LO) / span) *
          (EMBED_MAG_GAP_LUMA_EXTREME - EMBED_MAG_GAP_NEAR_WHITE)
    );
    return Math.min(
      Math.max(ramp, EMBED_MAG_GAP_NEAR_WHITE),
      EMBED_MAG_GAP_LUMA_EXTREME
    );
  }

  if (variance > BLOCK_VAR_HIGH_CONTRAST_GT) {
    return EMBED_MAG_GAP_EDGE_CONTRAST;
  }

  if (yAvg < LUMA_AVG_SHADOW_MAX) {
    return EMBED_MAG_GAP_LUMA_EXTREME;
  }

  if (variance < BLOCK_VAR_SMOOTH_LT) {
    return EMBED_MAG_GAP_SMOOTH;
  }
  return EMBED_MAG_GAP_TEXTURED;
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

/** Post-alignment payload probe when fuzzy magic matched but strict decode did not (API / UI). */
export type WatermarkExtractForceExtractDebug = {
  failedAt: "length" | "utf8" | "empty";
  /** Hex of payload bytes 4–5 (uint16BE declared length) when available, else `""`. */
  rawLengthHex: string;
  lastCandidateLen: number | null;
};

/** Collapsed-stream diagnostic from magic brute-force (API / browser visibility). */
export type WatermarkExtractDebugSnapshot = {
  collapsedLen: number;
  first64: string;
  bestHamming: number;
  bestIndex: number;
  /** Whether `bestHamming` favored a stream-XOR window vs canonical magic. */
  bestFromInvertedStream: boolean;
  /** Set when brute-force aligned magic but `magic_missing` (or utf8 path below). */
  forceExtract?: WatermarkExtractForceExtractDebug;
  /**
   * Blind UTF-8 after magic (10B + 16B windows), printable-stripped previews — even when no accept.
   */
  blindCleanedPreview?: string;
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

const DCT_INV_SQRT2 = 1 / Math.SQRT2;
/** `cos((2*x+1)*u*π/16)` for `x,u ∈ [0,7]` — index `x * 8 + u` (avoids `Math.cos` in hot loops). */
const DCT_COS_XU = new Float32Array(64);
for (let x = 0; x < 8; x++) {
  for (let u = 0; u < 8; u++) {
    DCT_COS_XU[x * 8 + u] = Math.cos(((2 * x + 1) * u * Math.PI) / 16);
  }
}

/** 8×8 DCT into `out` (64 floats); uses `DCT_COS_XU` only — no `Math.cos` in the hot path. */
function dct8x8Into(pixels: Float32Array, out: Float32Array): void {
  for (let u = 0; u < 8; u++) {
    const cu = u === 0 ? DCT_INV_SQRT2 : 1;
    for (let v = 0; v < 8; v++) {
      const cv = v === 0 ? DCT_INV_SQRT2 : 1;
      let sum = 0;
      for (let x = 0; x < 8; x++) {
        const cx = DCT_COS_XU[x * 8 + u]!;
        for (let y = 0; y < 8; y++) {
          sum += pixels[x * 8 + y]! * cx * DCT_COS_XU[y * 8 + v]!;
        }
      }
      out[u * 8 + v] = 0.25 * cu * cv * sum;
    }
  }
}

function dct8x8(pixels: Float32Array): Float32Array {
  const out = new Float32Array(64);
  dct8x8Into(pixels, out);
  return out;
}

function idct8x8Into(coeffs: Float32Array, out: Float32Array): void {
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      let sum = 0;
      for (let u = 0; u < 8; u++) {
        const cu = u === 0 ? DCT_INV_SQRT2 : 1;
        const cux = DCT_COS_XU[x * 8 + u]!;
        for (let v = 0; v < 8; v++) {
          const cv = v === 0 ? DCT_INV_SQRT2 : 1;
          sum += cu * cv * coeffs[u * 8 + v]! * cux * DCT_COS_XU[y * 8 + v]!;
        }
      }
      out[x * 8 + y] = 0.25 * sum;
    }
  }
}

function idct8x8(coeffs: Float32Array): Float32Array {
  const out = new Float32Array(64);
  idct8x8Into(coeffs, out);
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

/** 8×8 luma into `out` (length ≥ 64); layout x*8+y matches dct8x8. */
function readLumaBlockInto(
  data: Buffer,
  width: number,
  height: number,
  bx: number,
  by: number,
  out: Float32Array
): void {
  let i = 0;
  for (let dx = 0; dx < 8; dx++) {
    for (let dy = 0; dy < 8; dy++) {
      const x = bx * 8 + dx;
      const y = by * 8 + dy;
      if (x < 0 || x >= width || y < 0 || y >= height) {
        out[i++] = 0;
        continue;
      }
      const o = (y * width + x) * 4;
      out[i++] = bt601LumaFromRgb(data[o]!, data[o + 1]!, data[o + 2]!);
    }
  }
}

/** 8×8 luma samples; layout x*8+y matches dct8x8. Raster walk: dx 0..7, dy 0..7. */
function readLumaBlock(
  data: Buffer,
  width: number,
  height: number,
  bx: number,
  by: number
): Float32Array {
  const p = new Float32Array(64);
  readLumaBlockInto(data, width, height, bx, by, p);
  return p;
}

function applyBlockDeltaToRgb(
  data: Buffer,
  width: number,
  height: number,
  bx: number,
  by: number,
  delta: Float32Array,
  opts?: { targetBit?: number; magGapTarget?: number }
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

  // Zero-tolerance: integer RGB clamp shrinks the DCT magnitude margin from the ideal IDCT delta.
  const tb = opts?.targetBit;
  const gapT = opts?.magGapTarget ?? EMBED_MAG_GAP_LUMA_EXTREME;
  if (
    tb !== undefined &&
    readBitFromBlock(data, width, height, bx, by) === tb
  ) {
    for (let guard = 0; guard < 8; guard++) {
      const mg = blockMagGap(data, width, height, bx, by);
      const ok =
        tb === 1 ? mg >= gapT : mg <= -gapT;
      if (ok && readBitFromBlock(data, width, height, bx, by) === tb) break;
      enforceMinDctGapAfterClamp(data, width, height, bx, by, tb, gapT);
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

/** Signed `|coeff[COEFF_A]| − |coeff[COEFF_B]|` (Steel read/embed classification). */
function midfreqAbsMagGapFromCoeff(coeff: Float32Array): number {
  return Math.abs(coeff[COEFF_A]!) - Math.abs(coeff[COEFF_B]!);
}

/** `|DCT(COEFF_A)| − |DCT(COEFF_B)|` after luma → DCT (Steel magnitude protocol). */
function blockMagGap(
  data: Buffer,
  width: number,
  height: number,
  bx: number,
  by: number
): number {
  const coeff = dct8x8(readLumaBlock(data, width, height, bx, by));
  return midfreqAbsMagGapFromCoeff(coeff);
}

function embedSatisfiesMagProtocol(
  data: Buffer,
  width: number,
  height: number,
  bx: number,
  by: number,
  bit: number,
  magGapTarget: number
): boolean {
  const mg = blockMagGap(data, width, height, bx, by);
  return bit === 1 ? mg >= magGapTarget : mg <= -magGapTarget;
}

/**
 * After IDCT+clamp, widen **magnitude** gap without flipping the stored bit.
 */
function enforceMinDctGapAfterClamp(
  data: Buffer,
  width: number,
  height: number,
  bx: number,
  by: number,
  bit: number,
  magGapTarget: number
): void {
  const snap = new Uint8Array(64 * 3);

  for (let step = 0; step < GAP_ENFORCE_MAX_STEPS; step++) {
    const mg = blockMagGap(data, width, height, bx, by);
    const ok =
      bit === 1 ? mg >= magGapTarget : mg <= -magGapTarget;
    if (ok && readBitFromBlock(data, width, height, bx, by) === bit) return;

    copyBlockRgb(data, width, height, bx, by, snap);
    const dir = (bit === 1 ? 1 : -1) as -1 | 1;
    if (!bumpBlockRgbUniform(data, width, height, bx, by, dir)) return;

    if (readBitFromBlock(data, width, height, bx, by) !== bit) {
      pasteBlockRgb(data, width, height, bx, by, snap);
      return;
    }
    const mg2 = blockMagGap(data, width, height, bx, by);
    const better = bit === 1 ? mg2 > mg : mg2 < mg;
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

/**
 * Vercel-speed path: **skip ~50%** of interior blocks (even `bx+by`), and only blocks whose
 * center pixel lies in the **middle 70%** of width/height (15% margin each edge).
 * Embed/extract share the same ordered index list `0..embedBlockCount-1` for the physical stream.
 */
function blockEligibleForSparseEmbed(
  bx: number,
  by: number,
  width: number,
  height: number
): boolean {
  if (((bx + by) & 1) === 0) return false;
  const cx = bx * 8 + 4;
  const cy = by * 8 + 4;
  const m = 0.15;
  const xLo = width * m;
  const xHi = width * (1 - m);
  const yLo = height * m;
  const yHi = height * (1 - m);
  return cx >= xLo && cx <= xHi && cy >= yLo && cy <= yHi;
}

function buildSparseEmbedBlockIndices(
  width: number,
  height: number,
  bw: number,
  bh: number
): number[] {
  const total = bw * bh;
  const out: number[] = [];
  for (let k = 0; k < total; k++) {
    const { bx, by } = blockIndexToCoords(k, bw);
    if (blockEligibleForSparseEmbed(bx, by, width, height)) {
      out.push(k);
    }
  }
  return out;
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

  const luma = new Float32Array(64);
  const coeff = new Float32Array(64);
  const idctOut = new Float32Array(64);
  const delta = new Float32Array(64);

  readLumaBlockInto(data, width, height, bx, by, luma);
  const magPrimary = getAdaptiveMagnitude(luma);

  function attemptWithMagGapTarget(magGapTarget: number): boolean {
    let scale = 1;
    for (let iter = 0; iter < EMBED_VERIFY_ITERS; iter++) {
      pasteBlockRgb(data, width, height, bx, by, saved);

      readLumaBlockInto(data, width, height, bx, by, luma);
      dct8x8Into(luma, coeff);
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
      idct8x8Into(coeff, idctOut);
      for (let i = 0; i < 64; i++) {
        delta[i] = idctOut[i]! - luma[i]!;
      }
      applyBlockDeltaToRgb(data, width, height, bx, by, delta, {
        targetBit: bit,
        magGapTarget,
      });

      if (
        readBitFromBlock(data, width, height, bx, by) === bit &&
        embedSatisfiesMagProtocol(
          data,
          width,
          height,
          bx,
          by,
          bit,
          magGapTarget
        )
      ) {
        return true;
      }
      scale = Math.min(scale * EMBED_SCALE_GROWTH, EMBED_SCALE_MAX);
    }
    return false;
  }

  if (attemptWithMagGapTarget(magPrimary)) return;
  pasteBlockRgb(data, width, height, bx, by, saved);
  if (magPrimary > EMBED_MAG_GAP_RELAXED_STEP) {
    if (attemptWithMagGapTarget(EMBED_MAG_GAP_RELAXED_STEP)) return;
    pasteBlockRgb(data, width, height, bx, by, saved);
  }
  if (magPrimary > EMBED_MAG_GAP_ULTRA_RELAXED) {
    attemptWithMagGapTarget(EMBED_MAG_GAP_ULTRA_RELAXED);
  }
}

/**
 * Classify signed magnitude gap vs ±`threshold` (per-block adaptive in production).
 * Tie-break in ambiguous band uses sign of gap. `invert` matches extract XOR path only.
 */
function magGapToBitWithThreshold(
  magGap: number,
  threshold: number,
  invert: boolean
): number {
  let b: number;
  if (magGap > threshold) b = 1;
  else if (magGap < -threshold) b = 0;
  else b = magGap >= 0 ? 1 : 0;
  return invert ? b ^ 1 : b;
}

/**
 * Extract: same `getAdaptiveMagnitude` / threshold policy as embed (current pixel luma).
 * `thresholdBias` — deep-scan only: shift detection band by ±1 vs tier default.
 */
function decodeBitFromMidfreqGapForExtract(
  coeff: Float32Array,
  luma: Float32Array,
  thresholdBias = 0
): number {
  const magTarget = getAdaptiveMagnitude(luma);
  const t = extractBitThresholdForMagTarget(magTarget, thresholdBias);
  return magGapToBitWithThreshold(
    midfreqAbsMagGapFromCoeff(coeff),
    t,
    EXTRACT_INVERT_DCT_GAP_DECODER
  );
}

/** Embed/verify: Steel magnitude protocol; threshold tracks adaptive mag tier (matches extract). */
function readBitFromBlock(
  data: Buffer,
  width: number,
  height: number,
  bx: number,
  by: number
): number {
  const luma = readLumaBlock(data, width, height, bx, by);
  const magTarget = getAdaptiveMagnitude(luma);
  const t = extractBitThresholdForMagTarget(magTarget, 0);
  const coeff = dct8x8(luma);
  return magGapToBitWithThreshold(midfreqAbsMagGapFromCoeff(coeff), t, false);
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
  const expected = WATERMARK_MAGIC_V4.subarray(0, 4).toString("hex");
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
    expectedMagicHead4: WATERMARK_MAGIC_V4.subarray(0, 4).toString("hex"),
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

/** Each logical payload bit → `PHYSICAL_REDUNDANCY` identical physical bits (cyclic in blocks). */
function tripleExpandPayloadBits(bits: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < bits.length; i++) {
    const b = bits[i]! & 1;
    for (let t = 0; t < PHYSICAL_REDUNDANCY; t++) out.push(b);
  }
  return out;
}

/** v4: first 32 logical bits (magic) → `2 * PHYSICAL_REDUNDANCY` physical copies each; rest → R each. */
function tripleExpandV4PayloadBits(bits: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < bits.length; i++) {
    const b = bits[i]! & 1;
    const r =
      i < V4_MAGIC_HEADER_LOGICAL_BITS
        ? 2 * PHYSICAL_REDUNDANCY
        : PHYSICAL_REDUNDANCY;
    for (let t = 0; t < r; t++) out.push(b);
  }
  return out;
}

/** Invert expand: one logical bit per `PHYSICAL_REDUNDANCY` physical slots (embed majority). */
function collapseTriplePhysicalBits(physical: number[]): number[] | null {
  if (physical.length % PHYSICAL_REDUNDANCY !== 0) return null;
  const out: number[] = [];
  for (let i = 0; i < physical.length; i += PHYSICAL_REDUNDANCY) {
    const chunk = physical.slice(i, i + PHYSICAL_REDUNDANCY);
    out.push(majority(chunk));
  }
  return out;
}

function logicalBitFromTripleVotesExtract(votes: number[]): number {
  if (!EXTRACT_TRIPLE_REQUIRE_UNANIMOUS_FOR_ONE) {
    return majority(votes);
  }
  for (const v of votes) {
    if ((v & 1) === 0) return 0;
  }
  return 1;
}

/** Extract path: unanimous vs majority (see `EXTRACT_TRIPLE_REQUIRE_UNANIMOUS_FOR_ONE`). */
function collapseTriplePhysicalBitsForExtract(
  physical: number[]
): number[] | null {
  if (physical.length % PHYSICAL_REDUNDANCY !== 0) return null;
  const out: number[] = [];
  for (let i = 0; i < physical.length; i += PHYSICAL_REDUNDANCY) {
    const chunk = physical.slice(i, i + PHYSICAL_REDUNDANCY);
    out.push(logicalBitFromTripleVotesExtract(chunk));
  }
  return out;
}

/** v4 extract: variable chunk size 2×R then R after first 32 logical bits recovered. */
function collapseV4PhysicalBitsForExtract(physical: number[]): number[] | null {
  const out: number[] = [];
  let i = 0;
  while (i < physical.length) {
    const r =
      out.length < V4_MAGIC_HEADER_LOGICAL_BITS
        ? 2 * PHYSICAL_REDUNDANCY
        : PHYSICAL_REDUNDANCY;
    if (i + r > physical.length) return null;
    const chunk = physical.slice(i, i + r);
    out.push(logicalBitFromTripleVotesExtract(chunk));
    i += r;
  }
  return out;
}

function collapsePhysicalBitsForExtract(
  physical: number[],
  ver: 3 | 4
): number[] | null {
  if (ver === 3) {
    return collapseTriplePhysicalBitsForExtract(physical);
  }
  return collapseV4PhysicalBitsForExtract(physical);
}

const EMERGENCY_SUSPICIOUS_DECLARED_LEN = 100;
const EMERGENCY_FIXED_USER_ID_LENS = [12, 16] as const;

function tryEmergencyFixedMemberLenExtract(
  blockBits: number[],
  count: number,
  magicSkipBits: number,
  streamInvertCollapsed: boolean,
  fixedUserIdLen: 12 | 16
): string | null {
  const len = fixedUserIdLen;
  for (const ver of [4, 3] as const) {
    const Lphy = physicalStreamBitLengthForPayloadVersion(
      len,
      magicSkipBits,
      ver
    );
    if (count < Lphy) continue;
    const allBits = reconstructBigEndianBitsFromBlocks(blockBits, count, Lphy);
    if (!allBits || allBits.length !== Lphy) continue;
    const collapsedRaw = collapsePhysicalBitsForExtract(allBits, ver);
    const needCollapsed = collapsedLogicalBitCountForPayloadVersion(
      len,
      magicSkipBits,
      ver
    );
    if (!collapsedRaw || collapsedRaw.length !== needCollapsed) continue;
    const collapsed = applyCollapsedStreamInvert(
      collapsedRaw,
      streamInvertCollapsed
    );

    if (ver === 3) {
      const payloadBits = sliceCollapsedPayloadBits(
        collapsed,
        6 + len,
        magicSkipBits
      );
      if (!payloadBits || payloadBits.length !== (6 + len) * 8) continue;
      const buf = bigEndianBitsToBuffer(payloadBits, 6 + len);
      if (!buf || buf.length < 6 + len) continue;
      if (
        buf[0] !== 0x43 ||
        buf[1] !== 0x47 ||
        buf[2] !== 0x57 ||
        buf[3] !== 0x03
      ) {
        continue;
      }
      const raw = buf.subarray(6, 6 + len);
      try {
        return new TextDecoder("utf-8", { fatal: false }).decode(raw);
      } catch {
        continue;
      }
    } else {
      const parts = sliceCollapsedHeaderAndEccV4(
        collapsed,
        len,
        magicSkipBits
      );
      if (!parts) continue;
      const buf = bigEndianBitsToBuffer(parts.headerBits, 6);
      if (!buf || buf.length < 6) continue;
      if (
        buf[0] !== 0x43 ||
        buf[1] !== 0x47 ||
        buf[2] !== 0x57 ||
        buf[3] !== 0x04
      ) {
        continue;
      }
      if (buf.readUInt16BE(4) !== len) continue;
      const idBits = hamming74DecodeStream(parts.eccBits, len * 8);
      if (!idBits) continue;
      const idBuf = bigEndianBitsToBuffer(idBits, len);
      if (!idBuf) continue;
      try {
        return new TextDecoder("utf-8", { fatal: false }).decode(idBuf);
      } catch {
        continue;
      }
    }
  }
  return null;
}

/** Bits after the 32-bit magic: 10 bytes then 16 bytes, length field ignored. */
const BLIND_AFTER_MAGIC_BIT_WINDOWS = [80, 128] as const;
/** Payload `len` so collapsed stream covers magic + 128 bits blind window. */
const BLIND_PHYSICAL_SURROGATE_USER_LEN = 16;
const BLIND_MIN_CLEANED_LEN = 5;
const BLIND_MIN_LETTER_OR_DIGIT = 3;

function blindExtractStripNonPrintable(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c >= 32 && c <= 126) {
      out += ch;
      continue;
    }
    if (c > 127 && /\p{L}|\p{N}/u.test(ch)) {
      out += ch;
    }
  }
  return out;
}

function countLettersOrDigits(s: string): number {
  let n = 0;
  for (const ch of s) {
    if (/[\p{L}\p{N}]/u.test(ch)) n++;
  }
  return n;
}

type BlindExtractOutcome = {
  userId: string | null;
  /** Joined previews from 10B + 16B windows (printable-stripped), for `debugSnapshot`. */
  blindCleanedPreview: string;
};

/**
 * After fuzzy magic alignment: raw UTF-8 from collapsed bits immediately after the 32-bit magic.
 * Accept if trimmed `cleaned` length ≥ 5 **or** ≥ 3 letters/digits (Unicode) in `cleaned`.
 */
function tryBlindExtractAfterMagicMarker(
  blockBits: number[],
  count: number,
  magicSkipBits: number,
  streamInvertCollapsed: boolean
): BlindExtractOutcome {
  const empty = (): BlindExtractOutcome => ({
    userId: null,
    blindCleanedPreview: "",
  });

  const len = BLIND_PHYSICAL_SURROGATE_USER_LEN;
  const needCollapsedLogical = magicSkipBits + 32 + 128;
  if (
    maxCollapsedLogicalBitCountForLen(len, magicSkipBits) < needCollapsedLogical
  ) {
    return empty();
  }

  const decoder = new TextDecoder("utf-8", { fatal: false });
  const previewParts: string[] = [];

  for (const ver of [4, 3] as const) {
    if (
      collapsedLogicalBitCountForPayloadVersion(len, magicSkipBits, ver) <
      needCollapsedLogical
    ) {
      continue;
    }
    const Lphy = physicalStreamBitLengthForPayloadVersion(
      len,
      magicSkipBits,
      ver
    );
    if (count < Lphy) continue;
    const allBits = reconstructBigEndianBitsFromBlocks(blockBits, count, Lphy);
    if (!allBits || allBits.length !== Lphy) continue;
    const collapsedRaw = collapsePhysicalBitsForExtract(allBits, ver);
    const needCollapsed = collapsedLogicalBitCountForPayloadVersion(
      len,
      magicSkipBits,
      ver
    );
    if (!collapsedRaw || collapsedRaw.length !== needCollapsed) continue;
    const collapsed = applyCollapsedStreamInvert(
      collapsedRaw,
      streamInvertCollapsed
    );
    const startBit = magicSkipBits + 32;
    if (collapsed.length < startBit + 128) continue;

    for (const winBits of BLIND_AFTER_MAGIC_BIT_WINDOWS) {
      const slice = collapsed.slice(startBit, startBit + winBits);
      if (slice.length < winBits) continue;
      const byteLen = winBits / 8;
      const buf = bigEndianBitsToBuffer(slice, byteLen);
      if (!buf) continue;
      const raw = decoder.decode(buf);
      const cleaned = blindExtractStripNonPrintable(raw);
      const prevSnippet = cleaned.slice(0, 96);
      previewParts.push(`${winBits}b:${prevSnippet}`);
      const trimmed = cleaned.trim();
      const alnumish = countLettersOrDigits(cleaned);
      const longEnough = trimmed.length >= BLIND_MIN_CLEANED_LEN;
      const alnumOk = alnumish >= BLIND_MIN_LETTER_OR_DIGIT;
      if (longEnough || alnumOk) {
        const userId = trimmed.length > 0 ? trimmed : raw.trim();
        if (userId.length === 0) continue;
        return {
          userId,
          blindCleanedPreview: previewParts.join(" | ").slice(0, 500),
        };
      }
    }
  }

  return {
    userId: null,
    blindCleanedPreview: previewParts.join(" | ").slice(0, 500),
  };
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

/**
 * Embed Member ID into raw RGBA `data` (row-major RGBA, `width`×`height`).
 * Prefer this from API routes to avoid an extra wrapper object on the hot path.
 */
export function embedMemberIdDctInBitmap(
  data: Buffer,
  width: number,
  height: number,
  userId: string
): void {
  flattenBitmapToOpaqueRgb({ data, width, height });

  if (height < MIN_EMBED_HEIGHT_PX) {
    const { count } = blockGridDims(width, height);
    throw new WatermarkEmbedCapacityError(
      `Image height too small for DCT watermark: need at least ${MIN_EMBED_HEIGHT_PX}px, have ${height}px`,
      1,
      count
    );
  }

  const utf8 = Buffer.from(userId, "utf8");
  if (utf8.length > MAX_USER_ID_BYTES) {
    throw new Error("Member ID too long for DCT watermark");
  }
  const payload = Buffer.alloc(4 + 2 + utf8.length);
  WATERMARK_MAGIC_V4.copy(payload, 0);
  payload.writeUInt16BE(utf8.length, 4);
  utf8.copy(payload, 6);

  const headerBits = payloadBufferToBigEndianBits(payload.subarray(0, 6));
  const idBits = payloadBufferToBigEndianBits(utf8);
  const eccBits = hamming74EncodeStream(idBits);
  const logicalBits = headerBits.concat(eccBits);
  assertV4MagicHeaderLogicalBitsNotDegenerate(logicalBits);
  const expandedBits = tripleExpandV4PayloadBits(logicalBits);
  const Lphy = expandedBits.length;
  const { bw, bh, count, fullBw, fullBh } = blockGridDims(width, height);
  const sparseK = buildSparseEmbedBlockIndices(width, height, bw, bh);
  const embedBlockCount = sparseK.length;

  if (embedBlockCount < Lphy) {
    throw new WatermarkEmbedCapacityError(
      `Image too small for sparse DCT watermark: need at least ${Lphy} eligible 8×8 blocks (checkerboard + central 70%, Steel ${PHYSICAL_REDUNDANCY}×), have ${embedBlockCount} (full interior ${count}; ${bw}×${bh}; full grid ${fullBw}×${fullBh})`,
      Lphy,
      embedBlockCount
    );
  }

  for (let i = 0; i < embedBlockCount; i++) {
    const k = sparseK[i]!;
    const { bx, by } = blockIndexToCoords(k, bw);
    const bit = expandedBits[i % Lphy]!;
    embedBitInBlock(data, width, height, bx, by, bit);
  }

  enforceBitmapOpaque(data, width, height);
  flattenBitmapToOpaqueRgb({ data, width, height });
}

export function embedMemberIdDct(image: BitmapLike, userId: string): void {
  embedMemberIdDctInBitmap(
    image.bitmap.data,
    image.bitmap.width,
    image.bitmap.height,
    userId
  );
}

function buildExtractSparseBlockBits(
  data: Buffer,
  width: number,
  height: number,
  sparseK: number[],
  embedBlockCount: number,
  bw: number,
  thresholdBias: number
): number[] {
  const blockBits: number[] = new Array(embedBlockCount);
  for (let i = 0; i < embedBlockCount; i++) {
    const k = sparseK[i]!;
    const { bx, by } = blockIndexToCoords(k, bw);
    const luma = readLumaBlock(data, width, height, bx, by);
    const coeff = dct8x8(luma);
    blockBits[i] = decodeBitFromMidfreqGapForExtract(
      coeff,
      luma,
      thresholdBias
    );
  }
  return blockBits;
}

export function extractMemberIdDctDetailed(
  image: BitmapLike,
  _options?: { includeDebug?: boolean }
): WatermarkExtractResult {
  flattenBitmapToOpaqueRgb(image.bitmap);
  const { data, width, height } = image.bitmap;
  enforceBitmapOpaque(data, width, height);

  const { bw, bh, count, fullBw, fullBh } = blockGridDims(width, height);
  const sparseK = buildSparseEmbedBlockIndices(width, height, bw, bh);
  const embedBlockCount = sparseK.length;

  if (width < 16 || height < 16 || count === 0 || embedBlockCount === 0) {
    return { ok: false, code: "capacity" };
  }

  /**
   * Auto-align: search collapsed logical stream for CGW\\x03 or CGW\\x04 (raw + stream XOR).
   * `magicSkipBits` + `streamInvertCollapsed` are the production settings for this image.
   */
  function runExtractWithBlockBits(blockBits: number[]): WatermarkExtractResult {
  let magicSkipBits = EXTRACT_COLLAPSED_LEADING_SKIP_FALLBACK;
  let streamInvertCollapsed = false;

  function loadAuditsForSkip(skip: number): {
    auditPhysicalLen1: number[] | null;
    auditCollapsedLen1: number[] | null;
    auditCollapsedLen10: number[] | null;
  } {
    let auditPhysicalLen1: number[] | null = null;
    let auditCollapsedLen1: number[] | null = null;
    let auditCollapsedLen10: number[] | null = null;

    for (const ver of [4, 3] as const) {
      const Lphy1 = physicalStreamBitLengthForPayloadVersion(1, skip, ver);
      if (embedBlockCount < Lphy1) continue;
      const p1 = reconstructBigEndianBitsFromBlocks(
        blockBits,
        embedBlockCount,
        Lphy1
      );
      if (!p1 || p1.length !== Lphy1) continue;
      const c1 = collapsePhysicalBitsForExtract(p1, ver);
      const need1 = collapsedLogicalBitCountForPayloadVersion(1, skip, ver);
      if (!c1 || c1.length !== need1) continue;
      auditPhysicalLen1 = p1;
      auditCollapsedLen1 = c1;
      break;
    }

    for (const ver of [4, 3] as const) {
      const Lphy10 = physicalStreamBitLengthForPayloadVersion(10, skip, ver);
      if (embedBlockCount < Lphy10) continue;
      const p10 = reconstructBigEndianBitsFromBlocks(
        blockBits,
        embedBlockCount,
        Lphy10
      );
      if (!p10 || p10.length !== Lphy10) continue;
      const c10 = collapsePhysicalBitsForExtract(p10, ver);
      const need10 = collapsedLogicalBitCountForPayloadVersion(10, skip, ver);
      if (!c10 || c10.length !== need10) continue;
      auditCollapsedLen10 = c10;
      break;
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
    bestFromInvertedStream: false,
  };
  let hadBruteMagicMatch = false;
  if (auditCollapsedLen10 !== null && auditCollapsedLen10.length >= 32) {
    const brute = bruteForceMagicSkip0To32(
      auditCollapsedLen10,
      EXTRACT_INVERT_DCT_GAP_DECODER
    );
    magicBruteScanStats = brute.scanStats;
    if (brute.match) {
      hadBruteMagicMatch = true;
      const found = brute.match;
      if (found.offset !== magicSkipBits) {
        magicSkipBits = found.offset;
        ({ auditPhysicalLen1, auditCollapsedLen1, auditCollapsedLen10 } =
          loadAuditsForSkip(magicSkipBits));
      }
      streamInvertCollapsed = found.streamInvert;
    }
  }

  let forceExtractProbe: WatermarkExtractForceExtractDebug | null = null;
  let maxDeclaredUint16Seen = 0;

  const minInteriorBlocks = magicSkipBits + 32;

  const verifyDebug: WatermarkVerifyExtractDebug =
    buildWatermarkVerifyExtractDebug({
      auditPhysicalLen1,
      auditCollapsedLen1,
      auditCollapsedLen10,
      blockBits,
      bw,
      bh,
      count: embedBlockCount,
      fullBw,
      fullBh,
      magicSkipBits,
      streamInvertCollapsed,
    });

  if (embedBlockCount < minInteriorBlocks) {
    console.warn(
      "[Creator Guard DCT] interior_blocks_below_magic_skip_plus_32",
      {
        count: embedBlockCount,
        minInteriorBlocks,
        magicSkipBits,
      }
    );
    return { ok: false, code: "capacity", debug: verifyDebug };
  }

  const minBlocksPhysicalLen1 = maxPhysicalStreamBitLengthForLen(1, magicSkipBits);
  if (embedBlockCount < minBlocksPhysicalLen1) {
    console.warn(
      "[Creator Guard DCT] insufficient_interior_blocks_for_physical_stream_len1",
      {
        count: embedBlockCount,
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
    for (const ver of [4, 3] as const) {
      const Lphy = physicalStreamBitLengthForPayloadVersion(
        len,
        magicSkipBits,
        ver
      );
      if (embedBlockCount < Lphy) {
        continue;
      }

      const allBits = reconstructBigEndianBitsFromBlocks(
        blockBits,
        embedBlockCount,
        Lphy
      );
      if (!allBits || allBits.length !== Lphy) {
        continue;
      }

      const collapsedRaw = collapsePhysicalBitsForExtract(allBits, ver);
      const needCollapsed = collapsedLogicalBitCountForPayloadVersion(
        len,
        magicSkipBits,
        ver
      );
      if (!collapsedRaw || collapsedRaw.length !== needCollapsed) {
        if (hadBruteMagicMatch) {
          forceExtractProbe = {
            failedAt: "empty",
            rawLengthHex: "",
            lastCandidateLen: len,
          };
        }
        continue;
      }

      const collapsed = applyCollapsedStreamInvert(
        collapsedRaw,
        streamInvertCollapsed
      );

      if (ver === 3) {
        const payloadBits = sliceCollapsedPayloadBits(
          collapsed,
          6 + len,
          magicSkipBits
        );
        if (!payloadBits || payloadBits.length !== (6 + len) * 8) {
          if (hadBruteMagicMatch) {
            forceExtractProbe = {
              failedAt: "length",
              rawLengthHex: "",
              lastCandidateLen: len,
            };
          }
          continue;
        }

        const buf = bigEndianBitsToBuffer(payloadBits, 6 + len);
        if (!buf || buf.length < 6 + len) {
          if (hadBruteMagicMatch) {
            forceExtractProbe = {
              failedAt: "length",
              rawLengthHex: "",
              lastCandidateLen: len,
            };
          }
          continue;
        }

        const packedDeclLen = buf.readUInt16BE(4);
        if (packedDeclLen > maxDeclaredUint16Seen) {
          maxDeclaredUint16Seen = packedDeclLen;
        }

        const rawLengthHex = buf.subarray(4, 6).toString("hex");
        const declaredLenBits32_47 = uint16BEFromBits32Through47(payloadBits);
        if (declaredLenBits32_47 === null || declaredLenBits32_47 !== len) {
          if (hadBruteMagicMatch) {
            forceExtractProbe = {
              failedAt: "length",
              rawLengthHex,
              lastCandidateLen: len,
            };
          }
          continue;
        }

        const declaredFromPacked = buf.readUInt16BE(4);
        if (declaredFromPacked !== declaredLenBits32_47) {
          if (hadBruteMagicMatch) {
            forceExtractProbe = {
              failedAt: "length",
              rawLengthHex,
              lastCandidateLen: len,
            };
          }
          continue;
        }

        if (buf[0] === 0x43 && buf[1] === 0x47 && buf[2] === 0x57) {
          if (buf[3] !== 0x03) {
            if (buf[3] !== 0x04) {
              return {
                ok: false,
                code: "unsupported_version",
                debug: verifyDebug,
              };
            }
            continue;
          }
        } else {
          if (hadBruteMagicMatch) {
            forceExtractProbe = {
              failedAt: "length",
              rawLengthHex,
              lastCandidateLen: len,
            };
          }
          continue;
        }
        const raw = buf.subarray(6, 6 + len);
        try {
          const userId = new TextDecoder("utf-8", { fatal: true }).decode(raw);
          return { ok: true, userId };
        } catch {
          if (hadBruteMagicMatch) {
            forceExtractProbe = {
              failedAt: "utf8",
              rawLengthHex,
              lastCandidateLen: len,
            };
          }
          return {
            ok: false,
            code: "utf8_corrupt",
            debug: verifyDebug,
            debugSnapshot: hadBruteMagicMatch
              ? {
                  collapsedLen: (auditCollapsedLen10 ?? []).length,
                  first64: Array.from(
                    (auditCollapsedLen10 ?? []).slice(0, 64)
                  )
                    .map((b) => String(b & 1))
                    .join(""),
                  bestHamming: magicBruteScanStats.bestHamming,
                  bestIndex: magicBruteScanStats.bestIndex,
                  bestFromInvertedStream:
                    magicBruteScanStats.bestFromInvertedStream,
                  forceExtract: forceExtractProbe ?? {
                    failedAt: "utf8",
                    rawLengthHex,
                    lastCandidateLen: len,
                  },
                }
              : undefined,
          };
        }
      } else {
        const parts = sliceCollapsedHeaderAndEccV4(
          collapsed,
          len,
          magicSkipBits
        );
        if (!parts) {
          if (hadBruteMagicMatch) {
            forceExtractProbe = {
              failedAt: "length",
              rawLengthHex: "",
              lastCandidateLen: len,
            };
          }
          continue;
        }

        const buf = bigEndianBitsToBuffer(parts.headerBits, 6);
        if (!buf || buf.length < 6) {
          if (hadBruteMagicMatch) {
            forceExtractProbe = {
              failedAt: "length",
              rawLengthHex: "",
              lastCandidateLen: len,
            };
          }
          continue;
        }

        const packedDeclLen = buf.readUInt16BE(4);
        if (packedDeclLen > maxDeclaredUint16Seen) {
          maxDeclaredUint16Seen = packedDeclLen;
        }

        const rawLengthHex = buf.subarray(4, 6).toString("hex");
        const declaredLenBits32_47 = uint16BEFromBits32Through47(
          parts.headerBits
        );
        if (declaredLenBits32_47 === null || declaredLenBits32_47 !== len) {
          if (hadBruteMagicMatch) {
            forceExtractProbe = {
              failedAt: "length",
              rawLengthHex,
              lastCandidateLen: len,
            };
          }
          continue;
        }

        const declaredFromPacked = buf.readUInt16BE(4);
        if (declaredFromPacked !== declaredLenBits32_47) {
          if (hadBruteMagicMatch) {
            forceExtractProbe = {
              failedAt: "length",
              rawLengthHex,
              lastCandidateLen: len,
            };
          }
          continue;
        }

        if (buf[0] === 0x43 && buf[1] === 0x47 && buf[2] === 0x57) {
          if (buf[3] !== 0x04) {
            if (buf[3] !== 0x03) {
              return {
                ok: false,
                code: "unsupported_version",
                debug: verifyDebug,
              };
            }
            continue;
          }
        } else {
          if (hadBruteMagicMatch) {
            forceExtractProbe = {
              failedAt: "length",
              rawLengthHex,
              lastCandidateLen: len,
            };
          }
          continue;
        }

        const idBits = hamming74DecodeStream(parts.eccBits, len * 8);
        if (!idBits) {
          if (hadBruteMagicMatch) {
            forceExtractProbe = {
              failedAt: "length",
              rawLengthHex,
              lastCandidateLen: len,
            };
          }
          continue;
        }

        const idBuf = bigEndianBitsToBuffer(idBits, len);
        if (!idBuf) {
          if (hadBruteMagicMatch) {
            forceExtractProbe = {
              failedAt: "length",
              rawLengthHex,
              lastCandidateLen: len,
            };
          }
          continue;
        }

        try {
          const userId = new TextDecoder("utf-8", { fatal: true }).decode(
            idBuf
          );
          return { ok: true, userId };
        } catch {
          if (hadBruteMagicMatch) {
            forceExtractProbe = {
              failedAt: "utf8",
              rawLengthHex,
              lastCandidateLen: len,
            };
          }
          return {
            ok: false,
            code: "utf8_corrupt",
            debug: verifyDebug,
            debugSnapshot: hadBruteMagicMatch
              ? {
                  collapsedLen: (auditCollapsedLen10 ?? []).length,
                  first64: Array.from(
                    (auditCollapsedLen10 ?? []).slice(0, 64)
                  )
                    .map((b) => String(b & 1))
                    .join(""),
                  bestHamming: magicBruteScanStats.bestHamming,
                  bestIndex: magicBruteScanStats.bestIndex,
                  bestFromInvertedStream:
                    magicBruteScanStats.bestFromInvertedStream,
                  forceExtract: forceExtractProbe ?? {
                    failedAt: "utf8",
                    rawLengthHex,
                    lastCandidateLen: len,
                  },
                }
              : undefined,
          };
        }
      }
    }
  }

  let blindCleanedPreviewForSnapshot = "";
  if (hadBruteMagicMatch) {
    const blind = tryBlindExtractAfterMagicMarker(
      blockBits,
      embedBlockCount,
      magicSkipBits,
      streamInvertCollapsed
    );
    blindCleanedPreviewForSnapshot = blind.blindCleanedPreview;
    if (blind.userId != null && blind.userId.length > 0) {
      return { ok: true, userId: blind.userId };
    }
  }

  if (
    hadBruteMagicMatch &&
    maxDeclaredUint16Seen > EMERGENCY_SUSPICIOUS_DECLARED_LEN
  ) {
    console.warn(
      "[Creator Guard DCT] emergency extract: suspicious declared uint16BE",
      maxDeclaredUint16Seen,
      "trying fixed member lengths",
      EMERGENCY_FIXED_USER_ID_LENS
    );
    for (const fixedLen of EMERGENCY_FIXED_USER_ID_LENS) {
      const rescued = tryEmergencyFixedMemberLenExtract(
        blockBits,
        embedBlockCount,
        magicSkipBits,
        streamInvertCollapsed,
        fixedLen
      );
      if (rescued != null && rescued.length > 0) {
        return { ok: true, userId: rescued };
      }
    }
  }

  const rawCollapsed = primaryCollapsedBitsForShiftScan({
    auditCollapsedLen10,
    auditCollapsedLen1,
    blockBits,
    count: embedBlockCount,
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
    bestFromInvertedStream: magicBruteScanStats.bestFromInvertedStream,
    ...(hadBruteMagicMatch
      ? { blindCleanedPreview: blindCleanedPreviewForSnapshot }
      : {}),
    ...(hadBruteMagicMatch && forceExtractProbe
      ? { forceExtract: forceExtractProbe }
      : hadBruteMagicMatch
        ? {
            forceExtract: {
              failedAt: "empty" as const,
              rawLengthHex: "",
              lastCandidateLen: null,
            },
          }
        : {}),
  };

  return {
    ok: false,
    code: "magic_missing",
    debug: debugData,
    debugSnapshot,
  };
  }

  const primary = runExtractWithBlockBits(
    buildExtractSparseBlockBits(
      data,
      width,
      height,
      sparseK,
      embedBlockCount,
      bw,
      0
    )
  );
  if (primary.ok) return primary;
  if (primary.code !== "magic_missing") return primary;

  const deepBh = primary.debugSnapshot?.bestHamming;
  if (deepBh !== undefined && deepBh >= 10 && deepBh <= 15) {
    // bias -1 → can reach threshold 0 when base t ≤ 1 (e.g. ramp mag ≈ 3).
    for (const bias of [-1, 1] as const) {
      const alt = buildExtractSparseBlockBits(
        data,
        width,
        height,
        sparseK,
        embedBlockCount,
        bw,
        bias
      );
      const r = runExtractWithBlockBits(alt);
      if (r.ok) return r;
      if (r.code !== "magic_missing") return r;
    }
  }

  return primary;
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
    throw new Error(
      "Creator Guard DCT: physical redundancy expand/collapse must preserve logical bits"
    );
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
  const bitsV4 = payloadBufferToBigEndianBits(WATERMARK_MAGIC_V4.subarray(0, 4));
  assertV4MagicHeaderLogicalBitsNotDegenerate(bitsV4);
  const packedV4 = bigEndianBitsToBuffer(bitsV4, 4);
  if (!packedV4 || !packedV4.equals(WATERMARK_MAGIC_V4.subarray(0, 4))) {
    throw new Error(
      "Creator Guard DCT: big-endian round-trip failed for CGW\\x04"
    );
  }
  const expandedV4Magic = tripleExpandV4PayloadBits(bitsV4);
  const collapsedV4Magic = collapseV4PhysicalBitsForExtract(expandedV4Magic);
  if (
    !collapsedV4Magic ||
    collapsedV4Magic.length !== bitsV4.length ||
    collapsedV4Magic.join("") !== bitsV4.join("")
  ) {
    throw new Error(
      "Creator Guard DCT: v4 magic-header double redundancy expand/collapse must preserve logical bits"
    );
  }
})();

void (function assertHamming74SingleErrorCorrection(): void {
  for (let t = 0; t < 300; t++) {
    const n = 1 + Math.floor(Math.random() * 48);
    const dataBits: number[] = [];
    for (let i = 0; i < n * 8; i++) {
      dataBits.push(Math.random() < 0.5 ? 0 : 1);
    }
    const enc = hamming74EncodeStream(dataBits);
    const noisy = enc.slice();
    if (noisy.length >= 7) {
      const cwIdx = Math.floor(Math.random() * (noisy.length / 7));
      const j = cwIdx * 7 + Math.floor(Math.random() * 7);
      noisy[j] = noisy[j]! ^ 1;
    }
    const dec = hamming74DecodeStream(noisy, n * 8);
    if (!dec || dec.join("") !== dataBits.join("")) {
      throw new Error(
        "Creator Guard DCT: Hamming(7,4) single-bit correction round-trip failed"
      );
    }
  }
})();
