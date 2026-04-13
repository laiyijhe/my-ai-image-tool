import type { Messages } from "./types";

/** English fallbacks for Taiwan swipe portal strings (non–zh-TW locales). */
export const portalV5EnFallbacks: Pick<
  Messages,
  | "portalSwiperTitle"
  | "portalSwiperSubtitle"
  | "portalSwipeRightLabel"
  | "portalSwipeLeftLabel"
  | "portalSwipeEmpty"
  | "portalContactIdentity"
  | "portalContactSource"
  | "portalContactDate"
  | "portalManageGroupsTitle"
  | "portalManageGroupsHint"
  | "portalNewGroupNamePlaceholder"
  | "portalAddGroup"
  | "portalRemoveGroupAria"
  | "portalGroupedSectionTitle"
  | "portalGroupedSectionHint"
  | "portalMembersCountTpl"
  | "portalAuthorizedGroupName"
  | "portalIgnoredGroupName"
  | "portalPendingReviewTitle"
  | "portalToastAuthorized"
  | "portalToastIgnored"
  | "portalGroupDeletedToast"
  | "portalImportMockHint"
  | "portalViewModeSwipe"
  | "portalViewModeList"
  | "portalSearchPlaceholder"
  | "portalSelectedCountTpl"
  | "portalActionMoveToGroupLabel"
  | "portalActionApplyMove"
  | "portalActionClearSelection"
  | "portalTableGroupColumn"
  | "portalSelectAllFilteredAria"
  | "portalListShiftHint"
  | "portalActionBatchProtectPdf"
  | "portalClearSelectionAria"
  | "portalAddMemberTitle"
  | "portalAddMemberIdentity"
  | "portalAddMemberIdentityPlaceholder"
  | "portalAddMemberSource"
  | "portalAddMemberSourcePlaceholder"
  | "portalAddMemberInitialGroup"
  | "portalAddMemberPendingOption"
  | "portalAddMemberSubmit"
  | "portalAddMemberCancel"
  | "portalAddMemberErrEmptyIdentity"
  | "portalAddMemberSuccessTpl"
  | "portalAddMemberFabAria"
  | "portalActionManageTagsGroupsLabel"
  | "portalMemberTagsAppliedToast"
  | "portalFilterUnassignedLabel"
  | "portalFilterUnassignedAria"
  | "portalQuickProtectPdf"
  | "portalTableActionsColumn"
  | "portalCloudSyncOffline"
  | "portalCloudSyncBusy"
  | "portalCloudSyncOk"
  | "portalCloudSyncError"
  | "portalCloudSyncToastOk"
  | "portalUpgradeTitle"
  | "portalUpgradeBody"
  | "portalUpgradeCta"
  | "portalUpgradeLater"
  | "portalFreePlanRibbon"
  | "portalPremiumRibbon"
  | "pricingPageTitle"
  | "pricingPagePlaceholder"
  | "pricingPageSubtitle"
  | "pricingCardProTitle"
  | "pricingCardProDescription"
  | "pricingCardProPrice"
  | "pricingCardProPeriod"
  | "pricingBuyNowPro"
  | "pricingCardFounderTitle"
  | "pricingCardFounderDescription"
  | "pricingCardFounderPrice"
  | "pricingCardFounderPeriod"
  | "pricingBuyNowFounder"
  | "pricingFounderBadge"
  | "pricingFounderSlotsOnlyBadge"
  | "pricingFoundersSlotsLine"
  | "pricingCheckoutFootnote"
  | "pricingCheckoutConfigureHint"
  | "pricingSkipToPortal"
  | "successPageTitle"
  | "successPageSubtitle"
  | "successEnterDashboardCta"
  | "successViewPricingAgain"
