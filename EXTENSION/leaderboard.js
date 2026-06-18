const BACKEND = 'https://panopto-stripe.harveychandler235.workers.dev';

const LB_TRANSLATIONS = {
    en: {
        title:     'Leaderboard',
        loading:   'Loading leaderboard…',
        errorMsg:  'Failed to load leaderboard.<br>Check your connection and try again.',
        retry:     'Retry',
        lastWinner:'Last week\'s winner',
        tabWeek:   'This Week',
        tabAllTime:'All Time',
        empty:     'No entries yet.',
    },
    ko: {
        title:     '리더보드',
        loading:   '리더보드 로딩 중…',
        errorMsg:  '리더보드를 불러오지 못했습니다.<br>연결 상태를 확인하고 다시 시도해 주세요.',
        retry:     '다시 시도',
        lastWinner:'지난 주 1위',
        tabWeek:   '이번 주',
        tabAllTime:'전체 기간',
        empty:     '아직 항목이 없어요.',
    },
    zh: {
        title:     '排行榜',
        loading:   '正在加载排行榜…',
        errorMsg:  '加载排行榜失败。<br>请检查您的网络连接后重试。',
        retry:     '重试',
        lastWinner:'上周冠军',
        tabWeek:   '本周',
        tabAllTime:'历史总榜',
        empty:     '暂无数据。',
    },
    he: {
        title:     'לוח תוצאות',
        loading:   '…טוען לוח תוצאות',
        errorMsg:  '.לא ניתן לטעון את לוח התוצאות<br>בדוק/י את החיבור ונסה/י שוב',
        retry:     'נסה/י שוב',
        lastWinner:'מנצח/ת השבוע שעבר',
        tabWeek:   'השבוע',
        tabAllTime:'כל הזמנים',
        empty:     '.עדיין אין רשומות',
    },
    uk: {
        title:     'Таблиця лідерів',
        loading:   'Завантаження таблиці лідерів…',
        errorMsg:  'Не вдалося завантажити таблицю лідерів.<br>Перевірте з\'єднання та спробуйте ще раз.',
        retry:     'Повторити',
        lastWinner:'Переможець минулого тижня',
        tabWeek:   'Цього тижня',
        tabAllTime:'За весь час',
        empty:     'Записів поки немає.',
    },
};

function lbT(key) {
    const lang = localStorage.getItem('ext-lang') || 'en';
    return (LB_TRANSLATIONS[lang] && LB_TRANSLATIONS[lang][key]) || LB_TRANSLATIONS.en[key] || key;
}

function applyLbLanguage() {
    const lang = localStorage.getItem('ext-lang') || 'en';
    document.documentElement.dir = (lang === 'he') ? 'rtl' : 'ltr';

    const titleEl = document.getElementById('lbl-lb-title');
    if (titleEl) titleEl.textContent = lbT('title');

    const loadingEl = document.getElementById('lbl-lb-loading');
    if (loadingEl) loadingEl.textContent = lbT('loading');

    const errorEl = document.getElementById('lbl-lb-error');
    if (errorEl) errorEl.innerHTML = lbT('errorMsg');

    const retryEl = document.getElementById('retryBtn');
    if (retryEl) retryEl.textContent = lbT('retry');

    const lwEl = document.getElementById('lbl-lw-label');
    if (lwEl) lwEl.textContent = lbT('lastWinner');

    const tabWeek = document.getElementById('lbl-tab-week');
    if (tabWeek) tabWeek.textContent = lbT('tabWeek');

    const tabAll = document.getElementById('lbl-tab-alltime');
    if (tabAll) tabAll.textContent = lbT('tabAllTime');
}

const MEDALS        = ['🥇', '🥈', '🥉'];
const BADGE_CLASSES = ['gold', 'silver', 'bronze'];
const ROW_CLASSES   = ['rank-1', 'rank-2', 'rank-3'];

let currentPeriod = 'week';

