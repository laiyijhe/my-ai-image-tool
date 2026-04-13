import type { Locale } from "@/lib/i18n/types";
import type { LegalSection } from "@/lib/legal/types";
import { pickLegalLocale } from "@/lib/legal/types";

const TERMS_EN: LegalSection[] = [
  {
    heading: "1. Agreement",
    paragraphs: [
      "These Terms of Service (“Terms”) govern your use of Creator Guard (“Service”), a software-as-a-service platform operated for digital content protection, member delivery links, and related tools. By creating an account, accessing the Service, or purchasing a paid plan, you agree to these Terms and our Privacy Policy.",
      "If you do not agree, do not use the Service.",
    ],
  },
  {
    heading: "2. Service description",
    paragraphs: [
      "Creator Guard provides web-based features that may include member/identity management, PDF and media protection workflows, verification tools, and cloud sync where configured. Features may change as we improve the product; we will use reasonable efforts to avoid materially reducing core paid functionality during an active subscription period except as required for security, law, or third-party API changes.",
    ],
  },
  {
    heading: "3. Accounts and eligibility",
    paragraphs: [
      "You must provide accurate registration information and safeguard your credentials. You are responsible for activity under your account. We may suspend or terminate accounts that violate these Terms, pose security risk, or abuse the Service.",
      "You must be legally able to enter into a contract in your jurisdiction. Where third-party login (e.g. Google) is offered, its provider terms also apply.",
    ],
  },
  {
    heading: "4. Fees, billing, and taxes",
    paragraphs: [
      "Paid plans, founders’ editions, and add-ons are billed as described at checkout (e.g. monthly subscription, annual, or one-time lifetime where offered). Prices may change for new purchases; existing subscriptions are governed by the price and plan shown at purchase unless we notify you as required by law.",
      "You authorize us and our payment partners to charge applicable fees and taxes. Invoices or receipts depend on your payment method and local regulations.",
    ],
  },
  {
    heading: "5. Refunds, cancellation, and cooling-off (Taiwan context)",
    paragraphs: [
      "Where the Consumer Protection Act of the Republic of China (Taiwan) or other mandatory rules apply, your statutory rights are not waived. For digital services that begin performance with your consent before the cooling-off period ends, applicable exceptions may apply under law; we will honor lawful refund and dispute procedures communicated by the payment provider or competent authority.",
      "You may cancel recurring subscriptions through the billing channel provided (e.g. payment portal) where available. One-time or founders’ purchases may be non-refundable except as required by law or at our reasonable discretion for technical failure attributable to us.",
    ],
  },
  {
    heading: "6. Acceptable use",
    paragraphs: [
      "You may not use the Service to infringe intellectual property, distribute unlawful content, harass others, circumvent security, overload systems, scrape without permission, or resell the Service in violation of plan limits. We may remove content or suspend access when necessary to comply with law or protect users.",
    ],
  },
  {
    heading: "7. Intellectual property",
    paragraphs: [
      "We retain rights in the Service, branding, and software. You retain rights in content you upload. You grant us a limited license to host, process, and display your content solely to operate the Service for you.",
    ],
  },
  {
    heading: "8. Disclaimers and limitation of liability",
    paragraphs: [
      "The Service is provided “as is” to the fullest extent permitted by law. We do not warrant uninterrupted or error-free operation. To the extent permitted by applicable law, our aggregate liability arising from the Service is limited to the fees you paid to us in the twelve (12) months before the claim (or, if none, one hundred (100) New Taiwan Dollars), except where liability cannot be limited by law.",
    ],
  },
  {
    heading: "9. Privacy",
    paragraphs: [
      "Our collection and use of personal data are described in the Privacy Policy, which forms part of these Terms.",
    ],
  },
  {
    heading: "10. Governing law and venue",
    paragraphs: [
      "Unless mandatory rules of your country provide otherwise, these Terms are governed by the laws of the Republic of China (Taiwan), without regard to conflict-of-law principles. For disputes not subject to mandatory jurisdiction elsewhere, you and we agree that the Taipei District Court shall have jurisdiction as the court of first instance.",
    ],
  },
  {
    heading: "11. Changes and contact",
    paragraphs: [
      "We may update these Terms by posting a revised version with a new effective date. Material changes may be communicated by email or in-product notice where appropriate. Continued use after the effective date constitutes acceptance unless prohibited by law.",
      "For compliance and payment-related inquiries, contact us through the support or business channels published on the website.",
    ],
  },
];

