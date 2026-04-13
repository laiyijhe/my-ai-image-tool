export const GROUP_AUTHORIZED = "authorized";
export const GROUP_IGNORED = "ignored";

export type PortalMember = {
  id: string;
  identityId: string;
  source: string;
  date: string;
  /** Empty = 待審核 / pending swipe queue; members may belong to multiple groups */
  groupIds: string[];
  /** ISO time for Supabase / local conflict resolution (manual rows) */
  updatedAt?: string;
};

export type CustomGroup = { id: string; name: string };

export type PortalViewMode = "swipe" | "list";
