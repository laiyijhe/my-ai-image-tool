import { PDFDocument } from "pdf-lib";

/** Primary forensic token: `CreatorGuard:<email>|<userId>|<ISO8601>`. */
function matchAllPipeTokens(keywordsStr: string): {
  email: string;
  id: string;
  ts: string;
} | null {
  const pipeRe = /CreatorGuard:([^|]+)\|([^|]+)\|([^\s,]+)/g;
  let last: { email: string; id: string; ts: string } | null = null;
  let m: RegExpExecArray | null;
  while ((m = pipeRe.exec(keywordsStr)) !== null) {
    last = {
      email: m[1]!.trim(),
      id: m[2]!.trim(),
      ts: m[3]!.trim(),
    };
  }
  return last;
}

export type PdfFingerprintFound = {
  status: "found";
  buyerEmail: string;
  userId: string;
  timestamp: string;
  version: string;
  author?: string;
  producer?: string;
  keywords?: string;
};

export type PdfFingerprintNotFound = {
  status: "not_found";
  message: string;
  author?: string;
  producer?: string;
  keywords?: string;
};

export type PdfFingerprintResult = PdfFingerprintFound | PdfFingerprintNotFound;

/**
 * Read PDF Info dictionary via pdf-lib. Parses pipe token and legacy `CreatorGuard:*=` keywords.
 */
export async function extractPdfFingerprint(
  buffer: Uint8Array
): Promise<PdfFingerprintResult> {
  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(buffer, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
  } catch {
    return {
      status: "not_found",
      message: "Could not open this file as a PDF.",
    };
  }

  const author = pdfDoc.getAuthor();
  const producer = pdfDoc.getProducer();
  const keywordsStr = pdfDoc.getKeywords() ?? "";

  const lastPipe = matchAllPipeTokens(keywordsStr);
  if (lastPipe) {
    const verM = keywordsStr.match(/CreatorGuard:Version=([^,\s]+)/);
    return {
      status: "found",
      buyerEmail: lastPipe.email,
      userId: lastPipe.id,
      timestamp: lastPipe.ts,
      version: verM?.[1]?.trim() ?? "PDF-V1.0-STABLE",
      author,
      producer,
      keywords: keywordsStr,
    };
  }

  const hasLegacyMarker =
    keywordsStr.includes("CreatorGuard:") ||
    (producer?.includes("Creator Guard PDF") ?? false);

  if (hasLegacyMarker) {
    const emailM = keywordsStr.match(/CreatorGuard:BuyerEmail=([^,]+)/);
    const idM = keywordsStr.match(/CreatorGuard:UserId=([^,]+)/);
    const verM = keywordsStr.match(/CreatorGuard:Version=([^,\s]+)/);
    const fromProducerEmail = producer
      ?.match(/Licensed:\s*([^|]+)/)?.[1]
      ?.trim();
    const fromProducerId = producer?.match(/UserId:\s*(.+)$/)?.[1]?.trim();

    const buyerEmail = (
      emailM?.[1]?.trim() ??
      fromProducerEmail ??
      author ??
      ""
    ).trim();
    const userId = (idM?.[1]?.trim() ?? fromProducerId ?? buyerEmail).trim();
    const mod = pdfDoc.getModificationDate();

    if (buyerEmail.length > 0 || userId.length > 0) {
      return {
        status: "found",
        buyerEmail: buyerEmail || userId,
        userId,
        timestamp: mod?.toISOString?.() ?? "",
        version: verM?.[1]?.trim() ?? "PDF-V1.0-STABLE",
        author,
        producer,
        keywords: keywordsStr,
      };
    }
  }

  return {
    status: "not_found",
    message: "Clean Document / No Guard Protection",
    author,
    producer,
    keywords: keywordsStr,
  };
}
