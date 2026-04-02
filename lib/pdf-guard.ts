import {
  EncryptedPDFError,
  PDFDocument,
  rgb,
  StandardFonts,
} from "pdf-lib";

export type CreatorGuardPdfOptions = {
  buyerEmail: string;
  /** Optional member / account id (defaults to email). */
  userId?: string;
};

const EMAIL_MAX = 320;

/**
 * PDF 32000 permission bits live under `/Encrypt` (`/P`). **pdf-lib** cannot set them on save;
 * we record policy intent in **Subject / Keywords / Producer** for audit. True “no copy / no modify”
 * needs a future encryption pass (e.g. qpdf) with an owner key.
 */
export async function protectPdfWithCreatorGuard(
  input: Uint8Array,
  opts: CreatorGuardPdfOptions
): Promise<Uint8Array> {
  const buyerEmail = normalizeBuyerEmail(opts.buyerEmail);
  const userId = (opts.userId?.trim() || buyerEmail).slice(0, 256);

  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(input, { updateMetadata: true });
  } catch (e) {
    if (e instanceof EncryptedPDFError) {
      throw new CreatorGuardPdfError(
        "encrypted_pdf",
        "This PDF is password-protected. Remove encryption or supply a decrypted file."
      );
    }
    throw e;
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const watermark = `Licensed to ${buyerEmail}`;
  const fontSize = 9;
  const footerGray = rgb(0.34, 0.35, 0.38);

  const prevTitle = pdfDoc.getTitle();
  pdfDoc.setTitle(
    prevTitle
      ? `${prevTitle} — Licensed to ${buyerEmail}`
      : `Licensed to ${buyerEmail}`
  );
  pdfDoc.setAuthor(buyerEmail);
  pdfDoc.setSubject(
    `Creator Guard licensed copy. Policy intent: disallow modification and content copying (enforce via encryption where available). Buyer: ${buyerEmail}.`
  );
  pdfDoc.setKeywords([
    `CreatorGuard:BuyerEmail=${buyerEmail}`,
    `CreatorGuard:UserId=${userId}`,
    `CreatorGuard:PolicyIntent=NoModify_NoContentCopy`,
    `CreatorGuard:Version=PDF-V1.0-STABLE`,
  ]);
  pdfDoc.setCreator("Creator Guard");
  pdfDoc.setProducer(
    `Creator Guard PDF-V1.0-STABLE | Licensed: ${buyerEmail} | UserId: ${userId}`
  );
  pdfDoc.setModificationDate(new Date());

  for (const page of pdfDoc.getPages()) {
    const { width } = page.getSize();
    const textWidth = font.widthOfTextAtSize(watermark, fontSize);
    const x = Math.max(28, (width - textWidth) / 2);
    page.drawText(watermark, {
      x,
      y: 20,
      size: fontSize,
      font,
      color: footerGray,
      opacity: 0.4,
    });
  }

  return pdfDoc.save({ useObjectStreams: false });
}

export class CreatorGuardPdfError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "CreatorGuardPdfError";
    this.code = code;
  }
}

function normalizeBuyerEmail(raw: string): string {
  const s = raw.trim().slice(0, EMAIL_MAX);
  if (s.length < 3) {
    throw new CreatorGuardPdfError("invalid_email", "Enter a valid buyer email.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
    throw new CreatorGuardPdfError("invalid_email", "Enter a valid buyer email.");
  }
  return s;
}

export function isLikelyPdfBuffer(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  return buf.subarray(0, 4).toString("latin1") === "%PDF";
}
