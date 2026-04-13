import type { Locale } from "@/lib/i18n/types";
import type { LegalSection } from "@/lib/legal/types";
import { pickLegalLocale } from "@/lib/legal/types";

const PRIVACY_EN: LegalSection[] = [
  {
    heading: "1. Who we are",
    paragraphs: [
      "This Privacy Policy explains how Creator Guard (“we”, “us”) collects, uses, and shares personal data when you use our website and SaaS services. It is intended to support transparency for users in Taiwan and internationally.",
    ],
  },
  {
    heading: "2. Data we collect",
    paragraphs: [
      "Account and identity data: such as email address, display name, and profile identifiers from third-party login providers when you choose to sign in with them.",
      "Usage and technical data: such as IP address, device/browser type, approximate location derived from IP, timestamps, and diagnostic logs needed to secure and operate the Service.",
      "Content you upload: such as PDFs, images, member identifiers, and metadata required to perform protection, verification, or delivery features you request.",
    ],
  },
  {
    heading: "3. Purposes of processing",
    paragraphs: [
      "We process data to provide and improve the Service, authenticate users, process payments, prevent fraud and abuse, comply with legal obligations, communicate service notices, and analyze aggregated usage where permitted.",
    ],
  },
  {
    heading: "4. Legal bases (where applicable)",
    paragraphs: [
      "Depending on jurisdiction, processing may be based on contract performance, legitimate interests (e.g. security and product improvement balanced against your rights), consent where required, or legal obligation.",
    ],
  },
  {
    heading: "5. Payment providers",
    paragraphs: [
      "Payments may be processed by third parties (e.g. Stripe, ECPay, or other gateways). Card or billing details are handled according to those providers’ policies; we typically receive limited billing metadata (e.g. transaction status, last four digits where applicable) rather than full card numbers.",
    ],
  },
  {
    heading: "6. Hosting and subprocessors",
    paragraphs: [
      "We may use cloud infrastructure and database providers (e.g. Supabase or similar) to store account data and application content. Subprocessors are bound by contractual confidentiality and security obligations appropriate to the data involved.",
    ],
  },
  {
    heading: "7. Retention",
    paragraphs: [
      "We retain personal data as long as needed to provide the Service, meet legal/tax/accounting requirements, resolve disputes, and enforce agreements. You may request deletion where applicable law allows, subject to legitimate retention needs.",
    ],
  },
  {
    heading: "8. International transfers",
    paragraphs: [
      "Your data may be processed in Taiwan and other countries where our providers operate. Where required, we implement appropriate safeguards (e.g. standard contractual clauses or equivalent mechanisms) in line with provider documentation.",
    ],
  },
  {
    heading: "9. Cookies and similar technologies",
    paragraphs: [
      "We use cookies and local storage as needed for authentication sessions, language preferences, security, and analytics. You can control cookies through browser settings; disabling certain cookies may limit functionality.",
    ],
  },
  {
    heading: "10. Your rights",
    paragraphs: [
      "Subject to applicable law (including Taiwan Personal Data Protection Act where relevant), you may request access, correction, deletion, restriction, objection, or portability of your personal data, and withdraw consent where processing is consent-based. Contact us using the channels published on the site. You may also lodge a complaint with a competent authority where permitted.",
    ],
  },
  {
    heading: "11. Security",
    paragraphs: [
      "We implement administrative, technical, and organizational measures designed to protect personal data. No method of transmission or storage is 100% secure; please use strong passwords and protect your devices.",
    ],
  },
  {
    heading: "12. Children",
    paragraphs: [
      "The Service is not directed to children under the age where parental consent is required in your jurisdiction. If you believe we collected data from a child improperly, contact us for prompt review.",
    ],
  },
  {
    heading: "13. Changes",
    paragraphs: [
      "We may update this Privacy Policy with a new effective date posted on this page. Material changes may be communicated by email or in-product notice where appropriate.",
    ],
  },
];

