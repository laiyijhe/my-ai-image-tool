"use client";

import { ProcessingOverlay } from "@/components/protect/ProcessingOverlay";
import {
  PROTECT_UNASSIGNED_ID,
  type ProtectGroupPick,
} from "@/hooks/useProtectGroups";
import { GROUP_AUTHORIZED, GROUP_IGNORED } from "@/components/portal/portal-types";
import type { PlanType } from "@/lib/plan-types";
// import { useCreatorPlan } from "@/hooks/useCreatorPlan";
import {
  appendCgBatchHistory,
  loadCgBatchHistory,
  type CgBatchHistoryEntry,
} from "@/lib/cg-batch-history";
import { useLanguage } from "@/lib/i18n/language-context";
import { useLiff } from "@/lib/line/liff-provider";
import { buildPdfShareFlex } from "@/lib/line/pdf-share-flex";
import { isValidDeliveryEmail } from "@/lib/member-identity";
import { consumeCgBatchQueueForPdfTextarea } from "@/lib/cg-batch-queue";
import { protectPdfBytesInWorker } from "@/lib/pdf-worker-client";
// import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  PDF_BATCH_MAX_COMBOS,
  PDF_CLIENT_MAX_COMBOS,
  PDF_PROTECT_MAX_BYTES,
  emailListsMatch,
  parseEmailListFromRaw,
  protectedPdfZipEntryName,
  isPdfFileLike,
  safePdfFileName,
  suggestGroupLabelFromRaw,
} from "@/lib/pdf-protect-shared";
import {
  triggerBlobDownload,
  zipNamedBlobs,
  type NamedBlob,
} from "@/lib/zip-util";
import { FileText, FolderOpen, RefreshCw, Search, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";

function tpl(s: string, vars: Record<string, string>): string {
  let out = s;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(v);
  }
  return out;
}

type Progress = { done: number; total: number };

type BatchLogRow = {
  id: string;
  fileName: string;
  email: string;
  emailSent: boolean;
};

function canRemoveProtectGroupBadge(id: string): boolean {
  return (
    id !== GROUP_AUTHORIZED &&
    id !== GROUP_IGNORED &&
    id !== PROTECT_UNASSIGNED_ID
  );
}

function queueFileStatusClass(s: "pending" | "protecting" | "ready") {
  if (s === "protecting")
    return "bg-amber-100 text-amber-900 ring-amber-200/80";
  if (s === "ready") return "bg-emerald-100 text-emerald-900 ring-emerald-200/80";
  return "bg-slate-100 text-slate-600 ring-slate-200/80";
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Bold red PDF-style icon for sidebar file rows */
function SidebarPdfIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M7 3h6l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
        fill="#DC2626"
      />
      <path
        d="M13 3v5h5"
        stroke="#991B1B"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 14.5h7M8.5 17h5"
        stroke="white"
        strokeWidth="1.35"
        strokeLinecap="round"
        opacity="0.95"
      />
    </svg>
  );
}

