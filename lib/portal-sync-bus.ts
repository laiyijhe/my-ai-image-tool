export type CloudSyncSource = "fetch" | "persist";

export type CloudSyncDetail =
  | { type: "started"; source: CloudSyncSource }
  | { type: "completed"; source: CloudSyncSource }
  | { type: "failed"; source: CloudSyncSource; message?: string };

const listeners = new Set<(d: CloudSyncDetail) => void>();

export function subscribeCloudSync(
  cb: (d: CloudSyncDetail) => void
): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function publishCloudSync(d: CloudSyncDetail): void {
  listeners.forEach((cb) => {
    try {
      cb(d);
    } catch {
      /* ignore subscriber errors */
    }
  });
}