const PRIVACY_ZH_TW: LegalSection[] = [
  {
    heading: "一、資料控管者與適用範圍",
    paragraphs: [
      "本隱私權政策說明 Creator Guard（下稱「我們」）於您使用網站與軟體即服務（SaaS）時，如何蒐集、處理、利用及保護您的個人資料。本政策亦協助您於臺灣及其他地區了解您的權利與我們之實務。",
    ],
  },
  {
    heading: "二、我們蒐集的資料",
    paragraphs: [
      "帳號與身分資料：例如電子郵件、顯示名稱，以及當您選擇第三方登入（如 Google）時，該提供者依其授權範圍所提供之識別資訊。",
      "使用與技術資料：例如 IP 位址、裝置／瀏覽器類型、由 IP 推估之大致地理位置、時間戳記、為維運與資安所需之紀錄與稽核資訊。",
      "您主動提供或上傳之內容：例如為執行 PDF／圖像保護、驗證或會員傳遞功能所需之檔案、會員識別文字與相關後設資料。",
    ],
  },
  {
    heading: "三、利用目的",
    paragraphs: [
      "我們於下列目的範圍內利用您的資料：提供與維運本服務、驗證身分、完成付款與對帳、偵測與防止詐欺或濫用、履行法令義務、向您發送與服務相關之重要通知，以及於符合法令之前提下進行去識別或統計分析以改善產品。",
    ],
  },
  {
    heading: "四、法令依據與同意",
    paragraphs: [
      "依各司法管轄區之要求，我們可能基於契約履行、合法正當利益（例如資安與服務改善，並於必要時權衡您的權利）、您的同意，或法令明文義務，作為個人資料處理之依據。若特定功能依法須取得同意，我們將於蒐集前向您說明並提供選擇。",
    ],
  },
  {
    heading: "五、金流與付款服務提供者",
    paragraphs: [
      "當您於結帳流程中付款時，付款資料（例如信用卡資訊）通常由合法立案之第三方支付服務業者（例如 Stripe、綠界 ECPay 或其他金流）直接處理，並受其隱私權與安全政策拘束。我們通常僅取得與訂單履行相關之有限資訊（例如付款結果、訂單編號、部分卡號尾碼等），而不儲存完整卡號。",
    ],
  },
  {
    heading: "六、雲端託管與受託單位",
    paragraphs: [
      "我們可能使用雲端資料庫、物件儲存與身分驗證等服務（例如 Supabase 或類似服務）以存放帳號資料與您上傳之內容。該等受託單位於契約中負有保密與安全義務，且僅得於我們指示範圍內處理資料。",
    ],
  },
  {
    heading: "七、保存期間",
    paragraphs: [
      "除法令另有規定或契約另有必要外，我們於達成蒐集目的所需期間內保存個人資料，包括提供服務、遵循稅務／會計保存義務、爭議處理與權利行使等。當目的消失或保存期間屆滿，我們將刪除、停止處理或以去識別化方式保有。您亦得於法令允許範圍內請求刪除，但若依法令或正當利益仍有保存必要者，不在此限。",
    ],
  },
  {
    heading: "八、跨境傳輸",
    paragraphs: [
      "基於雲端架構，您的資料可能於臺灣境內及境外伺服器處理或備份。若涉及個人資料跨境傳輸，我們將於法令要求範圍內，透過契約或服務提供者所提供之適當機制（例如標準契約條款或其他同等保護措施）降低風險。",
    ],
  },
  {
    heading: "九、Cookie 與類似技術",
    paragraphs: [
      "我們使用 Cookie、本機儲存或其他類似技術，以維持登入狀態、記住語系偏好、強化安全性或進行合規之流量分析。您可透過瀏覽器設定管理 Cookie；若停用必要類型之 Cookie，可能影響部分功能。",
    ],
  },
  {
    heading: "十、當事人權利",
    paragraphs: [
      "在符合個人資料保護法等相關法令之前提下，您得就個人資料行使查詢或閱覽、製給複製本、補充或更正、停止蒐集／處理／利用或刪除等權利（依法令限制者除外）。若您欲行使權利或有疑問，請透過網站公告之聯絡方式提出。於法定條件下，您亦得向主管機關申訴。",
    ],
  },
  {
    heading: "十一、資料安全",
    paragraphs: [
      "我們採取合理之技術與管理措施，以降低未經授權之存取、洩露、竄改或毀損風險。惟網路傳輸與電子儲存無法保證百分之百安全，請您亦應妥善保管帳號與裝置安全。",
    ],
  },
  {
    heading: "十二、兒童隱私",
    paragraphs: [
      "本服務主要面向具備完全行為能力之使用者。若您所在地法令要求取得監護人同意始得蒐集兒童資料，而我們於知悉後確認有不符情形，將儘速採取刪除或其他適當措施。",
    ],
  },
  {
    heading: "十三、政策修訂",
    paragraphs: [
      "我們得隨時修訂本政策，並於網頁更新生效日期。若修訂屬重大變更，於法令要求範圍內，我們將以合理方式通知您。",
    ],
  },
];

const PRIVACY_ZH_CN: LegalSection[] = [
  {
    heading: "一、控制者与范围",
    paragraphs: [
      "本隐私政策说明 Creator Guard（下称「我们」）在您使用网站与 SaaS 服务时，如何收集、使用和保护您的个人信息。",
    ],
  },
  {
    heading: "二、我们收集的信息",
    paragraphs: [
      "账户信息：如电子邮箱、显示名称及第三方登录（如 Google）在授权范围内提供的标识信息。",
      "技术与使用信息：如 IP 地址、设备/浏览器类型、时间戳及安全与运维所需的日志。",
      "您上传的内容：为提供 PDF/图像保护、验证或会员投递而处理的文件与相关数据。",
    ],
  },
  {
    heading: "三、使用目的",
    paragraphs: [
      "我们为实现提供服务、身份验证、处理付款、防范欺诈、遵守法律、发送服务通知及在合法前提下改进产品等目的而处理您的信息。",
    ],
  },
  {
    heading: "四、支付与第三方",
    paragraphs: [
      "付款通常由第三方支付机构（如 Stripe、绿界 ECPay 等）处理，受其隐私政策约束；我们通常仅接收有限的交易信息而非完整卡号。我们可能使用云服务商（如 Supabase）托管数据，并对其施加合同保密与安全义务。",
    ],
  },
  {
    heading: "五、保存、跨境与 Cookie",
    paragraphs: [
      "我们在实现目的所需期限内保存信息，并依法履行税务等保存义务。数据可能在台湾境内外处理；如需跨境传输，我们将在法律要求范围内采取适当措施。我们使用 Cookie 等维持登录与偏好，您可通过浏览器进行管理。",
    ],
  },
  {
    heading: "六、您的权利与安全",
    paragraphs: [
      "在适用法律（包括台湾地区个人资料保护法）允许范围内，您可依法请求查询、阅览、复制、更正、删除、限制处理等。请联系我们公布的渠道。我们采取合理安全措施，但无法保证绝对安全。本服务不面向需监护人同意的儿童；若发现不当收集将及时处理。",
    ],
  },
  {
    heading: "七、政策更新",
    paragraphs: [
      "我们可能更新本政策并公布新的生效日期；重大变更将在法律要求范围内通知您。",
    ],
  },
];

export function getPrivacySections(locale: Locale): LegalSection[] {
  const p = pickLegalLocale(locale);
  if (p === "zh-TW") return PRIVACY_ZH_TW;
  if (p === "zh-CN") return PRIVACY_ZH_CN;
  return PRIVACY_EN;
}
