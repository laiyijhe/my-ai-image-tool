import type { Locale, Messages } from "./types";

export const locales: Locale[] = ["en", "zh-TW", "zh-CN", "ja", "ko"];

export const localeLabels: Record<Locale, string> = {
  en: "English",
  "zh-TW": "繁體中文",
  "zh-CN": "简体中文",
  ja: "日本語",
  ko: "한국어",
};

function linksReadyManyTemplate(count: number, template: string): string {
  return template.replace("{count}", String(count));
}

export { linksReadyManyTemplate };

export const dictionary: Record<Locale, Messages> = {
  en: {
    brandName: "Creator Guard",
    heroSubtitle: "OnlyFans creators",
    heroTitle: "Creator Guard: Digital Content Protection Shield",
    heroDescription:
      "Share one portal link with your whole audience. Members enter their own ID there. Or copy per-member image links from the table for direct delivery.",
    step1Title: "Step 1 · Global access link",
    step1Body:
      "Choose a name or handle for your portal URL. This is the only link you need to post or DM—fans open it and enter their own Member ID.",
    yourCreatorId: "Your creator ID",
    creatorIdPlaceholder: "e.g. my-studio, Alex, 小明的创作室",
    globalAccessLink: "Global access link",
    copyGlobalLink: "Copy global link",
    copied: "Copied",
    enterCreatorIdHint:
      "Enter a creator ID above to generate your shareable portal URL.",
    step2Title: "Step 2 · Per-member image links (optional)",
    step2Body:
      "Paste member names (comma-separated). Each gets a tracked URL you can paste in DMs or emails.",
    memberNamesLabel: "Member names",
    memberNamesPlaceholder:
      "Paste member names (comma-separated), e.g. alex_m, sam99, Xiao-Ming",
    generateEncryptedLinks: "Generate Encrypted Links",
    linksReadyOne: "1 link ready",
    linksReadyMany: "{count} links ready",
    downloadCsv: "Download CSV",
    individualTrackedTitle: "Individual tracked links",
    individualTrackedHint:
      "Copy sends the full URL. Use Download CSV above to back up every link at once.",
    tableMemberName: "Member Name",
    tableUniqueLink: "Unique Link",
    tableActions: "Actions",
    copyLink: "Copy link",
    csvHeaderMemberName: "Member Name",
    csvHeaderFullUrl: "Full URL",
    csvHeaderPath: "Path",
    memberPortal: "Member portal",
    creatorFallback: "Creator",
    enterMemberIdLabel: "Enter your Member ID to view content",
    memberIdPlaceholder: "e.g. Xiao-Ming",
    memberIdHelp:
      "Your ID is the same one your creator used when generating your link. The image loads automatically after you stop typing.",
    emptyState: "Type your Member ID above to load your content.",
    errorState:
      "Could not load content. Check your Member ID or try again later.",
    protectedContentAlt: "Protected content",
    languageLabel: "Language",
  },
  "zh-TW": {
    brandName: "Creator Guard",
    heroSubtitle: "OnlyFans 創作者",
    heroTitle: "Creator Guard：數位內容防護盾",
    heroDescription:
      "與所有受眾分享一個入口連結，會員在該頁輸入自己的 ID。或從下方表格複製每位會員的圖片連結，直接傳送。",
    step1Title: "步驟 1 · 全站入口連結",
    step1Body:
      "為您的入口網址設定名稱或代號。這是您唯一需要發佈或私訊的連結—粉絲開啟後輸入自己的會員 ID。",
    yourCreatorId: "您的創作者 ID",
    creatorIdPlaceholder: "例如：my-studio、Alex、小明的創作室",
    globalAccessLink: "全站入口連結",
    copyGlobalLink: "複製全站連結",
    copied: "已複製",
    enterCreatorIdHint: "請在上方輸入創作者 ID 以產生可分享的入口網址。",
    step2Title: "步驟 2 · 每位會員圖片連結（選填）",
    step2Body:
      "貼上會員名稱（以逗號分隔）。每位會員會取得一個可追蹤的網址，可用於私訊或電子郵件。",
    memberNamesLabel: "會員名稱",
    memberNamesPlaceholder:
      "請貼上會員名稱（以逗號分隔），例如：alex_m、sam99、小明",
    generateEncryptedLinks: "產生加密連結",
    linksReadyOne: "已準備 1 個連結",
    linksReadyMany: "已準備 {count} 個連結",
    downloadCsv: "下載 CSV",
    individualTrackedTitle: "個別追蹤連結",
    individualTrackedHint:
      "複製會帶入完整網址。請使用上方的「下載 CSV」一次備份所有連結。",
    tableMemberName: "會員名稱",
    tableUniqueLink: "專屬連結",
    tableActions: "操作",
    copyLink: "複製連結",
    csvHeaderMemberName: "會員名稱",
    csvHeaderFullUrl: "完整網址",
    csvHeaderPath: "路徑",
    memberPortal: "會員入口",
    creatorFallback: "創作者",
    enterMemberIdLabel: "輸入您的會員 ID 以檢視內容",
    memberIdPlaceholder: "例如：小明",
    memberIdHelp:
      "您的 ID 與創作者產生連結時使用的名稱相同。停止輸入後圖片會自動載入。",
    emptyState: "請在上方輸入會員 ID 以載入內容。",
    errorState: "無法載入內容。請確認會員 ID 或稍後再試。",
    protectedContentAlt: "受保護內容",
    languageLabel: "語言",
  },
  "zh-CN": {
    brandName: "Creator Guard",
    heroSubtitle: "OnlyFans 创作者",
    heroTitle: "Creator Guard：数字内容防护盾",
    heroDescription:
      "与所有受众分享一个入口链接，会员在该页输入自己的 ID。或从下方表格复制每位会员的图片链接，直接发送。",
    step1Title: "步骤 1 · 全站入口链接",
    step1Body:
      "为您的入口网址设置名称或代号。这是您唯一需要发布或私信的链接—粉丝打开后输入自己的会员 ID。",
    yourCreatorId: "您的创作者 ID",
    creatorIdPlaceholder: "例如：my-studio、Alex、小明的创作室",
    globalAccessLink: "全站入口链接",
    copyGlobalLink: "复制全站链接",
    copied: "已复制",
    enterCreatorIdHint: "请在上方输入创作者 ID 以生成可分享的入口网址。",
    step2Title: "步骤 2 · 每位会员图片链接（选填）",
    step2Body:
      "粘贴会员名称（以逗号分隔）。每位会员将获得一个可追踪的网址，可用于私信或电子邮件。",
    memberNamesLabel: "会员名称",
    memberNamesPlaceholder:
      "请粘贴会员名称（以逗号分隔），例如：alex_m、sam99、小明",
    generateEncryptedLinks: "生成加密链接",
    linksReadyOne: "已准备 1 个链接",
    linksReadyMany: "已准备 {count} 个链接",
    downloadCsv: "下载 CSV",
    individualTrackedTitle: "个别追踪链接",
    individualTrackedHint:
      "复制会带入完整网址。请使用上方的「下载 CSV」一次备份所有链接。",
    tableMemberName: "会员名称",
    tableUniqueLink: "专属链接",
    tableActions: "操作",
    copyLink: "复制链接",
    csvHeaderMemberName: "会员名称",
    csvHeaderFullUrl: "完整网址",
    csvHeaderPath: "路径",
    memberPortal: "会员入口",
    creatorFallback: "创作者",
    enterMemberIdLabel: "输入您的会员 ID 以查看内容",
    memberIdPlaceholder: "例如：小明",
    memberIdHelp:
      "您的 ID 与创作者生成链接时使用的名称相同。停止输入后图片会自动加载。",
    emptyState: "请在上方输入会员 ID 以加载内容。",
    errorState: "无法加载内容。请确认会员 ID 或稍后再试。",
    protectedContentAlt: "受保护内容",
    languageLabel: "语言",
  },
  ja: {
    brandName: "Creator Guard",
    heroSubtitle: "OnlyFans クリエイター向け",
    heroTitle: "Creator Guard：デジタルコンテンツ保護シールド",
    heroDescription:
      "全ファンに共有するポータルリンクは1つだけ。会員はそこで自分のIDを入力します。または表から会員ごとの画像リンクをコピーして直接送れます。",
    step1Title: "ステップ1 · 共通アクセスリンク",
    step1Body:
      "ポータルURL用の名前またはハンドルを設定してください。投稿やDMに貼るのはこのリンクだけです。ファンが開いて自分の会員IDを入力します。",
    yourCreatorId: "クリエイターID",
    creatorIdPlaceholder: "例：my-studio、Alex、創作室",
    globalAccessLink: "共通アクセスリンク",
    copyGlobalLink: "共通リンクをコピー",
    copied: "コピーしました",
    enterCreatorIdHint:
      "上にクリエイターIDを入力すると、共有可能なポータルURLが表示されます。",
    step2Title: "ステップ2 · 会員ごとの画像リンク（任意）",
    step2Body:
      "会員名をカンマ区切りで貼り付けます。それぞれ追跡可能なURLが発行され、DMやメールに貼れます。",
    memberNamesLabel: "会員名",
    memberNamesPlaceholder:
      "会員名をカンマ区切りで貼り付け（例：alex_m, sam99, Xiao-Ming）",
    generateEncryptedLinks: "暗号化リンクを生成",
    linksReadyOne: "リンク 1 件準備済み",
    linksReadyMany: "リンク {count} 件準備済み",
    downloadCsv: "CSVをダウンロード",
    individualTrackedTitle: "個別トラッキングリンク",
    individualTrackedHint:
      "コピーすると完全なURLが入ります。一括バックアップは上の「CSVをダウンロード」を使ってください。",
    tableMemberName: "会員名",
    tableUniqueLink: "固有リンク",
    tableActions: "操作",
    copyLink: "リンクをコピー",
    csvHeaderMemberName: "会員名",
    csvHeaderFullUrl: "完全なURL",
    csvHeaderPath: "パス",
    memberPortal: "会員ポータル",
    creatorFallback: "クリエイター",
    enterMemberIdLabel: "会員IDを入力してコンテンツを表示",
    memberIdPlaceholder: "例：Xiao-Ming",
    memberIdHelp:
      "IDはクリエイターがリンクを作成したときの名前と同じです。入力を止めると画像が自動で読み込まれます。",
    emptyState: "上に会員IDを入力するとコンテンツが読み込まれます。",
    errorState:
      "コンテンツを読み込めませんでした。会員IDを確認するか、後でもう一度お試しください。",
    protectedContentAlt: "保護されたコンテンツ",
    languageLabel: "言語",
  },
  ko: {
    brandName: "Creator Guard",
    heroSubtitle: "OnlyFans 크리에이터",
    heroTitle: "Creator Guard: 디지털 콘텐츠 보호 실드",
    heroDescription:
      "전체 팬에게 포털 링크 하나만 공유하세요. 회원은 그 페이지에서 본인 ID를 입력합니다. 또는 아래 표에서 회원별 이미지 링크를 복사해 직접 보낼 수 있습니다.",
    step1Title: "1단계 · 전역 접속 링크",
    step1Body:
      "포털 URL에 사용할 이름이나 핸들을 정하세요. 게시하거나 DM으로 보낼 링크는 이것뿐입니다. 팬이 열고 본인 회원 ID를 입력합니다.",
    yourCreatorId: "크리에이터 ID",
    creatorIdPlaceholder: "예: my-studio, Alex, 스튜디오",
    globalAccessLink: "전역 접속 링크",
    copyGlobalLink: "전역 링크 복사",
    copied: "복사됨",
    enterCreatorIdHint:
      "위에 크리에이터 ID를 입력하면 공유 가능한 포털 주소가 만들어집니다.",
    step2Title: "2단계 · 회원별 이미지 링크(선택)",
    step2Body:
      "회원 이름을 쉼표로 구분해 붙여 넣으세요. 각 회원에게 추적 가능한 URL이 생성되어 DM이나 이메일에 사용할 수 있습니다.",
    memberNamesLabel: "회원 이름",
    memberNamesPlaceholder:
      "회원 이름을 쉼표로 구분해 붙여 넣기(예: alex_m, sam99, Xiao-Ming)",
    generateEncryptedLinks: "암호화 링크 생성",
    linksReadyOne: "링크 1개 준비됨",
    linksReadyMany: "링크 {count}개 준비됨",
    downloadCsv: "CSV 다운로드",
    individualTrackedTitle: "개별 추적 링크",
    individualTrackedHint:
      "복사 시 전체 URL이 들어갑니다. 한 번에 백업하려면 위의 CSV 다운로드를 사용하세요.",
    tableMemberName: "회원 이름",
    tableUniqueLink: "고유 링크",
    tableActions: "작업",
    copyLink: "링크 복사",
    csvHeaderMemberName: "회원 이름",
    csvHeaderFullUrl: "전체 URL",
    csvHeaderPath: "경로",
    memberPortal: "회원 포털",
    creatorFallback: "크리에이터",
    enterMemberIdLabel: "콘텐츠를 보려면 회원 ID를 입력하세요",
    memberIdPlaceholder: "예: Xiao-Ming",
    memberIdHelp:
      "ID는 크리에이터가 링크를 만들 때 사용한 이름과 같습니다. 입력을 멈추면 이미지가 자동으로 불러와집니다.",
    emptyState: "위에 회원 ID를 입력하면 콘텐츠가 로드됩니다.",
    errorState:
      "콘텐츠를 불러올 수 없습니다. 회원 ID를 확인하거나 나중에 다시 시도하세요.",
    protectedContentAlt: "보호된 콘텐츠",
    languageLabel: "언어",
  },
};

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}