const TERMS_ZH_TW: LegalSection[] = [
  {
    heading: "一、條款之適用與同意",
    paragraphs: [
      "本服務條款（下稱「本條款」）規範您使用 Creator Guard（下稱「本服務」）之權利義務。本服務為軟體即服務（SaaS）型態，提供數位內容防護、會員／身分管理、傳遞連結與相關工具等功能。當您註冊帳號、實際使用本服務或完成付費方案購買時，即視為已閱讀、理解並同意受本條款及《隱私權政策》之拘束。",
      "若您不同意，請勿使用本服務。",
    ],
  },
  {
    heading: "二、服務內容與變更",
    paragraphs: [
      "本服務具體功能包括但不限於：會員入口與名單管理、PDF／媒體保護流程、驗證與取證相關工具，以及於設定完成時之雲端同步等。我們得依產品演進調整、更新或優化介面與功能；於您有效訂閱期間，除因資安、法令或第三方 API 重大變更所必要者外，我們將合理避免單方面實質降低付費方案之核心功能。",
    ],
  },
  {
    heading: "三、帳號註冊與安全",
    paragraphs: [
      "您應提供真實、正確之資料，並妥善保管帳號與密鑰／登入方式。您帳號下之一切行為，視為您本人之行為，應自行負責。若有違反本條款、涉嫌違法、濫用或危害系統安全之情事，我們得暫停或終止您的使用權限。",
      "若您使用第三方登入（例如 Google），除本條款外，亦應遵守該第三方服務之條款。",
    ],
  },
  {
    heading: "四、費用、方案與稅費",
    paragraphs: [
      "付費方案（含月費／年費／創辦人方案或一次性方案等）之價金、計費週期與內容，以結帳頁面或合作金流／發票夥伴所顯示為準。價格得調整，但新價格原則上適用於調整後新購買之訂單；既有訂閱關係除法令另有規定或契約另有約定外，依您原購買時之約定辦理。",
      "您同意授權我們及合法之付款服務提供者，依約定方式收取應付費用及依法應併同收取之稅費。電子發票或憑證之開立格式，依財稅法規與金流夥伴實作為準。",
    ],
  },
  {
    heading: "五、退款、解除契約與消費爭議（臺灣消費者保護）",
    paragraphs: [
      "如您為適用中華民國《消費者保護法》或其他強制規定之消費者，您依法享有之權利不因本條款而減損。關於線上服務之七日鑑賞期與例外事由，依現行法令及經濟部相關函釋辦理；若屬「經您同意始提供之數位內容或線上服務」且符合法定例外，於法定範圍內可能不適用無條件解除，但仍應保障您之申訴與爭議處理權利。",
      "週期性訂閱方案，您得依付款管理介面或金流平台所提供之方式辦理終止續扣。一次性或創辦人方案，除法令另有強制規定、或因可歸責於我方之重大技術瑕疵致無法使用外，原則上於付款完成後不予退費；若有爭議，您得透過網站公告之客服管道、支付機構爭議機制或主管機關協助處理。",
    ],
  },
  {
    heading: "六、使用者守法義務與禁止行為",
    paragraphs: [
      "您不得利用本服務從事違反法令、侵害他人智慧財產權、隱私、名譽之行為，亦不得上傳或散佈惡意程式、進行未經授權之爬取、破解、干擾系統、或於違反方案限制下轉售本服務。我們得於合理範圍內移除資料、限制功能或終止契約以符合法令並保護其他使用者。",
    ],
  },
  {
    heading: "七、智慧財產權",
    paragraphs: [
      "本服務之軟體、商標、設計與文件等，歸屬於我們或合法權利人所有。您自行上傳之內容，智慧財產權仍歸您或合法權利人所有；您授權我們於提供本服務所必要之範圍內，進行儲存、處理、備份與顯示，僅限於營運與履行契約之目的。",
    ],
  },
  {
    heading: "八、免責與責任限制",
    paragraphs: [
      "於法令允許之最大範圍內，本服務依「現狀」提供，我們不就特定結果、不間斷、無錯誤或與第三方服務之相容性為默示保證。因可歸責於我們所致之損害，於依法不得排除或限制者外，我們對您所負之總賠償責任，以您於該請求發生前十二個月內就本服務已實際支付予我們之費用總額為上限（若無付費紀錄，以新臺幣一百元為上限）。",
    ],
  },
  {
    heading: "九、隱私與個人資料",
    paragraphs: [
      "我們如何蒐集、處理及利用個人資料，請詳見《隱私權政策》；該政策視為本條款之一部。",
    ],
  },
  {
    heading: "十、準據法與管轄法院",
    paragraphs: [
      "本條款之解釋與適用，除法律就涉外民事事件另有強制規定應適用他國法者外，以中華民國法律為準據法。因本條款或本服務所生之爭議，如依法得由當事人約定管轄法院者，雙方同意以臺灣臺北地方法院為第一審合意管轄法院。",
    ],
  },
  {
    heading: "十一、條款修訂與聯絡方式",
    paragraphs: [
      "我們得隨時修訂本條款；修訂後將公告於網站並標示更新日期。若屬重大變更，於法令要求範圍內，我們將以合理方式通知您（例如站內訊息或註冊電子郵件）。您於生效日後繼續使用本服務者，除法令另有規定外，視為同意修訂內容。",
      "與金流、發票或合規相關之詢問，請透過網站所載之客服或商務聯絡管道與我們聯繫。",
    ],
  },
];

