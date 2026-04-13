/** Portal → PDF protect handoff (one key for the whole app). */
export const CG_BATCH_QUEUE_STORAGE_KEY = "cg-batch-queue";

type BatchQueuePayload = {
  v?: number;
  /** Internal portal row ids (audit / future use). */
  selectedIds?: string[];
  /** Member identity lines for PDF `buyerEmail` / textarea. */
  identities: string[];
};

export function writeCgBatchQueueFromSelection(
  selectedIds: ReadonlySet<string>,
  members: readonly { id: string; identityId: string }[]
): boolean {
  const identities = members
    .filter((m) => selectedIds.has(m.id))
    .map((m) => m.identityId.trim())
    .filter(Boolean);
  if (identities.length === 0) return false;
  const payload: BatchQueuePayload = {
    v: 1,
    selectedIds: [...selectedIds],
    identities,
  };
  try {
    localStorage.setItem(CG_BATCH_QUEUE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    return false;
  }
  return true;
}

/** Read once, remove key, return newline-joined identities for the PDF textarea. */
export function consumeCgBatchQueueForPdfTextarea(): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(CG_BATCH_QUEUE_STORAGE_KEY);
  if (raw == null || raw === "") return null;
  localStorage.removeItem(CG_BATCH_QUEUE_STORAGE_KEY);
  try {
    const payload = JSON.parse(raw) as BatchQueuePayload;
    if (Array.isArray(payload.identities) && payload.identities.length > 0) {
      return payload.identities.join("\n");
    }
  } catch {
    // ignore malformed payloads
  }
  return null;
}
