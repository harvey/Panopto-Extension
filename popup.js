function sendToTab(action, value) {
    try {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: action, value: value });
        });
    } catch {
        console.log("Not connected to tab.");
    }
}

function generateUniqueId() {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

// ─── Translations ─────────────────────────────────────────────────────────────

const TRANSLATIONS = {
    en: {
        speedSection: "Playback Speed",
        editHint: "✏️ Click the speed above to type any custom value",
        startup: "Apply speed on startup",
        timeSavedLabel: "Time saved:",
        warning: "Changes only apply on Panopto pages.",
        leaderboardSection: "Leaderboard",
        signinPrompt: "Sign in to see your leaderboard position",
        signinBtn: "Sign in with Google",
        loggedInAs: "Logged in as",
        logout: "Log out",
        youAreRank: "You are rank",
        rankGt20: ">20",
        optIn: "Opt into leaderboard logging",
        viewLeaderboard: "View Leaderboard",
        coffee: "Buy me a coffee",
        rate: "Rate this extension",
        totalTime: "Time saved by all users:",
        migratingTitle: "Usernames are migrating!",
        oldUsername: "Your old username",
        confirmBtn: "Confirm",
        pleaseWait: "Please wait...",
    },
    ko: {
        speedSection: "재생 속도",
        editHint: "✏️ 속도를 클릭하면 직접 입력할 수 있어요",
        startup: "시작 시 속도 적용",
        timeSavedLabel: "절약된 시간:",
        warning: "파노프토 페이지에서만 적용됩니다.",
        leaderboardSection: "리더보드",
        signinPrompt: "로그인하면 리더보드 순위를 확인할 수 있어요",
        signinBtn: "Google로 로그인",
        loggedInAs: "로그인됨:",
        logout: "로그아웃",
        youAreRank: "내 순위:",
        rankGt20: ">20위",
        optIn: "리더보드 데이터 수집 동의",
        viewLeaderboard: "리더보드 보기",
        coffee: "커피 사주기",
        rate: "확장 프로그램 평가",
        totalTime: "전체 사용자 절약 시간:",
        migratingTitle: "사용자명 이전 중!",
        oldUsername: "이전 사용자명",
        confirmBtn: "확인",
        pleaseWait: "잠시 기다려 주세요...",
    },
    zh: {
        speedSection: "播放速度",
        editHint: "✏️ 点击速度数字可输入任意值",
        startup: "启动时应用速度",
        timeSavedLabel: "节省的时间：",
        warning: "仅在 Panopto 页面上生效。",
        leaderboardSection: "排行榜",
        signinPrompt: "登录以查看您的排行榜位置",
        signinBtn: "使用 Google 登录",
        loggedInAs: "已登录为",
        logout: "退出登录",
        youAreRank: "您的排名：",
        rankGt20: ">20",
        optIn: "加入排行榜数据收集",
        viewLeaderboard: "查看排行榜",
        coffee: "请我喝咖啡",
        rate: "评价此扩展",
        totalTime: "所有用户节省的时间：",
        migratingTitle: "用户名正在迁移！",
        oldUsername: "旧用户名",
        confirmBtn: "确认",
        pleaseWait: "请稍候...",
    },
    he: {
        speedSection: "מהירות הפעלה",
        editHint: "✏️ לחצ/י על המספר כדי להקליד ערך מותאם",
        startup: "החל מהירות בהפעלה",
        timeSavedLabel: ":זמן שנחסך",
        warning: ".השינויים חלים רק בדפי Panopto",
        leaderboardSection: "לוח תוצאות",
        signinPrompt: "התחבר/י כדי לראות את הדירוג שלך",
        signinBtn: "התחבר עם Google",
        loggedInAs: ":מחובר/ת כ",
        logout: "התנתק/י",
        youAreRank: "הדירוג שלך:",
        rankGt20: "(>20)",
        optIn: "הסכמה לאיסוף נתוני לוח התוצאות",
        viewLeaderboard: "הצג לוח תוצאות",
        coffee: "קנה לי קפה",
        rate: "דרג/י את ההרחבה",
        totalTime: ":זמן שנחסך על ידי כל המשתמשים",
        migratingTitle: "!שמות המשתמשים עוברים העברה",
        oldUsername: "שם המשתמש הישן שלך",
        confirmBtn: "אישור",
        pleaseWait: "...אנא המתן",
    },
    uk: {
        speedSection: "Швидкість відтворення",
        editHint: "✏️ Натисніть на число, щоб ввести будь-яке значення",
        startup: "Застосовувати швидкість при запуску",
        timeSavedLabel: "Заощаджений час:",
        warning: "Зміни діють лише на сторінках Panopto.",
        leaderboardSection: "Таблиця лідерів",
        signinPrompt: "Увійдіть, щоб побачити свою позицію",
        signinBtn: "Увійти через Google",
        loggedInAs: "Увійшли як",
        logout: "Вийти",
        youAreRank: "Ваш ранг:",
        rankGt20: "(>20)",
        optIn: "Долучитись до збору даних",
        viewLeaderboard: "Переглянути таблицю лідерів",
        coffee: "Купити мені каву",
        rate: "Оцінити розширення",
        totalTime: "Час, заощаджений усіма:",
        migratingTitle: "Імена користувачів мігрують!",
        oldUsername: "Старе ім'я користувача",
        confirmBtn: "Підтвердити",
        pleaseWait: "Будь ласка, зачекайте...",
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
    document.body.dir = (lang === 'he') ? 'rtl' : 'ltr';

    document.getElementById('lbl-speed-section').textContent    = t('speedSection');
    document.getElementById('lbl-edit-hint').textContent        = t('editHint');
    document.getElementById('lbl-startup').textContent          = t('startup');
    document.getElementById('lbl-time-saved-label').textContent = t('timeSavedLabel');
    document.getElementById('lbl-warning').textContent          = t('warning');
    document.getElementById('lbl-leaderboard-section').textContent = t('leaderboardSection');
    document.getElementById('lbl-signin-prompt').textContent    = t('signinPrompt');
    document.getElementById('lbl-signin-btn').textContent       = t('signinBtn');
    document.getElementById('lbl-logged-in-as').textContent     = t('loggedInAs');
    document.getElementById('logout').textContent               = t('logout');
    document.getElementById('lbl-you-are-rank').textContent     = t('youAreRank');
    document.getElementById('lbl-opt-in').textContent           = t('optIn');
    document.getElementById('lbl-lb-popup').textContent         = t('viewLeaderboard');
    document.getElementById('lbl-coffee').textContent           = t('coffee');
    document.getElementById('lbl-rate').textContent             = t('rate');
    document.getElementById('lbl-total-time').textContent       = t('totalTime');
    document.getElementById('lbl-migrating-title').textContent  = t('migratingTitle');
    document.getElementById('lbl-old-username').textContent     = t('oldUsername');

    const confirmBtn = document.getElementById('newUsernameButton');
    if (confirmBtn.textContent !== t('pleaseWait')) {
        confirmBtn.textContent = t('confirmBtn');
    }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", function () {

    // Language setup
    applyLanguage();
    document.getElementById('languageSelect').addEventListener('change', function () {
        localStorage.setItem('ext-lang', this.value);
        applyLanguage();
    });

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

    document.getElementById('userDataOptIn').addEventListener('click', () => {
        const val = document.getElementById('userDataOptIn').checked ? 'true' : 'false';
        localStorage.setItem('userDataOptIn', val);
        optInFunc();
    });

    const speedWarning = document.getElementById('speedWarning');
    function updateSpeedWarning(speed) {
        speedWarning.style.display = speed > 3 ? 'block' : 'none';
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

    const updateSavedTime = () => {
        chrome.runtime.sendMessage({ type: "getSavedTime" }, (response) => {
            if (response?.savedTime != null) {
                localStorage.setItem('saved-time', response.savedTime);
                timeSavedEl.textContent = formatTime(response.savedTime);
            }
        });
    };
    setInterval(updateSavedTime, 1000);
    updateSavedTime();

    // ── Auth helpers ──────────────────────────────────────────────────────────

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    function removeCachedToken(token) {
        return new Promise(resolve => chrome.identity.removeCachedAuthToken({ token }, resolve));
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
        document.getElementById('migrationContainer').style.display = 'none';
    }

    function showLoggedIn() {
        document.getElementById('loggedOutView').style.display  = 'none';
        document.getElementById('loggedInView').style.display   = 'block';
    }

    // ── Auth functions ────────────────────────────────────────────────────────

    function clientLogout() {
        try {
            const tok = localStorage.getItem('authToken');
            if (tok && tok !== 'null') {
                chrome.identity.removeCachedAuthToken({ token: tok }, () => {});
            }
        } catch {}
        localStorage.setItem('authToken', 'null');
        localStorage.removeItem('username');
        localStorage.removeItem('email');
        showLoggedOut();
    }

    function clientLogin() {
        showLoggedIn();

        const oldUSR = localStorage.getItem('uniqueID');

        if (oldUSR) {
            // Legacy migration path
            document.getElementById('migrationContainer').style.display = 'block';
            document.getElementById('oldUsernameTextbox').value = oldUSR;
            attachMigrationListener();
        } else {
            // Fetch username from server
            sleep(1).then(() => {
                fetch(BACKEND
                    + `?getUsername={"token":"${localStorage.getItem('authToken')}", "email":"${localStorage.getItem('email')}"}`)
                    .then(r => r.text())
                    .then(text => {
                        if (text === '{username not found}') {
                            document.getElementById('migrationContainer').style.display = 'block';
                            document.getElementById('oldUsernameTextbox').value = '(unknown)';
                            attachMigrationListener();
                        } else if (text.length <= 16) {
                            localStorage.setItem('username', text);
                            document.getElementById('email').textContent = text;
                            document.getElementById('migrationContainer').style.display = 'none';
                            getRank();
                        }
                    })
                    .catch(e => console.log(e));
            });

            document.getElementById('email').textContent =
                localStorage.getItem('username') || localStorage.getItem('email') || '';
        }
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

    function signIn() {
        chrome.identity.getAuthToken({ interactive: true }, async function (token) {
            if (chrome.runtime.lastError || !token) {
                console.log("Sign-in cancelled or failed.");
                return;
            }
            localStorage.setItem('authToken', token);
            const tokenInfoUrl = `https://oauth2.googleapis.com/tokeninfo?access_token=${token}`;
            try {
                const resp = await fetch(tokenInfoUrl);
                if (resp.status === 400) {
                    chrome.identity.removeCachedAuthToken({ token }, () => signIn());
                    return;
                }
                const info = await resp.json();
                if (info.error_description) return;
                localStorage.setItem('email', info.email);
                document.getElementById('email').textContent = info.email;
                storeToken(token, info.expires_in);
                logLogin();
                clientLogin();
            } catch (e) {
                console.log(e);
            }
        });
    }

    document.getElementById('signInWithGoogle').addEventListener('click', signIn);

    document.getElementById('logout').addEventListener('click', clientLogout);

    // ── Backend calls ─────────────────────────────────────────────────────────

    const BACKEND = 'https://script.google.com/macros/s/AKfycbxr5AZzyaYAFm8NyhpWj7oSOb3Tc1NhYcTiHlo5OekghLYFiNsmY_Lfp1dWec_UDxUk/exec';

    function logLogin() {
        try {
            fetch(BACKEND, {
                method: 'POST', mode: 'no-cors',
                body: JSON.stringify({
                    option: 'logLogin',
                    token: localStorage.getItem('authToken'),
                    email: localStorage.getItem('email'),
                })
            });
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

        fetch(BACKEND + `?input=${localStorage.getItem('username')}`)
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
                console.log('getRank error:', e);
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
            fetch(BACKEND + `?user={"username":"${username}", "token":"${localStorage.getItem('authToken')}", "email":"${localStorage.getItem('email')}"}`)
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
            option: 'updateUser',
            token: localStorage.getItem('authToken'),
            email: localStorage.getItem('email'),
            newUsername: newName
        };
        await fetch(BACKEND, {
            method: 'POST', mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        localStorage.removeItem('uniqueID');
        btn.textContent = t('confirmBtn');
        clientLogin();
    }

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
                fetch(BACKEND, {
                    method: 'POST', mode: 'no-cors',
                    body: JSON.stringify({
                        option: 'logTime',
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

    optInFunc();

    // Log time on startup if opted in
    if (localStorage.getItem('userDataOptIn') === 'true' && localStorage.getItem('email')) {
        fetch(BACKEND, {
            method: 'POST', mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                option: 'logTime',
                token: localStorage.getItem('authToken'),
                email: localStorage.getItem('email'),
                username: localStorage.getItem('username'),
                timeSaved: localStorage.getItem('saved-time'),
                speed: localStorage.getItem('panoptoExtSpeed')
            })
        });
    }

    // ── Leaderboard popup ─────────────────────────────────────────────────────

    document.getElementById('leaderboard-popup').addEventListener('click', (e) => {
        e.preventDefault();
        window.open(
            "https://docs.google.com/spreadsheets/d/e/2PACX-1vQY7BsTK4TY5DLMUDF7kbf-dq1Eo0cgv95FKkemrwyIlHwxUNhC4Kz1qBYDrTF5IZ_NYerftRcRlB6q/pubchart?oid=1888302536&format=interactive",
            "popupWindow", "width=644,height=620"
        );
    });

    document.getElementById('rate-button').addEventListener('click', () => {
        window.open("https://chromewebstore.google.com/detail/panopto-custom-speed/fnoppdfnaklabgfllejlefomclegmnam/reviews");
    });

    document.getElementById('coffee-button').addEventListener('click', () => {
        window.open("https://buymeacoffee.com/harveychandler");
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
    if (localStorage.getItem('fullTime')) {
        timingDiv.style.display = 'block';
        setTimingDisplay(localStorage.getItem('fullTime'));
    }

    function fetchTotalTime() {
        fetch(BACKEND + `?getFullTime={"aID":"${localStorage.getItem('aID')}", "myTime":"${localStorage.getItem('saved-time')}"}`)
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

    // ── Init auth state (NO auto-prompt) ──────────────────────────────────────

    const savedEmail = localStorage.getItem('email');
    if (!savedEmail) {
        // Not logged in — just show sign-in button, do NOT call signIn()
        showLoggedOut();
    } else if (isTokenExpired()) {
        // Token expired — log out silently, let user re-login manually
        clientLogout();
    } else {
        // Valid session
        clientLogin();
    }

    // Show rank immediately from cache if we know who the user is
    if (savedEmail && !isTokenExpired()) {
        const cachedRank = localStorage.getItem('user-rank');
        if (cachedRank) {
            document.getElementById('user-rank').textContent =
                cachedRank == -1 ? t('rankGt20') : `#${cachedRank}`;
        }
    }

});
