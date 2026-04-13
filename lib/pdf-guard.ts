import {
  isValidMemberIdentityToken,
  MEMBER_IDENTITY_MAX_LEN,
} from "@/lib/member-identity";
import {
  applyCreatorGuardToPdfBytes,
  CreatorGuardPdfCoreError,
} from "@/lib/pdf-guard-core";
import type { PlanType } from "@/lib/plan-types";

export type CreatorGuardPdfOptions = {
  /** Primary licensed identity (member ID / handle; 1–64 chars). */
  buyerEmail: string;
  /** Optional member / account id (defaults to buyer identity). */
  userId?: string;
  /** When `'free'`, adds visible “Protected by Creator Guard” footer on each page. */
  planType?: PlanType;
};

/**
 * PDF 32000 permission bits live under `/Encrypt` (`/P`). **pdf-lib** cannot set them on save;
 * we record policy intent in **Subject / Keywords / Producer** for audit. True “no copy / no modify”
 * needs a future encryption pass (e.g. qpdf) with an owner key.
 */
export async function protectPdfWithCreatorGuard(
  input: Uint8Array,
  opts: CreatorGuardPdfOptions
): Promise<Uint8Array> {
  const buyerEmail = normalizeMemberIdentity(opts.buyerEmail);
  const userId = (opts.userId?.trim() || buyerEmail).slice(0, 256);
  try {
    return await applyCreatorGuardToPdfBytes(input, {
      buyerEmail,
      userId,
      planType: opts.planType,
    });
  } catch (e) {
    if (e instanceof CreatorGuardPdfCoreError) {
      throw new CreatorGuardPdfError(e.code, e.message);
    }
    throw e;
  }
}

export class CreatorGuardPdfError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "CreatorGuardPdfError";
    this.code = code;
  }
}

function normalizeMemberIdentity(raw: string): string {
  const s = raw.trim().slice(0, MEMBER_IDENTITY_MAX_LEN);
  if (!isValidMemberIdentityToken(s)) {
    throw new CreatorGuardPdfError(
      "invalid_member_identity",
      "Enter a valid member identity (1–64 characters, printable text only)."
    );
  }
  return s;
}

export function isLikelyPdfBuffer(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  return buf.subarray(0, 4).toString("latin1") === "%PDF";
}
