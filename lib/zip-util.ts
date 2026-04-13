import JSZip from "jszip";

export type NamedBlob = { name: string; blob: Blob };

/**
 * Pack PDF (or other) blobs into a single ZIP download.
 */
export async function zipNamedBlobs(files: NamedBlob[]): Promise<Blob> {
  const zip = new JSZip();
  for (const { name, blob } of files) {
    zip.file(name, blob);
  }
  return zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