function getWeekDateRange() {
    const now  = new Date();
    const day  = now.getUTCDay();
    const daysFromMonday = day === 0 ? 6 : day - 1;

    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - daysFromMonday);
    monday.setUTCHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    const fmt = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    return `${fmt(monday)} – ${fmt(sunday)}`;
}

function updatePeriodLabel(period) {
    const el = document.getElementById('period-range');
    if (!el) return;
    el.textContent = period === 'week' ? getWeekDateRange() : 'All time';
}

function formatTime(totalSecs) {
    totalSecs = Math.floor(Number(totalSecs));
    if (isNaN(totalSecs) || totalSecs <= 0) return '0s';
    const y  = Math.floor(totalSecs / 31536000); totalSecs %= 31536000;
    const mo = Math.floor(totalSecs / 2592000);  totalSecs %= 2592000;
    const d  = Math.floor(totalSecs / 86400);    totalSecs %= 86400;
    const h  = Math.floor(totalSecs / 3600);     totalSecs %= 3600;
    const m  = Math.floor(totalSecs / 60);
    const s  = totalSecs % 60;
    let out = '';
    if (y)  out += `${y}y `;
    if (mo) out += `${mo}mo `;
    if (d)  out += `${d}d `;
    if (h)  out += `${h}h `;
    if (m)  out += `${m}m `;
    if (s || !out) out += `${s}s`;
    return out.trim();
}

function renderLeaderboard(entries) {
    const list = document.getElementById('list');
    list.innerHTML = '';

    if (!entries || entries.length === 0) {
        list.innerHTML = `
            <div class="state">
                <span class="empty-emoji">📋</span>
                <p class="empty-msg">${lbT('empty')}</p>
            </div>`;
        list.style.display = 'block';
        return;
    }

    entries.forEach((entry, i) => {
        const row = document.createElement('div');
        row.className = 'row' + (i < 3 ? ` ${ROW_CLASSES[i]}` : '');

        const badge = document.createElement('div');
        badge.className = 'rank-badge' + (i < 3 ? ` ${BADGE_CLASSES[i]}` : '');
        badge.textContent = i < 3 ? MEDALS[i] : String(i + 1);

        const username = document.createElement('span');
        username.className = 'username';
        username.textContent = entry.username || 'unknown';

        const time = document.createElement('span');
        time.className = 'time-saved';
        time.textContent = formatTime(entry.timeSaved);

        row.appendChild(badge);
        row.appendChild(username);
        if (entry.username === 'harvey') {
            const devBadge = document.createElement('span');
            devBadge.className = 'dev-badge';
            devBadge.textContent = 'Developer';
            row.appendChild(devBadge);
        }
        if (entry.isPremium) {
            const premBadge = document.createElement('span');
            premBadge.className = 'prem-badge';
            premBadge.textContent = '★ Premium';
            row.appendChild(premBadge);
        }
        row.appendChild(time);
        list.appendChild(row);
    });

    list.style.display = 'block';
}

async function loadLeaderboard(period) {
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('error').style.display   = 'none';
    document.getElementById('list').style.display    = 'none';

    try {
        const res = await fetch(`${BACKEND}/leaderboard?type=${period}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        document.getElementById('loading').style.display = 'none';
        renderLeaderboard(data);
    } catch {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display   = 'flex';
    }
}

async function loadLastWinner() {
    try {
        const res = await fetch(`${BACKEND}/lastWinner`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data || !data.username) return;
        document.getElementById('lw-username').textContent = data.username;
        document.getElementById('lw-time').textContent     = formatTime(data.timeSaved);
        document.getElementById('last-winner').style.display = 'block';
    } catch {
        // silently skip — not critical
    }
}

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        if (tab.dataset.period === currentPeriod) return;
        currentPeriod = tab.dataset.period;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        updatePeriodLabel(currentPeriod);
        loadLeaderboard(currentPeriod);
    });
});

document.getElementById('retryBtn').addEventListener('click', () => loadLeaderboard(currentPeriod));

applyLbLanguage();
updatePeriodLabel('week');
loadLeaderboard('week');
loadLastWinner();