const TERMS_ZH_CN: LegalSection[] = [
  {
    heading: "一、条款的适用与同意",
    paragraphs: [
      "本服务条款（下称「本条款」）规范您使用 Creator Guard（下称「本服务」）的权利义务。本服务为软件即服务（SaaS），提供数字内容防护、会员／身份管理、投递链接与相关工具。当您注册账号、使用本服务或完成付费购买，即视为已阅读并同意本条款及《隐私政策》。",
      "若您不同意，请勿使用本服务。",
    ],
  },
  {
    heading: "二、服务内容",
    paragraphs: [
      "具体功能包括会员入口与名单管理、PDF／媒体保护、验证工具及（如已配置）云同步等。我们可随产品演进调整功能；在有效订阅期内，除因安全、法律或第三方 API 重大变更外，我们将合理避免单方面实质降低付费核心功能。",
    ],
  },
  {
    heading: "三、账号与安全",
    paragraphs: [
      "您应提供真实资料并妥善保管登录方式。您账号下的行为由您负责。若有违法、滥用或危害安全之虞，我们得暂停或终止服务。使用第三方登录时，亦应遵守该第三方之条款。",
    ],
  },
  {
    heading: "四、费用与税务",
    paragraphs: [
      "付费方案之价格与计费周期以结账页面或支付服务商显示为准。我们得调整新订单价格；既有订阅除法律或合同另有规定外，依原购买约定。您授权我们及合法支付服务商收取费用及依法应缴税费。",
    ],
  },
  {
    heading: "五、退款与争议（台湾地区消费者保护参照）",
    paragraphs: [
      "若您依法享有消费者保护权利，该等权利不因本条款而减损。关于七日鉴赏期及数字化服务例外，依台湾地区相关法令与主管机关解释。周期性订阅可依支付管理界面终止续扣。一次性方案除法律强制规定或可归责于我方之重大技术故障外，原则上付款完成后不予退费；争议可透过网站客服或支付机构机制处理。",
    ],
  },
  {
    heading: "六、禁止行为",
    paragraphs: [
      "您不得利用本服务从事违法、侵害他人知识产权或隐私之行为，不得干扰系统、未经授权大量抓取或违反方案限制转售本服务。",
    ],
  },
  {
    heading: "七、知识产权",
    paragraphs: [
      "本服务之软件与品牌等归我们或合法权利人所有。您上传内容之权利仍归您；您授权我们在运营本服务必要范围内存储、处理与显示该内容。",
    ],
  },
  {
    heading: "八、责任限制",
    paragraphs: [
      "于法律允许范围内，本服务按「现状」提供。除法律不得排除或限制者外，我们就相关索赔所负赔偿责任，以您于索赔前十二个月内向我们已支付之费用总额为上限（若无付费记录，以新台币一百元为上限）。",
    ],
  },
  {
    heading: "九、隐私",
    paragraphs: [
      "个人资料之处理详见《隐私政策》，该政策为本条款之一部分。",
    ],
  },
  {
    heading: "十、准据法与管辖",
    paragraphs: [
      "除法律另有强制规定外，本条款以中华民国法律为准据法。争议得由台湾台北地方法院为第一审管辖法院。",
    ],
  },
  {
    heading: "十一、修订与联系",
    paragraphs: [
      "我们得修订本条款并于网站公告。重大变更将于法令要求范围内以合理方式通知。您于生效日后继续使用，除法律另有规定外，视为同意修订。合规与支付相关问题请透过网站所载联络方式与我们联系。",
    ],
  },
];

export function getTermsSections(locale: Locale): LegalSection[] {
  const p = pickLegalLocale(locale);
  if (p === "zh-TW") return TERMS_ZH_TW;
  if (p === "zh-CN") return TERMS_ZH_CN;
  return TERMS_EN;
}