> = {
  portalSwiperTitle: "Review contacts",
  portalSwiperSubtitle: "Swipe right to authorize, left to ignore or block.",
  portalSwipeRightLabel: "Authorized",
  portalSwipeLeftLabel: "Ignored / blocklist",
  portalSwipeEmpty: "No contacts pending review.",
  portalContactIdentity: "Identity ID",
  portalContactSource: "Source",
  portalContactDate: "Date",
  portalManageGroupsTitle: "Manage groups",
  portalManageGroupsHint:
    "Add or remove custom groups. Authorized and Ignored are fixed system groups.",
  portalNewGroupNamePlaceholder: "Group name",
  portalAddGroup: "Add group",
  portalRemoveGroupAria: "Remove group",
  portalGroupedSectionTitle: "Grouped members",
  portalGroupedSectionHint: "Drag cards between groups to adjust assignments.",
  portalMembersCountTpl: "Members: {count}",
  portalAuthorizedGroupName: "Authorized",
  portalIgnoredGroupName: "Ignored / blocklist",
  portalPendingReviewTitle: "Swipe to classify",
  portalToastAuthorized: "Marked as authorized.",
  portalToastIgnored: "Marked as ignored / blocklist.",
  portalGroupDeletedToast: "Group removed (members returned to queue).",
  portalImportMockHint: "Loaded sample contacts for testing.",
  portalViewModeSwipe: "Swipe",
  portalViewModeList: "List",
  portalSearchPlaceholder: "Search identity, source, or date…",
  portalSelectedCountTpl: "{count} members selected",
  portalActionMoveToGroupLabel: "Move to group",
  portalActionApplyMove: "Apply",
  portalActionClearSelection: "Clear",
  portalTableGroupColumn: "Group",
  portalSelectAllFilteredAria: "Select all visible rows",
  portalListShiftHint:
    "Shift-click a checkbox to select a continuous range (like Gmail).",
  portalActionBatchProtectPdf: "Batch-protect PDF",
  portalClearSelectionAria: "Clear selection",
  portalAddMemberTitle: "Add member",
  portalAddMemberIdentity: "Identity ID (LINE / Telegram)",
  portalAddMemberIdentityPlaceholder: "LINE / Telegram / serial no.",
  portalAddMemberSource: "Source",
  portalAddMemberSourcePlaceholder: "FB / live / Shopee",
  portalAddMemberInitialGroup: "Initial group",
  portalAddMemberPendingOption: "Pending review",
  portalAddMemberSubmit: "Confirm add",
  portalAddMemberCancel: "Cancel",
  portalAddMemberErrEmptyIdentity: "Identity ID is required.",
  portalAddMemberSuccessTpl: "Member {id} was added.",
  portalAddMemberFabAria: "Add member",
  portalActionManageTagsGroupsLabel: "Manage tags / groups",
  portalMemberTagsAppliedToast: "Tags added: {groups}",
  portalFilterUnassignedLabel: "Unassigned",
  portalFilterUnassignedAria: "Toggle: show only unassigned members",
  portalQuickProtectPdf: "Quick protect",
  portalTableActionsColumn: "Actions",
  portalCloudSyncOffline: "Cloud sync off (local only)",
  portalCloudSyncBusy: "Syncing with cloud…",
  portalCloudSyncOk: "Cloud sync up to date",
  portalCloudSyncError: "Cloud sync failed",
  portalCloudSyncToastOk: "Saved to cloud",
  portalUpgradeTitle: "You’ve reached the Free plan limit",
  portalUpgradeBody:
    "Free accounts can track up to 5 members (sample contacts don’t count). Upgrade to Pro for unlimited members and PDFs without the extra Creator Guard footer.",
  portalUpgradeCta: "View Pro pricing",
  portalUpgradeLater: "Not now",
  portalFreePlanRibbon:
    "Free plan — up to 5 tracked members; PDFs include the free-tier footer.",
  portalPremiumRibbon:
    "Premium active — unlimited members and no free-tier PDF footer.",
  pricingPageTitle: "Creator Guard Pro",
  pricingPagePlaceholder:
    "Pricing and checkout will appear here. This page is a placeholder for early access and sales conversations.",
  pricingPageSubtitle:
    "Unlock unlimited members, no free-tier PDF footer, and the full Taiwan member dashboard.",
  pricingCardProTitle: "Pro · Monthly",
  pricingCardProDescription:
    "Best if you want flexibility. Full Pro features, billed monthly.",
  pricingCardProPrice: "$29",
  pricingCardProPeriod: "/ month",
  pricingBuyNowPro: "Buy now — Monthly",
  pricingCardFounderTitle: "Founders’ Edition · Lifetime",
  pricingCardFounderDescription:
    "One-time payment for permanent Pro access. Same features as monthly Pro, with founders pricing.",
  pricingCardFounderPrice: "$499",
  pricingCardFounderPeriod: "one-time",
  pricingBuyNowFounder: "Buy now — Founders lifetime",
  pricingFounderBadge: "Founders",
  pricingFounderSlotsOnlyBadge: "Only 100 slots",
  pricingFoundersSlotsLine:
    "{count} limited slots remaining — Founders’ Edition",
  pricingCheckoutFootnote:
    "Secure checkout via Stripe. You must be signed in to purchase.",
  pricingCheckoutConfigureHint:
    "Set STRIPE_SECRET_KEY, Stripe Price IDs (server + NEXT_PUBLIC_*), and sign in. Example: STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_LIFETIME, NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY, NEXT_PUBLIC_STRIPE_PRICE_LIFETIME.",
  pricingSkipToPortal: "Member dashboard",
  successPageTitle: "Welcome to Pro",
  successPageSubtitle:
    "Payment successful — enjoy the confetti (紙花) and your upgraded workspace.",
  successEnterDashboardCta: "Enter member dashboard",
  successViewPricingAgain: "View pricing again",
};
