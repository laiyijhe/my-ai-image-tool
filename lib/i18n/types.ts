export type Locale = "en" | "zh-TW" | "zh-CN" | "ja" | "ko";

export type Messages = {
  brandName: string;
  heroSubtitle: string;
  heroTitle: string;
  heroDescription: string;
  step1Title: string;
  step1Body: string;
  yourCreatorId: string;
  creatorIdPlaceholder: string;
  globalAccessLink: string;
  copyGlobalLink: string;
  copied: string;
  enterCreatorIdHint: string;
  step2Title: string;
  step2Body: string;
  memberNamesLabel: string;
  memberNamesPlaceholder: string;
  generateEncryptedLinks: string;
  linksReadyOne: string;
  linksReadyMany: string;
  downloadCsv: string;
  individualTrackedTitle: string;
  individualTrackedHint: string;
  tableMemberName: string;
  tableUniqueLink: string;
  tableActions: string;
  copyLink: string;
  csvHeaderMemberName: string;
  csvHeaderFullUrl: string;
  csvHeaderPath: string;
  memberPortal: string;
  creatorFallback: string;
  enterMemberIdLabel: string;
  memberIdPlaceholder: string;
  memberIdHelp: string;
  emptyState: string;
  errorState: string;
  protectedContentAlt: string;
  languageLabel: string;
  /** Simplified dashboard (Apple-style) */
  heroTagline: string;
  /** Root hero — direct links to PDF tools (avoid 404 from deep links) */
  homeHeroCtaPdfProtect: string;
  homeHeroCtaPdfVerify: string;
  /** Short badge: frequency-domain / high-resistive watermark */
  highResistProtectionBadge: string;
  portalYourId: string;
  creatorTapToEdit: string;
  creatorNewId: string;
  dropZoneTitle: string;
  dropZoneSubtitle: string;
  browseButton: string;
  optionalNamesLabel: string;
  compactNamesPlaceholder: string;
  generateAllCta: string;
  needMembersHint: string;
  regenCreatorAria: string;
  /** Mass protection (gallery × members) */
  massProtectionTitle: string;
  massProtectionHint: string;
  massGalleryDropTitle: string;
  massGalleryHint: string;
  massGalleryBrowse: string;
  massGalleryClear: string;
  massImagesSelected: string;
  massGenerateBatchesCta: string;
  massNeedImagesHint: string;
  massUploadingLabel: string;
  massUploadProgress: string;
  massBlobUnavailable: string;
  massUploadFailed: string;
  massTableMember: string;
  massTableImage: string;
  massTableLink: string;
  massCopyUniqueLink: string;
  massLinksReady: string;
  massDownloadCsvAll: string;
  massCsvHeaderImage: string;
  /** One-shot upload → direct PNG download (POST /api/protect) */
  quickTestTitle: string;
  quickTestHint: string;
  quickTestImageButton: string;
  quickTestImageChosen: string;
  quickTestMemberLabel: string;
  quickTestMemberPlaceholder: string;
  quickTestGenerate: string;
  quickTestNeedImage: string;
  quickTestNeedMember: string;
  quickTestInvalidMemberId: string;
  quickTestFailed: string;
  quickTestWorking: string;
  quickTestProcessingWait: string;
  /** Apple-style dashboard tabs + toasts */
  tabQuickShield: string;
  tabMassDelivery: string;
  quickProtectDownload: string;
  toastCapacityHint: string;
  toastProtectReady: string;
  toastDismissAria: string;
  /** Leak verification */
  verifyToolLink: string;
  verifyPageTitle: string;
  verifyPageSubtitle: string;
  verifyDropTitle: string;
  verifyDropHint: string;
  verifyButton: string;
  verifyAnalyzing: string;
  verifyMemberLabel: string;
  verifyNoWatermark: string;
  verifyUploadError: string;
  verifyBackHome: string;
  verifyErrMagicMissing: string;
  verifyErrUnsupportedVersion: string;
  verifyErrLengthInvalid: string;
  verifyErrPayloadTruncated: string;
  verifyErrUtf8Corrupt: string;
  verifyErrDecodeFailed: string;
  verifyErrCapacity: string;
  verifyErrSyncOffset: string;
  /** PDF fingerprint (Ghost Hunter) */
  verifyPdfToolLink: string;
  verifyPdfPageTitle: string;
  verifyPdfPageSubtitle: string;
  verifyPdfDropTitle: string;
  verifyPdfMaxSize: string;
  verifyPdfButton: string;
  verifyPdfAnalyzing: string;
  verifyPdfGhostDetected: string;
  verifyPdfCleanDoc: string;
  verifyPdfMemberIdentity: string;
  verifyPdfMemberId: string;
  verifyPdfTimestamp: string;
  verifyPdfVersion: string;
  verifyPdfNeedFile: string;
  verifyPdfScanFailed: string;
  verifyPdfFileTooLarge: string;
  /** PDF verify — forensic report UI (V3.0) */
  verifyPdfScanProgressTitle: string;
  verifyPdfScanLineStream: string;
  verifyPdfScanLineStructure: string;
  verifyPdfScanLineKeywords: string;
  verifyPdfScanLineCorrelate: string;
  verifyPdfScanLineDeepBuffer: string;
  verifyPdfScanLineShaCrossRef: string;
  verifyPdfScanLineFound: string;
  verifyPdfScanLineClean: string;
  verifyPdfOfficialReportTitle: string;
  verifyPdfCaseIdTpl: string;
  verifyPdfSectionEvidence: string;
  verifyPdfLabelOriginalFilename: string;
  verifyPdfLabelFileSize: string;
  verifyPdfLabelPageCount: string;
  verifyPdfSectionFindings: string;
  verifyPdfLabelFingerprintId: string;
  verifyPdfLabelUtcRecorded: string;
  verifyPdfSectionIntegrity: string;
  verifyPdfLabelGuardVersion: string;
  verifyPdfLabelSha256: string;
  verifyPdfWatermarkBg: string;
  verifyPdfPrintReport: string;
  verifyPdfDownloadPng: string;
  verifyPdfExportingPng: string;
  /** PDF protect + contact book (/protect/pdf) */
  protectPdfBackHome: string;
  protectPdfTitle: string;
  protectPdfIntro: string;
  protectPdfSectionFiles: string;
  protectPdfDropActive: string;
  protectPdfDropIdle: string;
  protectPdfDropHint: string;
  protectPdfNoFilesYet: string;
  protectPdfSectionContact: string;
  protectPdfBatchRunning: string;
  protectPdfLastBatch: string;
  protectPdfEmailSentTitle: string;
  protectPdfSelectGroup: string;
  protectPdfSavedInPrefix: string;
  protectPdfGroupsSourceHint: string;
  protectPdfLoadingSuffix: string;
  protectPdfPickGroupPlaceholder: string;
  protectPdfQuickBadges: string;
  /** Shown when no group is selected in the sidebar member preview. */
  protectPdfGroupMembersPlaceholder: string;
  protectPdfGroupMembersTitle: string;
  protectPdfGroupMembersEmpty: string;
  /** Groups list syncing (auth or Supabase fetch). */
  protectPdfGroupsSyncing: string;
  protectPdfRemoveGroup: string;
  protectPdfRemoveGroupAria: string;
  protectPdfNoGroupsHint: string;
  protectPdfNoGroupsBold: string;
  protectPdfEmailsLabel: string;
  protectPdfEmailsPlaceholder: string;
  protectPdfNewGroupPlaceholder: string;
  protectPdfSaveAsGroup: string;
  protectPdfNewGroupAria: string;
  protectPdfSendEmailCheckbox: string;
  protectPdfSendEmailHint: string;
  protectPdfFooterBatch: string;
  protectPdfProtecting: string;
  protectPdfProtectingWithCount: string;
  protectPdfStartBatch: string;
  protectPdfErrNoValidPdfsDropped: string;
  /** Shown when user tries to add a non-PDF to the batch queue (e.g. double-click). */
  protectPdfErrBatchQueuePdfOnly: string;
  protectPdfErrSomeSkipped: string;
  protectPdfErrNeedPdf: string;
  protectPdfErrNeedEmail: string;
  protectPdfErrPdfInvalid: string;
  protectPdfErrTooManyCombos: string;
  protectPdfErrRequestFailed: string;
  protectPdfErrFailedOn: string;
  protectPdfErrGeneric: string;
  protectPdfErrGroupName: string;
  protectPdfErrPasteEmails: string;
  protectPdfErrSendEmailNeedsValidEmail: string;
  protectPdfErrEmailSendFailed: string;
  protectPdfOneValidEmail: string;
  protectPdfManyValidEmails: string;
  protectPdfOneOutput: string;
  protectPdfManyOutputs: string;
  protectPdfBadgePdf: string;
  protectPdfFileRemove: string;
  protectPdfProgressFilesLabel: string;
  protectPdfProgressSteps: string;
  protectPdfOverlayProcessingMember: string;
  protectPdfOverlayMembersCaption: string;
  protectPdfOverlaySafetyVerified: string;
  protectPdfDownloadAllZip: string;
  /** Smart group / history (V2.3) */
  protectPdfRecentlyUsed: string;
  protectPdfSaveNewListTip: string;
  protectPdfSaveNewListCta: string;
  protectPdfSaveNewListDismissAria: string;
  protectPdfUseSuggestedName: string;
  /** LINE LIFF share (V2.4) */
  protectPdfShareLine: string;
  protectPdfShareLineUploading: string;
  protectPdfShareLineFlexAlt: string;
  protectPdfShareLineFlexTitle: string;
  protectPdfShareLineFlexSubtitle: string;
  protectPdfShareLineFlexDownload: string;
  protectPdfShareLineBlobMissing: string;
  protectPdfShareLineUploadFailed: string;
  protectPdfShareLineShareFailed: string;
  protectPdfShareLineFileTooLarge: string;
  protectPdfShareLineInvalidType: string;
  /** Dashboard shell (V4.0) */
  dashboardNavHome: string;
  dashboardNavPdf: string;
  dashboardNavImage: string;
  dashboardNavVideo: string;
  dashboardNavVerify: string;
  dashboardSuiteLabel: string;
  /** Dashboard V4.1 — feature labels + home CTAs */
  dashboardBrandHomeAria: string;
  dashboardNavPdfDocument: string;
  dashboardNavImageSecurity: string;
  dashboardNavVideoProtection: string;
  dashboardNavVideoSoon: string;
  dashboardNavUniversalVerify: string;
  homeCtaEnterDashboard: string;
  homeCtaVerifyFile: string;
  protectImageTitle: string;
  protectImageIntro: string;
  protectImageSectionPreview: string;
  protectImageStartProtect: string;
  protectImageOptionsTitle: string;
  protectImageWatermarkLabel: string;
  protectImageWatermarkPlaceholder: string;
  protectImageTransparencyLabel: string;
  protectImageTransparencyHint: string;
  protectImageDctHint: string;
  protectImageDownloadProtected: string;
  homeCtaStartProtecting: string;
  homeCtaVerifyEvidence: string;
  homeLinkAdvancedPortal: string;
  /** Top nav — primary portal entry (V6.3) */
  navAdminCenter: string;
  /** Home member portal card CTA */
  homeEnterAdminDashboard: string;
  homeMemberPortalBlurb: string;
  /** Taiwan portal quick link to universal verify */
  portalJumpToVerify: string;
  /** Home landing V6.5 — member entry hero */
  homeHeroEntryTitle: string;
  /** Shown directly under the home H1 (e.g. Founders scarcity line for audits). */
  homeHeroFounderAuditLine: string;
  homeHeroEntrySubtitle: string;
  homeWelcomeBack: string;
  /** Home hero — paid plans / pricing entry (always visible; falls back to /pricing). */
  homeCtaPremiumEntry: string;
  /** V6.11 — single primary OAuth CTA on home hero. */
  homeCtaGetStartedCreatorLogin: string;
  /** V7 — large Canva-style home headline (zh-TW core market). */
  homeHeroCanvaTitle: string;
  homeHeroCanvaSubtitle: string;
  homeCtaFreeStartProtect: string;
  /** Supabase Google auth (V6.4) */
  authLogin: string;
  authLoginWithGoogle: string;
  authLoginWithApple: string;
  /** Shown when Apple OAuth is temporarily disabled (facade / maintenance). */
  authAppleLoginMaintenance: string;
  authLogout: string;
  /** Shown in the navbar for paid plans (Pro / yearly / lifetime). */
  authPremiumMemberBadge: string;
  authAccessDenied: string;
  authRestrictedHint: string;
  /** V7 — Auth modal (Canva-style) */
  authModalHeadline: string;
  authModalSubline: string;
  authModalContinueGoogle: string;
  authModalContinueFacebook: string;
  authModalContinueEmail: string;
  authModalEmailPlaceholder: string;
  authModalEmailSubmit: string;
  authModalEmailCheckInbox: string;
  authModalEmailInvalid: string;
  authModalCloseAria: string;
  /** OAuth /auth/callback failure landing (V8.0). */
  authErrorCallbackTitle: string;
  authErrorCallbackBody: string;
  authErrorCallbackCtaHome: string;
  navLogIn: string;
  navSignUp: string;
  /** Primary nav CTA → member portal (groups & delivery). */
  navManageMembersGroups: string;
  /** Site footer + legal (V6.10 — payment / ECPay compliance) */
  footerTerms: string;
  footerPrivacy: string;
  footerPricing: string;
  legalTermsTitle: string;
  legalPrivacyTitle: string;
  legalEffectiveDate: string;
  legalBackHome: string;
  portalBackHome: string;
  portalWorkspaceTitle: string;
  portalWorkspaceSubtitle: string;
  dashboardNavPdfGuard: string;
  dashboardNavImageGuard: string;
  dashboardNavVideoGuard: string;
  dashboardNavVerifyHub: string;
  protectPdfLivePreview: string;
  protectPdfLivePreviewEmpty: string;
  /** V8.5 — File System Access API folder browser */
  protectPdfOpenFolder: string;
  /** Clears local folder selection (sidebar) */
  protectPdfCancelLocal: string;
  /** aria-label / title for vault refresh icon control */
  protectPdfVaultRefreshAria: string;
  protectPdfBrowserSearchPlaceholder: string;
  protectPdfBrowserEmpty: string;
  protectPdfBrowserNoMatch: string;
  protectPdfBrowserUnsupported: string;
  protectPdfImagePreviewBatchHint: string;
  protectPdfOrDropPdfs: string;
  protectPdfPdfDoubleClickHint: string;
  protectPdfQueueTitle: string;
  protectPdfQueuePending: string;
  protectPdfQueueProtecting: string;
  protectPdfQueueReady: string;
  /** Centered hint inside the dashed queue dropzone when empty */
  protectPdfQueueDropEmptyHint: string;
  /** Primary CTA when exactly one PDF is queued */
  protectPdfProtectNFilesOne: string;
  /** Primary CTA when multiple PDFs queued; use tpl with {count} */
  protectPdfProtectNFilesMany: string;
  /** Queue protect button when the queue is empty (disabled) */
  protectPdfQueueAddPdfsFirst: string;
  /** aria-label for compact remove (X) on a queued file card */
  protectPdfRemoveFromQueueAria: string;
  protectImageComingTitle: string;
  protectImageComingBody: string;
  protectVideoComingTitle: string;
  protectVideoComingBody: string;
  /** Universal verify + radar (V4.0) */
  verifyUniversalPageSubtitle: string;
  verifyUniversalDropTitle: string;
  verifyUniversalDropHint: string;
  verifyUniversalUnsupported: string;
  verifyUniversalVideoSoon: string;
  verifyUniversalPdfFoundHint: string;
  verifyUniversalPdfCleanHint: string;
  verifyUniversalFullForensicLink: string;
  verifyUniversalForensicNote: string;
  verifyUniversalRadarTitle: string;
  verifyRadarMimeDetected: string;
  verifyRadarNameImage: string;
  verifyRadarNamePdf: string;
  verifyRadarNameVideo: string;
  verifyRadarNameUnknown: string;
  verifyUniversalScan1: string;
  verifyUniversalScan2: string;
  verifyUniversalScan3: string;
  verifyUniversalScan4: string;
  verifyUniversalOutcomeImageFound: string;
  verifyUniversalOutcomeImageClean: string;
  verifyUniversalOutcomePdfFound: string;
  verifyUniversalOutcomePdfClean: string;
  verifyUniversalOutcomeVideo: string;
  /** /claim — client-side template + fingerprint */
  claimPageLoading: string;
  claimPageFingerprinting: string;
  claimPageSuccess: string;
  claimPageError: string;
  claimPageManualDownload: string;
  claimPageMissingMemberIdentity: string;
  portalOrganizeTitle: string;
  portalOrganizeHint: string;
  portalGroupUnassigned: string;
  portalMockGroupVip: string;
  portalMockGroupStandard: string;
  portalMemberMovedToast: string;
  /** Taiwan swipe portal (V5) — EN fallbacks; zh-TW copy lives in locales/zh-TW.ts */
  portalSwiperTitle: string;
  portalSwiperSubtitle: string;
  portalSwipeRightLabel: string;
  portalSwipeLeftLabel: string;
  portalSwipeEmpty: string;
  portalContactIdentity: string;
  portalContactSource: string;
  portalContactDate: string;
  portalManageGroupsTitle: string;
  portalManageGroupsHint: string;
  portalNewGroupNamePlaceholder: string;
  portalAddGroup: string;
  portalRemoveGroupAria: string;
  portalGroupedSectionTitle: string;
  portalGroupedSectionHint: string;
  portalMembersCountTpl: string;
  portalAuthorizedGroupName: string;
  portalIgnoredGroupName: string;
  portalPendingReviewTitle: string;
  portalToastAuthorized: string;
  portalToastIgnored: string;
  portalGroupDeletedToast: string;
  portalImportMockHint: string;
  /** Hybrid portal V5.1 */
  portalViewModeSwipe: string;
  portalViewModeList: string;
  portalSearchPlaceholder: string;
  portalSelectedCountTpl: string;
  portalActionMoveToGroupLabel: string;
  portalActionApplyMove: string;
  portalActionClearSelection: string;
  portalTableGroupColumn: string;
  portalSelectAllFilteredAria: string;
  portalListShiftHint: string;
  /** Batch PDF handoff from portal (V5.2) */
  portalActionBatchProtectPdf: string;
  portalClearSelectionAria: string;
  /** Add member modal (V5.3) */
  portalAddMemberTitle: string;
  portalAddMemberIdentity: string;
  portalAddMemberIdentityPlaceholder: string;
  portalAddMemberSource: string;
  portalAddMemberSourcePlaceholder: string;
  portalAddMemberInitialGroup: string;
  portalAddMemberPendingOption: string;
  portalAddMemberSubmit: string;
  portalAddMemberCancel: string;
  portalAddMemberErrEmptyIdentity: string;
  portalAddMemberSuccessTpl: string;
  portalAddMemberFabAria: string;
  /** Portal V5.4 — multi-group tags & quick PDF */
  portalActionManageTagsGroupsLabel: string;
  portalMemberTagsAppliedToast: string;
  portalFilterUnassignedLabel: string;
  portalFilterUnassignedAria: string;
  portalQuickProtectPdf: string;
  portalTableActionsColumn: string;
  /** Cloud sync (V6.1) */
  portalCloudSyncOffline: string;
  portalCloudSyncBusy: string;
  portalCloudSyncOk: string;
  portalCloudSyncError: string;
  portalCloudSyncToastOk: string;
  /** Free-tier limit + Pro upsell (V6.6) */
  portalUpgradeTitle: string;
  portalUpgradeBody: string;
  portalUpgradeCta: string;
  portalUpgradeLater: string;
  /** In-app plan ribbon (portal) */
  portalFreePlanRibbon: string;
  portalPremiumRibbon: string;
  pricingPageTitle: string;
  pricingPagePlaceholder: string;
  pricingPageSubtitle: string;
  pricingCardProTitle: string;
  pricingCardProDescription: string;
  pricingCardProPrice: string;
  pricingCardProPeriod: string;
  pricingBuyNowPro: string;
  pricingCardFounderTitle: string;
  pricingCardFounderDescription: string;
  pricingCardFounderPrice: string;
  pricingCardFounderPeriod: string;
  pricingBuyNowFounder: string;
  pricingFounderBadge: string;
  /** Short scarcity badge on the Founders card (distinct from {@link pricingFounderBadge}). */
  pricingFounderSlotsOnlyBadge: string;
  /** Use `{count}` for hardcoded founders slot display, e.g. "100". */
  pricingFoundersSlotsLine: string;
  pricingCheckoutFootnote: string;
  pricingCheckoutConfigureHint: string;
  pricingSkipToPortal: string;
  successPageTitle: string;
  successPageSubtitle: string;
  successEnterDashboardCta: string;
  successViewPricingAgain: string;
};
