import type { Messages } from "../types";

/**
 * Taiwan-core portal V5: swipe UI, grouping, and identity field copy (zh-TW only).
 * Merged into `dictionary["zh-TW"]` — keep all strings here for this feature set.
 */
export const zhTWPortalV5: Partial<Messages> = {
  /* Identity field — unified label (LINE / TG / serial) */
  optionalNamesLabel: "成員識別 ID (LINE / TG / 序號)",
  compactNamesPlaceholder:
    "例：line_abc123、@tg_handle、序號 VIP-001（逗號分隔）",
  protectPdfEmailsLabel: "本批次成員識別 ID (LINE / TG / 序號)",
  protectPdfEmailsPlaceholder:
    "member_line_01\n@telegram_user\nVIP-2048\n或以逗號、分號分隔（各 1–64 字元）",
  protectPdfNoGroupsHint:
    "尚無群組。在下方貼上成員識別 ID、命名群組後點",
  verifyPdfMemberIdentity: "成員識別 ID (LINE / TG / 序號)",
  quickTestMemberLabel: "成員識別 ID (LINE / TG / 序號)",
  memberNamesLabel: "成員識別 ID (LINE / TG / 序號)",
  memberNamesPlaceholder:
    "貼上成員識別（逗號分隔），例：line_user、@tg、序號 88",
  enterMemberIdLabel: "輸入您的成員識別 ID (LINE / TG / 序號) 以檢視內容",
  memberIdPlaceholder: "例：line_xxx 或 @handle",
  tableMemberName: "成員識別 ID",
  csvHeaderMemberName: "成員識別 ID",
  massTableMember: "成員識別",
  verifyMemberLabel: "嵌入的成員識別 ID (LINE / TG / 序號)",

  protectPdfIntro:
    "左側拖放 PDF，右側載入通訊錄群組或貼上成員識別 ID (LINE / TG / 序號)，再開始批次防護。多個輸出會以 JSZip 打包。",
  protectPdfGroupsSourceHint:
    "與 Portal 相同的群組（本機＋登入後 Supabase）；下拉選單僅顯示可作為寄件目標的電子郵件地址。",
  protectPdfErrNeedEmail:
    "請選擇通訊錄群組或輸入至少一個成員識別 ID（1–64 字元）。",
  protectPdfErrPasteEmails: "儲存群組前請先貼上至少一個成員識別 ID。",
  protectPdfOneValidEmail: "1 個成員識別 ID",
  protectPdfManyValidEmails: "{count} 個成員識別 ID",
  protectPdfSendEmailHint:
    "使用 Resend。請在 .env.local 設定 RESEND_API_KEY。勾選寄信時，每個成員識別須為有效電子郵件地址。",
  protectPdfErrTooManyCombos:
    "組合過多（{total}）。上限 {max}（檔案 × 成員識別）。請分批處理。",
  protectPdfErrFailedOn: "{file} × {memberId} 失敗（{status}）",

  /* Swipe portal */
  portalSwiperTitle: "待審核聯絡人",
  portalSwiperSubtitle: "右滑加入「已授權」，左滑標記「已略過／黑名單」",
  portalSwipeRightLabel: "已授權",
  portalSwipeLeftLabel: "略過／黑名單",
  portalSwipeEmpty: "目前沒有待分類的聯絡人",
  portalContactIdentity: "識別 ID",
  portalContactSource: "來源",
  portalContactDate: "日期",
  portalManageGroupsTitle: "管理群組",
  portalManageGroupsHint:
    "可新增／刪除自訂群組。「已授權」與「已略過」為系統群組，無法刪除。",
  portalNewGroupNamePlaceholder: "新群組名稱（例：鐵粉、課程 A 班）",
  portalAddGroup: "新增群組",
  portalRemoveGroupAria: "刪除此群組",
  portalGroupedSectionTitle: "已分組名單",
  portalGroupedSectionHint: "拖曳卡片可手動調整所屬群組",
  portalMembersCountTpl: "目前成員：{count} 人",
  portalAuthorizedGroupName: "已授權",
  portalIgnoredGroupName: "已略過／黑名單",
  portalPendingReviewTitle: "滑動分類",
  portalToastAuthorized: "已標記為已授權",
  portalToastIgnored: "已標記為略過／黑名單",
  portalGroupDeletedToast: "已刪除群組（成員回到待審核）",
  portalImportMockHint: "已載入示範聯絡人供測試",
  portalOrganizeTitle: "手動調整分組",
  portalOrganizeHint: "將已分組成員拖曳到其他群組。資料僅存於此瀏覽器（示意）。",
  portalGroupUnassigned: "待審核",
  portalMemberMovedToast: "已移至「{group}」",

  portalViewModeSwipe: "滑動檢視",
  portalViewModeList: "清單檢視",
  portalSearchPlaceholder: "搜尋識別 ID、來源或日期…",
  portalSelectedCountTpl: "已選取 {count} 位成員",
  portalActionMoveToGroupLabel: "移動至群組",
  portalActionApplyMove: "套用",
  portalActionClearSelection: "清除選取",
  portalTableGroupColumn: "所屬群組",
  portalSelectAllFilteredAria: "選取目前清單全部列",
  portalActionBatchProtectPdf: "批量保護 PDF",
  portalClearSelectionAria: "清除選取",
  portalAddMemberTitle: "新增成員",
  portalAddMemberIdentity: "識別 ID (LINE/TG)",
  portalAddMemberIdentityPlaceholder: "LINE / TG / 序號",
  portalAddMemberSource: "來源",
  portalAddMemberSourcePlaceholder: "FB / 直播 / 蝦皮",
  portalAddMemberInitialGroup: "初始群組",
  portalAddMemberPendingOption: "待審核",
  portalAddMemberSubmit: "確認加入",
  portalAddMemberCancel: "取消",
  portalAddMemberErrEmptyIdentity: "請填寫識別 ID。",
  portalAddMemberSuccessTpl: "成員 {id} 已成功加入！",
  portalAddMemberFabAria: "新增成員",
  portalActionManageTagsGroupsLabel: "管理標籤／群組",
  portalMemberTagsAppliedToast: "已加入標籤：{groups}",
  portalFilterUnassignedLabel: "未分組",
  portalFilterUnassignedAria: "切換：僅顯示未分組成員",
  portalQuickProtectPdf: "快速保護",
  portalTableActionsColumn: "操作",
  portalCloudSyncOffline: "未連線雲端（僅本機）",
  portalCloudSyncBusy: "雲端同步中…",
  portalCloudSyncOk: "雲端已同步",
  portalCloudSyncError: "雲端同步失敗",
  portalCloudSyncToastOk: "已同步至雲端",
  portalListShiftHint:
    "按住 Shift 再點另一列的核取方塊，可選取兩者之間的連續範圍（與 Gmail 相同）。",
  portalUpgradeTitle: "已達免費方案成員上限",
  portalUpgradeBody:
    "免費帳號最多可追蹤 5 位成員（示範聯絡人不計入）。升級 Pro 可無限新增成員，且輸出的 PDF 不再附加額外的 Creator Guard 頁尾標示。",
  portalUpgradeCta: "查看 Pro 方案",
  portalUpgradeLater: "稍後再說",
  portalFreePlanRibbon: "免費方案 — 最多追蹤 5 位成員；PDF 含免費版頁尾標示。",
  portalPremiumRibbon:
    "Premium 已啟用 — 成員無上限，PDF 不再附加免費版頁尾。",
  pricingPageTitle: "Creator Guard Pro",
  pricingPagePlaceholder:
    "正式價格與結帳流程將於此頁提供；目前為預留頁面，方便早期體驗與商務洽詢。",
  pricingPageSubtitle:
    "解鎖無限成員、免費版 PDF 無額外頁尾標示，以及完整台灣會員儀表板。",
  pricingCardProTitle: "Pro · 月付",
  pricingCardProDescription: "需要彈性時首選。完整 Pro 功能，按月計費。",
  pricingCardProPrice: "NT$899",
  pricingCardProPeriod: "/ 月",
  pricingBuyNowPro: "立即購買 — 月付",
  pricingCardFounderTitle: "創辦人方案 · 終身",
  pricingCardFounderDescription:
    "一次性付費，永久 Pro 權限。功能與月付 Pro 相同，享創辦人優惠價。",
  pricingCardFounderPrice: "NT$14,990",
  pricingCardFounderPeriod: "一次性",
  pricingBuyNowFounder: "立即購買 — 創辦人終身",
  pricingFounderBadge: "創辦人",
  pricingFounderSlotsOnlyBadge: "僅剩 100 席",
  pricingFoundersSlotsLine: "創辦人方案限量 {count} 席",
  pricingCheckoutFootnote:
    "結帳由 Stripe 處理。購買前請先登入帳號。",
  pricingCheckoutConfigureHint:
    "請設定 STRIPE_SECRET_KEY、Stripe Price ID（伺服器與 NEXT_PUBLIC_*），並登入。例：STRIPE_PRICE_PRO_MONTHLY、STRIPE_PRICE_LIFETIME、NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY、NEXT_PUBLIC_STRIPE_PRICE_LIFETIME。",
  pricingSkipToPortal: "會員儀表板",
  successPageTitle: "歡迎升級 Pro",
  successPageSubtitle: "付款成功！紙花效果為您助興，工作區已解鎖完整功能。",
  successEnterDashboardCta: "進入會員儀表板",
  successViewPricingAgain: "再看一次方案",
};
