/**
 * PDF stamping + metadata (pdf-lib only). Callers must validate `buyerEmail` / `userId`.
 * Shared by server `protectPdfWithCreatorGuard` and the browser PDF worker.
 */
import type { PlanType } from "@/lib/plan-types";
import {
  EncryptedPDFError,
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
} from "pdf-lib";

export class CreatorGuardPdfCoreError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "CreatorGuardPdfCoreError";
    this.code = code;
  }
}

export type CreatorGuardPdfCoreOptions = {
  buyerEmail: string;
  userId: string;
  /** When `'free'`, draws an extra “Protected by Creator Guard” footer on each page. */
  planType?: PlanType;
};

const GRID_COLS = 5;
const GRID_ROWS = 5;
const WATERMARK_OPACITY = 0.08;
/** Light grey body text (Helvetica; Inter not embedded here). */
const WM_GRAY = rgb(0.82, 0.82, 0.84);

function drawTiltedWatermarkGrid(
  page: import("pdf-lib").PDFPage,
  font: import("pdf-lib").PDFFont,
  identityLabel: string,
  buyerEmail: string,
  showFreeTierBranding: boolean
): void {
  const { width, height } = page.getSize();
  const text =
    identityLabel.length > 48
      ? `${identityLabel.slice(0, 45)}…`
      : identityLabel;
  const cellW = width / GRID_COLS;
  const cellH = height / GRID_ROWS;
  const baseSize = Math.max(
    6,
    Math.min(11, Math.min(cellW, cellH) / (Math.max(text.length, 8) * 0.55))
  );

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const cx = (c + 0.5) * cellW;
      const cyBottom = (r + 0.5) * cellH;
      const y = height - cyBottom;
      const tw = font.widthOfTextAtSize(text, baseSize);
      const x = cx - tw / 2;
      page.drawText(text, {
        x,
        y: y - baseSize * 0.35,
        size: baseSize,
        font,
        color: WM_GRAY,
        opacity: WATERMARK_OPACITY,
        rotate: degrees(-45),
      });
    }
  }

  const footer = `Licensed to ${buyerEmail}`;
  const fs = 8;
  const fw = font.widthOfTextAtSize(footer, fs);
  const licensedY = showFreeTierBranding ? 30 : 18;
  page.drawText(footer, {
    x: Math.max(24, (width - fw) / 2),
    y: licensedY,
    size: fs,
    font,
    color: rgb(0.5, 0.51, 0.54),
    opacity: 0.35,
  });

  if (showFreeTierBranding) {
    const brand = "Protected by Creator Guard";
    const fsB = 7;
    const bw = font.widthOfTextAtSize(brand, fsB);
    page.drawText(brand, {
      x: Math.max(24, (width - bw) / 2),
      y: 14,
      size: fsB,
      font,
      color: rgb(0.45, 0.46, 0.48),
      opacity: 0.42,
    });
  }
}

export async function applyCreatorGuardToPdfBytes(
  input: Uint8Array,
  opts: CreatorGuardPdfCoreOptions
): Promise<Uint8Array> {
  const buyerEmail = opts.buyerEmail;
  const userId = opts.userId;
  const showFreeTierBranding = opts.planType === "free";
  const fingerprintTs = new Date().toISOString();
  const pipeFingerprint = `CreatorGuard:${buyerEmail}|${userId}|${fingerprintTs}`;
  const metaTitleAuthor = `Protected by Creator Guard for ${buyerEmail}`;

  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(input, { updateMetadata: true });
  } catch (e) {
    if (e instanceof EncryptedPDFError) {
      throw new CreatorGuardPdfCoreError(
        "encrypted_pdf",
        "This PDF is password-protected. Remove encryption or supply a decrypted file."
      );
    }
    throw e;
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  pdfDoc.setTitle(metaTitleAuthor);
  pdfDoc.setAuthor(metaTitleAuthor);
  pdfDoc.setSubject(
    `Creator Guard licensed copy. Policy intent: disallow modification and content copying (enforce via encryption where available). Buyer: ${buyerEmail}.`
  );
  pdfDoc.setKeywords([
    pipeFingerprint,
    `CreatorGuard:BuyerEmail=${buyerEmail}`,
    `CreatorGuard:UserId=${userId}`,
    `CreatorGuard:PolicyIntent=NoModify_NoContentCopy`,
    `CreatorGuard:Version=PDF-V1.0-STABLE`,
    ...(showFreeTierBranding
      ? ["CreatorGuard:FreeTierVisibleFooter=1"]
      : []),
  ]);
  pdfDoc.setCreator("Creator Guard");
  pdfDoc.setProducer(
    showFreeTierBranding
      ? `Creator Guard PDF-V1.0-STABLE | Licensed: ${buyerEmail} | UserId: ${userId} | CreatorGuard:FreeTierVisibleFooter=1`
      : `Creator Guard PDF-V1.0-STABLE | Licensed: ${buyerEmail} | UserId: ${userId}`
  );
  pdfDoc.setModificationDate(new Date());

  for (const page of pdfDoc.getPages()) {
    drawTiltedWatermarkGrid(
      page,
      font,
      buyerEmail,
      buyerEmail,
      showFreeTierBranding
    );
  }

  return pdfDoc.save({ useObjectStreams: false });
}
