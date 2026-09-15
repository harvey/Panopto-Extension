// Set to true to see the extension's diagnostic console output.
const PCS_DEBUG = false;

function sendToTab(action, value) {
    try {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: action, value: value });
        });
    } catch {
        PCS_DEBUG && console.log("Not connected to tab.");
    }
}

function generateUniqueId() {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

// ─── Promo code ───────────────────────────────────────────────────────────────
// Change this string when you create the Stripe coupon.
const PROMO_CODE = 'PANOPTO2M';
// The strip that used to advertise the "2 months free" coupon now advertises the free
// trial instead: on the £3/2-month plan that coupon gave away a whole billing period,
// and it competed with the trial for the same glance. The code still works at checkout,
// it just isn't advertised. Element ids and CSS keep their old promo-* names.
const SHOW_TRIAL_BANNER = true;

// ─── Translations ─────────────────────────────────────────────────────────────

const TRANSLATIONS = {
    en: {
        supportOpen: 'Premium not working? Message support',
        supportHint: 'Goes straight to the developer with your signed-in email attached.',
        supportSend: 'Send',
        supportPlaceholder: 'e.g. I bought Premium with a different email…',
        supportSignIn: 'Sign in first so the developer knows which account to look at.',
        supportEmpty: 'Write a few words first.',
        supportSending: 'Sending…',
        supportSent: 'Sent ✓ — the developer will reply to {email}, usually within a day.',
        supportRate: 'Already sent one a moment ago — give it 5 minutes.',
        supportFail: 'Couldn’t send. Email harveychandler235@gmail.com instead.',
        speedSection: "Playback Speed",
        speedHints: "Click the speed to type any value · hold the video to fast-forward",
        speedWarning: "Time saved isn’t counted above 4×",
        startup: "Apply speed on startup",
        timeSavedLabel: "Time saved:",
        warning: "Changes only apply on Panopto pages.",
        leaderboardSection: "Leaderboard",
        signinPrompt: "Sign in to unlock AI notes and Anki flashcards — free, no card needed",
        signinBtn: "Sign in with Google",
        loggedInAs: "Logged in as",
        logout: "Log out",
        youAreRank: "You are rank",
        rankGt20: ">20",
        optIn: "Opt into leaderboard logging",
        showChapters: "Show lecture chapters",
        darkTheme: "🌙 Dark theme",
        viewLeaderboard: "View Leaderboard",
        coffee: "Get Premium",
        rate: "Rate this extension",
        totalTime: "Time saved by all users:",
        migratingTitle: "Set up a username to use features",
        oldUsername: "Your old username",
        confirmBtn: "Submit",
        pleaseWait: "Please wait...",
        premiumSection: "Premium Features",
        autoSkipSilence: "Auto-Skip Silence",
        silenceDesc: "Speeds through quiet parts of lectures automatically",
        silenceSaved: "Silence skip saved:",
        pictureInPicture: "Picture in Picture",
        pipPlaceholder: "Open a Panopto page to use",
        getPremium: "🔒 Get Premium",
        premiumModalTitle: "✨ Get Premium",
        plan2moLabel: "2 Months",
        plan2moSub: "every 2 months",
        plan2moBtn: "Start free trial →",
        planYearLabel: "1 Year",
        planYearSub: "per year",
        planYearBtn: "Subscribe →",
        planTrialNote: "🎁 <strong>7-day free trial</strong> on the 2-month plan — <strong>no card or payment details needed</strong>. Cancel any time.",
        ctaTrial: "Free trial →",
        ctaYear: "£12/yr",
        planLifetimeLabel: "Lifetime",
        planTrialLabel: "Trial",
        planMonthlyPlanLabel: "Monthly",
        planYearlyPlanLabel: "Yearly",
        planBestValue: "BEST VALUE",
        cancelInfo: "To cancel your subscription there is a cancel button in the extension which generates your cancel link. If you cannot access it, email {email} and I will cancel it for you. Cancelling during the free trial costs you nothing.",
        betaBadge: "BETA",
        newBadge: "NEW",
        downloadLecture: "Download Lecture",
        premiumBadgeText: "★ Premium",
        downloadVideoBtn: "⬇ Video",
        pipOpenTitle: "Open in Picture in Picture",
        pipSource: "Source",
        aiNotes: "AI Lecture Notes",
        inPageChat: "AI Chat on lecture page",
        generateNotesBtn: "Generate Notes",
        aiChatBtn: "AI Chat",
        generateFlashcardsBtn: "Generate Flashcards",
        dubbedLecture: "Dubbed Lecture",
        dubBtn: "Dub",
        aiTools: "AI Tools",
        dubHint: "Open a Panopto lecture video first.",
        alphaBadge: "ALPHA",
        checkPremium: "Already purchased? Check Premium",
        checkSignIn: "Sign in first to check",
        checking: "Checking…",
        promoText: "🎁 <strong>7-day free trial</strong> — no card needed",
        copyBtn: "Copy",
        copiedBtn: "✓ Copied!",
        silenceFreeUsed: "{time} / 3:00 free used",
        silenceFreeTry: "✓ First 3 minutes free — try it now",
        silenceFreeLimit: "Free 3 min limit reached",
        pipFreeLocked: "{used}/{limit} free presses used — Get Premium",
        pipFreeUsed: "{used}/{limit} free presses used",
        pipFreeTry: "✓ First {limit} presses free — try it now",
        downloadFreeLocked: "{used}/{limit} free downloads used — Get Premium",
        downloadFreeUsed: "{used}/{limit} free downloads used",
        downloadFreeTry: "✓ First {limit} downloads free — try it now",
        notesDailyLimitReached: "Daily limit reached ({used}/{limit}) — resets at midnight UTC",
        notesDailyUsed:         "{used}/{limit} notes used today",
        notesDailyAvailable:    "{limit} notes available today",
        notesFreeLocked:        "🔒 Today's free notes used — resets at midnight, or get Premium for {limit}/day",
        notesFreeAvailable:     "✨ {limit} free notes a day — try it now",
        aiUnlimited:            "⚡ Unlimited AI usage",
        weeklyPrize: "<strong>#1 on the leaderboard</strong> each week wins <strong>7 days Premium</strong> free",
        lifetimeModalTitle: "Lifetime Premium",
        lifetimeModalBody: "You have lifetime access to all premium features. Thank you for supporting Panopto Speed!",
        milestoneTitle: "You've saved over 2 hours!",
        milestoneMsg: "Nice work speeding through your lectures. Want to save even more? Check out Premium features like <strong>Auto-Skip Silence</strong> and <strong>AI Notes</strong>.",
        milestoneExplore: "Explore Premium →",
        milestoneLater: "Maybe later",
        optInNudge: "Make sure to opt into leaderboard logging",
        referralSection: "Refer Friends",
        referralShow: "Show",
        referralBlurb: "Each friend who uses your code gives you <strong>5 days of Premium</strong>.",
        referralCopyCode: "Copy",
        referralCopied: "✓ Copied",
        referralStat: "{count} referred · {days}d earned",
        redeemPrompt: "Got a friend's code? Apply it to give them 5 days of Premium.",
        redeemBtn: "Apply",
        redeemPlaceholder: "CODE",
        redeemInvalid: "Enter a valid code.",
        redeemDone: "✓ Done — your friend earned {days} days of Premium.",
        redeemFail: "Could not apply that code.",
        redeemNetwork: "Network error — please try again.",
        rewardModalBtn: "Nice!",
        streakModalBtn: "Got it",
    },
    ko: {
        supportOpen: '프리미엄이 안 되나요? 지원팀에 문의',
        supportHint: '로그인한 이메일과 함께 개발자에게 바로 전달됩니다.',
        supportSend: '보내기',
        supportPlaceholder: '예: 다른 이메일로 프리미엄을 구매했어요…',
        supportSignIn: '개발자가 어떤 계정인지 확인할 수 있도록 먼저 로그인해 주세요.',
        supportEmpty: '먼저 내용을 적어 주세요.',
        supportSending: '보내는 중…',
        supportSent: '전송됨 ✓ — 개발자가 {email}로 답장합니다. 보통 하루 안에요.',
        supportRate: '방금 보내셨어요 — 5분 뒤에 다시 시도해 주세요.',
        supportFail: '전송 실패. harveychandler235@gmail.com으로 메일해 주세요.',
        speedSection: "재생 속도",
        speedHints: "속도를 클릭해 직접 입력 · 영상을 길게 누르면 빨리 감기",
        speedWarning: "4배속 이상에서는 절약 시간이 기록되지 않아요",
        startup: "시작 시 속도 적용",
        timeSavedLabel: "절약된 시간:",
        warning: "파노프토 페이지에서만 적용됩니다.",
        leaderboardSection: "리더보드",
        signinPrompt: "로그인하면 AI 노트와 Anki 플래시카드를 무료로 사용할 수 있어요 — 카드 등록 없음",
        signinBtn: "Google로 로그인",
        loggedInAs: "로그인됨:",
        logout: "로그아웃",
        youAreRank: "내 순위:",
        rankGt20: ">20위",
        optIn: "리더보드 데이터 수집 동의",
        viewLeaderboard: "리더보드 보기",
        coffee: "프리미엄 이용하기",
        rate: "확장 프로그램 평가",
        totalTime: "전체 사용자 절약 시간:",
        migratingTitle: "기능을 사용하려면 사용자명을 설정하세요",
        oldUsername: "이전 사용자명",
        confirmBtn: "제출",
        pleaseWait: "잠시 기다려 주세요...",
        premiumSection: "프리미엄 기능",
        autoSkipSilence: "침묵 자동 건너뛰기",
        silenceDesc: "강의의 조용한 구간을 자동으로 빠르게 넘깁니다",
        silenceSaved: "침묵 건너뛰기 절약:",
        pictureInPicture: "화면 속 화면",
        pipPlaceholder: "파노프토 페이지를 열어주세요",
        getPremium: "🔒 프리미엄 구매",
        premiumModalTitle: "✨ 프리미엄 구매",
        plan2moLabel: "2개월",
        plan2moSub: "2개월마다",
        plan2moBtn: "무료 체험 시작 →",
        planYearLabel: "1년",
        planYearSub: "연간",
        planYearBtn: "구독하기 →",
        planTrialNote: "🎁 2개월 플랜 <strong>7일 무료 체험</strong> — <strong>카드 등록이나 결제 정보 입력이 필요 없습니다</strong>. 언제든지 취소할 수 있습니다.",
        ctaTrial: "무료 체험 →",
        ctaYear: "연 £12",
        planLifetimeLabel: "평생 이용권",
        planTrialLabel: "체험",
        planMonthlyPlanLabel: "월간",
        planYearlyPlanLabel: "연간",
        planBestValue: "최고의 가치",
        cancelInfo: "구독을 취소하려면 확장 프로그램의 취소 버튼으로 취소 링크를 생성하실 수 있습니다. 접근할 수 없는 경우 {email} 으로 이메일을 보내주시면 대신 취소해 드리겠습니다. 무료 체험 기간 중 취소하면 비용이 청구되지 않습니다.",
        betaBadge: "베타",
        newBadge: "신규",
        downloadLecture: "강의 다운로드",
        premiumBadgeText: "★ 프리미엄",
        downloadVideoBtn: "⬇ 동영상",
        pipOpenTitle: "화면 속 화면으로 열기",
        pipSource: "소스",
        aiNotes: "AI 강의 노트",
        generateNotesBtn: "노트 생성",
        aiChatBtn: "AI 채팅",
        generateFlashcardsBtn: "플래시카드 생성",
        dubbedLecture: "강의 더빙",
        dubBtn: "더빙",
        aiTools: "AI 도구",
        dubHint: "먼저 Panopto 강의 영상을 열어 주세요.",
        alphaBadge: "알파",
        checkPremium: "이미 구매하셨나요? 프리미엄 확인",
        checkSignIn: "확인하려면 먼저 로그인하세요",
        checking: "확인 중…",
        promoText: "🎁 <strong>7일 무료 체험</strong> — 카드 불필요",
        copyBtn: "복사",
        copiedBtn: "✓ 복사됨!",
        silenceFreeUsed: "{time} / 3:00 무료 사용됨",
        silenceFreeTry: "✓ 처음 3분 무료 — 지금 사용해 보세요",
        silenceFreeLimit: "무료 3분 한도 도달",
        pipFreeLocked: "{used}/{limit} 무료 사용됨 — 프리미엄 구매",
        pipFreeUsed: "{used}/{limit} 무료 사용됨",
        pipFreeTry: "✓ 처음 {limit}회 무료 — 지금 사용해 보세요",
        downloadFreeLocked: "{used}/{limit} 무료 다운로드 사용됨 — 프리미엄 구매",
        downloadFreeUsed: "{used}/{limit} 무료 다운로드 사용됨",
        downloadFreeTry: "✓ 처음 {limit}회 다운로드 무료 — 지금 사용해 보세요",
        inPageChat: "강의 페이지 내 AI 채팅",
        showChapters: "강의 챕터 표시",
        darkTheme: "🌙 다크 테마",
        aiUnlimited: "⚡ 무제한 AI 사용",
        notesDailyLimitReached: "일일 한도 도달 ({used}/{limit}) — UTC 자정에 초기화",
        notesDailyUsed:         "오늘 {used}/{limit}개 노트 사용",
        notesDailyAvailable:    "오늘 {limit}개 노트 이용 가능",
        notesFreeLocked:        "🔒 오늘의 무료 노트를 모두 사용했어요 — 자정에 초기화되며, 프리미엄은 하루 {limit}개",
        notesFreeAvailable:     "✨ 하루 {limit}개 무료 노트 — 지금 시도해 보세요",
        weeklyPrize: "매주 <strong>리더보드 1위</strong>는 <strong>프리미엄 7일</strong> 무료 혜택을 받습니다",
        lifetimeModalTitle: "평생 프리미엄",
        lifetimeModalBody: "모든 프리미엄 기능에 영구적으로 접근하실 수 있습니다. Panopto Speed를 지원해 주셔서 감사합니다!",
        milestoneTitle: "2시간 이상 절약했어요!",
        milestoneMsg: "강의를 빠르게 시청하고 있네요! 더 절약하고 싶으신가요? <strong>자동 침묵 건너뛰기</strong>와 <strong>AI 노트</strong> 같은 프리미엄 기능을 확인해 보세요.",
        milestoneExplore: "프리미엄 탐색 →",
        milestoneLater: "나중에",
        optInNudge: "리더보드 데이터 수집에 동의했는지 확인하세요",
        // Referral / redeem / modal buttons
        referralSection: "친구 추천",
        referralShow: "보기",
        referralBlurb: "내 코드를 사용하는 친구 한 명당 <strong>프리미엄 5일</strong>을 드립니다.",
        referralCopyCode: "복사",
        referralCopied: "✓ 복사됨",
        referralStat: "{count}명 추천 · {days}일 획득",
        redeemPrompt: "친구의 코드가 있나요? 적용하면 친구에게 프리미엄 5일을 선물할 수 있어요.",
        redeemBtn: "적용",
        redeemPlaceholder: "코드",
        redeemInvalid: "유효한 코드를 입력하세요.",
        redeemDone: "✓ 완료 — 친구가 프리미엄 {days}일을 받았어요.",
        redeemFail: "코드를 적용할 수 없습니다.",
        redeemNetwork: "네트워크 오류 — 다시 시도해 주세요.",
        rewardModalBtn: "좋아요!",
        streakModalBtn: "알겠어요",
    },
    zh: {
        supportOpen: '高级版无法使用？联系支持',
        supportHint: '会连同你登录的邮箱直接发给开发者。',
        supportSend: '发送',
        supportPlaceholder: '例如：我用另一个邮箱购买了高级版…',
        supportSignIn: '请先登录，这样开发者才知道查看哪个账户。',
        supportEmpty: '请先写几个字。',
        supportSending: '发送中…',
        supportSent: '已发送 ✓ — 开发者会回复到 {email}，通常一天内。',
        supportRate: '刚刚已发送过一条 — 请等 5 分钟。',
        supportFail: '发送失败。请改发邮件至 harveychandler235@gmail.com。',
        speedSection: "播放速度",
        speedHints: "点击速度可输入任意值 · 长按视频快进",
        speedWarning: "超过 4× 时不计算节省的时间",
        startup: "启动时应用速度",
        timeSavedLabel: "节省的时间：",
        warning: "仅在 Panopto 页面上生效。",
        leaderboardSection: "排行榜",
        signinPrompt: "登录即可免费使用 AI 笔记和 Anki 抽认卡 — 无需信用卡",
        signinBtn: "使用 Google 登录",
        loggedInAs: "已登录为",
        logout: "退出登录",
        youAreRank: "您的排名：",
        rankGt20: ">20",
        optIn: "加入排行榜数据收集",
        viewLeaderboard: "查看排行榜",
        coffee: "获取高级版",
        rate: "评价此扩展",
        totalTime: "所有用户节省的时间：",
        migratingTitle: "设置用户名以使用功能",
        oldUsername: "旧用户名",
        confirmBtn: "提交",
        pleaseWait: "请稍候...",
        premiumSection: "高级功能",
        autoSkipSilence: "自动跳过静音",
        silenceDesc: "自动跳过讲座中的安静部分",
        silenceSaved: "静音跳过节省：",
        pictureInPicture: "画中画",
        pipPlaceholder: "请打开 Panopto 页面",
        getPremium: "🔒 获取高级版",
        premiumModalTitle: "✨ 获取高级版",
        plan2moLabel: "2 个月",
        plan2moSub: "每 2 个月",
        plan2moBtn: "开始免费试用 →",
        planYearLabel: "1 年",
        planYearSub: "每年",
        planYearBtn: "立即订阅 →",
        planTrialNote: "🎁 2 个月方案享 <strong>7 天免费试用</strong> — <strong>无需银行卡或付款信息</strong>。可随时取消。",
        ctaTrial: "免费试用 →",
        ctaYear: "£12/年",
        planLifetimeLabel: "终身授权",
        planTrialLabel: "试用",
        planMonthlyPlanLabel: "月度",
        planYearlyPlanLabel: "年度",
        planBestValue: "最超值",
        cancelInfo: "如需取消订阅，扩展程序中有一个取消按钮，可生成取消链接。如果您无法访问该按钮，请发送邮件至 {email}，我将手动为您取消。在免费试用期内取消不会产生任何费用。",
        betaBadge: "测试版",
        newBadge: "新增",
        downloadLecture: "下载讲座",
        premiumBadgeText: "★ 高级版",
        downloadVideoBtn: "⬇ 视频",
        pipOpenTitle: "在画中画中打开",
        pipSource: "来源",
        aiNotes: "AI 讲座笔记",
        generateNotesBtn: "生成笔记",
        aiChatBtn: "AI 聊天",
        generateFlashcardsBtn: "生成抽认卡",
        dubbedLecture: "讲座配音",
        dubBtn: "配音",
        aiTools: "AI 工具",
        dubHint: "请先打开一个 Panopto 讲座视频。",
        alphaBadge: "内测",
        checkPremium: "已购买？检查高级版",
        checkSignIn: "请先登录以检查",
        checking: "正在检查…",
        promoText: "🎁 <strong>7 天免费试用</strong> — 无需银行卡",
        copyBtn: "复制",
        copiedBtn: "✓ 已复制！",
        silenceFreeUsed: "{time} / 3:00 免费已用",
        silenceFreeTry: "✓ 前 3 分钟免费 — 立即体验",
        silenceFreeLimit: "已达 3 分钟免费上限",
        pipFreeLocked: "已用 {used}/{limit} 次免费 — 获取高级版",
        pipFreeUsed: "已用 {used}/{limit} 次免费",
        pipFreeTry: "✓ 前 {limit} 次免费 — 立即体验",
        downloadFreeLocked: "已用 {used}/{limit} 次免费下载 — 获取高级版",
        downloadFreeUsed: "已用 {used}/{limit} 次免费下载",
        downloadFreeTry: "✓ 前 {limit} 次下载免费 — 立即体验",
        inPageChat: "讲座页面内 AI 聊天",
        showChapters: "显示讲座章节",
        darkTheme: "🌙 深色主题",
        aiUnlimited: "⚡ 无限 AI 使用",
        notesDailyLimitReached: "已达每日上限（{used}/{limit}）— 将于 UTC 午夜重置",
        notesDailyUsed:         "今日已用 {used}/{limit} 篇笔记",
        notesDailyAvailable:    "今日可生成 {limit} 篇笔记",
        notesFreeLocked:        "🔒 今日免费笔记已用完 — 午夜重置，或升级高级版每天 {limit} 篇",
        notesFreeAvailable:     "✨ 每天 {limit} 篇免费笔记 — 立即体验",
        weeklyPrize: "每周<strong>排行榜第 1 名</strong>可免费获得 <strong>7 天高级版</strong>",
        lifetimeModalTitle: "终身高级版",
        lifetimeModalBody: "您已获得所有高级功能的终身使用权。感谢您支持 Panopto Speed！",
        milestoneTitle: "您已节省超过 2 小时！",
        milestoneMsg: "您加速观看讲座做得很好！想节省更多时间吗？试试 <strong>自动跳过静音</strong> 和 <strong>AI 笔记</strong> 等高级功能。",
        milestoneExplore: "探索高级版 →",
        milestoneLater: "稍后再说",
        optInNudge: "请确保已开启排行榜数据收集",
        // Referral / redeem / modal buttons
        referralSection: "推荐好友",
        referralShow: "显示",
        referralBlurb: "每位使用你邀请码的好友都会为你带来 <strong>5 天高级版</strong>。",
        referralCopyCode: "复制",
        referralCopied: "✓ 已复制",
        referralStat: "已推荐 {count} 人 · 获得 {days} 天",
        redeemPrompt: "有好友的邀请码？应用后即可送好友 5 天高级版。",
        redeemBtn: "应用",
        redeemPlaceholder: "邀请码",
        redeemInvalid: "请输入有效的邀请码。",
        redeemDone: "✓ 完成 — 你的好友获得了 {days} 天高级版。",
        redeemFail: "无法应用该邀请码。",
        redeemNetwork: "网络错误 — 请重试。",
        rewardModalBtn: "太棒了！",
        streakModalBtn: "知道了",
    },
    he: {
        supportOpen: 'הפרימיום לא עובד? שלחו הודעה לתמיכה',
        supportHint: 'נשלח ישירות למפתח יחד עם האימייל שאיתו נכנסתם.',
        supportSend: 'שליחה',
        supportPlaceholder: 'לדוגמה: קניתי פרימיום עם אימייל אחר…',
        supportSignIn: 'קודם התחברו כדי שהמפתח ידע באיזה חשבון להסתכל.',
        supportEmpty: 'כתבו כמה מילים קודם.',
        supportSending: 'שולח…',
        supportSent: 'נשלח ✓ — המפתח ישיב ל‑{email}, בדרך כלל תוך יום.',
        supportRate: 'כבר נשלחה הודעה לפני רגע — חכו 5 דקות.',
        supportFail: 'השליחה נכשלה. שלחו מייל ל‑harveychandler235@gmail.com.',
        speedSection: "מהירות הפעלה",
        speedHints: "לחצ/י על המהירות להקלדת ערך · לחיצה ארוכה על הווידאו להרצה קדימה",
        speedWarning: "זמן שנחסך לא נספר מעל 4×",
        startup: "החל מהירות בהפעלה",
        timeSavedLabel: ":זמן שנחסך",
        warning: ".השינויים חלים רק בדפי Panopto",
        leaderboardSection: "לוח תוצאות",
        signinPrompt: "התחבר/י כדי לפתוח סיכומי AI וכרטיסיות Anki — בחינם, ללא כרטיס אשראי",
        signinBtn: "התחבר עם Google",
        loggedInAs: ":מחובר/ת כ",
        logout: "התנתק/י",
        youAreRank: "הדירוג שלך:",
        rankGt20: "(>20)",
        optIn: "הסכמה לאיסוף נתוני לוח התוצאות",
        viewLeaderboard: "הצג לוח תוצאות",
        coffee: "קבלת פרימיום",
        rate: "דרג/י את ההרחבה",
        totalTime: ":זמן שנחסך על ידי כל המשתמשים",
        migratingTitle: "הגדר/י שם משתמש כדי להשתמש בתכונות",
        oldUsername: "שם המשתמש הישן שלך",
        confirmBtn: "שלח/י",
        pleaseWait: "...אנא המתן",
        premiumSection: "פרימיום",
        autoSkipSilence: "דילוג אוטומטי על שקט",
        silenceDesc: "מאיץ דרך חלקים שקטים בהרצאות באופן אוטומטי",
        silenceSaved: ":זמן שנחסך בדילוג",
        pictureInPicture: "תמונה בתוך תמונה",
        pipPlaceholder: "פתח/י דף Panopto כדי להשתמש",
        getPremium: "🔒 קנה/י פרימיום",
        premiumModalTitle: "✨ קנה/י פרימיום",
        plan2moLabel: "חודשיים",
        plan2moSub: "כל חודשיים",
        plan2moBtn: "← ניסיון חינם",
        planYearLabel: "שנה",
        planYearSub: "לשנה",
        planYearBtn: "← הרשמה",
        planTrialNote: "🎁 <strong>7 ימי ניסיון חינם</strong> בתוכנית הדו-חודשית — <strong>ללא כרטיס אשראי וללא פרטי תשלום</strong>. אפשר לבטל בכל רגע.",
        ctaTrial: "← ניסיון חינם",
        ctaYear: "£12 לשנה",
        planLifetimeLabel: "לכל החיים",
        planTrialLabel: "ניסיון",
        planMonthlyPlanLabel: "חודשי",
        planYearlyPlanLabel: "שנתי",
        planBestValue: "הכי משתלם",
        cancelInfo: "לביטול המנוי, יש כפתור ביטול בתוסף שמייצר קישור לביטול. אם אין לך גישה אליו, ניתן לפנות אלי בדוא\"ל {email} ואני אבטל את המנוי ידנית. ביטול במהלך תקופת הניסיון אינו כרוך בתשלום.",
        betaBadge: "בטא",
        newBadge: "חדש",
        downloadLecture: "הורד/י הרצאה",
        premiumBadgeText: "★ פרימיום",
        downloadVideoBtn: "⬇ וידאו",
        pipOpenTitle: "פתח/י בתמונה בתוך תמונה",
        pipSource: "מקור",
        aiNotes: "סיכומי AI להרצאות",
        generateNotesBtn: "צור סיכום",
        aiChatBtn: "צ'אט AI",
        generateFlashcardsBtn: "צור כרטיסיות",
        dubbedLecture: "הרצאה מדובבת",
        dubBtn: "דיבוב",
        aiTools: "כלי AI",
        dubHint: "פתח/י תחילה סרטון הרצאה ב-Panopto.",
        alphaBadge: "אלפא",
        checkPremium: "כבר רכשת? בדוק/י פרימיום",
        checkSignIn: "התחבר/י תחילה כדי לבדוק",
        checking: "...בודק",
        promoText: "🎁 <strong>7 ימי ניסיון חינם</strong> — ללא כרטיס אשראי",
        copyBtn: "העתק",
        copiedBtn: "!✓ הועתק",
        silenceFreeUsed: "{time} / 3:00 בשימוש חינם",
        silenceFreeTry: "✓ 3 הדקות הראשונות חינם — נסה/י עכשיו",
        silenceFreeLimit: "הגעת למגבלת 3 הדקות החינמיות",
        pipFreeLocked: "{used}/{limit} שימושים חינמיים נוצלו — קנה/י פרימיום",
        pipFreeUsed: "{used}/{limit} שימושים חינמיים נוצלו",
        pipFreeTry: "✓ {limit} השימושים הראשונים חינם — נסה/י עכשיו",
        downloadFreeLocked: "{used}/{limit} הורדות חינמיות נוצלו — קנה/י פרימיום",
        downloadFreeUsed: "{used}/{limit} הורדות חינמיות נוצלו",
        downloadFreeTry: "✓ {limit} ההורדות הראשונות חינם — נסה/י עכשיו",
        inPageChat: "צ'אט AI בעמוד ההרצאה",
        showChapters: "הצג פרקי הרצאה",
        darkTheme: "🌙 ערכת נושא כהה",
        aiUnlimited: "⚡ שימוש בלתי מוגבל ב-AI",
        notesDailyLimitReached: "הגעת למגבלה היומית ({used}/{limit}) — מתאפס בחצות UTC",
        notesDailyUsed:         "השתמשת ב-{used}/{limit} סיכומים היום",
        notesDailyAvailable:    "{limit} סיכומים זמינים היום",
        notesFreeLocked:        "🔒 הסיכומים החינמיים להיום נוצלו — מתאפס בחצות, או פרימיום {limit} ביום",
        notesFreeAvailable:     "✨ {limit} סיכומים חינם ביום — נסו עכשיו",
        weeklyPrize: "המקום ה<strong>ראשון בלוח התוצאות</strong> כל שבוע זוכה ב<strong>7 ימי פרימיום</strong> חינם",
        lifetimeModalTitle: "פרימיום לכל החיים",
        lifetimeModalBody: "!יש לך גישה לצמיתות לכל תכונות הפרימיום. תודה שתמכת ב-Panopto Speed",
        milestoneTitle: "!חסכת יותר מ-2 שעות",
        milestoneMsg: "!כל הכבוד על הצפייה המהירה בהרצאות. רוצה לחסוך עוד יותר? בדוק/י תכונות פרימיום כמו <strong>דילוג אוטומטי על שקט</strong> ו<strong>סיכומי AI</strong>",
        milestoneExplore: "← חקור/י פרימיום",
        milestoneLater: "אולי מאוחר יותר",
        optInNudge: "וודא/י הסכמה לאיסוף נתוני לוח התוצאות",
        // Referral / redeem / modal buttons
        referralSection: "הזמנת חברים",
        referralShow: "הצג",
        referralBlurb: "כל חבר/ה שמשתמש/ת בקוד שלך מזכה אותך ב־<strong>5 ימי פרימיום</strong>.",
        referralCopyCode: "העתק",
        referralCopied: "✓ הועתק",
        referralStat: "{count} הופנו · {days} ימים נצברו",
        redeemPrompt: "יש לך קוד של חבר/ה? הפעילו אותו כדי להעניק לו/לה 5 ימי פרימיום.",
        redeemBtn: "הפעל",
        redeemPlaceholder: "קוד",
        redeemInvalid: "יש להזין קוד תקין.",
        redeemDone: "✓ בוצע — החבר/ה שלך קיבל/ה {days} ימי פרימיום.",
        redeemFail: "לא ניתן להפעיל את הקוד.",
        redeemNetwork: "שגיאת רשת — נסו שוב.",
        rewardModalBtn: "מעולה!",
        streakModalBtn: "הבנתי",
    },
    uk: {
        supportOpen: 'Преміум не працює? Написати в підтримку',
        supportHint: 'Надійде прямо розробнику разом з email, під яким ви увійшли.',
        supportSend: 'Надіслати',
        supportPlaceholder: 'напр.: я купив(ла) Преміум з іншого email…',
        supportSignIn: 'Спершу увійдіть, щоб розробник знав, який акаунт перевіряти.',
        supportEmpty: 'Спочатку напишіть кілька слів.',
        supportSending: 'Надсилаю…',
        supportSent: 'Надіслано ✓ — розробник відповість на {email}, зазвичай протягом дня.',
        supportRate: 'Ви щойно надіслали повідомлення — зачекайте 5 хвилин.',
        supportFail: 'Не вдалося надіслати. Напишіть на harveychandler235@gmail.com.',
        speedSection: "Швидкість відтворення",
        speedHints: "Натисніть на швидкість, щоб ввести значення · утримуйте відео для перемотування",
        speedWarning: "Заощаджений час не рахується понад 4×",
        startup: "Застосовувати швидкість при запуску",
        timeSavedLabel: "Заощаджений час:",
        warning: "Зміни діють лише на сторінках Panopto.",
        leaderboardSection: "Таблиця лідерів",
        signinPrompt: "Увійдіть, щоб відкрити AI-нотатки та картки Anki — безкоштовно, без картки",
        signinBtn: "Увійти через Google",
        loggedInAs: "Увійшли як",
        logout: "Вийти",
        youAreRank: "Ваш ранг:",
        rankGt20: "(>20)",
        optIn: "Долучитись до збору даних",
        viewLeaderboard: "Переглянути таблицю лідерів",
        coffee: "Отримати Premium",
        rate: "Оцінити розширення",
        totalTime: "Час, заощаджений усіма:",
        migratingTitle: "Створіть ім'я користувача, щоб користуватися функціями",
        oldUsername: "Старе ім'я користувача",
        confirmBtn: "Надіслати",
        pleaseWait: "Будь ласка, зачекайте...",
        premiumSection: "Преміум функції",
        autoSkipSilence: "Авто-пропуск тиші",
        silenceDesc: "Автоматично пришвидшує тихі частини лекцій",
        silenceSaved: "Час заощаджено пропуском тиші:",
        pictureInPicture: "Картинка в картинці",
        pipPlaceholder: "Відкрийте сторінку Panopto для використання",
        getPremium: "🔒 Отримати преміум",
        premiumModalTitle: "✨ Отримати преміум",
        plan2moLabel: "2 місяці",
        plan2moSub: "кожні 2 місяці",
        plan2moBtn: "Безкоштовний період →",
        planYearLabel: "1 рік",
        planYearSub: "на рік",
        planYearBtn: "Підписатись →",
        planTrialNote: "🎁 <strong>7 днів безкоштовно</strong> на 2-місячному тарифі — <strong>без картки та платіжних даних</strong>. Скасувати можна будь-коли.",
        ctaTrial: "Безкоштовно →",
        ctaYear: "£12/рік",
        planLifetimeLabel: "Довічний",
        planTrialLabel: "Пробний",
        planMonthlyPlanLabel: "Місячний",
        planYearlyPlanLabel: "Річний",
        planBestValue: "НАЙКРАЩА ЦІНА",
        cancelInfo: "Щоб скасувати підписку, у розширенні є кнопка скасування, яка генерує посилання. Якщо ви не можете отримати до неї доступ, напишіть на {email} — я скасую вручну. Скасування під час безкоштовного періоду нічого не коштує.",
        betaBadge: "БЕТА",
        newBadge: "НОВЕ",
        downloadLecture: "Завантажити лекцію",
        premiumBadgeText: "★ Преміум",
        downloadVideoBtn: "⬇ Відео",
        pipOpenTitle: "Відкрити в режимі картинка в картинці",
        pipSource: "Джерело",
        aiNotes: "AI-конспекти лекцій",
        generateNotesBtn: "Згенерувати конспект",
        aiChatBtn: "AI Чат",
        generateFlashcardsBtn: "Згенерувати картки",
        dubbedLecture: "Дубльована лекція",
        dubBtn: "Дубляж",
        aiTools: "AI-інструменти",
        dubHint: "Спочатку відкрийте відео лекції в Panopto.",
        alphaBadge: "АЛЬФА",
        checkPremium: "Вже придбали? Перевірити преміум",
        checkSignIn: "Спочатку увійдіть, щоб перевірити",
        checking: "Перевірка…",
        promoText: "🎁 <strong>7 днів безкоштовно</strong> — без картки",
        copyBtn: "Копіювати",
        copiedBtn: "✓ Скопійовано!",
        silenceFreeUsed: "{time} / 3:00 безкоштовно використано",
        silenceFreeTry: "✓ Перші 3 хвилини безкоштовно — спробуйте зараз",
        silenceFreeLimit: "Досягнуто ліміту 3 безкоштовних хвилин",
        pipFreeLocked: "{used}/{limit} безкоштовних натискань — Отримати преміум",
        pipFreeUsed: "{used}/{limit} безкоштовних натискань",
        pipFreeTry: "✓ Перші {limit} натискань безкоштовно — спробуйте зараз",
        downloadFreeLocked: "{used}/{limit} безкоштовних завантажень — Отримати преміум",
        downloadFreeUsed: "{used}/{limit} безкоштовних завантажень",
        downloadFreeTry: "✓ Перші {limit} завантажень безкоштовно — спробуйте зараз",
        inPageChat: "AI-чат на сторінці лекції",
        showChapters: "Показувати розділи лекції",
        darkTheme: "🌙 Темна тема",
        aiUnlimited: "⚡ Необмежене використання AI",
        notesDailyLimitReached: "Денний ліміт вичерпано ({used}/{limit}) — оновиться опівночі UTC",
        notesDailyUsed:         "Сьогодні використано {used}/{limit} конспектів",
        notesDailyAvailable:    "Сьогодні доступно {limit} конспектів",
        notesFreeLocked:        "🔒 Безкоштовні нотатки на сьогодні використано — оновлення опівночі, або Premium {limit}/день",
        notesFreeAvailable:     "✨ {limit} безкоштовні нотатки на день — спробуйте зараз",
        weeklyPrize: "<strong>#1 у таблиці лідерів</strong> щотижня отримує <strong>7 днів Premium</strong> безкоштовно",
        lifetimeModalTitle: "Довічний Premium",
        lifetimeModalBody: "Ви маєте довічний доступ до всіх преміум-функцій. Дякуємо за підтримку Panopto Speed!",
        milestoneTitle: "Ви заощадили понад 2 години!",
        milestoneMsg: "Чудова робота зі швидким переглядом лекцій! Хочете заощадити ще більше? Спробуйте функції Premium: <strong>Авто-пропуск тиші</strong> та <strong>AI-конспекти</strong>.",
        milestoneExplore: "Дізнатися про Premium →",
        milestoneLater: "Пізніше",
        optInNudge: "Переконайтеся, що ви долучилися до збору даних таблиці лідерів",
        // Referral / redeem / modal buttons
        referralSection: "Запросити друзів",
        referralShow: "Показати",
        referralBlurb: "Кожен друг, який скористається вашим кодом, дає вам <strong>5 днів Преміум</strong>.",
        referralCopyCode: "Копіювати",
        referralCopied: "✓ Скопійовано",
        referralStat: "{count} запрошено · {days} дн. отримано",
        redeemPrompt: "Маєте код друга? Застосуйте його, щоб подарувати другові 5 днів Преміум.",
        redeemBtn: "Застосувати",
        redeemPlaceholder: "КОД",
        redeemInvalid: "Введіть дійсний код.",
        redeemDone: "✓ Готово — ваш друг отримав {days} днів Преміум.",
        redeemFail: "Не вдалося застосувати цей код.",
        redeemNetwork: "Помилка мережі — спробуйте ще раз.",
        rewardModalBtn: "Чудово!",
        streakModalBtn: "Зрозуміло",
    }
};

function getLang() {
    return localStorage.getItem('ext-lang') || 'en';
}

function t(key) {
    const lang = getLang();
    return (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) || TRANSLATIONS.en[key] || key;
}

function applyLanguage() {
    const lang = getLang();
    document.getElementById('languageSelect').value = lang;
    document.documentElement.dir = (lang === 'he') ? 'rtl' : 'ltr';
    document.body.dir = (lang === 'he') ? 'rtl' : 'ltr';

    document.getElementById('lbl-speed-section').textContent    = t('speedSection');
    { const sw = document.getElementById('speedWarning'); if (sw && sw.style.color !== 'rgb(220, 38, 38)') sw.textContent = t('speedHints'); }
    document.getElementById('lbl-startup').textContent          = t('startup');
    document.getElementById('lbl-time-saved-label').textContent = t('timeSavedLabel');
    document.getElementById('lbl-leaderboard-section').textContent = t('leaderboardSection');
    document.getElementById('lbl-signin-prompt').textContent    = t('signinPrompt');
    document.getElementById('lbl-signin-btn').textContent       = t('signinBtn');
    document.getElementById('lbl-logged-in-as').textContent     = t('loggedInAs');
    document.getElementById('logout').textContent               = t('logout');
    document.getElementById('lbl-you-are-rank').textContent     = t('youAreRank');
    document.getElementById('lbl-opt-in').textContent           = t('optIn');
    { const _c = document.getElementById('lbl-chapters-toggle'); if (_c) _c.textContent = t('showChapters'); }
    { const _d = document.getElementById('lbl-dark-theme'); if (_d) _d.textContent = t('darkTheme'); }
    document.getElementById('lbl-lb-popup').textContent         = t('viewLeaderboard');
    const _lblCoffee = document.getElementById('lbl-coffee'); if (_lblCoffee) _lblCoffee.textContent = t('coffee');
    document.getElementById('lbl-rate').textContent             = t('rate');
    document.getElementById('lbl-total-time').textContent       = t('totalTime');
    document.getElementById('lbl-migrating-title').textContent  = t('migratingTitle');
    document.getElementById('lbl-old-username').textContent     = t('oldUsername');
    document.getElementById('lbl-premium-section').textContent  = t('premiumSection');
    document.getElementById('lbl-auto-skip').textContent        = t('autoSkipSilence');
    document.getElementById('lbl-silence-saved').textContent    = t('silenceSaved');
    document.getElementById('lbl-pip').textContent              = t('pictureInPicture');
    const pipPlaceholderEl = document.getElementById('pipPlaceholder');
    if (pipPlaceholderEl) pipPlaceholderEl.textContent = t('pipPlaceholder');
    document.getElementById('getPremiumLink').textContent       = t('getPremium');
    function setT(id, key, useInner) {
        const el = document.getElementById(id);
        if (!el) return;
        if (useInner) {
            el.innerHTML = t(key).replace('{email}', '<a href="mailto:harveychandler235@gmail.com" style="color:#11773D;">harveychandler235@gmail.com</a>');
        } else {
            el.textContent = t(key);
        }
    }
    setT('lbl-premium-modal-title',  'premiumModalTitle');
    setT('lbl-plan-monthly-label',   'plan2moLabel');
    setT('lbl-plan-monthly-sub',     'plan2moSub');
    setT('monthlyModalBtn',          'planYearBtn');   // both cards buy now
    setT('trialModalBtn',            'plan2moBtn');    // that string is already "Start free trial"
    setT('lbl-plan-lifetime-label',  'planYearLabel');
    setT('lbl-plan-lifetime-sub',    'planYearSub');
    setT('lifetimeModalBtn',         'planYearBtn');
    setT('lbl-plan-best-value',      'planBestValue');
    setT('lbl-plan-trial-note',      'planTrialNote', true);
    setT('monthlyPremiumBtn',        'ctaTrial');
    setT('lifetimePremiumBtn',       'ctaYear');
    setT('lbl-cancel-info',          'cancelInfo', true);
    setT('lbl-new-badge',            'newBadge');
    setT('lbl-download-lecture',     'downloadLecture');
    setT('lbl-ai-notes',             'aiNotes');
    setT('lbl-inpage-chat',          'inPageChat');
    setT('lbl-ai-beta-badge',        'betaBadge');
    setT('lbl-chat-beta-badge',      'betaBadge');
    setT('lbl-generate-notes',       'generateNotesBtn');
    setT('lbl-ai-chat',              'aiChatBtn');
    setT('lbl-generate-flashcards',  'generateFlashcardsBtn');
    setT('lbl-ai-tools',             'aiTools');
    setT('lbl-dub',                  'dubbedLecture');
    setT('lbl-dub-btn',              'dubBtn');
    setT('lbl-dub-alpha',            'alphaBadge');
    setT('inPageChatLock',           'getPremium');
    setT('checkPremiumBtn',          'checkPremium');
    setT('copyPromoBtn',             'copyBtn');
    { const _pt = document.getElementById('lbl-promo-text'); if (_pt) _pt.innerHTML = t('promoText'); }
    setT('premiumBadge',             'premiumBadgeText');
    setT('premiumUserBadge',         'premiumBadgeText');
    const weeklyPrizeEl = document.getElementById('lbl-weekly-prize');
    if (weeklyPrizeEl) weeklyPrizeEl.innerHTML = t('weeklyPrize');
    setT('lbl-lifetime-modal-title', 'lifetimeModalTitle');
    setT('lbl-lifetime-modal-body',  'lifetimeModalBody');
    setT('lbl-milestone-title',      'milestoneTitle');
    const milestoneMsgEl = document.getElementById('lbl-milestone-msg');
    if (milestoneMsgEl) milestoneMsgEl.innerHTML = t('milestoneMsg');
    setT('milestoneExploreBtn',      'milestoneExplore');
    setT('milestoneLaterBtn',        'milestoneLater');
    setT('optInNudgeBtn',            'optInNudge');
    setT('lbl-referral-section',     'referralSection');
    setT('lbl-referral-show',        'referralShow');
    setT('lbl-redeem-prompt',        'redeemPrompt');
    setT('rewardModalBtn',           'rewardModalBtn');
    setT('streakModalBtn',           'streakModalBtn');
    const referralBlurbEl = document.getElementById('lbl-referral-blurb');
    if (referralBlurbEl) referralBlurbEl.innerHTML = t('referralBlurb');
    const copyReferralBtnEl = document.getElementById('copyReferralBtn');
    if (copyReferralBtnEl && !copyReferralBtnEl.dataset.copied) copyReferralBtnEl.textContent = t('referralCopyCode');
    const redeemBtnEl = document.getElementById('redeemBtn');
    if (redeemBtnEl) redeemBtnEl.textContent = t('redeemBtn');
    const redeemInputEl = document.getElementById('redeemCodeInput');
    if (redeemInputEl) redeemInputEl.placeholder = t('redeemPlaceholder');
    const dlBtn = document.getElementById('downloadVideoBtn');
    if (dlBtn && dlBtn.textContent !== '⏳ Fetching…' && !dlBtn.textContent.startsWith('✗')) {
        dlBtn.textContent = t('downloadVideoBtn');
    }

    const confirmBtn = document.getElementById('newUsernameButton');
    if (confirmBtn.textContent !== t('pleaseWait')) {
        confirmBtn.textContent = t('confirmBtn');
    }
}

// ─── Free-tier state (module-level so updateSavedTime can read them) ──────────

let _isPremium          = false;
let _premiumType        = null;   // 'lifetime' | 'timed' | null
let _premiumExpiry      = null;   // Unix timestamp (seconds) or null
let _premiumPlan        = null;   // 'trial' | 'monthly' | 'yearly' | 'lifetime' (from /check)
let _trialUsed          = false;  // free trial already spent → send them to the pay-now link
let _silenceSecs        = 0;
let _lastCaptionData    = null;
let _notesDailyUsed     = 0;      // server-reported today's count (promo premium tier)
let _notesLifetimeUsed  = 0;      // server-reported total free uses (non-premium tier)
let _notesUnlimited     = false;  // admin-granted unlimited AI (never blocked)
let _aiTier             = null;   // 'unlimited' | 'paid' | 'promo' | 'free' (from /notesQuota)
let _aiBudget           = null;   // budget tier: { pctLeft, exhausted, resetAt, isTrial } — no costs
const FREE_SILENCE_LIMIT_SECS = 180; // 3 minutes
const FREE_PIP_LIMIT          = 10;  // PiP button presses
const FREE_DOWNLOAD_LIMIT     = 3;   // lecture downloads
const NOTES_DAILY_LIMIT_PREMIUM = 15; // promo-premium users — N generations per day. MUST match cf/worker.js (it was 3 here and 15 there, so the lock string advertised "3/day")
const NOTES_FREE_DAILY_LIMIT = 3; // non-premium — free generations per UTC day (must match NOTES_FREE_DAILY_LIMIT in cf/worker.js)
const NOTES_QUOTA_CACHE_TTL_MS  = 60_000; // refetch quota at most every minute

// Local time-saved & free-usage counters live per-device, not per-account. Tag them
// with the owning account so a DIFFERENT user signing in on the same device doesn't
// inherit — and then re-upload — the previous user's totals. The SAME user signing
// back in after an accidental logout keeps everything (owner matches → no reset).
function reconcileTimeOwner(email) {
    if (!email || email === 'null') return;
    const owner = localStorage.getItem('localDataOwner');
    if (owner && owner !== email) {
        // New account on this device → zero the local counters so this account
        // starts from ITS OWN server values (getRank + loadFreeUsage pull them up).
        localStorage.setItem('saved-time', '0');
        localStorage.setItem('pipPressCount', '0');
        localStorage.setItem('downloadCount', '0');
        _silenceSecs = 0;
        try { chrome.runtime.sendMessage({ type: "resetUserMetrics" }); } catch {}
    }
    localStorage.setItem('localDataOwner', email);
}

// Publish auth + premium to chrome.storage so content.js (the in-page lecture chat)
// can make authenticated calls. The popup is the only place with a fresh OAuth token.
// The username dialog can be dismissed. While the account still has no username,
// a "Set username" link sits in the header so it can be reopened without waiting
// for the next popup open.
function setNeedsUsername(needs) {
    const link = document.getElementById('setUsernameLink');
    if (link) link.style.display = needs ? 'inline' : 'none';
}
function openUsernameDialog() {
    const modal = document.getElementById('migrationContainer');
    if (!modal) return;
    modal.classList.add('open');
    const box = document.getElementById('newUsernameTextbox');
    if (box) setTimeout(() => box.focus(), 50);
}

function writeAiAuth() {
    try {
        const email = localStorage.getItem('email');
        const token = localStorage.getItem('authToken');
        if (email && token && token !== 'null') {
            const tokenExpiry = parseInt(localStorage.getItem('tokenExpiry') || '0', 10) || 0;
            chrome.storage.local.set({ pcsAuth: { email, token, tokenExpiry, premium: !!_isPremium, ts: Date.now() } });
        } else {
            chrome.storage.local.remove('pcsAuth');
        }
    } catch {}
}

// Lead with the recovery panel when background.js has flagged the active tab as one
// the content script never attached to (see the pcsFailedTabs map it keeps in
// chrome.storage.session). The normal UI is only HIDDEN, never removed — the rest of
// this file dereferences its children without null checks.
function initRecoveryPanel() {
    const panel = document.getElementById('recoveryPanel');
    if (!panel) return;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        if (!tab || tab.id == null) return;

        chrome.storage.session.get('pcsFailedTabs', (r) => {
            if (chrome.runtime.lastError) return;
            const failed = (r && r.pcsFailedTabs) || {};
            if (!failed[tab.id]) return;

            document.querySelectorAll('.top-bar').forEach(el => { el.style.display = 'none'; });
            document.querySelectorAll('.card').forEach(el => {
                if (el !== panel) el.style.display = 'none';
            });
            panel.style.display = 'block';

            document.getElementById('recoveryReloadBtn').addEventListener('click', () => {
                chrome.tabs.reload(tab.id);
                window.close();   // the fix happens on the page, not in here
            });
        });
    });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", function () {

    initRecoveryPanel();

    // Language setup
    applyLanguage();
    document.getElementById('languageSelect').addEventListener('change', function () {
        localStorage.setItem('ext-lang', this.value);
        applyLanguage();
    });

    // Promo code — badge and copy button only exist while the coupon is advertised.
    const promoCodeEl = document.getElementById('promoCodeDisplay');
    if (promoCodeEl) promoCodeEl.textContent = PROMO_CODE;
    document.getElementById('copyPromoBtn')?.addEventListener('click', () => {
        const btn = document.getElementById('copyPromoBtn');
        const onCopied = () => {
            btn.textContent = t('copiedBtn');
            setTimeout(() => { btn.textContent = t('copyBtn'); }, 2000);
        };
        if (navigator.clipboard) {
            navigator.clipboard.writeText(PROMO_CODE).then(onCopied).catch(onCopied);
        } else {
            const ta = Object.assign(document.createElement('textarea'), {
                value: PROMO_CODE, style: 'position:fixed;opacity:0'
            });
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            onCopied();
        }
    });

    // Feature spotlight — cycles through every premium row once per popup open.
    // Reads the rows from the DOM so newly-added features are included automatically.
    (function runSpotlight() {
        const rows = document.querySelectorAll('#premiumSectionWrap .prem-row');
        rows.forEach((el, i) => {
            setTimeout(() => {
                el.classList.add('feature-glow');
                el.addEventListener('animationend', () => el.classList.remove('feature-glow'), { once: true });
            }, 500 + i * 950);
        });
    })();


    // First-time defaults
    if (!localStorage.getItem('panoptoExtSpeed')) {
        localStorage.setItem('panoptoExtSpeed', '1');
        localStorage.setItem('userDataOptIn', 'false');
    }
    if (!localStorage.getItem('panoptoExtToggle')) {
        localStorage.setItem('panoptoExtToggle', 'false');
    }
    if (!localStorage.getItem('saved-time')) {
        localStorage.setItem('saved-time', '0');
    }

    const previousSavedTime = localStorage.getItem('saved-time');
    const uniqueID = localStorage.getItem('uniqueID');

    // ── Slider + speed badge ──────────────────────────────────────────────────

    const slider      = document.getElementById('dynamicSlider');
    const speedBadge  = document.getElementById('sliderValue');
    const checkBox    = document.getElementById('startupSpeed');

    // Restore toggle state
    if (localStorage.getItem('panoptoExtToggle') === 'true') checkBox.checked = true;
    if (localStorage.getItem('userDataOptIn') === 'true') document.getElementById('userDataOptIn').checked = true;


    checkBox.addEventListener('click', () => {
        const val = checkBox.checked ? 'true' : 'false';
        localStorage.setItem('panoptoExtToggle', val);
        sendToTab("speedOnStartup", val);
    });

    function updateOptInNudge() {
        const btn = document.getElementById('optInNudgeBtn');
        if (!btn) return;
        const loggedIn = !!localStorage.getItem('email');
        const optedIn  = localStorage.getItem('userDataOptIn') === 'true';
        btn.style.display = (loggedIn && !optedIn) ? 'block' : 'none';
    }

    document.getElementById('optInNudgeBtn').addEventListener('click', () => {
        const cb = document.getElementById('userDataOptIn');
        cb.checked = true;
        localStorage.setItem('userDataOptIn', 'true');
        optInFunc();
        updateOptInNudge();
    });

    document.getElementById('userDataOptIn').addEventListener('click', () => {
        const val = document.getElementById('userDataOptIn').checked ? 'true' : 'false';
        localStorage.setItem('userDataOptIn', val);
        optInFunc();
        updateOptInNudge();
    });

    // One line under the slider. Normally a grey hint (typed speeds, hold-to-fast-
    // forward - the two things nobody would otherwise discover); above 4x it becomes
    // the red "not counted" warning, because that is where track() stops counting.
    const speedWarning = document.getElementById('speedWarning');
    function updateSpeedWarning(speed) {
        const warn = speed > 4;
        speedWarning.textContent   = warn ? t('speedWarning') : t('speedHints');
        speedWarning.style.color   = warn ? '#dc2626' : '#9ca3af';
        speedWarning.style.display = 'block';
    }

    // Restore stored speed
    let storedSpeed = parseFloat(localStorage.getItem('panoptoExtSpeed'));
    if (isNaN(storedSpeed)) { storedSpeed = 1; localStorage.setItem('panoptoExtSpeed', '1'); }
    if (storedSpeed > parseFloat(slider.max)) slider.max = storedSpeed;
    slider.value = storedSpeed;
    speedBadge.textContent = storedSpeed.toFixed(2) + 'x';
    updateSpeedWarning(storedSpeed);

    // Slider input
    slider.addEventListener('input', function () {
        const val = parseFloat(this.value);
        localStorage.setItem('panoptoExtSpeed', val);
        speedBadge.textContent = val.toFixed(2) + 'x';
        updateSpeedWarning(val);
    });
    slider.addEventListener('mouseup', function () {
        sendToTab("updateSpeed", parseFloat(slider.value));
    });

    // Badge click → editable (strip "x" first so only the number is shown while editing)
    speedBadge.addEventListener('click', () => {
        speedBadge.textContent = speedBadge.textContent.replace(/x/gi, '').trim();
        speedBadge.setAttribute('contenteditable', 'true');
        speedBadge.focus();
        const range = document.createRange();
        range.selectNodeContents(speedBadge);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    });

    speedBadge.addEventListener('blur', () => {
        speedBadge.removeAttribute('contenteditable');
        speedBadge.textContent = parseAndStore(speedBadge.textContent) + 'x';
        updateSpeedWarning(parseFloat(localStorage.getItem('panoptoExtSpeed')));
        sendToTab("updateSpeed", parseFloat(localStorage.getItem('panoptoExtSpeed')));
    });

    speedBadge.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); speedBadge.blur(); }
        else if (!isNumericKey(e)) e.preventDefault();
    });

    function parseAndStore(raw) {
        const cleaned = raw.replace(/[^\d.]/g, '');
        const f = parseFloat(cleaned);
        if (!isNaN(f)) {
            localStorage.setItem('panoptoExtSpeed', f.toString());
            slider.value = f.toString();
            return f.toFixed(2);
        }
        const i = parseInt(cleaned);
        if (!isNaN(i)) {
            localStorage.setItem('panoptoExtSpeed', i.toString());
            slider.value = i.toString();
            return i.toFixed(2);
        }
        return '1.00';
    }

    function isNumericKey(e) {
        const k = e.key;
        return (k >= '0' && k <= '9') ||
            ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', '.', 'x', 'X', 'a', 'Ctrl'].includes(k);
    }

    // ── Time saved display ────────────────────────────────────────────────────

    const timeSavedEl = document.getElementById('timeSaved');

    function formatTime(totalSecs) {
        totalSecs = Math.floor(Number(totalSecs));
        if (isNaN(totalSecs) || totalSecs <= 0) return '0s';
        const y = Math.floor(totalSecs / 31536000); totalSecs %= 31536000;
        const mo = Math.floor(totalSecs / 2592000); totalSecs %= 2592000;
        const d = Math.floor(totalSecs / 86400);    totalSecs %= 86400;
        const h = Math.floor(totalSecs / 3600);     totalSecs %= 3600;
        const m = Math.floor(totalSecs / 60);
        const s = totalSecs % 60;
        let out = '';
        if (y)  out += `${y}y `;
        if (mo) out += `${mo}mo `;
        if (d)  out += `${d}d `;
        if (h)  out += `${h}h `;
        if (m)  out += `${m}m `;
        if (s || !out) out += `${s}s`;
        return out.trim();
    }

    function formatHours(totalSecs) {
        const hours = Math.floor(Number(totalSecs) / 3600);
        return hours.toLocaleString() + (hours === 1 ? ' hour' : ' hours');
    }

    function formatTimeFull(totalSecs) {
        totalSecs = Math.floor(Number(totalSecs));
        if (isNaN(totalSecs) || totalSecs <= 0) return '0 seconds';
        const y  = Math.floor(totalSecs / 31536000); totalSecs %= 31536000;
        const mo = Math.floor(totalSecs / 2592000);  totalSecs %= 2592000;
        const d  = Math.floor(totalSecs / 86400);    totalSecs %= 86400;
        const h  = Math.floor(totalSecs / 3600);     totalSecs %= 3600;
        const m  = Math.floor(totalSecs / 60);
        const s  = totalSecs % 60;
        const parts = [];
        if (y)  parts.push(`${y} year${y   !== 1 ? 's' : ''}`);
        if (mo) parts.push(`${mo} month${mo !== 1 ? 's' : ''}`);
        if (d)  parts.push(`${d} day${d   !== 1 ? 's' : ''}`);
        if (h)  parts.push(`${h} hour${h   !== 1 ? 's' : ''}`);
        if (m)  parts.push(`${m} minute${m !== 1 ? 's' : ''}`);
        if (s || parts.length === 0) parts.push(`${s} second${s !== 1 ? 's' : ''}`);
        return parts.join(', ');
    }

    const silenceSavedDisplay = document.getElementById('silenceSavedDisplay');
    const silenceSavedSpan    = document.getElementById('silenceSavedSpan');

    const updateSavedTime = () => {
        chrome.runtime.sendMessage({ type: "getSavedTime" }, (response) => {
            if (response?.savedTime != null) {
                localStorage.setItem('saved-time', response.savedTime);
                timeSavedEl.textContent = formatTime(response.savedTime);
            }
        });

        // Always fetch silence time — needed for free-tier counter even when auto-skip is off
        chrome.runtime.sendMessage({ type: "getSilenceSavedTime" }, (response) => {
            if (response?.silenceSavedTime == null) return;
            const newSecs       = response.silenceSavedTime;
            const wasUnderLimit = _silenceSecs < FREE_SILENCE_LIMIT_SECS;
            _silenceSecs        = newSecs;

            const autoSkipOn = localStorage.getItem('autoSkipSilence') === 'true';

            if (_isPremium) {
                // Premium: show raw "silence saved" stat when auto-skip is on
                silenceSavedDisplay.style.display = (autoSkipOn && newSecs > 0) ? 'block' : 'none';
                if (autoSkipOn && newSecs > 0) silenceSavedSpan.textContent = formatTime(newSecs);
            } else {
                silenceSavedDisplay.style.display = 'none';
                // If the limit was just crossed, do a full re-render to show the lock state
                if (wasUnderLimit && newSecs >= FREE_SILENCE_LIMIT_SECS) {
                    applyPremiumUI();
                    syncFreeUsage();
                } else {
                    // Live-update the free-usage counter text without a full re-render
                    const silenceFreeEl = document.getElementById('silenceFreeUsage');
                    if (silenceFreeEl && silenceFreeEl.style.display !== 'none') {
                        if (newSecs > 0) {
                            const m = Math.floor(newSecs / 60);
                            const s = Math.floor(newSecs % 60);
                            silenceFreeEl.style.color = '#9ca3af';
                            silenceFreeEl.textContent = t('silenceFreeUsed').replace('{time}', m + ':' + s.toString().padStart(2, '0'));
                        } else {
                            silenceFreeEl.style.color = '#11773D';
                            silenceFreeEl.textContent = t('silenceFreeTry');
                        }
                    }
                }
            }
        });
    };
    setInterval(updateSavedTime, 1000);
    updateSavedTime();

    // ── Auth helpers ──────────────────────────────────────────────────────────

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    // ── Cross-browser Google sign-in ──────────────────────────────────────────
    //
    // chrome.identity.getAuthToken() only works in Google Chrome — it relies on
    // the browser being signed into a Google Account, which Microsoft Edge,
    // Brave, Opera, etc. do not provide. On those browsers it always fails with
    // "Sign-in cancelled or failed.", so we fall back to launchWebAuthFlow(),
    // which works on every Chromium browser.
    //
    // launchWebAuthFlow needs a *Web application* OAuth 2.0 client — NOT the
    // "Chrome App" client in manifest.json; they are different client types —
    // with this extension's redirect URI registered as an authorized redirect.
    // The exact redirect URI is logged to the console the first time the web
    // flow runs; register that value, then paste the Web client ID below.
    const WEB_OAUTH_CLIENT_ID = '226457587386-4ppmltjpvb2177b6qhh24pmvrah03p1n.apps.googleusercontent.com';

    function removeCachedToken(token) {
        return new Promise(resolve => {
            try {
                if (token && chrome.identity && typeof chrome.identity.removeCachedAuthToken === 'function') {
                    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
                    return;
                }
            } catch (e) { /* removeCachedAuthToken is Chrome-only; nothing to clear elsewhere */ }
            resolve();
        });
    }

    // True only for genuine Google Chrome, where getAuthToken is backed by a real
    // Google Account. Edge/Opera are excluded explicitly; Brave reports itself as
    // Chrome but disables getAuthToken — that case is caught at runtime by falling
    // back to the web flow when getAuthToken returns no token.
    function nativeAuthLikelyWorks() {
        if (!chrome.identity || typeof chrome.identity.getAuthToken !== 'function') return false;
        const ua = navigator.userAgent || '';
        if (/\bEdg(?:e|A|iOS)?\//.test(ua)) return false;
        if (/\bOPR\//.test(ua) || /\bOpera\b/.test(ua)) return false;
        const brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
        if (brands.some(b => /Edge|Opera/i.test(b.brand))) return false;
        return true;
    }

    // Chrome-native sign-in. Resolves to a token string, or null on any failure.
    function getAuthTokenNative(interactive) {
        return new Promise(resolve => {
            // Brave (which reports itself as Chrome) and some managed Chrome profiles
            // have an identity.getAuthToken that never calls back. With no timeout
            // the promise hung forever, acquireGoogleToken never reached the web-flow
            // fallback, and the Sign in button did nothing at all. Interactive gets
            // longer because the user may genuinely be picking an account.
            let settled = false;
            const done = (v) => { if (!settled) { settled = true; resolve(v); } };
            const timer = setTimeout(() => done(null), interactive ? 45000 : 8000);
            try {
                chrome.identity.getAuthToken({ interactive }, token => {
                    clearTimeout(timer);
                    // Touch lastError so it is cleared even when we ignore the result.
                    if (chrome.runtime.lastError || !token) { done(null); return; }
                    done(token);
                });
            } catch (e) {
                clearTimeout(timer);
                done(null);
            }
        });
    }

    // Web-based sign-in (Edge/Brave/Opera, and Chrome as a fallback). Opens
    // Google's consent page and captures the access token from the redirect.
    // Resolves to a token string, or null on failure/cancel.
    function getAuthTokenWeb(interactive) {
        return new Promise(resolve => {
            if (!chrome.identity || typeof chrome.identity.launchWebAuthFlow !== 'function') {
                resolve(null);
                return;
            }
            const manifest = chrome.runtime.getManifest();
            const scopes = (manifest.oauth2 && manifest.oauth2.scopes) || ['email'];
            const redirectUri = chrome.identity.getRedirectURL();
            // This is the value registered as an "Authorized redirect URI" on the
            // Web OAuth client (it differs between an unpacked dev build and the
            // published extension). To look it up again during development, run
            // chrome.identity.getRedirectURL() in the popup's DevTools console.

            if (!WEB_OAUTH_CLIENT_ID || WEB_OAUTH_CLIENT_ID.startsWith('REPLACE_WITH')) {
                console.error('[Panopto] Web sign-in is not configured: set WEB_OAUTH_CLIENT_ID in popup.js to your "Web application" OAuth client ID.');
                resolve(null);
                return;
            }

            const authUrl =
                'https://accounts.google.com/o/oauth2/v2/auth' +
                '?client_id='    + encodeURIComponent(WEB_OAUTH_CLIENT_ID) +
                '&response_type=token' +
                '&redirect_uri=' + encodeURIComponent(redirectUri) +
                '&scope='        + encodeURIComponent(scopes.join(' ')) +
                '&prompt='       + (interactive ? 'select_account' : 'none');

            chrome.identity.launchWebAuthFlow({ url: authUrl, interactive }, redirectUrl => {
                if (chrome.runtime.lastError || !redirectUrl) { resolve(null); return; }
                const match = /[#&]access_token=([^&]+)/.exec(redirectUrl);
                resolve(match ? decodeURIComponent(match[1]) : null);
            });
        });
    }

    // Acquire a Google access token using the best mechanism for this browser:
    // Chrome's native flow when available, otherwise (or on its failure) the web
    // flow. Resolves to a token string or null.
    async function acquireGoogleToken(interactive) {
        if (nativeAuthLikelyWorks()) {
            const nativeToken = await getAuthTokenNative(interactive);
            if (nativeToken) return nativeToken;
            // getAuthToken exists but returned nothing (e.g. Brave, or Edge exposing
            // a non-functional API) — fall through to the web flow.
        }
        return await getAuthTokenWeb(interactive);
    }

    function storeToken(token, expiresIn) {
        localStorage.setItem('oauthToken', token);
        localStorage.setItem('tokenExpiry', Date.now() + expiresIn * 1000);
    }

    function isTokenExpired() {
        const expiry = localStorage.getItem('tokenExpiry');
        if (!expiry) return true;
        return Date.now() > parseInt(expiry, 10);
    }

    // ── View toggles ──────────────────────────────────────────────────────────

    function showLoggedOut() {
        document.getElementById('loggedOutView').style.display  = 'block';
        document.getElementById('loggedInView').style.display   = 'none';
        document.getElementById('migrationContainer').classList.remove('open');
        setNeedsUsername(false);
        const referralSection = document.getElementById('referralSection');
        if (referralSection) referralSection.style.display = 'none';
        const streakChip = document.getElementById('streakChip');
        if (streakChip) streakChip.style.display = 'none';
        updateOptInNudge();
    }

    function showLoggedIn() {
        document.getElementById('loggedOutView').style.display  = 'none';
        document.getElementById('loggedInView').style.display   = 'block';
        updateOptInNudge();
    }

    // ── Auth functions ────────────────────────────────────────────────────────

    function clientLogout() {
        const tok = localStorage.getItem('authToken');
        if (tok && tok !== 'null') removeCachedToken(tok);
        localStorage.setItem('authToken', 'null');
        localStorage.removeItem('oauthToken');
        localStorage.removeItem('tokenExpiry');
        localStorage.removeItem('username');
        localStorage.removeItem('email');
        localStorage.removeItem('couponCache');
        try { chrome.storage.local.remove('pcsAuth'); } catch {}   // stop in-page chat for the signed-out user
        localStorage.removeItem('premiumCache');
        localStorage.removeItem('notesQuotaCache');
        _isPremium = false; _premiumType = null; _premiumExpiry = null; _premiumPlan = null;
        // ...and the quota/budget state, or the AI-usage bar and "trial used" of the
        // account that just left stay drawn under the signed-out header.
        _notesDailyUsed = 0; _notesLifetimeUsed = 0; _notesUnlimited = false;
        _aiTier = null; _aiBudget = null; _trialUsed = false;
        _streak = null;
        const sp = document.getElementById('lbl-signin-prompt');
        if (sp) { sp.textContent = t('signinPrompt'); sp.style.color = ''; }
        showLoggedOut();
        // Redraw locks/badges for the signed-out state (applyPremiumUI is hoisted).
        try { applyPremiumUI(); } catch {}
    }

    function clientLogin() {
        showLoggedIn();
        loadFreeUsage();

        const oldUSR = localStorage.getItem('uniqueID');

        if (oldUSR) {
            // Legacy migration path
            setNeedsUsername(true);
            openUsernameDialog();
            document.getElementById('oldUsernameTextbox').value = oldUSR;
            attachMigrationListener();
        } else {
            // Fetch username from server
            sleep(1).then(() => {
                fetch(`${BACKEND}/username`, { headers: { 'X-PCS-Email': localStorage.getItem('email') || '', 'X-PCS-Token': localStorage.getItem('authToken') || '' } })
                    .then(r => r.text())
                    .then(text => {
                        if (text === '{username not found}') {
                            setNeedsUsername(true);
                            openUsernameDialog();
                            document.getElementById('oldUsernameTextbox').value = '(unknown)';
                            attachMigrationListener();
                        } else if (text.length <= 16) {
                            localStorage.setItem('username', text);
                            document.getElementById('email').textContent = text;
                            document.getElementById('migrationContainer').classList.remove('open');
                            setNeedsUsername(false);
                            getRank();
                        }
                    })
                    .catch(e => PCS_DEBUG && console.log(e));
            });

            document.getElementById('email').textContent =
                localStorage.getItem('username') || localStorage.getItem('email') || '';
        }

        initReferral();
        initRewards();
        initStreak();
        // Republish auth for the in-page chat/dub straight away. It was only ever
        // written at the end of the premium check, so after a silent refresh the
        // content script saw no auth until that round-trip finished — and if it
        // failed, never.
        writeAiAuth();
        // And re-run the premium check now. It used to run only at popup open, so
        // someone who signed in inside the popup kept looking at the signed-out lock
        // states ("Get Premium", "10/10 free presses used") until they closed and
        // reopened it. initPremium() ends in applyPremiumUI(), which redraws all of it.
        initPremium();
    }

    function attachMigrationListener() {
        sleep(100).then(() => {
            const usrBox = document.getElementById('newUsernameTextbox');
            // avoid duplicate listeners
            usrBox.removeEventListener('input', onMigrationInput);
            usrBox.addEventListener('input', onMigrationInput);
        });
    }

    function onMigrationInput() {
        document.getElementById('newUsernameButton').disabled = true;
        currentValid = false;
        debouncedValidateUsername();
    }

    async function loginWithChromeIdentity(interactive, retryInvalidToken = true) {
        const token = await acquireGoogleToken(interactive);
        if (!token) {
            if (interactive) PCS_DEBUG && console.log("Sign-in cancelled or failed.");
            return false;
        }

        const tokenInfoUrl = `https://oauth2.googleapis.com/tokeninfo?access_token=${token}`;
        try {
            const resp = await fetch(tokenInfoUrl);
            if (resp.status === 400) {
                // Token is invalid/expired — drop any cached copy and retry once.
                await removeCachedToken(token);
                return retryInvalidToken ? await loginWithChromeIdentity(interactive, false) : false;
            }
            const info = await resp.json();
            if (info.error_description) return false;
            localStorage.setItem('authToken', token);
            localStorage.setItem('email', info.email);
            reconcileTimeOwner(info.email);   // don't inherit a previous account's local totals
            document.getElementById('email').textContent = info.email;
            storeToken(token, info.expires_in);
            logLogin();
            clientLogin();
            return true;
        } catch (e) {
            PCS_DEBUG && console.log(e);
            return false;
        }
    }

    // Sign-in used to be fire-and-forget: on any failure (Google window closed,
    // pop-up blocked, tokeninfo unreachable on a campus network, Brave's identity
    // API never calling back) the button simply did nothing, and the user assumed
    // login was broken. Now it shows progress and says what to do when it fails.
    let _signingIn = false;
    async function signIn() {
        if (_signingIn) return;
        _signingIn = true;
        const btnLbl = document.getElementById('lbl-signin-btn');
        const prompt = document.getElementById('lbl-signin-prompt');
        const origBtn = btnLbl ? btnLbl.textContent : '';
        const origPrompt = prompt ? prompt.textContent : '';
        if (btnLbl) btnLbl.textContent = 'Signing in…';
        try {
            const ok = await loginWithChromeIdentity(true);
            if (!ok && prompt) {
                prompt.textContent = 'Sign-in didn’t complete. If a Google window opened and closed, allow pop-ups for this extension and try again.';
                prompt.style.color = '#b45309';
                setTimeout(() => { prompt.textContent = origPrompt; prompt.style.color = ''; }, 8000);
            }
        } finally {
            if (btnLbl) btnLbl.textContent = origBtn;
            _signingIn = false;
        }
    }

    document.getElementById('signInWithGoogle').addEventListener('click', signIn);

    document.getElementById('logout').addEventListener('click', clientLogout);

    // ── Backend calls ─────────────────────────────────────────────────────────

    const BACKEND = 'https://panopto-stripe.harveychandler235.workers.dev';

    function logLogin() {
        try {
            fetch(`${BACKEND}/logLogin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: localStorage.getItem('authToken'),
                    email: localStorage.getItem('email'),
                    source: 'popup',
                })
            });
        } catch {}
    }

    function logPremiumFeature(featureName) {
        try {
            fetch(`${BACKEND}/logPremiumFeature`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: localStorage.getItem('authToken'),
                    email: localStorage.getItem('email'),
                    featureClicked: featureName,
                })
            });
        } catch {}
    }

    // ── Free-tier usage sync ──────────────────────────────────────────────────

    var _freeUsageSyncTimer;

    function syncFreeUsage() {
        clearTimeout(_freeUsageSyncTimer);
        _freeUsageSyncTimer = setTimeout(_doSyncFreeUsage, 8000);
    }

    function _doSyncFreeUsage() {
        const email = localStorage.getItem('email');
        const token = localStorage.getItem('authToken');
        if (!email || !token || token === 'null') return;
        fetch(`${BACKEND}/freeUsage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token,
                email,
                silenceSecs:   _silenceSecs,
                pipCount:      parseInt(localStorage.getItem('pipPressCount') || '0'),
                downloadCount: parseInt(localStorage.getItem('downloadCount') || '0'),
            })
        }).catch(() => {});
    }

    async function loadFreeUsage() {
        const email = localStorage.getItem('email');
        const token = localStorage.getItem('authToken');
        if (!email || !token || token === 'null') return;
        try {
            const res = await fetch(`${BACKEND}/freeUsage`, { headers: { 'X-PCS-Email': email, 'X-PCS-Token': token } });
            if (!res.ok) return;
            const data = await res.json();
            if (data.error) return;

            const localPip      = parseInt(localStorage.getItem('pipPressCount') || '0');
            const localDownload = parseInt(localStorage.getItem('downloadCount') || '0');
            const newPip        = Math.max(localPip,      data.pipCount      || 0);
            const newDownload   = Math.max(localDownload, data.downloadCount || 0);
            const newSilence    = Math.max(_silenceSecs,  data.silenceSecs   || 0);

            if (newPip !== localPip)           localStorage.setItem('pipPressCount', newPip.toString());
            if (newDownload !== localDownload) localStorage.setItem('downloadCount', newDownload.toString());
            if (newSilence > _silenceSecs) {
                chrome.runtime.sendMessage({ type: "setSilenceSavedTime", silenceSavedTime: newSilence });
            }

            applyPremiumUI();

            // Push back if local was higher on any counter
            if (localPip > (data.pipCount || 0) || localDownload > (data.downloadCount || 0) || _silenceSecs > (data.silenceSecs || 0)) {
                _doSyncFreeUsage();
            }
        } catch {}
    }

    // ── Rank (updated: parses "rank:serverSeconds") ───────────────────────────

    async function getRank() {
        // Show cached rank immediately while loading
        const cachedRank = localStorage.getItem('user-rank');
        if (cachedRank) {
            document.getElementById('user-rank').textContent =
                cachedRank == -1 ? t('rankGt20') : `#${cachedRank}`;
        }

        const token = localStorage.getItem('authToken');
        if (!token || token === 'null') return;

        document.getElementById('loader').style.display = 'inline-block';
        document.getElementById('tick').style.display   = 'none';

        fetch(`${BACKEND}/rank?username=${encodeURIComponent(localStorage.getItem('username'))}`)
            .then(r => r.text())
            .then(text => {
                text = text.trim();
                const parts = text.split(':');
                const rank  = parts[0].trim();

                localStorage.setItem('user-rank', rank);
                document.getElementById('user-rank').textContent =
                    rank == -1 ? t('rankGt20') : `#${rank}`;

                // Time sync: if server time > local, update local
                if (parts.length > 1) {
                    const serverSeconds = parseFloat(parts[1]);
                    const localSeconds  = parseFloat(localStorage.getItem('saved-time') || '0');
                    if (!isNaN(serverSeconds) && serverSeconds > localSeconds) {
                        localStorage.setItem('saved-time', serverSeconds);
                        chrome.runtime.sendMessage({ type: "setSavedTime", savedTime: serverSeconds });
                    }
                }

                document.getElementById('loader').style.display = 'none';
                document.getElementById('tick').style.display   = 'inline-block';
            })
            .catch(e => {
                PCS_DEBUG && console.log('getRank error:', e);
                document.getElementById('loader').style.display = 'none';
            });
    }

    // ── Username migration ────────────────────────────────────────────────────

    let currentValid = false;

    function debounce(fn, delay) {
        let id;
        return function (...args) { clearTimeout(id); id = setTimeout(() => fn.apply(this, args), delay); };
    }

    function validateUsername() {
        const input    = document.getElementById('newUsernameTextbox');
        const username = input.value;
        const isValid  = /^[a-zA-Z0-9]+$/.test(username);
        input.classList.remove('border-green', 'border-red', 'border-orange');
        if (username.length > 0 && isValid) {
            input.classList.add('border-orange');
            fetch(`${BACKEND}/checkUsername?username=${encodeURIComponent(username)}`, { headers: { 'X-PCS-Email': localStorage.getItem('email') || '', 'X-PCS-Token': localStorage.getItem('authToken') || '' } })
                .then(r => r.text())
                .then(text => {
                    input.classList.remove('border-orange');
                    if (text === 'true') {
                        input.classList.add('border-green');
                        document.getElementById('newUsernameButton').disabled = false;
                        currentValid = true;
                    } else {
                        input.classList.add('border-red');
                        document.getElementById('newUsernameButton').disabled = true;
                        currentValid = false;
                    }
                })
                .catch(() => {});
        } else {
            input.classList.add('border-red');
        }
    }

    const debouncedValidateUsername = debounce(validateUsername, 500);

    async function updateUsername() {
        const btn      = document.getElementById('newUsernameButton');
        const newName  = document.getElementById('newUsernameTextbox').value;
        localStorage.setItem('username', newName);
        btn.disabled    = true;
        btn.textContent = t('pleaseWait');
        const payload = {
            token: localStorage.getItem('authToken'),
            email: localStorage.getItem('email'),
            newUsername: newName
        };
        await fetch(`${BACKEND}/updateUser`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        localStorage.removeItem('uniqueID');
        btn.textContent = t('confirmBtn');
        clientLogin();
    }

    (function wireUsernameModal() {
        const modal = document.getElementById('migrationContainer');
        const close = () => modal.classList.remove('open');
        document.getElementById('usernameModalClose')?.addEventListener('click', close);
        document.getElementById('setUsernameLink')?.addEventListener('click', (e) => { e.preventDefault(); openUsernameDialog(); });
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
        // Enter in the box submits when the name has validated.
        document.getElementById('newUsernameTextbox')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !document.getElementById('newUsernameButton').disabled) {
                document.getElementById('newUsernameButton').click();
            }
        });
    })();

    document.getElementById('newUsernameButton').addEventListener('click', () => {
        if (currentValid && !document.getElementById('newUsernameButton').disabled) {
            updateUsername();
        }
    });

    // ── Opt-in logging ────────────────────────────────────────────────────────

    function optInFunc() {
        const optIn = localStorage.getItem('userDataOptIn');
        if (optIn !== 'true') return;

        chrome.runtime.sendMessage({ type: "getSavedTime" }, (response) => {
            if (response?.savedTime == null) return;
            const ts = response.savedTime;
            if (ts === 0) return;
            try {
                fetch(`${BACKEND}/logTime`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: localStorage.getItem('authToken'),
                        email: localStorage.getItem('email'),
                        username: localStorage.getItem('username'),
                        timeSaved: ts,
                        speed: localStorage.getItem('panoptoExtSpeed')
                    })
                });
            } catch {}
        });
    }

    // Guard the startup pushes too: make sure the local totals belong to the
    // currently signed-in account before we upload them.
    reconcileTimeOwner(localStorage.getItem('email'));
    optInFunc();

    // Log time on startup if opted in
    if (localStorage.getItem('userDataOptIn') === 'true' && localStorage.getItem('email')) {
        fetch(`${BACKEND}/logTime`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: localStorage.getItem('authToken'),
                email: localStorage.getItem('email'),
                username: localStorage.getItem('username'),
                timeSaved: localStorage.getItem('saved-time'),
                speed: localStorage.getItem('panoptoExtSpeed')
            })
        });
    }

    // ── Leaderboard popup ─────────────────────────────────────────────────────

    // ── Premium ───────────────────────────────────────────────────────────────

    // Baked-in defaults. loadPlans() below overrides these from GET /plans so a price
    // or payment-link change ships instantly instead of waiting on a store review.
    // £3 every 2 months. The 7-day free trial (no card required) is enabled on
    // this payment link in Stripe, so checkout offers it automatically.
    let PREMIUM_2MO_URL  = 'https://buy.stripe.com/6oU9ALalk59U4GdfqY1VK04';
    // Same £3/2-month price, but charges immediately with no trial. Used once the
    // free trial is spent — the trial link would give them a Stripe trial the server
    // won't honour, so they'd pay nothing and get nothing for a week.
    let PREMIUM_2MO_PAYNOW_URL = 'https://buy.stripe.com/28EaEP8dcgSC8Wt3Ig1VK06';
    // £12 per year.
    let PREMIUM_YEAR_URL = 'https://buy.stripe.com/eVqdR1dxweKu8Wt3Ig1VK05';

    // Whichever of the two the user is actually entitled to.
    // The cards always charge immediately; the trial button is the only route to
    // the trial link, and it is hidden once the trial is spent.
    function twoMonthUrl() { return PREMIUM_2MO_PAYNOW_URL; }

    // Best-effort: any failure leaves the baked-in prices and links in place.
    async function loadPlans() {
        try {
            const res = await fetch(`${BACKEND}/plans`);
            if (!res.ok) return;
            const { plans } = await res.json();
            for (const p of plans || []) {
                if (p.id === '2mo'  && p.url) PREMIUM_2MO_URL  = p.url;
                if (p.id === '2mo'  && p.subscribeUrl) PREMIUM_2MO_PAYNOW_URL = p.subscribeUrl;
                if (p.id === 'year' && p.url) PREMIUM_YEAR_URL = p.url;
                const el = document.getElementById(p.id === '2mo' ? 'plan2moPrice' : 'planYearPrice');
                if (el && p.price) el.textContent = p.price;
                if (p.id === 'year' && p.price) {
                    const cta = document.getElementById('lifetimePremiumBtn');
                    if (cta) cta.textContent = `${p.price}/yr`;
                }
            }
        } catch {}
    }
    loadPlans();

    // Returns { active, type, expiry, plan } — type is 'lifetime'|'timed'|null,
    // plan is 'trial'|'monthly'|'yearly'|'lifetime' and drives the badge label.
    // The email Panopto shows as signed in on the last lecture page (content.js →
    // background → storage). Sent with /check so premium bought under it counts.
    async function panoptoIdentity() {
        try { const r = await chrome.storage.local.get('panoptoIdentity'); return (r && r.panoptoIdentity && r.panoptoIdentity.email) || ''; } catch { return ''; }
    }
    function showPanoptoLink(alt, status) {
        const el = document.getElementById('panoptoEmail');
        if (!el) return;
        if (!alt) { el.style.display = 'none'; return; }
        el.style.display = 'inline';
        if (status?.altBlocked) {
            el.textContent = 'Panopto: ' + alt + ' (used by too many accounts)';
            el.title = 'This Panopto email has been used with several Google accounts recently, so its premium is not shared here. If that is just you, use "Message support" and it is reset in a minute.';
            el.style.color = '#b45309';
        } else if (status?.via === 'alt') {
            el.textContent = 'Premium via Panopto: ' + alt;
            el.title = 'Premium was bought under this Panopto email; it counts for this Google account too.';
            el.style.color = '#11773D';
        } else {
            el.textContent = 'Panopto: ' + alt;
            el.title = 'The email Panopto shows as signed in. Premium bought under it counts here.';
            el.style.color = '#6b7280';
        }
    }
    async function checkPremium(email) {
        const alt      = await panoptoIdentity();
        const cached   = JSON.parse(localStorage.getItem('premiumCache') || 'null');
        // Lifetime premium: cache 24h. Timed: cache 1h so expiry is noticed sooner.
        const cacheTTL = (cached?.type === 'lifetime') ? 86400000 : 3600000;
        if (cached?.email === email && (cached.alt || '') === (alt || '') && Date.now() - (cached.checkedAt || 0) < cacheTTL) {
            showPanoptoLink(alt, cached);
            return { active: cached.active, type: cached.type, expiry: cached.expiry, plan: cached.plan, via: cached.via, altBlocked: cached.altBlocked };
        }
        try {
            const headers = { 'X-PCS-Email': email };
            if (alt && alt !== String(email).toLowerCase()) headers['X-PCS-Alt'] = alt;
            const res  = await fetch(`${BACKEND}/check`, { headers });
            // A 5xx from the worker (KV hiccup, deploy in progress) used to be cached
            // as an authoritative "not premium" for the next hour, locking a paying
            // user out. Treat it like a network failure: keep whatever we knew.
            if (!res.ok) throw new Error(`check ${res.status}`);
            const data = await res.json();
            localStorage.setItem('premiumCache', JSON.stringify({
                email, alt, checkedAt: Date.now(),
                active: data.active, type: data.type, expiry: data.expiry, plan: data.plan,
                via: data.via, altBlocked: !!data.altBlocked
            }));
            showPanoptoLink(alt, data);
            return { ...data, ok: true };
        } catch {
            // ok:false lets the "Check Premium" link tell "no premium on this email"
            // apart from "could not reach the server".
            if (cached) return { active: cached.active, type: cached.type, expiry: cached.expiry, plan: cached.plan, ok: false };
            return { active: false, type: null, expiry: null, plan: null, ok: false };
        }
    }

    // applyPremiumUI is a function declaration so it's hoisted within DOMContentLoaded
    // and can be safely called from updateSavedTime which runs before this code block.
    function applyPremiumUI() {
        const pipCount      = parseInt(localStorage.getItem('pipPressCount') || '0');
        const silenceLocked = !_isPremium && _silenceSecs >= FREE_SILENCE_LIMIT_SECS;
        const pipLocked     = !_isPremium && pipCount >= FREE_PIP_LIMIT;
        const silenceFreeEl = document.getElementById('silenceFreeUsage');
        const pipFreeEl     = document.getElementById('pipFreeUsage');

        // Toggle premium pricing options vs badge in section header
        const getPremiumOptions = document.getElementById('getPremiumOptions');
        const premiumBadgeGroup = document.getElementById('premiumBadgeGroup');
        if (getPremiumOptions) getPremiumOptions.style.display = _isPremium ? 'none' : 'flex';
        if (premiumBadgeGroup) premiumBadgeGroup.style.display = _isPremium ? 'flex' : 'none';
        // Don't advertise a trial someone has already used — and don't label the
        // button "Start free trial" when it now goes to the pay-now link.
        const promoBanner = document.getElementById('promoBanner');
        if (promoBanner) promoBanner.style.display = (SHOW_TRIAL_BANNER && !_isPremium && !_trialUsed) ? 'flex' : 'none';
        // Trial button and its blurb disappear once the trial is used or they're premium.
        const trialBtn = document.getElementById('trialModalBtn');
        const hideTrial = _trialUsed || _isPremium;
        if (trialBtn) trialBtn.style.display = hideTrial ? 'none' : 'block';
        const trialNote = document.getElementById('lbl-plan-trial-note');
        if (trialNote && trialNote.parentNode) trialNote.parentNode.style.display = hideTrial ? 'none' : 'block';
        if (_trialUsed) {
            const cta = document.getElementById('monthlyPremiumBtn');
            if (cta) { cta.textContent = t('planYearBtn'); cta.title = 'Free trial already used'; }
        }

        // Show expiry date for timed premium
        const premiumExpiryEl = document.getElementById('premiumExpiry');
        if (premiumExpiryEl) {
            premiumExpiryEl.textContent = _isPremium ? planLabelText() : '';
        }

        const premiumBadge     = document.getElementById('premiumBadge');
        const premiumUserBadge = document.getElementById('premiumUserBadge');
        const premiumDaysLeft  = document.getElementById('premiumDaysLeft');
        const cancelSubBtn     = document.getElementById('cancelSubBtn');
        if (cancelSubBtn) cancelSubBtn.style.display = (_isPremium && _premiumType === 'timed') ? 'inline' : 'none';
        if (premiumBadge) premiumBadge.style.display = _isPremium ? 'inline' : 'none';
        if (premiumUserBadge) {
            // Plan name, not a countdown — same rule as the badge and bottom button.
            premiumUserBadge.style.display = _isPremium ? 'inline' : 'none';
            if (_isPremium) {
                premiumUserBadge.title = planLabelText();
                if (premiumDaysLeft) {
                    premiumDaysLeft.style.display = 'inline';
                    premiumDaysLeft.textContent   = planLabelText();
                }
            } else {
                premiumUserBadge.title = '';
                if (premiumDaysLeft) premiumDaysLeft.style.display = 'none';
            }
        }

        // --- Auto-Skip Silence ---
        if (silenceLocked) {
            document.getElementById('getPremiumLink').style.display = 'inline';
            document.getElementById('autoSkipToggle').style.display = 'none';
            if (silenceFreeEl) {
                silenceFreeEl.style.display = 'block';
                silenceFreeEl.style.color   = '#dc2626';
                silenceFreeEl.textContent   = t('silenceFreeLimit');
            }
            if (localStorage.getItem('autoSkipSilence') === 'true') {
                localStorage.setItem('autoSkipSilence', 'false');
                sendToTab('autoSkipSilence', 'false');
                const cb = document.getElementById('autoSkipCheckbox');
                if (cb) cb.checked = false;
            }
        } else {
            // Everyone under the limit (free or premium) gets the toggle
            document.getElementById('getPremiumLink').style.display = 'none';
            document.getElementById('autoSkipToggle').style.display = 'inline-block';
            document.getElementById('autoSkipCheckbox').checked =
                localStorage.getItem('autoSkipSilence') === 'true';
            if (_isPremium) {
                if (silenceFreeEl) silenceFreeEl.style.display = 'none';
            } else {
                if (silenceFreeEl) {
                    silenceFreeEl.style.display = 'block';
                    if (_silenceSecs > 0) {
                        silenceFreeEl.style.color = '#9ca3af';
                        const m = Math.floor(_silenceSecs / 60);
                        const s = Math.floor(_silenceSecs % 60);
                        silenceFreeEl.textContent = t('silenceFreeUsed').replace('{time}', m + ':' + s.toString().padStart(2, '0'));
                    } else {
                        silenceFreeEl.style.color = '#11773D';
                        silenceFreeEl.textContent = t('silenceFreeTry');
                    }
                }
            }
        }

        const checkRow = document.getElementById('checkPremiumRow');
        if (checkRow) checkRow.style.display = _isPremium ? 'none' : 'block';

        // In-page AI chat: premium gets the toggle, everyone else a Get-Premium link.
        const ipcLock   = document.getElementById('inPageChatLock');
        const ipcToggle = document.getElementById('inPageChatToggleWrap');
        if (ipcLock)   ipcLock.style.display   = _isPremium ? 'none' : 'inline';
        if (ipcToggle) ipcToggle.style.display = _isPremium ? 'inline-block' : 'none';

        // --- Picture in Picture ---
        if (pipLocked) {
            if (pipFreeEl) {
                pipFreeEl.style.display = 'block';
                pipFreeEl.style.color   = '#dc2626';
                pipFreeEl.textContent   = t('pipFreeLocked').replace('{used}', FREE_PIP_LIMIT).replace('{limit}', FREE_PIP_LIMIT);
            }
            document.querySelectorAll('#pipButtons .pip-btn').forEach(b => {
                b.disabled      = true;
                b.style.opacity = '0.4';
                b.style.cursor  = 'not-allowed';
            });
        } else {
            if (pipFreeEl) {
                if (_isPremium) {
                    pipFreeEl.style.display = 'none';
                } else if (pipCount > 0) {
                    pipFreeEl.style.display = 'block';
                    pipFreeEl.style.color   = '#9ca3af';
                    pipFreeEl.textContent   = t('pipFreeUsed').replace('{used}', pipCount).replace('{limit}', FREE_PIP_LIMIT);
                } else {
                    pipFreeEl.style.display = 'block';
                    pipFreeEl.style.color   = '#11773D';
                    pipFreeEl.textContent   = t('pipFreeTry').replace('{limit}', FREE_PIP_LIMIT);
                }
            }
            document.querySelectorAll('#pipButtons .pip-btn').forEach(b => {
                b.disabled      = false;
                b.style.opacity = '';
                b.style.cursor  = '';
            });
        }

        // --- Download ---
        const downloadCount  = parseInt(localStorage.getItem('downloadCount') || '0');
        const downloadLocked = !_isPremium && downloadCount >= FREE_DOWNLOAD_LIMIT;
        const downloadFreeEl = document.getElementById('downloadFreeUsage');
        const dlVideoBtn     = document.getElementById('downloadVideoBtn');

        if (downloadLocked) {
            if (dlVideoBtn) { dlVideoBtn.disabled = true; dlVideoBtn.style.opacity = '0.4'; dlVideoBtn.style.cursor = 'not-allowed'; }
            if (downloadFreeEl) {
                downloadFreeEl.style.display = 'block';
                downloadFreeEl.style.color   = '#dc2626';
                downloadFreeEl.textContent   = t('downloadFreeLocked').replace('{used}', FREE_DOWNLOAD_LIMIT).replace('{limit}', FREE_DOWNLOAD_LIMIT);
            }
        } else {
            if (dlVideoBtn) { dlVideoBtn.disabled = false; dlVideoBtn.style.opacity = ''; dlVideoBtn.style.cursor = ''; }
            if (downloadFreeEl) {
                if (_isPremium) {
                    downloadFreeEl.style.display = 'none';
                } else if (downloadCount > 0) {
                    downloadFreeEl.style.display = 'block';
                    downloadFreeEl.style.color   = '#9ca3af';
                    downloadFreeEl.textContent   = t('downloadFreeUsed').replace('{used}', downloadCount).replace('{limit}', FREE_DOWNLOAD_LIMIT);
                } else {
                    downloadFreeEl.style.display = 'block';
                    downloadFreeEl.style.color   = '#11773D';
                    downloadFreeEl.textContent   = t('downloadFreeTry').replace('{limit}', FREE_DOWNLOAD_LIMIT);
                }
            }
        }

        // --- AI Lecture Notes — server enforces the same limits ---
        // Premium: NOTES_DAILY_LIMIT_PREMIUM (5) generations per UTC day.
        // Free:    NOTES_FREE_DAILY_LIMIT (3) generations per day, resets at midnight UTC.
        const notesBtn    = document.getElementById('generateNotesBtn');
        const notesFreeEl = document.getElementById('notesFreeUsage');
        if (notesBtn) {
            let locked = false;
            let labelText = '';
            let labelColor = '#9ca3af';

            if (_notesUnlimited) {
                locked     = false;
                labelText  = t('aiUnlimited');
                labelColor = '#a855f7';
            } else if (_aiBudget) {
                // Budget tier (paying, or inside the Stripe free trial): no daily caps,
                // just a usage allowance. Shown as a percentage only — the server never
                // sends costs to the client, so users don't see what we pay per request.
                const pct = Math.max(0, Math.min(100, _aiBudget.pctLeft || 0));
                locked = !!_aiBudget.exhausted;
                if (locked) {
                    const resetDay = _aiBudget.resetAt ? new Date(_aiBudget.resetAt).toLocaleDateString() : 'the 1st';
                    labelText  = _aiBudget.isTrial
                        ? 'Free-trial AI allowance used — subscribe for the full monthly allowance'
                        : `Monthly AI allowance used — resets ${resetDay}`;
                    labelColor = '#dc2626';
                } else {
                    labelText  = _aiBudget.isTrial
                        ? `AI usage: ${pct}% of your free-trial allowance left`
                        : `AI usage: ${pct}% left this month`;
                    labelColor = '#11773D';
                }
            } else if (_isPremium) {
                const used = _notesDailyUsed;
                const remaining = Math.max(0, NOTES_DAILY_LIMIT_PREMIUM - used);
                locked = remaining <= 0;
                if (locked) {
                    labelText  = t('notesDailyLimitReached').replace('{used}', used).replace('{limit}', NOTES_DAILY_LIMIT_PREMIUM);
                    labelColor = '#dc2626';
                } else if (used > 0) {
                    labelText  = t('notesDailyUsed').replace('{used}', used).replace('{limit}', NOTES_DAILY_LIMIT_PREMIUM);
                    labelColor = '#9ca3af';
                } else {
                    labelText  = t('notesDailyAvailable').replace('{limit}', NOTES_DAILY_LIMIT_PREMIUM);
                    labelColor = '#11773D';
                }
            } else {
                const used = _notesLifetimeUsed;
                locked = used >= NOTES_FREE_DAILY_LIMIT;
                if (locked) {
                    labelText  = t('notesFreeLocked').replace('{limit}', NOTES_DAILY_LIMIT_PREMIUM);
                    labelColor = '#dc2626';
                } else {
                    labelText  = t('notesFreeAvailable').replace('{limit}', NOTES_FREE_DAILY_LIMIT);
                    labelColor = '#11773D';
                }
            }

            // Notes / Chat / Flashcards share the same notes quota → gate them together.
            [notesBtn, document.getElementById('aiChatBtn'), document.getElementById('generateFlashcardsBtn')].forEach((b) => {
                if (!b) return;
                b.disabled      = locked;
                b.style.opacity = locked ? '0.4' : '';
                b.style.cursor  = locked ? 'not-allowed' : '';
                b.title         = locked ? labelText : '';
            });

            if (notesFreeEl) {
                notesFreeEl.style.display = 'block';
                notesFreeEl.style.color   = labelColor;
                notesFreeEl.textContent   = labelText;
            }

            // Green AI-budget progress bar (paying users only) — how much of the
            // monthly budget is left until the month ends. Built lazily in JS so
            // popup.html needs no changes.
            let budgetBar = document.getElementById('aiBudgetBar');
            if (_aiBudget && notesFreeEl) {
                if (!budgetBar) {
                    budgetBar = document.createElement('div');
                    budgetBar.id = 'aiBudgetBar';
                    budgetBar.style.cssText = 'height:6px;border-radius:3px;background:rgba(128,128,128,0.25);overflow:hidden;margin:4px 0 2px;';
                    budgetBar.innerHTML = '<div id="aiBudgetBarFill" style="height:100%;width:0%;background:#16a34a;border-radius:3px;transition:width .3s;"></div>';
                    notesFreeEl.parentNode.insertBefore(budgetBar, notesFreeEl);
                }
                budgetBar.style.display = 'block';
                const fill = document.getElementById('aiBudgetBarFill');
                const pct  = Math.max(0, Math.min(100, _aiBudget.pctLeft || 0));
                fill.style.width = pct + '%';
                fill.style.background = pct <= 10 ? '#dc2626' : pct <= 25 ? '#f59e0b' : '#16a34a';
                budgetBar.title = `${pct}% of your AI allowance left — resets on the 1st`;
            } else if (budgetBar) {
                budgetBar.style.display = 'none';
            }
        }

        // --- Bottom buy/status button ---
        const coffeeBtn = document.getElementById('coffee-button');
        if (coffeeBtn) {
            if (_isPremium) {
                coffeeBtn.innerHTML = '★ ' + planLabelText();
            } else {
                coffeeBtn.innerHTML = '★ <span id="lbl-coffee">' + t('coffee') + '</span>';
            }
        }
    }

    // ── Premium plan modal ────────────────────────────────────────────────────

    function openPremiumModal() {
        document.getElementById('premiumModal').classList.add('open');
    }
    function closePremiumModal() {
        document.getElementById('premiumModal').classList.remove('open');
    }

    function openLifetimePopup() {
        document.getElementById('lifetimeModal').classList.add('open');
    }
    function closeLifetimePopup() {
        document.getElementById('lifetimeModal').classList.remove('open');
    }

    document.getElementById('premiumModalClose').addEventListener('click', closePremiumModal);
    document.getElementById('premiumModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('premiumModal')) closePremiumModal();
    });

    document.getElementById('lifetimeModalClose').addEventListener('click', closeLifetimePopup);
    document.getElementById('lifetimeModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('lifetimeModal')) closeLifetimePopup();
    });

    // Heading off to Stripe: drop both caches so the very next popup open after
    // checkout refetches everything instead of showing an hour-old "not premium".
    const forgetPremiumCaches = () => { localStorage.removeItem('premiumCache'); localStorage.removeItem('notesQuotaCache'); };
    document.getElementById('monthlyModalBtn').addEventListener('click', () => {
        forgetPremiumCaches();
        window.open(twoMonthUrl());
        closePremiumModal();
    });
    document.getElementById('trialModalBtn')?.addEventListener('click', () => {
        forgetPremiumCaches();
        window.open(PREMIUM_2MO_URL);   // the link that carries the 7-day no-card trial
    });
    document.getElementById('lifetimeModalBtn').addEventListener('click', () => {
        forgetPremiumCaches();
        window.open(PREMIUM_YEAR_URL);
        closePremiumModal();
    });

    // "🔒 Get Premium" link inside the silence-locked row → open modal
    document.getElementById('getPremiumLink').addEventListener('click', (e) => {
        e.preventDefault();
        openPremiumModal();
    });

    document.getElementById('monthlyPremiumBtn').addEventListener('click', (e) => {
        e.preventDefault();
        openPremiumModal();
    });

    document.getElementById('lifetimePremiumBtn').addEventListener('click', (e) => {
        e.preventDefault();
        openPremiumModal();
    });

    document.getElementById('cancelSubBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        const btn   = document.getElementById('cancelSubBtn');
        const email = localStorage.getItem('email');
        const token = localStorage.getItem('authToken');
        if (!email || !token) return;
        btn.textContent      = 'Loading…';
        btn.style.pointerEvents = 'none';
        try {
            const res  = await fetch(`${BACKEND}/customerPortal`, { headers: { 'X-PCS-Email': email, 'X-PCS-Token': token } });
            const data = await res.json();
            if (data.url) {
                window.open(data.url);
            } else {
                btn.textContent = 'Error — try again';
                setTimeout(() => { btn.textContent = 'Cancel'; btn.style.pointerEvents = ''; }, 3000);
                return;
            }
        } catch {
            btn.textContent = 'Error — try again';
            setTimeout(() => { btn.textContent = 'Cancel'; btn.style.pointerEvents = ''; }, 3000);
            return;
        }
        btn.textContent      = 'Cancel';
        btn.style.pointerEvents = '';
    });

    // Premium support: a message straight to Discord, with the signed-in email and
    // what the server thinks their premium is. Exists because "I paid but it says
    // no premium" is nearly always a different-email problem, and people who can't
    // tell you that just assume it's broken and refund.
    (function setupSupport() {
        const open = document.getElementById('supportOpenBtn');
        const box  = document.getElementById('supportBox');
        const msg  = document.getElementById('supportMsg');
        const send = document.getElementById('supportSendBtn');
        const st   = document.getElementById('supportStatus');
        if (!open || !box) return;
        const status = (text, kind) => { st.textContent = text; st.className = 'support-status ' + (kind || ''); };
        msg.placeholder = t('supportPlaceholder');
        open.addEventListener('click', (e) => {
            e.preventDefault();
            const show = box.style.display === 'none';
            box.style.display = show ? 'block' : 'none';
            if (show) { status('', ''); setTimeout(() => msg.focus(), 50); }
        });
        send.addEventListener('click', async () => {
            const email = localStorage.getItem('email');
            const token = localStorage.getItem('authToken');
            const text  = (msg.value || '').trim();
            if (!email || !token) { status(t('supportSignIn'), 'bad'); return; }
            if (text.length < 3)  { status(t('supportEmpty'), 'bad'); return; }
            send.disabled = true; status(t('supportSending'), '');
            try {
                const r = await fetch('https://panopto-stripe.harveychandler235.workers.dev/support', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, token, message: text,
                        version: (chrome.runtime.getManifest && chrome.runtime.getManifest().version) || '',
                        host: '', panoptoEmail: await panoptoIdentity() }),
                });
                const d = await r.json().catch(() => ({}));
                if (r.ok && d.ok) { status(t('supportSent').replace('{email}', email), 'ok'); msg.value = ''; }
                else if (d.error === 'rate_limited') status(t('supportRate'), 'bad');
                else if (d.error === 'signin')       status(t('supportSignIn'), 'bad');
                else                                 status(t('supportFail'), 'bad');
            } catch { status(t('supportFail'), 'bad'); }
            finally { send.disabled = false; }
        });
    })();

    document.getElementById('checkPremiumBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('checkPremiumBtn');
        const email = localStorage.getItem('email');
        if (!email) {
            btn.textContent = t('checkSignIn');
            setTimeout(() => { btn.textContent = t('checkPremium'); }, 2500);
            return;
        }
        btn.textContent = t('checking');
        btn.style.pointerEvents = 'none';
        localStorage.removeItem('premiumCache');
        await initPremium();
        btn.style.pointerEvents = '';
        if (_isPremium) { btn.textContent = t('checkPremium'); return; }   // row hides itself
        // Still not premium: say which of the two things happened. The usual real
        // cause is paying with a different email than the one signed in here.
        const reached = !!localStorage.getItem('premiumCache');
        btn.textContent = reached ? `No Premium found for ${email}` : 'Couldn’t reach the server — try again';
        btn.style.color = reached ? '#dc2626' : '#b45309';
        setTimeout(() => { btn.textContent = t('checkPremium'); btn.style.color = ''; }, 5000);
    });

    document.getElementById('autoSkipCheckbox').addEventListener('change', function () {
        const val = this.checked ? 'true' : 'false';
        localStorage.setItem('autoSkipSilence', val);
        sendToTab('autoSkipSilence', val);
        if (this.checked) logPremiumFeature('auto_skip_silence');
    });

    async function fetchNotesQuota(force = false) {
        const email = localStorage.getItem('email');
        const token = localStorage.getItem('authToken');
        if (!email || !token) {
            _notesDailyUsed = 0;
            _notesLifetimeUsed = 0;
            _notesUnlimited = false;
            _aiTier = null;
            _aiBudget = null;   // else a signed-out user keeps the paid budget bar
            return;
        }
        if (!force) {
            const cached = JSON.parse(localStorage.getItem('notesQuotaCache') || 'null');
            if (cached && cached.email === email
                && (Date.now() - (cached.checkedAt || 0)) < NOTES_QUOTA_CACHE_TTL_MS) {
                _notesDailyUsed    = cached.dailyUsed    || 0;
                _notesLifetimeUsed = cached.lifetimeUsed || 0;
                _notesUnlimited    = !!cached.unlimited;
                _trialUsed         = !!cached.trialUsed;
                _aiTier            = cached.tier   || null;
                _aiBudget          = cached.budget || null;
                return;
            }
        }
        try {
            const res  = await fetch(`${BACKEND}/notesQuota`, { headers: { 'X-PCS-Email': email, 'X-PCS-Token': token } });
            if (!res.ok) return;
            const data = await res.json();
            // /notesQuota says whether the account is premium on every call, and it is
            // refetched every minute; checkPremium's answer is cached for an hour. When
            // the two disagree - they just bought premium, or it just expired - trust
            // the fresh one and re-run the premium check now, so the popup does not sit
            // in a half-premium mix (trial budget bar under a free-tier header).
            if (typeof data.premium === 'boolean' && data.premium !== _isPremium) {
                localStorage.removeItem('premiumCache');
                const s = await checkPremium(email);
                _isPremium = s.active; _premiumType = s.type; _premiumPlan = s.plan || null; _premiumExpiry = s.expiry;
            }
            _notesDailyUsed    = data.dailyUsed    || 0;
            _notesLifetimeUsed = data.lifetimeUsed || 0;
            _notesUnlimited    = !!data.unlimited;
            _trialUsed         = !!data.trialUsed;
            _aiTier            = data.tier   || null;
            _aiBudget          = data.budget || null;
            localStorage.setItem('notesQuotaCache', JSON.stringify({
                email, checkedAt: Date.now(),
                dailyUsed:    _notesDailyUsed,
                lifetimeUsed: _notesLifetimeUsed,
                unlimited:    _notesUnlimited,
                trialUsed:    _trialUsed,
                tier:         _aiTier,
                budget:       _aiBudget,
            }));
            // Lock state is only trustworthy now. Re-check whether it is a decent
            // moment to ask for a rating.
            maybeShowRatePrompt();
        } catch {}
    }

    async function checkCouponUsed(email) {
        const cacheRaw = localStorage.getItem('couponCache');
        const cache    = cacheRaw ? JSON.parse(cacheRaw) : null;
        // Cache result per email for 1 hour — flips to "used" permanently once true
        if (cache && cache.email === email && (cache.used || Date.now() - cache.ts < 3_600_000)) {
            return cache.used;
        }
        const token = localStorage.getItem('authToken');
        if (!token || token === 'null') return false;
        try {
            const res = await fetch(
                `${BACKEND}/couponUsed?code=${PROMO_CODE}`,
                { headers: { 'X-PCS-Email': email, 'X-PCS-Token': token } }
            );
            if (!res.ok) return false;
            const data = await res.json();
            localStorage.setItem('couponCache', JSON.stringify({ email, used: data.used, ts: Date.now() }));
            return data.used;
        } catch {
            return false;
        }
    }

    // Plan name for the premium badge. No dates, no countdown - just what they're on.
    function planLabelText() {
        if (_premiumPlan === 'lifetime') return t('planLifetimeLabel');
        if (_premiumPlan === 'trial')    return t('planTrialLabel');
        if (_premiumPlan === 'yearly')   return t('planYearlyPlanLabel');
        if (_premiumPlan === 'monthly')  return t('planMonthlyPlanLabel');
        return _premiumType === 'lifetime' ? t('planLifetimeLabel') : t('planMonthlyPlanLabel');
    }

    // Runs at popup open AND after an in-session sign-in / sign-out. Concurrent calls
    // share one in-flight promise so the two never race or double-fetch.
    let _premiumInFlight = null;
    function initPremium() {
        if (!_premiumInFlight) {
            _premiumInFlight = _initPremiumImpl().finally(() => { _premiumInFlight = null; });
        }
        return _premiumInFlight;
    }
    async function _initPremiumImpl() {
        const email = localStorage.getItem('email');
        if (email) {
            // The banner now advertises the free trial, not the coupon, so it stays up
            // for every non-premium user and the coupon lookup is dead work — dropped,
            // saving a request on every popup open.
            const status = await checkPremium(email);
            _isPremium     = status.active;
            _premiumType   = status.type;
            _premiumPlan   = status.plan || null;
            _premiumExpiry = status.expiry;
        } else {
            _isPremium = false; _premiumType = null; _premiumExpiry = null; _premiumPlan = null;
        }
        await new Promise(resolve => {
            chrome.runtime.sendMessage({ type: "getSilenceSavedTime" }, (r) => {
                if (r?.silenceSavedTime != null) _silenceSecs = r.silenceSavedTime;
                resolve();
            });
        });
        await fetchNotesQuota();
        applyPremiumUI();
        renderStreakChip();   // premium type now known → hide the chip for lifetime users
        writeAiAuth();        // publish auth+premium for the in-page lecture chat
    }
    function checkMilestoneBanner() {
        const savedTime = parseFloat(localStorage.getItem('saved-time') || '0');
        if (savedTime < 7200) return;
        if (_isPremium) return;
        if (localStorage.getItem('milestone2hDismissed')) return;
        const pipCount      = parseInt(localStorage.getItem('pipPressCount') || '0');
        const downloadCount = parseInt(localStorage.getItem('downloadCount') || '0');
        if (pipCount > 0 || downloadCount > 0 || _silenceSecs >= 10 || _notesLifetimeUsed > 0) return;

        const modal = document.getElementById('milestoneModal');
        if (!modal) return;
        modal.classList.add('open');

        function dismissMilestone() {
            localStorage.setItem('milestone2hDismissed', '1');
            modal.classList.remove('open');
        }

        document.getElementById('milestoneModalClose').addEventListener('click', dismissMilestone);
        document.getElementById('milestoneLaterBtn').addEventListener('click', dismissMilestone);
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });

        document.getElementById('milestoneExploreBtn').addEventListener('click', () => {
            dismissMilestone();
            const wrap = document.getElementById('premiumSectionWrap');
            if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
            const rows = document.querySelectorAll('#premiumSectionWrap .prem-row');
            rows.forEach((el, i) => {
                setTimeout(() => {
                    el.classList.remove('feature-glow');
                    void el.offsetWidth;
                    el.classList.add('feature-glow');
                    el.addEventListener('animationend', () => el.classList.remove('feature-glow'), { once: true });
                }, i * 220);
            });
        });
    }

    // ── Referrals ──────────────────────────────────────────────────────────────

    // Referrals are hidden: nobody used the panel, and each referral minted promo
    // premium (5 days a time, uncapped) - the tier with the loosest AI limits.
    // Flip to true to bring it back; the endpoints and all strings are untouched.
    const SHOW_REFERRALS = false;

    async function initReferral() {
        if (!SHOW_REFERRALS) {
            const el = document.getElementById('referralSection');
            if (el) el.style.display = 'none';
            return;
        }
        const section = document.getElementById('referralSection');
        if (!section) return;

        const email = localStorage.getItem('email');
        const token = localStorage.getItem('authToken');
        if (!email || !token || token === 'null') { section.style.display = 'none'; return; }

        let data;
        try {
            const res = await fetch(`${BACKEND}/referral`, { headers: { 'X-PCS-Email': email, 'X-PCS-Token': token } });
            if (!res.ok) { section.style.display = 'none'; return; }
            data = await res.json();
        } catch (e) {
            console.warn('[Referral] could not load referral info:', e);
            section.style.display = 'none';
            return;
        }
        if (!data || !data.code) { section.style.display = 'none'; return; }

        section.style.display = 'block';

        const codeEl = document.getElementById('referralCode');
        if (codeEl) codeEl.textContent = data.code;

        const statEl = document.getElementById('referralStat');
        if (statEl) {
            statEl.textContent = (data.referralCount > 0)
                ? t('referralStat').replace('{count}', data.referralCount).replace('{days}', data.daysEarned)
                : '';
        }

        setupReferralCopy(data.code);
        setupReferralToggle();

        const redeemRow = document.getElementById('redeemRow');
        if (redeemRow) {
            redeemRow.style.display = data.canRedeem ? 'block' : 'none';
            if (data.canRedeem) setupRedeemHandler();
        }
        // Referrer rewards now arrive via the shared reward feed (see initRewards).
    }

    function setupReferralCopy(code) {
        const btn = document.getElementById('copyReferralBtn');
        if (!btn || btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => {
            navigator.clipboard.writeText(code).then(() => {
                btn.dataset.copied = '1';
                btn.textContent = t('referralCopied');
                setTimeout(() => { delete btn.dataset.copied; btn.textContent = t('referralCopyCode'); }, 1600);
            }).catch(() => {});
        });
    }

    // Collapse/expand the referral panel body. Expanded by default; choice persists.
    function setupReferralToggle() {
        const toggle = document.getElementById('referralToggle');
        const body   = document.getElementById('referralBody');
        if (!toggle || !body) return;
        const expanded = localStorage.getItem('referralExpanded') !== 'false'; // default ON
        toggle.checked     = expanded;
        body.style.display = expanded ? 'block' : 'none';
        if (toggle.dataset.bound) return;
        toggle.dataset.bound = '1';
        toggle.addEventListener('change', () => {
            body.style.display = toggle.checked ? 'block' : 'none';
            localStorage.setItem('referralExpanded', toggle.checked ? 'true' : 'false');
        });
    }

    function setupRedeemHandler() {
        const btn   = document.getElementById('redeemBtn');
        const input = document.getElementById('redeemCodeInput');
        const msg   = document.getElementById('redeemMsg');
        if (!btn || !input || btn.dataset.bound) return;
        btn.dataset.bound = '1';

        const showMsg = (text, ok) => {
            if (!msg) return;
            msg.style.display = 'block';
            msg.style.color   = ok ? '#11773D' : '#dc2626';
            msg.textContent   = text;
        };

        const submit = async () => {
            const code = (input.value || '').trim().toUpperCase();
            if (!/^[A-Z0-9]{4,8}$/.test(code)) { showMsg(t('redeemInvalid'), false); return; }
            btn.disabled = true;
            try {
                const res = await fetch(`${BACKEND}/applyReferral`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: localStorage.getItem('authToken'),
                        email: localStorage.getItem('email'),
                        code,
                    }),
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok && data.ok) {
                    showMsg(data.message || t('redeemDone').replace('{days}', data.rewardDays || 5), true);
                    input.value = '';
                    input.disabled = true;
                    btn.style.display = 'none';
                    setTimeout(() => {
                        const rr = document.getElementById('redeemRow');
                        if (rr) rr.style.display = 'none';
                    }, 2600);
                } else {
                    showMsg(data.message || t('redeemFail'), false);
                    btn.disabled = false;
                }
            } catch (e) {
                console.warn('[Referral] apply failed:', e);
                showMsg(t('redeemNetwork'), false);
                btn.disabled = false;
            }
        };

        btn.addEventListener('click', submit);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    }

    // ── Reward feed ─────────────────────────────────────────────────────────────
    // Drains the server's "you earned Premium" feed (trials, streaks, milestones,
    // referrals) and shows one celebration modal, then acknowledges them so they
    // don't repeat. The premium days are already live server-side; this just tells
    // the user about them.
    async function initRewards() {
        const email = localStorage.getItem('email');
        const token = localStorage.getItem('authToken');
        if (!email || !token || token === 'null') return;

        let rewards;
        try {
            const res = await fetch(`${BACKEND}/rewards`, { headers: { 'X-PCS-Email': email, 'X-PCS-Token': token } });
            if (!res.ok) return;
            rewards = (await res.json()).rewards;
        } catch (e) {
            console.warn('[Rewards] could not load reward feed:', e);
            return;
        }
        if (!Array.isArray(rewards) || rewards.length === 0) return;

        const totalDays = rewards.reduce((sum, r) => sum + (r.days || 0), 0);
        showRewardModal(totalDays, rewards);

        // Acknowledge so the modal won't show again next open.
        const ids = rewards.map(r => r.id).filter(Boolean);
        fetch(`${BACKEND}/rewardsAck`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ token, email, ids }),
        }).catch(() => {});
    }

    function rewardReasonText(r) {
        const reason = r.reason || '';
        const d = r.days || 0;
        if (reason === 'referral_referrer') return `a friend used your referral code (+${d}d)`;
        if (reason === 'new_user_trial')    return `your welcome trial (+${d}d)`;
        if (reason === 'winner')            return `winning the weekly leaderboard (+${d}d)`;
        if (reason.startsWith('streak_'))   return `a ${reason.split('_')[1]}-day login streak (+${d}d)`;
        if (reason.startsWith('time_'))     return `saving ${reason.slice(5)} of lectures (+${d}d)`;
        return `+${d} days`;
    }

    function showRewardModal(totalDays, rewards) {
        const modal = document.getElementById('rewardModal');
        if (!modal) return;

        const titleEl = document.getElementById('rewardModalTitle');
        if (titleEl) titleEl.textContent = `🎉 You earned ${totalDays} day${totalDays !== 1 ? 's' : ''} of Premium!`;

        const msgEl = document.getElementById('rewardModalMsg');
        if (msgEl) {
            const items = rewards.map(r => `<li>${rewardReasonText(r)}</li>`).join('');
            msgEl.innerHTML = `It's been added to your account:<ul style="text-align:left; margin:6px 0 0; padding-left:18px;">${items}</ul>`;
        }

        const close = () => modal.classList.remove('open');
        modal.classList.add('open');
        document.getElementById('rewardModalClose').addEventListener('click', close, { once: true });
        document.getElementById('rewardModalBtn').addEventListener('click', close, { once: true });
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    }

    // ── Login streak ────────────────────────────────────────────────────────────
    // Chip lives in the top bar; clicking it explains progress toward the next free
    // day. Hidden for logged-out and lifetime users (they gain nothing from days).
    let _streak = null;

    async function initStreak() {
        const email = localStorage.getItem('email');
        const token = localStorage.getItem('authToken');
        if (!email || !token || token === 'null') return;
        try {
            const res = await fetch(`${BACKEND}/streak`, { headers: { 'X-PCS-Email': email, 'X-PCS-Token': token } });
            if (!res.ok) return;
            _streak = await res.json();
        } catch (e) {
            console.warn('[Streak] could not load streak:', e);
            return;
        }
        const chip = document.getElementById('streakChip');
        if (chip && !chip.dataset.bound) {
            chip.dataset.bound = '1';
            chip.addEventListener('click', openStreakModal);
        }
        renderStreakChip();
    }

    function renderStreakChip() {
        const chip = document.getElementById('streakChip');
        if (!chip) return;
        const token    = localStorage.getItem('authToken');
        const loggedIn = !!localStorage.getItem('email') && token && token !== 'null';
        if (!loggedIn || !_streak || _premiumType === 'lifetime') {
            chip.style.display = 'none';
            return;
        }
        const countEl = document.getElementById('streakChipCount');
        if (countEl) countEl.textContent = _streak.count;
        chip.style.display = 'inline-flex';
    }

    function openStreakModal() {
        if (!_streak) return;
        const modal = document.getElementById('streakModal');
        if (!modal) return;
        const { count, period, reward, done, daysUntilReward, justEarned } = _streak;

        const titleEl = document.getElementById('streakModalTitle');
        if (titleEl) titleEl.textContent = `${count} day streak`;

        const dotsEl = document.getElementById('streakDots');
        if (dotsEl) {
            dotsEl.innerHTML = '';
            for (let i = 0; i < period; i++) {
                const dot = document.createElement('span');
                dot.className = 'streak-dot' + (i < done ? ' on' : '');
                dotsEl.appendChild(dot);
            }
        }

        const msgEl = document.getElementById('streakModalMsg');
        if (msgEl) {
            if (justEarned) {
                msgEl.innerHTML = `🎉 You just earned <strong>${reward} day of Premium</strong>! Keep logging in daily — ${period} days to the next one.`;
            } else {
                msgEl.innerHTML = `Open Panopto Speed once a day. Reach a <strong>${period}-day streak</strong> to earn <strong>${reward} day of Premium</strong> — <strong>${daysUntilReward} more day${daysUntilReward !== 1 ? 's' : ''}</strong> to go.`;
            }
        }

        const close = () => modal.classList.remove('open');
        modal.classList.add('open');
        document.getElementById('streakModalClose').addEventListener('click', close, { once: true });
        document.getElementById('streakModalBtn').addEventListener('click', close, { once: true });
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    }

    // In-page AI chat toggle → persists to chrome.storage so content.js can read it.
    function setupInPageChatToggle() {
        const toggle = document.getElementById('inPageChatToggle');
        const lock   = document.getElementById('inPageChatLock');
        if (toggle) {
            chrome.storage.local.get('pcsInPageChat', (r) => { toggle.checked = !!(r && r.pcsInPageChat); });
            toggle.addEventListener('change', () => {
                chrome.storage.local.set({ pcsInPageChat: toggle.checked });
            });
        }
        if (lock) lock.addEventListener('click', (e) => { e.preventDefault(); openPremiumModal(); });
    }
    setupInPageChatToggle();

    // Dub Lecture (ALPHA) → message the content script to open the in-page language
    // picker on the Panopto lecture page. The modal + server enforce premium/limits,
    // so non-premium users still get their one free trial here (like AI Notes).
    function setupDubButton() {
        const btn  = document.getElementById('dubLectureBtn');
        const hint = document.getElementById('dubHint');
        if (!btn) return;
        btn.addEventListener('click', () => {
            if (hint) hint.style.display = 'none';
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs && tabs[0];
                if (!tab) return;
                chrome.tabs.sendMessage(tab.id, { action: 'openDubModal' }, (resp) => {
                    if (chrome.runtime.lastError || !resp || !resp.ok) {
                        if (hint) {
                            hint.style.display = 'block';
                            hint.style.color   = '#dc2626';
                            hint.textContent   = t('dubHint');
                        }
                        return;
                    }
                    window.close();   // let the user see the in-page modal
                });
            });
        });
    }
    setupDubButton();

    // Lecture chapters on/off (default ON) → persisted to chrome.storage for content.js.
    function setupChaptersToggle() {
        const cb = document.getElementById('chaptersToggle');
        if (!cb) return;
        chrome.storage.local.get('pcsChaptersEnabled', (r) => { cb.checked = !(r && r.pcsChaptersEnabled === false); });
        cb.addEventListener('change', () => { chrome.storage.local.set({ pcsChaptersEnabled: cb.checked }); });
    }
    setupChaptersToggle();

    // Dark theme — applies to the Panopto page only (via content.js). The popup
    // itself is intentionally left unaffected. chrome.storage is the source of truth.
    function setupDarkThemeToggle() {
        const cb = document.getElementById('darkThemeToggle');
        if (!cb) return;
        chrome.storage.local.get('pcsDarkTheme', (r) => { cb.checked = !!(r && r.pcsDarkTheme); });
        cb.addEventListener('change', () => { chrome.storage.local.set({ pcsDarkTheme: cb.checked }); });
    }
    setupDarkThemeToggle();

    initPremium().then(() => checkMilestoneBanner());

    // ── Picture in Picture ────────────────────────────────────────────────────

    function renderPiPButtons(videos) {
        const container   = document.getElementById('pipButtons');
        const placeholder = document.getElementById('pipPlaceholder');

        if (!videos || videos.length === 0) {
            placeholder.style.display = 'inline';
            return;
        }

        placeholder.style.display = 'none';
        container.innerHTML = '';

        videos.forEach((v, i) => {
            const btn = document.createElement('button');
            btn.className   = 'pip-btn';
            btn.textContent = `${t('pipSource')} ${v.label}`;
            btn.title       = t('pipOpenTitle');
            btn.addEventListener('click', () => {
                const pipCount = parseInt(localStorage.getItem('pipPressCount') || '0');
                if (!_isPremium && pipCount >= FREE_PIP_LIMIT) return;

                localStorage.setItem('pipPressCount', (pipCount + 1).toString());
                container.querySelectorAll('.pip-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                sendToTab('enterPiP', i);
                logPremiumFeature('picture_in_picture');
                applyPremiumUI(); // update counter / lock if just hit limit
                syncFreeUsage();
            });
            container.appendChild(btn);
        });

        applyPremiumUI(); // apply current lock state to freshly rendered buttons
    }

    // Query the active tab for videos — only works on Panopto pages
    function queryPiPVideos() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) return;
            chrome.tabs.sendMessage(tabs[0].id, { action: 'getVideos' }, (response) => {
                if (chrome.runtime.lastError) { showOpenLectureBanner(); return; } // not on a Panopto page
                if (response?.videos) renderPiPButtons(response.videos);
            });
        });
    }
    // Off Panopto the popup used to show a full panel of controls that do nothing.
    // Now the first thing it says is where to go, with their last Panopto host as
    // the link when we know it.
    function showOpenLectureBanner() {
        const banner = document.getElementById('openLectureBanner');
        if (!banner) return;
        banner.style.display = 'flex';
        chrome.storage.local.get(['lastHost'], (r) => {
            const link = document.getElementById('openLectureLink');
            if (r && r.lastHost && link) { link.href = 'https://' + r.lastHost + '/'; link.style.display = 'inline-block'; }
        });
    }
    // First session ever: hide padlocks and the trial pitch (CSS on body.first-session).
    chrome.storage.local.get(['sessionCount'], (r) => {
        if ((parseInt(r && r.sessionCount, 10) || 0) < 2 && !_isPremium) document.body.classList.add('first-session');
    });
    queryPiPVideos();

    // ── Download Lecture ──────────────────────────────────────────────────────

    function sanitizeFilename(name) {
        return (name || 'lecture').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').substring(0, 100);
    }

    document.getElementById('downloadVideoBtn').addEventListener('click', () => {
        const downloadCount = parseInt(localStorage.getItem('downloadCount') || '0');
        if (!_isPremium && downloadCount >= FREE_DOWNLOAD_LIMIT) return;

        const btn = document.getElementById('downloadVideoBtn');
        btn.disabled    = true;
        btn.textContent = '⏳ Fetching…';

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) { btn.textContent = t('downloadVideoBtn'); btn.disabled = false; return; }
            chrome.tabs.sendMessage(tabs[0].id, { action: 'getDownloadInfo' }, (response) => {
                btn.textContent = t('downloadVideoBtn');
                if (chrome.runtime.lastError || !response || response.error || !response.videoUrl) {
                    btn.disabled = false;
                    const msg = response?.error || 'Could not get download link. Make sure you are on a Panopto lecture page.';
                    btn.textContent = '✗ Error';
                    btn.title = msg;
                    setTimeout(() => { btn.textContent = t('downloadVideoBtn'); btn.title = ''; }, 4000);
                    return;
                }
                const newCount = downloadCount + 1;
                localStorage.setItem('downloadCount', newCount.toString());
                chrome.downloads.download({
                    url:      response.videoUrl,
                    filename: sanitizeFilename(response.title) + '.mp4',
                    saveAs:   false
                });
                if (response.captionUrls && response.captionUrls.length > 0) {
                    _lastCaptionData = response;
                    const captBtn = document.getElementById('downloadCaptionsBtn');
                    if (captBtn) captBtn.style.display = 'inline-block';
                }
                logPremiumFeature('download_lecture');
                applyPremiumUI();
                syncFreeUsage();
                if (newCount < FREE_DOWNLOAD_LIMIT || _isPremium) btn.disabled = false;
            });
        });
    });

    document.getElementById('downloadCaptionsBtn').addEventListener('click', () => {
        if (!_lastCaptionData) return;
        const { captionUrls, title } = _lastCaptionData;
        captionUrls.forEach((cap, i) => {
            const ext = (cap.url || '').includes('.vtt') ? 'vtt' : 'srt';
            chrome.downloads.download({
                url:      cap.url,
                filename: sanitizeFilename(title) + '_captions' + (captionUrls.length > 1 ? `_${i + 1}` : '') + '.' + ext,
                saveAs:   false
            });
        });
        logPremiumFeature('download_captions');
    });

    // ── AI Lecture Notes ───────────────────────────────────────────────────────

    // Notes / Chat / Flashcards all share one flow: fetch the lecture captions, then
    // open the AI Notes window to the requested view (?tab=notes|chat|cards).
    function launchAiNotes(btn, targetTab) {
        if (!btn) return;
        // Quota gates (server enforces these too — this is just for UX)
        if (_notesUnlimited) {
            // unlimited — never blocked
        } else if (_aiBudget) {
            // Budget tier: no daily cap, just the monthly allowance.
            if (_aiBudget.exhausted) {
                btn.title = 'Monthly AI allowance used — resets on the 1st';
                return;
            }
        } else if (_isPremium) {
            if (_notesDailyUsed >= NOTES_DAILY_LIMIT_PREMIUM) {
                btn.title = `Daily limit reached (${_notesDailyUsed}/${NOTES_DAILY_LIMIT_PREMIUM}) — resets at midnight UTC`;
                return;
            }
        } else {
            if (_notesLifetimeUsed >= NOTES_FREE_DAILY_LIMIT) {
                openPremiumModal();
                return;
            }
            // free trial available — let them through
        }

        const btnLabel = btn.innerHTML;
        const restore  = () => { btn.disabled = false; btn.innerHTML = btnLabel; };

        const email = localStorage.getItem('email');
        const token = localStorage.getItem('authToken');
        if (!email || !token) {
            // This used to flash "⚠ Sign in" for 2.5s and give up — while the label
            // underneath said "1 free trial available — try it now". The popup invited
            // the click and then refused it. Start the sign-in instead; on success the
            // user clicks the same button again with the session in place.
            btn.disabled    = true;
            btn.textContent = 'Signing in…';
            loginWithChromeIdentity(true).then((ok) => {
                restore();
                if (ok) { btn.title = ''; launchAiNotes(btn, targetTab); }
                else    { btn.title = 'Sign-in was cancelled'; setTimeout(() => { btn.title = ''; }, 2500); }
            });
            return;
        }

        btn.disabled    = true;
        btn.textContent = '⏳ Fetching captions…';

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) { restore(); return; }
            chrome.tabs.sendMessage(tabs[0].id, { action: 'getLectureInfo' }, (response) => {
                restore();

                if (chrome.runtime.lastError || !response || response.error) {
                    const msg = response?.error || 'Open a Panopto lecture page first.';
                    btn.title = msg;
                    btn.textContent = '✗ Error';
                    setTimeout(() => { restore(); btn.title = ''; }, 4000);
                    return;
                }

                if (!response.hasCaptions || !response.captionsCleaned) {
                    // Keep the probe details in the console for debugging, but never
                    // surface raw fetch/parse errors to the user via the tooltip.
                    console.warn('[AI Notes] captions probe:', response.debug || '(no debug info)');
                    btn.title = 'No captions could be loaded for this lecture. If it does have captions, refresh the Panopto page and try again.';
                    btn.textContent = '✗ No captions';
                    setTimeout(() => { restore(); btn.title = ''; }, 6000);
                    return;
                }

                const ctxKey = 'notesContext_' + response.deliveryId;
                const context = {
                    deliveryId:      response.deliveryId,
                    title:           response.title,
                    viewerUrl:       response.viewerUrl,
                    captionsCleaned: response.captionsCleaned,
                    lang:            response.lang || 'en',
                    email,
                    authToken:       token,
                    panoptoTabId:    tabs[0].id,
                    createdAt:       Date.now(),
                };
                chrome.storage.local.set({ [ctxKey]: context }, () => {
                    // Open the notes as a separate popup window (no tab strip, no url
                    // bar). The original Panopto tab stays the *active* tab in its own
                    // window, so its document.visibilityState stays 'visible' and the
                    // video keeps decoding — no background-tab capture issues.
                    const tabParam = targetTab ? '&tab=' + targetTab : '';
                    chrome.windows.create({
                        url:    chrome.runtime.getURL('notes.html?id=' + encodeURIComponent(response.deliveryId) + tabParam),
                        type:   'popup',
                        width:  1280,
                        height: 900,
                    });
                    // One event per tool, not three tools under 'ai_notes' — otherwise
                    // the dashboard cannot say whether people want notes, chat or decks.
                    logPremiumFeature(targetTab === 'cards' ? 'ai_flashcards'
                                    : targetTab === 'chat'  ? 'ai_chat'
                                    :                          'ai_notes');
                    // Invalidate the cached quota — next popup open will refetch and
                    // reflect the increment.
                    localStorage.removeItem('notesQuotaCache');
                });
            });
        });
    }

    document.getElementById('generateNotesBtn')?.addEventListener('click', function () { launchAiNotes(this, 'notes'); });
    document.getElementById('aiChatBtn')?.addEventListener('click', function () { launchAiNotes(this, 'chat'); });
    document.getElementById('generateFlashcardsBtn')?.addEventListener('click', function () { launchAiNotes(this, 'cards'); });

    document.getElementById('leaderboard-popup').addEventListener('click', (e) => {
        e.preventDefault();
        window.open(chrome.runtime.getURL('leaderboard.html'), 'leaderboard', 'width=480,height=620');
    });

    const STORE_REVIEWS_URL =
        "https://chromewebstore.google.com/detail/panopto-custom-speed/fnoppdfnaklabgfllejlefomclegmnam/reviews";

    document.getElementById('rate-button').addEventListener('click', () => {
        window.open(STORE_REVIEWS_URL);
    });

    // ── Review prompt ─────────────────────────────────────────────────────────
    // Ratings are one of the two Chrome Web Store ranking inputs, and this has never
    // asked for one — 21 ratings across ~3,000 users. Asking at the right moment is
    // the whole trick: after the extension has demonstrably done something for them,
    // never while something is broken.
    const RATE_MIN_SECONDS  = 3600;   // an hour genuinely banked
    const RATE_MIN_SESSIONS = 3;      // across more than one sitting
    const RATE_SNOOZE_MS    = 60 * 24 * 60 * 60 * 1000;   // "not now" means 60 days

    // True when a free user is currently looking at a locked feature. The popup's
    // premium prompts are all lock-driven — silence at 3 min, PiP at 10 presses,
    // notes at 1 generation — so a free user can easily have one on screen. Asking
    // for five stars on the same screen that just took a feature away reads as a
    // shakedown and is how you get a two-star review instead of a five.
    function anyFreeLimitHit() {
        if (_isPremium) return false;
        const pipCount = parseInt(localStorage.getItem('pipPressCount') || '0', 10);
        return _silenceSecs       >= FREE_SILENCE_LIMIT_SECS
            || pipCount           >= FREE_PIP_LIMIT
            || _notesLifetimeUsed >= NOTES_FREE_DAILY_LIMIT;
    }

    function maybeShowRatePrompt() {
        const el = document.getElementById('ratePrompt');
        if (!el || el.style.display === 'block') return;

        // Asked and answered: never ask this person again.
        if (localStorage.getItem('ratePromptDone') === 'true') return;
        const snoozedAt = parseInt(localStorage.getItem('ratePromptSnoozedAt') || '0', 10);
        if (snoozedAt && Date.now() - snoozedAt < RATE_SNOOZE_MS) return;
        if (anyFreeLimitHit()) return;

        chrome.storage.local.get(['sessionCount', 'everAttached'], (state) => {
            // Never solicit a review from someone the extension has not worked for.
            // They are exactly the people whose one-star reviews already say
            // "doesn't work on my university's Panopto".
            if (!state || !state.everAttached) return;
            if ((parseInt(state.sessionCount, 10) || 0) < RATE_MIN_SESSIONS) return;

            chrome.runtime.sendMessage({ type: "getSavedTime" }, (response) => {
                const secs = response && response.savedTime;
                if (secs == null || secs < RATE_MIN_SECONDS) return;

                const hours = Math.floor(secs / 3600);
                const label = hours >= 1
                    ? (hours === 1 ? 'an hour' : `${hours} hours`)
                    : 'an hour';
                const hoursEl = document.getElementById('ratePromptHours');
                if (hoursEl) hoursEl.textContent = label;
                el.style.display = 'block';
            });
        });
    }

    document.getElementById('ratePromptYes')?.addEventListener('click', () => {
        localStorage.setItem('ratePromptDone', 'true');
        document.getElementById('ratePrompt').style.display = 'none';
        window.open(STORE_REVIEWS_URL);
    });

    document.getElementById('ratePromptNo')?.addEventListener('click', () => {
        localStorage.setItem('ratePromptSnoozedAt', String(Date.now()));
        document.getElementById('ratePrompt').style.display = 'none';
    });

    // Deferred on purpose. _silenceSecs, _notesLifetimeUsed and _isPremium all land
    // asynchronously, and anyFreeLimitHit() reading them at zero would show the
    // prompt to exactly the locked-out user it is meant to skip. Running late also
    // keeps it out of the popup's first paint. refreshNotesQuota() calls this again
    // once the server quota resolves, and the display:block check makes that a no-op
    // if it is already up.
    setTimeout(maybeShowRatePrompt, 1500);

    document.getElementById('coffee-button').addEventListener('click', () => {
        if (_isPremium && _premiumType === 'lifetime') openLifetimePopup();
        else openPremiumModal();
    });

    // ── Total time saved (all users) ──────────────────────────────────────────

    const timingDiv        = document.getElementById('timingDiv');
    const timingSpan       = document.getElementById('timingSpan');
    const timingToggleHint = document.getElementById('timingToggleHint');
    let   timingExpanded   = false;

    function setTimingDisplay(raw) {
        if (!raw) return;
        timingSpan.textContent = timingExpanded ? formatTimeFull(raw) : formatHours(raw);
        timingToggleHint.textContent = timingExpanded ? '(click to collapse)' : '(click to expand)';
    }

    timingDiv.addEventListener('click', () => {
        timingExpanded = !timingExpanded;
        setTimingDisplay(localStorage.getItem('fullTime'));
    });

    if (!localStorage.getItem('aID')) {
        localStorage.setItem('aID', generateUniqueId());
    }
    // aID is the extension's long-standing anonymous install id, but it lives in the
    // popup's localStorage where the service worker cannot reach it. Mirror it into
    // chrome.storage so churn rows join up with the anon_times this device already
    // reports. Never overwritten — whichever context wrote userId first wins.
    chrome.storage.local.get('userId', (r) => {
        if (!r || !r.userId) chrome.storage.local.set({ userId: localStorage.getItem('aID') });
    });
    if (localStorage.getItem('fullTime')) {
        timingDiv.style.display = 'block';
        setTimingDisplay(localStorage.getItem('fullTime'));
    }

    function fetchTotalTime() {
        fetch(`${BACKEND}/fulltime?aID=${encodeURIComponent(localStorage.getItem('aID'))}&myTime=${encodeURIComponent(localStorage.getItem('saved-time'))}`)
            .then(r => r.text())
            .then(text => {
                if (text) {
                    localStorage.setItem('fullTime', text);
                    timingDiv.style.display = 'block';
                    setTimingDisplay(text);
                }
            })
            .catch(() => {});
    }
    fetchTotalTime();
    setInterval(fetchTotalTime, 15000);

    // ── Init auth state ───────────────────────────────────────────────────────

    async function silentRefresh() {
        const refreshed = await loginWithChromeIdentity(false);
        if (!refreshed) clientLogout();
    }

    // A Google ACCESS token lasts about an hour and nothing here ever refreshes it,
    // so isTokenExpired() is true on essentially every popup open after the first.
    // This used to click #logout FIRST and only then try a silent re-login — and on
    // Brave/Edge/Opera, or offline, that silent attempt cannot succeed, so people
    // were dumped to the anonymous view every hour with no explanation. Verify
    // before destroying: try to get a replacement token with the session untouched,
    // and only if that fails show the sign-in view — keeping the stored identity so
    // a single click on Sign in restores everything.
    async function refreshExpiredSession() {
        const refreshed = await loginWithChromeIdentity(false);
        if (!refreshed) {
            showLoggedOut();
            // The identity is kept, so this is not a stranger: say what actually
            // happened rather than pitching the free tier at someone who may be paying.
            const sp = document.getElementById('lbl-signin-prompt');
            if (sp) sp.textContent = 'Your Google sign-in expired — sign in again to keep using the AI tools.';
        }
    }

    let savedEmail = localStorage.getItem('email');

    // background.js refreshes the token on a 45-minute alarm and parks it in
    // chrome.storage.local.pcsAuth. If that copy is for the same account and
    // fresher than ours, take it — then the expiry branch below is rarely hit.
    async function adoptBackgroundToken() {
        try {
            const { pcsAuth } = await chrome.storage.local.get('pcsAuth');
            if (!pcsAuth || !pcsAuth.token || !pcsAuth.tokenExpiry || !pcsAuth.email) return;
            if (!savedEmail) {
                // Signed in from a nudge card on the page (background.js ran the Google
                // flow). Adopt the identity so this popup opens signed in.
                if (pcsAuth.tokenExpiry <= Date.now()) return;
                localStorage.setItem('email',       pcsAuth.email);
                localStorage.setItem('authToken',   pcsAuth.token);
                localStorage.setItem('oauthToken',  pcsAuth.token);
                localStorage.setItem('tokenExpiry', String(pcsAuth.tokenExpiry));
                savedEmail = pcsAuth.email;
                return;
            }
            if (String(pcsAuth.email || '').toLowerCase() !== savedEmail.toLowerCase()) return;
            const ours = parseInt(localStorage.getItem('tokenExpiry') || '0', 10) || 0;
            if (pcsAuth.tokenExpiry <= Date.now() || pcsAuth.tokenExpiry <= ours) return;
            localStorage.setItem('authToken',   pcsAuth.token);
            localStorage.setItem('oauthToken',  pcsAuth.token);
            localStorage.setItem('tokenExpiry', String(pcsAuth.tokenExpiry));
        } catch {}
    }

    (async () => {
        await adoptBackgroundToken();
        if (!savedEmail) {
            // Never logged in — show sign-in button
            showLoggedOut();
        } else if (isTokenExpired()) {
            // Silent refresh is harmless on every browser, so try it regardless of the
            // Auto-login preference; that switch only ever gated a destructive path.
            refreshExpiredSession();
        } else {
            // Valid session
            clientLogin();
        }
    })();

    // Show rank immediately from cache if we know who the user is
    if (savedEmail && !isTokenExpired()) {
        const cachedRank = localStorage.getItem('user-rank');
        if (cachedRank) {
            document.getElementById('user-rank').textContent =
                cachedRank == -1 ? t('rankGt20') : `#${cachedRank}`;
        }
    }

});