function SidebarEmptyIllustration({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        x="12"
        y="8"
        width="40"
        height="48"
        rx="4"
        className="stroke-slate-200"
        strokeWidth="1.5"
      />
      <path
        d="M20 22h24M20 30h18M20 38h22"
        className="stroke-slate-200"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="44" cy="46" r="10" className="fill-slate-100 stroke-slate-200" strokeWidth="1.25" />
      <path
        d="M40 46h8M44 42v8"
        className="stroke-slate-300"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MailLetterIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

type BrowserAssetKind = "pdf" | "image";

type BrowserAsset = {
  key: string;
  file: File;
  kind: BrowserAssetKind;
};

type VaultFileJson = {
  name: string;
  size_kb: number;
  is_pdf: boolean;
};

const RASTER_IMAGE_NAME_RE = /\.(png|jpe?g)$/i;

/** Skip dotfiles, `.git` folders, and common OS / editor junk so the sidebar shows real documents only. */
function isHiddenOrSystemFileName(name: string): boolean {
  const segment = name.includes("/")
    ? (name.split("/").pop() ?? name)
    : name;
  if (segment.startsWith(".")) return true;
  const lower = segment.toLowerCase();
  if (
    lower === "thumbs.db" ||
    lower === "ehthumbs.db" ||
    lower === "ehthumbs_vista.db" ||
    lower === "desktop.ini"
  ) {
    return true;
  }
  if (lower.startsWith("~$")) return true;
  return false;
}

function isRasterImageFileLike(file: File): boolean {
  if (file.size > PDF_PROTECT_MAX_BYTES) return false;
  if (RASTER_IMAGE_NAME_RE.test(file.name)) return true;
  const mime = file.type.toLowerCase();
  return mime.startsWith("image/") && !mime.includes("svg");
}

type DirectoryHandleWithValues = FileSystemDirectoryHandle & {
  values(): AsyncIterableIterator<FileSystemHandle>;
};

const DIRECTORY_SCAN_MAX_DEPTH = 32;

/** Recursively collects PDFs and raster images; keys include relative path to avoid collisions. */
async function collectBrowserAssetsFromDirectory(
  dir: FileSystemDirectoryHandle,
  pathPrefix = "",
  depth = 0
): Promise<BrowserAsset[]> {
  if (depth > DIRECTORY_SCAN_MAX_DEPTH) return [];

  const out: BrowserAsset[] = [];
  for await (const handle of (dir as DirectoryHandleWithValues).values()) {
    if (isHiddenOrSystemFileName(handle.name)) continue;

    const rel = pathPrefix ? `${pathPrefix}/${handle.name}` : handle.name;

    if (handle.kind === "directory") {
      const sub = await collectBrowserAssetsFromDirectory(
        handle as FileSystemDirectoryHandle,
        rel,
        depth + 1
      );
      out.push(...sub);
      continue;
    }

    if (handle.kind !== "file") continue;

    const file = await (handle as FileSystemFileHandle).getFile();
    if (isPdfFileLike(file)) {
      out.push({
        key: `pdf:${rel}:${file.size}:${file.lastModified}`,
        file,
        kind: "pdf",
      });
    } else if (isRasterImageFileLike(file)) {
      out.push({
        key: `img:${rel}:${file.size}:${file.lastModified}`,
        file,
        kind: "image",
      });
    }
  }

  out.sort((a, b) =>
    a.key.localeCompare(b.key, undefined, { sensitivity: "base" })
  );
  return out;
}

export default function ProtectPdfPage() {
  const { t, locale } = useLanguage();
  const {
    ready: liffReady,
    canUseShareTargetPicker,
    shareTargetPickerMessages,
  } = useLiff();
  /**
   * Supabase paused: `useProtectGroups()` triggers cloud fetch / members sync / 403 loops.
   * Stubs keep UI usable without `profiles` / `usage_stats` or `supabase.from(...)` side effects.
   */
  const groups = useMemo(
    () =>
      ({
        [t.portalAuthorizedGroupName]: [] as string[],
        [t.portalIgnoredGroupName]: [] as string[],
        [t.portalGroupUnassigned]: [] as string[],
      }) as Record<string, string[]>,
    [t]
  );
  const hydrated = true;
  const upsertGroup = useCallback(
    async (name: string, emails: string[]): Promise<string | undefined> => {
      void name;
      void emails;
      return undefined;
    },
    []
  );
  const removeGroupById = useCallback(async (groupId: string) => {
    void groupId;
  }, []);
  const sortedPickList = useMemo((): ProtectGroupPick[] => {
    return [
      { id: GROUP_AUTHORIZED, name: t.portalAuthorizedGroupName, count: 0 },
      { id: GROUP_IGNORED, name: t.portalIgnoredGroupName, count: 0 },
      {
        id: PROTECT_UNASSIGNED_ID,
        name: t.portalGroupUnassigned,
        count: 0,
      },
    ];
  }, [t]);
  const idToName = useMemo((): Record<string, string> => {
    return {
      [GROUP_AUTHORIZED]: t.portalAuthorizedGroupName,
      [GROUP_IGNORED]: t.portalIgnoredGroupName,
      [PROTECT_UNASSIGNED_ID]: t.portalGroupUnassigned,
    };
  }, [t]);
  const customGroups = useMemo(
    () => [] as { id: string; name: string }[],
    []
  );

  const groupsSyncBusy = false;

  const sidebarPickList = useMemo(() => {
    const system = sortedPickList.filter(
      (p) =>
        p.id === GROUP_AUTHORIZED ||
        p.id === GROUP_IGNORED ||
        p.id === PROTECT_UNASSIGNED_ID
    );
    const cloud = customGroups
      .map((g) => ({
        id: g.id,
        name: g.name,
        count: groups[g.name]?.length ?? 0,
      }))
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      );
    return [...system, ...cloud];
  }, [sortedPickList, customGroups, groups]);
  /** Paused: {@link useCreatorPlan} calls `ensureProfileAndUsageRows` (profiles insert + usage_stats insert) — 403 churn. */
  // const { planType } = useCreatorPlan();
  const planType: PlanType = "free";

  const sendProtectedPdfEmail = useCallback(
    async (blob: Blob, to: string, attachmentFileName: string) => {
      const fd = new FormData();
      fd.set("to", to);
      fd.set(
        "file",
        new File([blob], attachmentFileName, { type: "application/pdf" })
      );
      const res = await fetch("/api/send/pdf", { method: "POST", body: fd });
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        throw new Error(
          j.message ??
            tpl(t.protectPdfErrEmailSendFailed, {
              status: String(res.status),
            })
        );
      }
    },
    [t]
  );
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [directoryAssets, setDirectoryAssets] = useState<BrowserAsset[]>([]);
  const [vaultFiles, setVaultFiles] = useState<VaultFileJson[]>([]);
  const [vaultPathLabel, setVaultPathLabel] = useState<string | null>(null);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultFetchError, setVaultFetchError] = useState<string | null>(null);
  const [selectedVaultPdf, setSelectedVaultPdf] = useState<string | null>(null);
  const [folderSearchQuery, setFolderSearchQuery] = useState("");
  const [folderLabel, setFolderLabel] = useState<string | null>(null);
  const [dirScanBusy, setDirScanBusy] = useState(false);
  const [previewSelection, setPreviewSelection] = useState<File | null>(null);
  const [selectedAssetKey, setSelectedAssetKey] = useState<string | null>(
    null
  );
  const [emailListText, setEmailListText] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectValue, setSelectValue] = useState("");

  const selectedGroupMemberEmails = useMemo(() => {
    if (!selectedGroupId) return null;
    const name = idToName[selectedGroupId];
    if (!name) return [];
    return groups[name] ?? [];
  }, [selectedGroupId, idToName, groups]);
  const [newGroupName, setNewGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [sendEmailAfterProtection, setSendEmailAfterProtection] =
    useState(false);
  const [batchSendLog, setBatchSendLog] = useState<BatchLogRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [historyEntries, setHistoryEntries] = useState<CgBatchHistoryEntry[]>(
    []
  );
  const [dismissedSaveTipKey, setDismissedSaveTipKey] = useState<string | null>(
    null
  );
  const [lastShareable, setLastShareable] = useState<{
    blob: Blob;
    fileName: string;
  } | null>(null);
  const [lineShareBusy, setLineShareBusy] = useState(false);
  const [lineShareNotice, setLineShareNotice] = useState<string | null>(null);
  const [fileQueueStatus, setFileQueueStatus] = useState<
    ("pending" | "protecting" | "ready")[]
  >([]);
  const [batchOutputBlobs, setBatchOutputBlobs] = useState<NamedBlob[]>([]);
  const [processingVerified, setProcessingVerified] = useState(false);

  /** Avoid hydration mismatch: never read `window` during SSR/first paint. */
  const [mounted, setMounted] = useState(false);
  const [canPickDirectory, setCanPickDirectory] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCanPickDirectory(
      typeof window !== "undefined" && "showDirectoryPicker" in window
    );

    /* Paused: `await supabase.auth.getSession()` in effect — reduce Supabase / 403 noise (Flask fetch + File System API).
    let cancelled = false;
    const checkSession = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (process.env.NODE_ENV === "development" && !data.session) {
          console.warn("未登入，部分功能受限");
        }
      } catch (e) {
        if (cancelled) return;
        if (process.env.NODE_ENV === "development") {
          console.error("Session check failed", e);
        }
      }
    };
    void checkSession();
    return () => {
      cancelled = true;
    };
    */
  }, []);

  const effectivePreviewFile = previewSelection ?? pdfFiles[0] ?? null;

  const previewIsPdf =
    !!effectivePreviewFile && isPdfFileLike(effectivePreviewFile);
  const previewIsImage =
    !!effectivePreviewFile &&
    !previewIsPdf &&
    isRasterImageFileLike(effectivePreviewFile);

  const previewUrl = useMemo(() => {
    if (!effectivePreviewFile) return null;
    if (previewIsPdf || previewIsImage) {
      return URL.createObjectURL(effectivePreviewFile);
    }
    return null;
  }, [effectivePreviewFile, previewIsPdf, previewIsImage]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const filteredDirectoryAssets = useMemo(() => {
    const q = folderSearchQuery.trim().toLowerCase();
    if (!q) return directoryAssets;
    return directoryAssets.filter((a) =>
      a.file.name.toLowerCase().includes(q)
    );
  }, [directoryAssets, folderSearchQuery]);

  const insuranceVaultBase = useMemo(
    () =>
      (process.env.NEXT_PUBLIC_INSURANCE_VAULT_URL ?? "http://127.0.0.1:5000").replace(
        /\/$/,
        ""
      ),
    []
  );

  const filteredVaultFiles = useMemo(() => {
    const q = folderSearchQuery.trim().toLowerCase();
    if (!q) return vaultFiles;
    return vaultFiles.filter((f) => f.name.toLowerCase().includes(q));
  }, [vaultFiles, folderSearchQuery]);

  const fetchVaultFiles = useCallback(async () => {
    setVaultLoading(true);
    setVaultFetchError(null);
    try {
      let res = await fetch(`${insuranceVaultBase}/api/files`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        res = await fetch(`${insuranceVaultBase}/?format=json`, {
          headers: { Accept: "application/json" },
        });
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        files?: VaultFileJson[];
        vault_path?: string;
      };
      setVaultFiles(Array.isArray(data.files) ? data.files : []);
      setVaultPathLabel(data.vault_path ?? null);
    } catch (e) {
      setVaultFetchError(
        e instanceof Error ? e.message : "Insurance vault fetch failed"
      );
      setVaultFiles([]);
      setVaultPathLabel(null);
    } finally {
      setVaultLoading(false);
    }
  }, [insuranceVaultBase]);

  useEffect(() => {
    if (!mounted) return;
    void fetchVaultFiles();
  }, [mounted, fetchVaultFiles]);

  const openLocalFolder = useCallback(async () => {
    if (!canPickDirectory) return;
    setDirScanBusy(true);
    setError(null);
    try {
      const dir = await (
        window as unknown as {
          showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
        }
      ).showDirectoryPicker();
      const assets = await collectBrowserAssetsFromDirectory(dir);
      setDirectoryAssets(assets);
      setFolderLabel(dir.name);
      setFolderSearchQuery("");
      const first = assets[0];
      if (first) {
        setSelectedAssetKey(first.key);
        setPreviewSelection(first.file);
      } else {
        setSelectedAssetKey(null);
        setPreviewSelection(null);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(t.protectPdfErrGeneric);
    } finally {
      setDirScanBusy(false);
    }
  }, [canPickDirectory, t]);

  const clearLocalFolder = useCallback(() => {
    setDirectoryAssets([]);
    setFolderLabel(null);
    setFolderSearchQuery("");
    setSelectedAssetKey(null);
    setPreviewSelection(null);
  }, []);

  const addPdfToQueue = useCallback(
    (file: File) => {
      const isPdfMimeOrExt =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");
      if (!isPdfMimeOrExt) {
        setError(t.protectPdfErrBatchQueuePdfOnly);
        return;
      }
      if (file.size > PDF_PROTECT_MAX_BYTES) {
        setError(t.protectPdfErrNoValidPdfsDropped);
        return;
      }
      setPdfFiles((prev) => {
        const exists = prev.some(
          (p) =>
            p.name === file.name &&
            p.size === file.size &&
            p.lastModified === file.lastModified
        );
        if (exists) return prev;
        return [...prev, file];
      });
      setError(null);
    },
    [t]
  );

  useEffect(() => {
    setFileQueueStatus(pdfFiles.map(() => "pending"));
  }, [pdfFiles]);

  useLayoutEffect(() => {
    setHistoryEntries(loadCgBatchHistory());
    const fromPortal = consumeCgBatchQueueForPdfTextarea();
    if (fromPortal) {
      setEmailListText(fromPortal);
      setSelectedGroupId(null);
      setSelectValue("");
      setError(null);
    }
  }, []);

  /* Supabase paused: cloud group refetch was disabled — it re-triggered effects / 403 noise.
  useEffect(() => {
    void refetchGroupsFromCloud();
  }, [refetchGroupsFromCloud]);
  */

  const historyLocaleTag = useMemo(() => {
    if (locale === "zh-TW") return "zh-TW";
    if (locale === "zh-CN") return "zh-CN";
    if (locale === "ja") return "ja-JP";
    if (locale === "ko") return "ko-KR";
    return "en-US";
  }, [locale]);

  const formatHistoryAt = useCallback(
    (iso: string) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleString(historyLocaleTag, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    },
    [historyLocaleTag]
  );

  const recentThree = useMemo(
    () => historyEntries.slice(0, 3),
    [historyEntries]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const next = acceptedFiles.filter(isPdfFileLike);
      if (acceptedFiles.length > 0 && next.length === 0) {
        setError(t.protectPdfErrNoValidPdfsDropped);
      } else if (next.length < acceptedFiles.length) {
        setError(t.protectPdfErrSomeSkipped);
      } else if (next.length > 0) {
        setError(null);
      }
      setPdfFiles((prev) => [...prev, ...next]);
    },
    [t]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: true,
    disabled: loading,
    noClick: pdfFiles.length > 0,
  });

  const batchCtaLabel = useMemo(() => {
    if (loading) {
      if (progress && progress.total > 1) {
        return tpl(t.protectPdfProtectingWithCount, {
          done: String(progress.done),
          total: String(progress.total),
        });
      }
      return t.protectPdfProtecting;
    }
    if (pdfFiles.length === 0) return t.protectPdfQueueAddPdfsFirst;
    if (pdfFiles.length === 1) return t.protectPdfProtectNFilesOne;
    return tpl(t.protectPdfProtectNFilesMany, {
      count: String(pdfFiles.length),
    });
  }, [loading, progress, pdfFiles.length, t]);

  const parsedEmails = useMemo(
    () => parseEmailListFromRaw(emailListText),
    [emailListText]
  );

  const emailsIdentityKey = useMemo(
    () =>
      [...parsedEmails].map((e) => e.toLowerCase()).sort().join("|"),
    [parsedEmails]
  );

  const matchesSavedGroup = useMemo(() => {
    if (parsedEmails.length === 0) return false;
    return Object.values(groups).some((g) =>
      emailListsMatch(parsedEmails, g)
    );
  }, [parsedEmails, groups]);

  const suggestedLabel = useMemo(
    () => suggestGroupLabelFromRaw(emailListText),
    [emailListText]
  );

  const showSaveNewListTip =
    parsedEmails.length > 0 &&
    !matchesSavedGroup &&
    dismissedSaveTipKey !== emailsIdentityKey &&
    !loading;

  const applyHistoryEntry = useCallback((entry: CgBatchHistoryEntry) => {
    setEmailListText(entry.emails.join("\n"));
    setSelectedGroupId(null);
    setSelectValue("");
    setError(null);
  }, []);

  const comboCount = pdfFiles.length * parsedEmails.length;

  const removeFile = useCallback((index: number) => {
    setPdfFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const applyGroupById = useCallback(
    (id: string) => {
      const name = idToName[id];
      if (!name) return;
      const emails = groups[name] ?? [];
      setSelectedGroupId(id);
      setSelectValue(id);
      setEmailListText(emails.join("\n"));
      setError(null);
    },
    [groups, idToName]
  );

  const onSelectGroupDropdown = useCallback(
    (value: string) => {
      setSelectValue(value);
      if (!value) {
        setSelectedGroupId(null);
        return;
      }
      applyGroupById(value);
    },
    [applyGroupById]
  );

  const saveAsGroup = useCallback(async () => {
    const name = newGroupName.trim();
    const emails = parseEmailListFromRaw(emailListText);
    if (!name) {
      setError(t.protectPdfErrGroupName);
      return;
    }
    if (emails.length === 0) {
      setError(t.protectPdfErrPasteEmails);
      return;
    }
    const gid = await upsertGroup(name, emails);
    if (gid) {
      setSelectedGroupId(gid);
      setSelectValue(gid);
    }
    setNewGroupName("");
    setDismissedSaveTipKey(
      [...emails].map((e) => e.toLowerCase()).sort().join("|")
    );
    setError(null);
  }, [emailListText, newGroupName, upsertGroup, t]);

  const onEmailTextChange = useCallback((value: string) => {
    setEmailListText(value);
    setSelectedGroupId(null);
    setSelectValue("");
  }, []);

  const pauseForSafetyVerifiedUi = useCallback(async () => {
    setProcessingVerified(true);
    await new Promise((r) => setTimeout(r, 1500));
    setProcessingVerified(false);
  }, []);

  const runBatch = useCallback(async () => {
    setError(null);
    setProgress(null);
    setBatchSendLog([]);
    setProcessingVerified(false);

    const emails = parseEmailListFromRaw(emailListText);
    if (pdfFiles.length === 0) {
      setError(t.protectPdfErrNeedPdf);
      return;
    }
    if (emails.length === 0) {
      setError(t.protectPdfErrNeedEmail);
      return;
    }

    if (
      sendEmailAfterProtection &&
      emails.some((id) => !isValidDeliveryEmail(id))
    ) {
      setError(t.protectPdfErrSendEmailNeedsValidEmail);
      return;
    }

    const invalid = pdfFiles.filter((f) => !isPdfFileLike(f));
    if (invalid.length > 0) {
      setError(
        tpl(t.protectPdfErrPdfInvalid, {
          names: invalid.map((f) => f.name).join(", "),
        })
      );
      return;
    }

    const tasks: { file: File; email: string }[] = [];
    for (const file of pdfFiles) {
      for (const email of emails) {
        tasks.push({ file, email });
      }
    }

    if (tasks.length > PDF_CLIENT_MAX_COMBOS) {
      setError(
        tpl(t.protectPdfErrTooManyCombos, {
          total: String(tasks.length),
          max: String(PDF_CLIENT_MAX_COMBOS),
        })
      );
      return;
    }

    setHistoryEntries(appendCgBatchHistory(emails, selectedGroupId));

    setLoading(true);
    setProgress({ done: 0, total: tasks.length });
    setFileQueueStatus(pdfFiles.map(() => "pending"));
    setBatchOutputBlobs([]);

    const uidForWorker = (identity: string) => identity.trim().slice(0, 256);

    try {
      const outputs: NamedBlob[] = [];

      if (tasks.length === 1) {
        const { file, email } = tasks[0]!;
        setFileQueueStatus(["protecting"]);
        const raw = await file.arrayBuffer();
        let outBuf: ArrayBuffer;
        try {
          outBuf = await protectPdfBytesInWorker(
            raw,
            email.trim(),
            uidForWorker(email),
            planType
          );
        } catch (e) {
          throw new Error(
            e instanceof Error ? e.message : t.protectPdfErrGeneric
          );
        }

        const blob = new Blob([outBuf], { type: "application/pdf" });
        const downloadName = safePdfFileName(file.name);

        let emailSent = false;
        if (sendEmailAfterProtection) {
          await sendProtectedPdfEmail(blob, email, downloadName);
          emailSent = true;
        }

        setBatchSendLog([
          {
            id: "0",
            fileName: file.name,
            email,
            emailSent,
          },
        ]);

        setLastShareable({ blob, fileName: downloadName });
        setBatchOutputBlobs([{ name: downloadName, blob }]);

        triggerBlobDownload(blob, downloadName);
        setProgress({ done: 1, total: 1 });
        setFileQueueStatus(["ready"]);
        await pauseForSafetyVerifiedUi();
        return;
      }

      const nEmails = emails.length;

      for (let i = 0; i < tasks.length; i++) {
        const fIdx = Math.floor(i / nEmails);
        setFileQueueStatus(
          pdfFiles.map((_, fi) =>
            fi < fIdx ? "ready" : fi === fIdx ? "protecting" : "pending"
          )
        );
        const { file, email } = tasks[i]!;
        const raw = await file.arrayBuffer();
        let outBuf: ArrayBuffer;
        try {
          outBuf = await protectPdfBytesInWorker(
            raw,
            email.trim(),
            uidForWorker(email),
            planType
          );
        } catch (e) {
          throw new Error(
            e instanceof Error
              ? e.message
              : tpl(t.protectPdfErrFailedOn, {
                  file: file.name,
                  memberId: email,
                  status: "error",
                })
          );
        }

        const blob = new Blob([outBuf], { type: "application/pdf" });
        const zipEntryName = protectedPdfZipEntryName(file.name, email, i);

        let emailSent = false;
        if (sendEmailAfterProtection) {
          await sendProtectedPdfEmail(blob, email, zipEntryName);
          emailSent = true;
        }

        outputs.push({ name: zipEntryName, blob });
        setBatchSendLog((prev) => [
          ...prev,
          {
            id: `${i}-${file.name}-${email}`,
            fileName: file.name,
            email,
            emailSent,
          },
        ]);
        setProgress({ done: i + 1, total: tasks.length });
      }

      const zipBlob = await zipNamedBlobs(outputs);

      const zipDownloadName = `creator-guard-batch-${new Date().toISOString().slice(0, 10)}.zip`;
      setLastShareable({
        blob: zipBlob,
        fileName: zipDownloadName,
      });
      setBatchOutputBlobs(outputs);

      triggerBlobDownload(zipBlob, zipDownloadName);
      setFileQueueStatus(pdfFiles.map(() => "ready"));
      await pauseForSafetyVerifiedUi();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t.protectPdfErrGeneric
      );
    } finally {
      setLoading(false);
    }
  }, [
    emailListText,
    pdfFiles,
    planType,
    sendEmailAfterProtection,
    sendProtectedPdfEmail,
    pauseForSafetyVerifiedUi,
    selectedGroupId,
    t,
  ]);

  const onShareViaLine = useCallback(async () => {
    if (!lastShareable) return;
    setLineShareNotice(null);
    setError(null);
    setLineShareBusy(true);
    try {
      const lower = lastShareable.fileName.toLowerCase();
      if (!lower.endsWith(".pdf") && !lower.endsWith(".zip")) {
        setError(t.protectPdfShareLineInvalidType);
        return;
      }
      const mime = lower.endsWith(".zip")
        ? "application/zip"
        : "application/pdf";
      const fd = new FormData();
      fd.set(
        "file",
        new File([lastShareable.blob], lastShareable.fileName, { type: mime })
      );
      const res = await fetch("/api/share/pdf-upload", {
        method: "POST",
        body: fd,
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        url?: string;
      };
      if (!res.ok) {
        const err = j.error;
        if (err === "blob_not_configured") {
          setError(t.protectPdfShareLineBlobMissing);
        } else if (err === "file_too_large") {
          setError(t.protectPdfShareLineFileTooLarge);
        } else if (err === "invalid_type") {
          setError(t.protectPdfShareLineInvalidType);
        } else {
          setError(t.protectPdfShareLineUploadFailed);
        }
        return;
      }
      const publicUrl = j.url;
      if (!publicUrl) {
        setError(t.protectPdfShareLineUploadFailed);
        return;
      }
      const messages = buildPdfShareFlex(
        publicUrl,
        lastShareable.fileName,
        {
          altText: t.protectPdfShareLineFlexAlt,
          title: t.protectPdfShareLineFlexTitle,
          subtitle: t.protectPdfShareLineFlexSubtitle,
          download: t.protectPdfShareLineFlexDownload,
        }
      );
      if (liffReady && canUseShareTargetPicker) {
        try {
          await shareTargetPickerMessages(messages);
        } catch {
          setError(t.protectPdfShareLineShareFailed);
        }
      } else {
        await navigator.clipboard.writeText(publicUrl);
        setLineShareNotice(t.copied);
      }
    } catch {
      setError(t.protectPdfShareLineUploadFailed);
    } finally {
      setLineShareBusy(false);
    }
  }, [
    lastShareable,
    t,
    liffReady,
    canUseShareTargetPicker,
    shareTargetPickerMessages,
  ]);

  const handleDownloadAllZip = useCallback(async () => {
    if (batchOutputBlobs.length === 0) return;
    const zipBlob = await zipNamedBlobs(batchOutputBlobs);
    const name = `creator-guard-batch-${new Date().toISOString().slice(0, 10)}.zip`;
    triggerBlobDownload(zipBlob, name);
  }, [batchOutputBlobs]);

  const showProcessingOverlay = loading && progress !== null;

  const overlayPercent = useMemo(() => {
    if (!progress || progress.total <= 0) return 0;
    return (progress.done / progress.total) * 100;
  }, [progress]);

  const overlayStatusLine = useMemo(() => {
    if (processingVerified) return t.protectPdfOverlaySafetyVerified;
    if (!progress) return "";
    return tpl(t.protectPdfOverlayProcessingMember, {
      current: String(Math.min(progress.done + 1, progress.total)),
      total: String(progress.total),
    });
  }, [progress, processingVerified, t]);

  if (!mounted) {
    return (
      <div
        className="min-h-full bg-canvas px-4 py-10 sm:px-8 sm:py-12 lg:px-12"
        role="main"
        aria-busy="true"
        aria-label={t.protectPdfTitle}
      >
        <div className="mx-auto w-full max-w-4xl animate-pulse space-y-6">
          <div className="h-9 w-2/3 max-w-md rounded-lg bg-slate-200/90" />
          <div className="h-4 w-full max-w-2xl rounded bg-slate-200/70" />
          <div className="h-4 w-full max-w-xl rounded bg-slate-200/60" />
          <div className="flex flex-col gap-4 md:flex-row md:gap-5">
            <div className="h-[min(22rem,50vh)] min-h-[16rem] flex-1 rounded-2xl bg-slate-200/80 md:max-w-[35%]" />
            <div className="h-[min(22rem,50vh)] min-h-[16rem] flex-[1.86] rounded-2xl bg-slate-200/70" />
          </div>
          <p className="text-center text-xs text-slate-500">
            {t.protectPdfLoadingSuffix}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-full bg-canvas px-4 py-10 sm:px-8 sm:py-12 lg:px-12"
      role="main"
    >
      <ProcessingOverlay
        open={showProcessingOverlay}
        current={
          progress
            ? Math.min(progress.done + 1, progress.total)
            : 0
        }
        total={progress?.total ?? 0}
        percent={overlayPercent}
        statusLine={overlayStatusLine}
        countCaption={t.protectPdfOverlayMembersCaption}
        safetyVerified={processingVerified}
      />

      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-10">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {t.protectPdfTitle}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            {t.protectPdfIntro}
          </p>
        </div>

        <div className="flex flex-col gap-8 lg:gap-10">
          <section className="flex w-full min-w-0 flex-col gap-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              {t.protectPdfSectionFiles}
            </h2>
            <div className="flex min-h-0 w-full flex-col gap-4 md:flex-row md:items-stretch md:gap-5">
              <div className="flex min-h-[min(22rem,50vh)] w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-50 shadow-sm md:min-h-[26rem] md:w-[35%] md:max-w-[35%]">
                <div className="shrink-0 space-y-2 border-b border-slate-200/80 bg-canvas-subtle p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                    <button
                      type="button"
                      disabled={!canPickDirectory || dirScanBusy || loading}
                      onClick={() => void openLocalFolder()}
                      className="flex min-h-[2.75rem] flex-1 items-center justify-center gap-2 rounded-xl bg-of-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-of-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {dirScanBusy ? (
                        <span
                          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                          aria-hidden
                        />
                      ) : (
                        <FolderOpen className="h-4 w-4 shrink-0" aria-hidden />
                      )}
                      {t.protectPdfOpenFolder}
                    </button>
                    <button
                      type="button"
                      disabled={
                        loading ||
                        (directoryAssets.length === 0 && folderLabel == null)
                      }
                      onClick={() => clearLocalFolder()}
                      className="flex min-h-[2.75rem] flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t.protectPdfCancelLocal}
                    </button>
                    <button
                      type="button"
                      disabled={vaultLoading || loading}
                      onClick={() => void fetchVaultFiles()}
                      title={t.protectPdfVaultRefreshAria}
                      aria-label={t.protectPdfVaultRefreshAria}
                      className="flex min-h-[2.75rem] min-w-[2.75rem] shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-of-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {vaultLoading ? (
                        <span
                          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-of-500"
                          aria-hidden
                        />
                      ) : (
                        <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
                      )}
                    </button>
                  </div>
                  {!canPickDirectory ? (
                    <p className="text-center text-[11px] leading-snug text-slate-500">
                      {t.protectPdfBrowserUnsupported}
                    </p>
                  ) : null}
                  <label className="sr-only" htmlFor="pdf-folder-search">
                    {t.protectPdfBrowserSearchPlaceholder}
                  </label>
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden
                    />
                    <input
                      id="pdf-folder-search"
                      type="search"
                      value={folderSearchQuery}
                      onChange={(e) => setFolderSearchQuery(e.target.value)}
                      placeholder={t.protectPdfBrowserSearchPlaceholder}
                      disabled={
                        vaultFiles.length === 0 && directoryAssets.length === 0
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-of-500/40 focus:ring-2 focus:ring-of-500/20 disabled:opacity-50"
                    />
                  </div>
                  {vaultPathLabel ? (
                    <p
                      className="truncate text-center text-[10px] font-medium uppercase tracking-wider text-slate-500"
                      title={vaultPathLabel}
                    >
                      Vault: {vaultPathLabel}
                    </p>
                  ) : null}
                  {folderLabel ? (
                    <p className="truncate text-center text-[10px] font-medium uppercase tracking-wider text-slate-500">
                      {folderLabel}
                    </p>
                  ) : null}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2">
                  {vaultFetchError ? (
                    <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-[11px] leading-snug text-amber-950">
                      Vault: {vaultFetchError}. 若請求被 CORS 擋下，請確認 Flask
                      已設定
                      <code className="rounded bg-white/80 px-1">Access-Control-Allow-Origin</code>
                      （flask-insurance-vault 已附於{" "}
                      <code className="rounded bg-white/80 px-1">after_request</code>
                      ）。
                    </p>
                  ) : null}
                  {vaultLoading && vaultFiles.length === 0 ? (
                    <p className="px-2 py-4 text-center text-xs text-slate-500">
                      {t.protectPdfLoadingSuffix}
                    </p>
                  ) : null}
                  {vaultFiles.length === 0 &&
                  directoryAssets.length === 0 &&
                  !vaultLoading &&
                  !vaultFetchError ? (
                    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                      <SidebarEmptyIllustration className="mx-auto mb-4 h-20 w-20 text-slate-200" />
                      <p className="max-w-[14rem] text-sm leading-relaxed text-slate-400">
                        {canPickDirectory
                          ? t.protectPdfBrowserEmpty
                          : t.protectPdfBrowserUnsupported}
                      </p>
                    </div>
                  ) : filteredVaultFiles.length === 0 &&
                    filteredDirectoryAssets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                      <SidebarEmptyIllustration className="mx-auto mb-4 h-20 w-20 text-slate-200" />
                      <p className="text-sm text-slate-400">
                        {t.protectPdfBrowserNoMatch}
                      </p>
                    </div>
                  ) : (
                    <ul className="flex flex-col gap-2 pb-2">
                      {filteredVaultFiles.map((vf) => {
                        const selected = selectedVaultPdf === vf.name;
                        return (
                          <li key={`vault:${vf.name}`}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAssetKey(null);
                                setPreviewSelection(null);
                                setSelectedVaultPdf(vf.is_pdf ? vf.name : null);
                              }}
                              onDoubleClick={() => {
                                if (!vf.is_pdf) return;
                                void (async () => {
                                  try {
                                    const r = await fetch(
                                      `${insuranceVaultBase}/file/${encodeURIComponent(vf.name)}`
                                    );
                                    if (!r.ok) return;
                                    const blob = await r.blob();
                                    const file = new File([blob], vf.name, {
                                      type: "application/pdf",
                                    });
                                    addPdfToQueue(file);
                                  } catch {
                                    /* ignore */
                                  }
                                })();
                              }}
                              title={
                                vf.is_pdf
                                  ? `${vf.name} — ${t.protectPdfPdfDoubleClickHint}`
                                  : vf.name
                              }
                              className={`group flex w-full items-start gap-3 rounded-xl bg-slate-50/50 p-3 text-left transition-all hover:bg-white hover:shadow-sm hover:ring-1 hover:ring-slate-200 ${
                                selected
                                  ? "bg-white shadow-sm ring-2 ring-of-500/35 ring-offset-0"
                                  : ""
                              } ${loading ? "pointer-events-none opacity-50" : ""}`}
                            >
                              <span className="mt-0.5 shrink-0">
                                {vf.is_pdf ? (
                                  <SidebarPdfIcon className="h-9 w-9" />
                                ) : (
                                  <FileText
                                    className="h-9 w-9 text-slate-400"
                                    strokeWidth={1.75}
                                    aria-hidden
                                  />
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-1.5">
                                  <span className="line-clamp-2 min-w-0 break-all text-left text-xs font-medium leading-snug text-slate-800">
                                    {vf.name}
                                  </span>
                                  <span className="shrink-0 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-indigo-700 ring-1 ring-indigo-100/80">
                                    Vault
                                  </span>
                                </span>
                                <span className="mt-1 block text-[10px] text-slate-400">
                                  {vf.size_kb} KB
                                  {vf.is_pdf ? "" : " · preview N/A"}
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                      {filteredDirectoryAssets.map((asset) => {
                        const selected = selectedAssetKey === asset.key;
                        return (
                          <li key={asset.key}>
                            <button
                              type="button"
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = "copy";
                                try {
                                  e.dataTransfer.clearData();
                                  e.dataTransfer.items.add(asset.file);
                                } catch {
                                  try {
                                    e.dataTransfer.setData(
                                      "text/plain",
                                      asset.file.name
                                    );
                                  } catch {
                                    /* ignore */
                                  }
                                }
                              }}
                              onClick={() => {
                                setSelectedVaultPdf(null);
                                setSelectedAssetKey(asset.key);
                                setPreviewSelection(asset.file);
                              }}
                              onDoubleClick={() => {
                                if (asset.kind === "pdf") {
                                  addPdfToQueue(asset.file);
                                }
                              }}
                              title={
                                asset.kind === "pdf"
                                  ? `${asset.file.name} — ${t.protectPdfPdfDoubleClickHint}`
                                  : asset.file.name
                              }
                              className={`group flex w-full items-start gap-3 rounded-xl bg-slate-50/50 p-3 text-left transition-all hover:bg-white hover:shadow-sm hover:ring-1 hover:ring-slate-200 ${
                                selected
                                  ? "bg-white shadow-sm ring-2 ring-of-500/35 ring-offset-0"
                                  : ""
                              } ${loading ? "pointer-events-none opacity-50" : ""}`}
                            >
                              <span className="mt-0.5 shrink-0">
                                {asset.kind === "pdf" ? (
                                  <SidebarPdfIcon className="h-9 w-9" />
                                ) : (
                                  <FileText
                                    className="h-9 w-9 text-slate-400"
                                    strokeWidth={1.75}
                                    aria-hidden
                                  />
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="line-clamp-2 min-w-0 break-all text-left text-xs font-medium leading-snug text-slate-800">
                                  {asset.file.name}
                                </span>
                                <span className="mt-1 block text-[10px] text-slate-400">
                                  {formatFileSize(asset.file.size)}
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>

              <div className="flex min-h-[min(22rem,50vh)] min-w-0 flex-1 flex-col md:min-h-[26rem] md:w-[65%]">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  {t.protectPdfLivePreview}
                </p>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  {selectedVaultPdf ? (
                    <iframe
                      title={t.protectPdfLivePreview}
                      src={`${insuranceVaultBase}/view/${encodeURIComponent(selectedVaultPdf)}`}
                      className="h-full min-h-[14rem] w-full flex-1 bg-white"
                    />
                  ) : previewIsImage && previewUrl ? (
                    <>
                      <div className="min-h-0 flex-1 overflow-auto bg-slate-50 p-3">
                        {/* eslint-disable-next-line @next/next/no-img-element -- blob: preview */}
                        <img
                          src={previewUrl}
                          alt=""
                          className="mx-auto max-h-full w-auto max-w-full object-contain"
                        />
                      </div>
                      <p className="shrink-0 border-t border-slate-100 bg-canvas-subtle px-3 py-2 text-center text-[11px] text-slate-600">
                        {t.protectPdfImagePreviewBatchHint}
                      </p>
                    </>
                  ) : previewUrl && previewIsPdf ? (
                    <iframe
                      title={t.protectPdfLivePreview}
                      src={previewUrl}
                      className="h-full min-h-[14rem] w-full flex-1 bg-white"
                    />
                  ) : (
                    <div className="flex flex-1 items-center justify-center px-4 py-10 text-center text-xs text-slate-500">
                      {t.protectPdfLivePreviewEmpty}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                {t.protectPdfQueueTitle}
              </h3>
              <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
                <div
                  {...getRootProps({
                    className: `relative flex min-h-[11rem] flex-col border-2 border-dashed outline-none transition ${
                      isDragActive
                        ? "cursor-copy border-of-500/55 bg-of-500/[0.08]"
                        : pdfFiles.length === 0
                          ? "cursor-pointer border-slate-200 bg-canvas-subtle hover:border-slate-300 hover:bg-slate-50/90"
                          : "cursor-default border-slate-200 bg-canvas-subtle"
                    } ${loading ? "pointer-events-none opacity-50" : ""}`,
                  })}
                >
                  <input {...getInputProps()} />
                  {pdfFiles.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
                      <p className="max-w-md text-sm font-medium leading-relaxed text-slate-800">
                        {isDragActive
                          ? t.protectPdfDropActive
                          : t.protectPdfQueueDropEmptyHint}
                      </p>
                      {!isDragActive ? (
                        <p className="max-w-sm text-xs leading-relaxed text-slate-500">
                          {t.protectPdfDropHint}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex flex-1 flex-col p-3">
                      <div className="-mx-0.5 flex min-h-[5.5rem] gap-2 overflow-x-auto px-0.5 pb-1 [scrollbar-width:thin]">
                        {pdfFiles.map((f, idx) => {
                          const st = fileQueueStatus[idx] ?? "pending";
                          const statusLabel =
                            st === "protecting"
                              ? t.protectPdfQueueProtecting
                              : st === "ready"
                                ? t.protectPdfQueueReady
                                : t.protectPdfQueuePending;
                          return (
                            <div
                              key={`${idx}-${f.name}-${f.size}`}
                              className="relative w-[6.75rem] shrink-0 rounded-xl border border-slate-200/90 bg-white p-2 pt-7 shadow-sm ring-1 ring-slate-100/80"
                            >
                              <button
                                type="button"
                                disabled={loading}
                                aria-label={tpl(t.protectPdfRemoveFromQueueAria, {
                                  name: f.name,
                                })}
                                title={t.protectPdfFileRemove}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  removeFile(idx);
                                }}
                                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                              >
                                <X className="h-3.5 w-3.5" strokeWidth={2.25} />
                              </button>
                              <div className="flex justify-center">
                                <SidebarPdfIcon className="h-8 w-8" />
                              </div>
                              <p
                                className="mt-1.5 truncate text-center text-[11px] font-semibold leading-tight text-slate-800"
                                title={f.name}
                              >
                                {f.name}
                              </p>
                              <span
                                className={`mx-auto mt-1.5 block max-w-full truncate rounded-full px-1.5 py-0.5 text-center text-[8px] font-bold uppercase tracking-wide ring-1 ${queueFileStatusClass(st)}`}
                                title={statusLabel}
                              >
                                {statusLabel}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-center text-[10px] leading-snug text-slate-400">
                        {t.protectPdfOrDropPdfs}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => void runBatch()}
                    disabled={loading || pdfFiles.length === 0}
                    title={
                      pdfFiles.length === 0
                        ? t.protectPdfQueueAddPdfsFirst
                        : undefined
                    }
                    className="inline-flex min-h-[2.75rem] min-w-[10rem] items-center justify-center rounded-xl bg-of-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-of-500/20 transition hover:bg-of-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none"
                  >
                    {batchCtaLabel}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="flex w-full min-w-0 flex-col gap-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              {t.protectPdfSectionContact}
            </h2>

            {(loading && progress) || batchSendLog.length > 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                {loading && progress ? (
                  <p className="mb-1 text-center text-xs font-medium text-slate-600">
                    {t.protectPdfBatchRunning}
                  </p>
                ) : (
                  <p className="mb-3 text-center text-xs font-medium text-slate-600">
                    {t.protectPdfLastBatch}
                  </p>
                )}
                {batchSendLog.length > 0 ? (
                  <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto border-t border-slate-100 pt-3">
                    {batchSendLog.map((row) => (
                      <li
                        key={row.id}
                        className="flex items-center gap-2 text-xs text-slate-600"
                      >
                        <span
                          className="min-w-0 flex-1 truncate font-medium text-slate-900"
                          title={row.fileName}
                        >
                          {row.fileName}
                        </span>
                        <span
                          className="max-w-[40%] truncate text-slate-600"
                          title={row.email}
                        >
                          {row.email}
                        </span>
                        {row.emailSent ? (
                          <span
                            className="inline-flex shrink-0 items-center gap-0.5 text-emerald-600"
                            title={t.protectPdfEmailSentTitle}
                          >
                            <MailLetterIcon className="text-emerald-600" />
                          </span>
                        ) : (
                          <span className="w-[18px] shrink-0" aria-hidden />
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {!loading && lastShareable ? (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {batchOutputBlobs.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => void handleDownloadAllZip()}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-of-500/35 bg-of-500/10 px-4 py-2.5 text-sm font-semibold text-of-700 transition hover:bg-of-500/15"
                        >
                          {t.protectPdfDownloadAllZip}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={lineShareBusy || !liffReady}
                        onClick={() => void onShareViaLine()}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#06C755]/50 bg-[#06C755]/15 px-4 py-2.5 text-sm font-semibold text-[#89f0a8] transition hover:bg-[#06C755]/25 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {lineShareBusy ? (
                          <>
                            <span
                              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#89f0a8]/30 border-t-[#89f0a8]"
                              aria-hidden
                            />
                            {t.protectPdfShareLineUploading}
                          </>
                        ) : (
                          t.protectPdfShareLine
                        )}
                      </button>
                    </div>
                    {lineShareNotice ? (
                      <p className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-800 shadow-sm">
                        {lineShareNotice}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            <aside
              className="space-y-3 rounded-[1.75rem] border border-slate-200 bg-canvas p-5 shadow-sm shadow-slate-200/50"
              aria-label={t.protectPdfSelectGroup}
            >
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <label
                      htmlFor="select-email-group"
                      className="text-sm font-semibold text-ink"
                    >
                      {t.protectPdfSelectGroup}
                    </label>
                    {groupsSyncBusy ? (
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-of-600"
                        aria-live="polite"
                      >
                        <span
                          className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-of-500/30 border-t-of-500"
                          aria-hidden
                        />
                        {t.protectPdfGroupsSyncing}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                    {t.protectPdfGroupsSourceHint}
                    {!hydrated ? ` · ${t.protectPdfLoadingSuffix}` : null}
                  </p>
                  <select
                    id="select-email-group"
                    value={selectValue}
                    onChange={(e) => onSelectGroupDropdown(e.target.value)}
                    disabled={loading || !hydrated || sidebarPickList.length === 0}
                    className="mt-2 w-full appearance-none rounded-xl border border-slate-200 bg-canvas-subtle bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat py-2.5 pl-4 pr-10 text-sm font-medium text-ink shadow-sm outline-none transition hover:border-of-500/40 focus:ring-2 focus:ring-of-500/25 disabled:cursor-not-allowed disabled:opacity-45"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                    }}
                  >
                    <option value="">{t.protectPdfPickGroupPlaceholder}</option>
                    {sidebarPickList.map(({ id, name, count }) => (
                      <option key={id} value={id}>
                        {name} ({count})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="w-full rounded-xl border border-slate-200 bg-canvas-subtle px-3 py-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  {t.protectPdfGroupMembersTitle}
                </p>
                {selectedGroupMemberEmails === null ? (
                  <p className="mt-2 text-sm text-ink-muted">
                    {t.protectPdfGroupMembersPlaceholder}
                  </p>
                ) : selectedGroupMemberEmails.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-muted">
                    {t.protectPdfGroupMembersEmpty}
                  </p>
                ) : (
                  <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto text-sm text-ink sm:max-h-72">
                    {selectedGroupMemberEmails.map((identity) => (
                      <li
                        key={identity}
                        className="break-all font-mono text-xs leading-relaxed text-slate-800"
                        title={identity}
                      >
                        {identity}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {sidebarPickList.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-muted">
                    {t.protectPdfQuickBadges}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {sidebarPickList.map(({ id, name, count }) => {
                      const active = selectedGroupId === id;
                      return (
                        <div
                          key={id}
                          className={`inline-flex items-stretch overflow-hidden rounded-full border text-sm font-medium shadow-sm transition ${
                            active
                              ? "border-of-500/40 bg-of-500/10 text-of-700 ring-2 ring-of-500/20"
                              : "border-slate-200 bg-canvas-subtle text-ink"
                          }`}
                        >
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => applyGroupById(id)}
                            className="inline-flex max-w-[12rem] items-center gap-1.5 px-3 py-1.5 transition hover:bg-canvas disabled:opacity-45"
                          >
                            <span className="truncate">{name}</span>
                            <span
                              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                                active
                                  ? "bg-of-500/15 text-of-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {count}
                            </span>
                          </button>
                          {canRemoveProtectGroupBadge(id) ? (
                            <button
                              type="button"
                              disabled={loading}
                              title={t.protectPdfRemoveGroup}
                              aria-label={tpl(t.protectPdfRemoveGroupAria, {
                                name,
                              })}
                              onClick={() => {
                                void removeGroupById(id);
                                if (selectedGroupId === id) {
                                  setSelectedGroupId(null);
                                  setSelectValue("");
                                }
                              }}
                              className="border-l border-slate-200 px-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-45"
                            >
                              ×
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : hydrated && !groupsSyncBusy ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-canvas-subtle px-4 py-4 text-sm text-ink-muted shadow-sm">
                  {t.protectPdfNoGroupsHint}{" "}
                  <strong className="text-ink">
                    {t.protectPdfNoGroupsBold}
                  </strong>
                  .
                </p>
              ) : null}
            </aside>

            <div className="relative flex flex-col gap-2">
              {recentThree.length > 0 ? (
                <div className="mb-1">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-600">
                    {t.protectPdfRecentlyUsed}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {recentThree.map((h, idx) => (
                      <button
                        key={`${h.at}-${idx}`}
                        type="button"
                        disabled={loading}
                        onClick={() => applyHistoryEntry(h)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 shadow-sm transition hover:border-of-500/30 hover:bg-of-500/5 disabled:opacity-45"
                        title={h.emails.join(", ")}
                      >
                        {h.emails.length} · {formatHistoryAt(h.at)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <label
                htmlFor="member-identity-list"
                className="text-sm font-medium text-slate-900"
              >
                {t.protectPdfEmailsLabel}
              </label>
              <textarea
                id="member-identity-list"
                value={emailListText}
                onChange={(e) => onEmailTextChange(e.target.value)}
                rows={7}
                disabled={loading}
                placeholder={t.protectPdfEmailsPlaceholder}
                className="min-h-[10rem] w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-of-500 focus:outline-none focus:ring-1 focus:ring-of-500/30 disabled:opacity-60"
              />
              {suggestedLabel && !newGroupName.trim() ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setNewGroupName(suggestedLabel)}
                    className="rounded-lg border border-of-500/30 bg-of-500/10 px-3 py-1.5 text-xs font-medium text-of-700 transition hover:bg-of-500/15 disabled:opacity-45"
                  >
                    {tpl(t.protectPdfUseSuggestedName, {
                      name: suggestedLabel,
                    })}
                  </button>
                </div>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <input
                  id="protect-new-group-name"
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  disabled={loading}
                  placeholder={t.protectPdfNewGroupPlaceholder}
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-of-500 focus:outline-none focus:ring-1 focus:ring-of-500/30 disabled:opacity-60"
                  aria-label={t.protectPdfNewGroupAria}
                />
                <button
                  type="button"
                  onClick={() => void saveAsGroup()}
                  disabled={loading}
                  className="shrink-0 rounded-xl bg-of-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-of-600 disabled:opacity-50"
                >
                  {t.protectPdfSaveAsGroup}
                </button>
              </div>
              <p className="text-xs text-slate-600">
                {parsedEmails.length === 0
                  ? tpl(t.protectPdfManyValidEmails, {
                      count: "0",
                    })
                  : parsedEmails.length === 1
                    ? t.protectPdfOneValidEmail
                    : tpl(t.protectPdfManyValidEmails, {
                        count: String(parsedEmails.length),
                      })}
                {comboCount > 0
                  ? ` · ${
                      comboCount === 1
                        ? t.protectPdfOneOutput
                        : tpl(t.protectPdfManyOutputs, {
                            count: String(comboCount),
                          })
                    }`
                  : ""}
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition hover:border-slate-200">
              <input
                type="checkbox"
                checked={sendEmailAfterProtection}
                onChange={(e) =>
                  setSendEmailAfterProtection(e.target.checked)
                }
                disabled={loading}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 bg-white text-of-500 focus:ring-of-500/30"
              />
              <span className="text-sm leading-snug text-slate-900">
                <span className="font-medium text-slate-900">
                  {t.protectPdfSendEmailCheckbox}
                </span>
                <span className="mt-1 block text-xs text-slate-600">
                  {t.protectPdfSendEmailHint}
                </span>
              </span>
            </label>

            {error ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => void runBatch()}
              disabled={loading || pdfFiles.length === 0}
              className="w-full rounded-xl border border-of-500/35 bg-of-500/10 px-4 py-3 text-sm font-semibold text-of-800 shadow-sm transition hover:bg-of-500/15 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 disabled:shadow-none"
            >
              {batchCtaLabel}
            </button>

            <p className="text-[11px] leading-relaxed text-slate-500">
              {tpl(t.protectPdfFooterBatch, {
                max: String(PDF_BATCH_MAX_COMBOS),
              })}
            </p>

            {showSaveNewListTip ? (
              <div
                className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4 sm:inset-x-auto sm:bottom-6 sm:right-5 sm:justify-end"
                role="status"
              >
                <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm">
                  <p className="min-w-0 flex-1 leading-snug text-slate-800">
                    {t.protectPdfSaveNewListTip}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      document.getElementById("protect-new-group-name")?.focus();
                    }}
                    className="shrink-0 rounded-lg bg-of-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-of-600"
                  >
                    {t.protectPdfSaveNewListCta}
                  </button>
                  <button
                    type="button"
                    aria-label={t.protectPdfSaveNewListDismissAria}
                    onClick={() =>
                      setDismissedSaveTipKey(emailsIdentityKey)
                    }
                    className="shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    ×
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
