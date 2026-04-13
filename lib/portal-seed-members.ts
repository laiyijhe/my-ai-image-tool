import type { PortalMember } from "@/components/portal/portal-types";

/** Demo deck merged with manual + cloud rows (same seed as Taiwan portal). */
export const PORTAL_MOCK_MEMBERS: PortalMember[] = [
  {
    id: "demo-1",
    identityId: "line:U4f8b2c1d0e9f8a7b6c5d4e3f2a1",
    source: "LINE 官方帳號",
    date: "2026-04-01",
    groupIds: [],
  },
  {
    id: "demo-2",
    identityId: "@iron_fan_tw",
    source: "Telegram 群組",
    date: "2026-04-02",
    groupIds: [],
  },
  {
    id: "demo-3",
    identityId: "序號 CG-88231",
    source: "官網表單",
    date: "2026-04-02",
    groupIds: [],
  },
  {
    id: "demo-4",
    identityId: "line:VIP_member_09",
    source: "LINE 官方帳號",
    date: "2026-04-03",
    groupIds: [],
  },
  {
    id: "demo-5",
    identityId: "@course_batch_b",
    source: "Telegram 群組",
    date: "2026-04-03",
    groupIds: [],
  },
];
