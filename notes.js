const BACKEND = 'https://panopto-stripe.harveychandler235.workers.dev';
const MAX_CHUNK_CHARS = 180_000;   // server caps at 200K
// £3 every 2 months, with the 7-day free trial (no card) enabled on the link.
const PREMIUM_URL = 'https://buy.stripe.com/6oU9ALalk59U4GdfqY1VK04';

const $ = (id) => document.getElementById(id);

const ERROR_MESSAGES = {
    not_premium:        'You’ve used today’s free notes — they reset at midnight UTC. Premium gets 15 a day; start a free 7-day trial to unlock it.',
    rate_limited:       'You\'ve reached today\'s AI limit. It resets at midnight UTC.',
    // The server rejects a query before sending it to the AI if it would take the
    // user over their monthly allowance, so nothing has been charged or generated.
    budget_exceeded:    'You\'ve used your AI allowance for this month. It resets on the 1st — everything else in Premium keeps working.',
    // Free/trial/leaderboard-premium users run on free AI capacity only, so when
    // that's gone for the day they wait rather than costing us anything.
    free_ai_exhausted:  'Today\'s free AI capacity is used up. It resets overnight — or subscribe for priority access.',
    caption_too_long:   'This lecture is unusually long. Splitting it into chunks…',
    bad_input:          'This lecture\'s captions don\'t look like a transcript. We can\'t summarise it.',
    gemini_failed:      'The AI service had a hiccup. Try again in a moment.',
    gemini_unconfigured:'AI service not configured yet. Please contact support.',
    Unauthorized:       'Your sign-in expired. Open the extension popup and sign in again.',
};

let _state = null;   // { context, sections[], title }
let _notesGenerated  = false;   // notes have been generated + rendered into the page
let _notesGenerating = false;   // a notes generation is currently in flight

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────────────────────

(async function main() {
    const params = new URLSearchParams(location.search);
    const id     = params.get('id');
    if (!id) return showError('Missing lecture ID in URL.');

    const ctxKey = 'notesContext_' + id;
    const stored = await new Promise(r => chrome.storage.local.get(ctxKey, r));
    const context = stored[ctxKey];
    if (!context) return showError('Lecture context expired. Open the extension popup and try again.');

    _state = { context, sections: null, title: context.title || 'Lecture' };
    document.title = `${_state.title} — AI Notes`;

    if (context.viewerUrl) {
        const openBtn = $('openLectureBtn');
        if (openBtn) openBtn.href = context.viewerUrl;
    }

    $('retryBtn').addEventListener('click', () => generate());
    $('downloadBtn').addEventListener('click', downloadHtml);
    $('copyBtn').addEventListener('click', copyMarkdown);
    $('regrabBtn')?.addEventListener('click', regrabScreenshots);

    setupLightbox();
    setupQrCode();

    // If the popup deep-linked straight to a tool (Flashcards / Chat), DON'T generate
    // notes — that's a slow, separate Gemini call the user didn't ask for. Show the
    // tool shell and generate notes lazily, only if they open the Notes tab.
    const wantedTab = params.get('tab');
    if (wantedTab === 'cards' || wantedTab === 'chat') {
        bootstrapTools();
    } else {
        generate();
    }
})();

// Deep-linked straight to a tool: show the AI-tools shell without generating notes.
function bootstrapTools() {
    $('loading').style.display = 'none';
    $('error').style.display   = 'none';
    const page = $('page'); if (page) page.style.display = 'none';
    $('toolbar').style.display = 'none';   // Download/Copy act on notes, not generated yet
    $('header-title').textContent = _state.title;
    $('header-sub').textContent   = 'AI Tools';
    // Shows the tab bar, wires the tabs, and routes to ?tab= (Flashcards / Chat).
    setupAiTools();
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-grab — user-triggered reset of cached screenshots
// ─────────────────────────────────────────────────────────────────────────────

async function regrabScreenshots() {
    const ctx = _state?.context;
    if (!ctx?.deliveryId) return;

    const btn = $('regrabBtn');
    if (btn) {
        btn.disabled = true;
        const orig = btn.innerHTML;
        btn.innerHTML = '🔄 Re-capturing…';
        setTimeout(() => { btn.disabled = false; btn.innerHTML = orig; }, 12_000);
    }

    // 1. Wipe the local cache for THIS lecture
    const shotKey = 'shots_' + ctx.deliveryId;
    await new Promise(r => chrome.storage.local.remove(shotKey, r));

    // 2. Reset every visible row to a loading banner that tells the user
    //    they may need to refresh the Panopto tab if the same wrong frames
    //    keep coming back.
    const message =
        '🔄 Re-capturing screenshots. If the wrong frames keep coming back, ' +
        'refresh the Panopto tab in the original window and click this again.';
    document.querySelectorAll('.section-shot-row').forEach(row => {
        row.classList.remove('is-loaded', 'is-failed');
        row.classList.add('is-loading');
        const tiles = row.querySelector('.section-shot-tiles');
        if (!tiles) return;
        tiles.innerHTML = '';
        const banner = document.createElement('div');
        banner.className = 'section-shot-banner';
        banner.innerHTML =
            '<span class="section-shot-spinner"></span>' +
            `<p>${message}</p>`;
        tiles.appendChild(banner);
    });

    // 3. Run the fetch again — cache is empty so it will go straight to
    //    the content script for a fresh capture.
    await fetchScreenshots();
}

// ─────────────────────────────────────────────────────────────────────────────
// QR code corner — fetched once and cached as a data URL so the exported
// HTML stays self-contained (no network needed when reading offline).
// ─────────────────────────────────────────────────────────────────────────────

const QR_TARGET = 'https://chromewebstore.google.com/detail/panopto-custom-speed/fnoppdfnaklabgfllejlefomclegmnam';
const QR_API    = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&format=png&data=';
const QR_STORAGE_KEY = 'aiNotesQrDataUrl_v1';

async function setupQrCode() {
    const link = $('qrLink');
    const img  = $('qrImg');
    if (!link || !img) return;
    link.href = QR_TARGET;

    let dataUrl = localStorage.getItem(QR_STORAGE_KEY);
    if (!dataUrl) {
        dataUrl = await fetchQrDataUrl(QR_TARGET);
        if (dataUrl) {
            try { localStorage.setItem(QR_STORAGE_KEY, dataUrl); } catch {}
        }
    }

    if (dataUrl) {
        img.src = dataUrl;
    } else {
        // No QR available — keep the clickable link as a tile-shaped "Get the
        // extension" call to action, just without the scannable image.
        link.querySelector('.qr-corner-img')?.remove();
    }
}

async function fetchQrDataUrl(target) {
    try {
        const resp = await fetch(QR_API + encodeURIComponent(target));
        if (!resp.ok) return null;
        const blob = await resp.blob();
        if (!blob.size) return null;
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload  = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn('[AI Notes] could not fetch QR code:', e);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lightbox
// ─────────────────────────────────────────────────────────────────────────────

function setupLightbox() {
    const lb       = $('lightbox');
    const close    = $('lightboxClose');
    if (!lb || !close) return;

    const hide = () => { lb.classList.remove('open'); $('lightboxImg').src = ''; };

    close.addEventListener('click', (e) => { e.stopPropagation(); hide(); });
    lb.addEventListener('click', (e) => {
        // Close when clicking the dark background; ignore clicks on the image
        if (e.target === lb) hide();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lb.classList.contains('open')) hide();
    });
}

function openLightbox(src, ts, label) {
    const lb = $('lightbox');
    if (!lb) return;
    $('lightboxImg').src      = src;
    $('lightboxTs').textContent    = ts || '';
    $('lightboxLabel').textContent = label || '';
    lb.classList.add('open');
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate / fetch
// ─────────────────────────────────────────────────────────────────────────────

async function generate() {
    _notesGenerating = true;
    showLoading();
    const { captionsCleaned, lang, title, email, authToken } = _state.context;

    if (!captionsCleaned || captionsCleaned.length < 50) {
        _notesGenerating = false;
        return showError('This lecture has no captions, or the transcript is too short to summarise.');
    }
    if (!email || !authToken) {
        _notesGenerating = false;
        return showError('You\'re not signed in. Open the extension popup and sign in with Google.', { showPremium: false });
    }

    try {
        const chunks = chunkText(captionsCleaned, MAX_CHUNK_CHARS);
        const allSections = [];
        const modelsUsed = new Set();
        let aiTitle = null;
        let partial = false;
        for (let i = 0; i < chunks.length; i++) {
            let data;
            try {
                data = await callSummarize({
                    token: authToken,
                    email,
                    captionsCleaned: chunks[i],
                    lang: lang || 'en',
                    title,
                });
            } catch (e) {
                // The server charges the quota per chunk. If the first chunk failed
                // nothing was spent and the normal error path is right; but if a LATER
                // chunk fails, throwing away the chunks that already succeeded meant a
                // free user's single credit was gone and they got nothing for it.
                // Keep what we have and say so.
                if (i === 0 || !allSections.length) throw e;
                partial = true;
                console.warn('[AI Notes] chunk', i + 1, 'of', chunks.length, 'failed — rendering the rest:', e?.code || e?.message);
                break;
            }
            allSections.push(...extractSections(data));
            if (!aiTitle && data?.title) aiTitle = data.title;
            if (data?.model) modelsUsed.add(data.model);
        }
        const merged = mergeSections(allSections);
        if (!merged.length) return showError('The AI returned no notes. Try again.');
        if (partial) _state.partialNotice = 'The last part of this lecture couldn’t be summarised — these notes cover the first part only.';
        if (aiTitle) _state.title = aiTitle;
        _state.sections = merged;
        // Show the model(s) the server actually used (it varies per request), not a
        // hardcoded name. Different chunks could use different models — show them all.
        _state.model = [...modelsUsed].map(prettifyModel).filter(Boolean).join(' + ');
        render();
    } catch (e) {
        const code = e?.code || 'unknown';
        showError(ERROR_MESSAGES[code] || e.message || 'Something went wrong.', {
            showRetry:   ['gemini_failed', 'unknown'].includes(code),
            showPremium: code === 'not_premium',
        });
    } finally {
        _notesGenerating = false;
    }
}

async function callSummarize(body) {
    let resp;
    try {
        resp = await fetch(`${BACKEND}/summarize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    } catch {
        const err = new Error('Network error'); err.code = 'gemini_failed'; throw err;
    }

    let data;
    try { data = await resp.json(); } catch { data = null; }

    if (!resp.ok) {
        const err = new Error(data?.error || `HTTP ${resp.status}`);
        err.code = data?.error || `http_${resp.status}`;
        throw err;
    }
    return data;
}

function chunkText(text, maxChars) {
    if (text.length <= maxChars) return [text];
    const lines  = text.split('\n');
    const chunks = [];
    let current  = '';
    for (const line of lines) {
        if (current.length + line.length + 1 > maxChars && current) {
            chunks.push(current);
            const overlap = current.slice(-Math.floor(maxChars * 0.05));
            current = overlap + '\n' + line;
        } else {
            current += (current ? '\n' : '') + line;
        }
    }
    if (current) chunks.push(current);
    return chunks;
}

// Accept both the new {sections:[{heading,content}]} shape AND the legacy
// {outline:[{timestamp,topic,summary}]} shape from old cached entries or
// from a worker that hasn't been redeployed yet.
function extractSections(data) {
    if (Array.isArray(data?.sections)) return data.sections;
    if (Array.isArray(data?.outline)) {
        return data.outline.map(o => ({
            heading: (o && (o.topic || o.heading)) || 'Section',
            content: (o && (o.summary || o.content)) || ''
        }));
    }
    return [];
}

// Concatenate section arrays from each chunk and drop consecutive duplicates by heading
function mergeSections(items) {
    if (!items?.length) return [];
    const cleaned = items
        .filter(s => s && typeof s.heading === 'string' && typeof s.content === 'string' && s.heading.trim());
    const out = [];
    const seen = new Set();
    for (const s of cleaned) {
        const key = s.heading.trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ heading: s.heading.trim(), content: s.content });
    }
    return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Render
// ─────────────────────────────────────────────────────────────────────────────

function slugify(s, i) {
    const base = (s || '').toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 40);
    return `sec-${i + 1}-${base || 'section'}`;
}

// Turn a raw model id ("gemini-2.0-flash") into a readable label ("Gemini 2.0 Flash").
function prettifyModel(m) {
    if (!m || typeof m !== 'string') return '';
    return m.trim()
        .replace(/^models\//i, '')          // drop any "models/" API prefix
        .replace(/(\d)-(\d)/g, '$1.$2')     // claude-haiku-4-5 → …4.5, not "4 5"
        .replace(/[-_]/g, ' ')
        .replace(/\b([a-z])/g, c => c.toUpperCase());
}

function render() {
    _notesGenerated = true;
    $('loading').style.display = 'none';
    $('error').style.display   = 'none';
    $('toolbar').style.display = 'flex';
    // Show the notes view only if the user is on the Notes tab — if they switched to
    // Flashcards/Chat while notes generated lazily, build the notes but keep them hidden
    // behind their tab (clicking Notes will reveal them; they won't re-generate).
    if (!$('tabNotes') || $('tabNotes').classList.contains('active')) {
        $('page').style.display = 'grid';
    }
    setupAiTools();

    $('header-title').textContent = _state.title;
    const poweredBy = _state.model ? `Powered by ${_state.model}` : 'Powered by Gemini';
    $('header-sub').textContent   = `${poweredBy} · ${_state.sections.length} sections`
        + (_state.partialNotice ? ` · ⚠ ${_state.partialNotice}` : '');

    const list    = $('list');
    const tocList = $('tocList');
    list.innerHTML    = '';
    tocList.innerHTML = '';

    // Pre-compute auto-assigned timestamps for any section that lacks one.
    // Distributes screenshots proportionally across the lecture timeline and
    // scales count by content length so harder/longer sections get more shots.
    autoAssignScreenshots(_state.sections, _state.context && _state.context.captionsCleaned);

    const playerChapters = [];   // {heading, ts} for the in-player chapter widget

    _state.sections.forEach((s, i) => {
        const id = slugify(s.heading, i);

        // Chapter
        const chapter = document.createElement('section');
        chapter.className = 'chapter';
        chapter.id = id;

        const eyebrow = document.createElement('div');
        eyebrow.className = 'chapter-eyebrow';
        eyebrow.textContent = `Chapter ${String(i + 1).padStart(2, '0')}`;
        chapter.appendChild(eyebrow);

        const h = document.createElement('h2');
        h.className = 'chapter-title';
        h.textContent = s.heading;
        chapter.appendChild(h);

        // Collect timestamps to screenshot, in priority order:
        //   1. explicit `timestamp` field from the model
        //   2. inline `[HH:MM:SS]` markers in the section content
        //   3. auto-distributed timestamps from the transcript
        const stamps = [];
        const push = (t) => {
            const n = normalizeTimestamp(t);
            if (n && !stamps.includes(n)) stamps.push(n);
        };
        push(s.timestamp);
        if (typeof s.content === 'string') {
            const re = /\[(\d{1,2}:\d{2}:\d{2})\]/g;
            let m; while ((m = re.exec(s.content)) !== null) push(m[1]);
        }
        if (Array.isArray(s._autoTimestamps)) {
            for (const t of s._autoTimestamps) push(t);
        }

        // Cap at 3 screenshots per section to keep things tidy
        const finalStamps = stamps.slice(0, 3);

        // The section's primary timestamp doubles as its in-player chapter marker.
        if (finalStamps[0]) playerChapters.push({ heading: s.heading, ts: finalStamps[0] });

        for (const t of finalStamps) {
            chapter.appendChild(buildShotRow(t));
        }

        const body = document.createElement('div');
        body.className = 'md';
        body.innerHTML = renderMarkdown(s.content);
        chapter.appendChild(body);

        list.appendChild(chapter);

        // TOC entry
        const li = document.createElement('li');
        const a  = document.createElement('a');
        a.className = 'toc-link';
        a.href = '#' + id;
        a.dataset.target = id;

        const num = document.createElement('span');
        num.className = 'toc-num';
        num.textContent = String(i + 1).padStart(2, '0');

        const lbl = document.createElement('span');
        lbl.textContent = s.heading;

        a.appendChild(num);
        a.appendChild(lbl);
        li.appendChild(a);
        tocList.appendChild(li);
    });

    // Cache a chronological chapter list so content.js can show clickable jump
    // points on the Panopto player for this lecture (keyed by delivery id).
    if (_state.context?.deliveryId && playerChapters.length) {
        const sorted = playerChapters.slice().sort(
            (a, b) => VttUtils.timestampToSeconds(a.ts) - VttUtils.timestampToSeconds(b.ts)
        );
        try {
            chrome.storage.local.set({
                ['chapters_' + _state.context.deliveryId]: {
                    title: _state.title, savedAt: Date.now(), chapters: sorted,
                },
            });
        } catch {}
    }

    setupScrollSpy();
    fetchScreenshots();
    showDownloadNudge();
}

// Normalise a timestamp into HH:MM:SS, accepting H:MM:SS or M:SS or seconds.
// Auto-distribute screenshots across sections, picking timestamps from the
// transcript proportionally to each section's chronological position. Number
// of shots per section scales with content length: short=1, long=2, very long=3.
function autoAssignScreenshots(sections, transcript) {
    if (!sections?.length || !transcript) return;

    const stamps = [];
    const re = /\[(\d{2}:\d{2}:\d{2})\]/g;
    let m;
    while ((m = re.exec(transcript)) !== null) stamps.push(m[1]);
    if (stamps.length < sections.length) return;

    sections.forEach((s, i) => {
        // How many shots for this section
        const len = (s.content || '').length;
        let count = 1;
        if (len > 1100) count = 2;
        if (len > 2200) count = 3;

        // This section's slice of the transcript timestamp list
        const start = Math.floor(i       * stamps.length / sections.length);
        const end   = Math.floor((i + 1) * stamps.length / sections.length);
        const range = stamps.slice(start, Math.max(end, start + 1));
        if (!range.length) return;

        count = Math.min(count, range.length);

        const picks = [];
        if (count === 1) {
            // Take roughly the 30% mark — early enough to match the topic intro,
            // late enough to land on a content slide not a transition.
            picks.push(range[Math.floor(range.length * 0.3)]);
        } else {
            // Evenly space within the range, avoiding both extremes
            for (let k = 0; k < count; k++) {
                const frac = (k + 1) / (count + 1);
                picks.push(range[Math.min(range.length - 1, Math.floor(frac * range.length))]);
            }
        }
        s._autoTimestamps = picks;
    });
}

function normalizeTimestamp(t) {
    if (!t) return null;
    if (typeof t === 'number' && isFinite(t)) {
        return VttUtils.secsToHHMMSS(t);
    }
    const s = String(t).trim();
    let m = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(s);
    if (m) return `${m[1].padStart(2,'0')}:${m[2]}:${m[3]}`;
    m = /^(\d{1,2}):(\d{2})$/.exec(s);
    if (m) return `00:${m[1].padStart(2,'0')}:${m[2]}`;
    m = /^(\d+)(?:\.\d+)?$/.exec(s);
    if (m) return VttUtils.secsToHHMMSS(+m[1]);
    return null;
}

// One row per timestamp. Inside the row we render N empty tiles — populated
// after `fetchScreenshots` returns with the per-source data URLs.
function buildShotRow(hhmmss) {
    const row = document.createElement('div');
    row.className = 'section-shot-row is-loading';
    row.dataset.ts = hhmmss;

    const header = document.createElement('div');
    header.className = 'section-shot-row-header';

    const tsPill = document.createElement('span');
    tsPill.className = 'section-shot-ts';
    tsPill.textContent = hhmmss;
    header.appendChild(tsPill);

    const viewerUrl = _state?.context?.viewerUrl;
    if (viewerUrl) {
        const secs = VttUtils.timestampToSeconds(hhmmss);
        const sep  = viewerUrl.includes('?') ? '&' : '?';
        const a = document.createElement('a');
        a.className = 'section-shot-link';
        a.href = `${viewerUrl}${sep}start=${secs}`;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = 'Open lecture at this moment ↗';
        header.appendChild(a);
    }

    row.appendChild(header);

    const tiles = document.createElement('div');
    tiles.className = 'section-shot-tiles';
    tiles.dataset.placeholder = 'true';
    // Loading banner spans the full row — the actual tile grid replaces this
    // once `fetchScreenshots` returns. Tells the user exactly what to do
    // because Chrome will not let us decode video frames reliably while the
    // Panopto tab is in the background.
    const banner = document.createElement('div');
    banner.className = 'section-shot-banner';
    banner.innerHTML =
        '<span class="section-shot-spinner"></span>' +
        '<p>Please go back to the lecture tab briefly so the screenshots can appear with the notes.</p>';
    tiles.appendChild(banner);
    row.appendChild(tiles);

    return row;
}

function buildShotTile(label) {
    const tile = document.createElement('figure');
    tile.className = 'section-shot is-loading';
    tile.dataset.label = label || '';

    const frame = document.createElement('div');
    frame.className = 'section-shot-frame';

    const img = document.createElement('img');
    img.className = 'section-shot-img';
    img.alt = label || 'Lecture frame';
    img.loading = 'lazy';
    frame.appendChild(img);

    const overlay = document.createElement('div');
    overlay.className = 'section-shot-overlay';
    overlay.innerHTML = '<span class="section-shot-spinner"></span>';
    frame.appendChild(overlay);

    tile.appendChild(frame);

    if (label) {
        const cap = document.createElement('figcaption');
        cap.className = 'section-shot-source';
        cap.textContent = label;
        tile.appendChild(cap);
    }

    return tile;
}

async function fetchScreenshots() {
    const rows = Array.from(document.querySelectorAll('.section-shot-row[data-ts]'));
    if (!rows.length) return;

    const ctx = _state?.context;
    if (!ctx?.deliveryId) {
        for (const r of rows) markRowFailed(r);
        return;
    }

    // 1. Read any cached captures from local storage
    const shotKey = 'shots_' + ctx.deliveryId;
    const stored  = await new Promise(r => chrome.storage.local.get(shotKey, r));
    const cachedEntry = stored[shotKey] || { captures: [] };
    const cacheByTime = new Map((cachedEntry.captures || []).map(c => [c.time, c.sources]));

    const uncachedRows  = [];
    const uncachedTimes = [];

    rows.forEach(row => {
        const time = VttUtils.timestampToSeconds(row.dataset.ts);
        const sources = cacheByTime.get(time);
        if (Array.isArray(sources) && sources.length) {
            renderRowSources(row, sources);
        } else {
            uncachedRows.push(row);
            uncachedTimes.push(time);
        }
    });

    if (!uncachedRows.length) return;   // every row was cached locally

    const tabId = ctx.panoptoTabId;
    if (!tabId) {
        // No Panopto tab to capture from — leave placeholders for next visit
        for (const r of uncachedRows) markRowFailed(r, 'Reopen the Panopto lecture and click Generate again to capture screenshots.');
        return;
    }

    // 2. Ask the content script to capture missing frames from the live <video>
    chrome.tabs.sendMessage(
        tabId,
        { action: 'getScreenshots', deliveryId: ctx.deliveryId, times: uncachedTimes },
        async (response) => {
            if (chrome.runtime.lastError) {
                console.warn('[AI Notes] capture — chrome.runtime.lastError:', chrome.runtime.lastError);
                for (const r of uncachedRows) markRowFailed(r, 'The Panopto tab is closed.');
                return;
            }
            console.groupCollapsed('[AI Notes] in-browser video capture');
            console.log('debug:', response?.debug);
            if (response?.error) console.log('error:', response.error);
            console.groupEnd();

            if (!response?.shots) {
                for (const r of uncachedRows) markRowFailed(r, response?.error || 'No frames captured.');
                return;
            }

            // 3. Render and persist
            const newCaptures = [];
            uncachedRows.forEach((row, i) => {
                const sources = response.shots[i];
                if (!Array.isArray(sources) || !sources.length) {
                    const msg = response?.error === 'no_videos'
                        ? 'No <video> element found on the lecture page.'
                        : 'Couldn\'t capture a fresh frame here. Click the Panopto lecture tab so it has focus, then click "Images look wrong?" again.';
                    markRowFailed(row, msg);
                    return;
                }
                renderRowSources(row, sources);
                newCaptures.push({ time: uncachedTimes[i], sources });
            });

            if (newCaptures.length) {
                const merged = (cachedEntry.captures || []).slice();
                for (const nc of newCaptures) {
                    // Replace any pre-existing entry at the same time
                    const idx = merged.findIndex(c => c.time === nc.time);
                    if (idx >= 0) merged[idx] = nc; else merged.push(nc);
                }
                chrome.storage.local.set({
                    [shotKey]: {
                        deliveryId: ctx.deliveryId,
                        captures: merged,
                        capturedAt: Date.now(),
                    }
                });
            }
        }
    );
}

function renderRowSources(row, sources) {
    const tiles = row.querySelector('.section-shot-tiles');
    if (!tiles) return;
    tiles.innerHTML = '';
    tiles.dataset.placeholder = '';

    const ts = row.dataset.ts || '';

    sources.forEach((source) => {
        const tile  = buildShotTile(source.label || 'Frame');
        const frame = tile.querySelector('.section-shot-frame');
        const img   = tile.querySelector('.section-shot-img');
        img.onload  = () => {
            if (img.naturalWidth < 32 || img.naturalHeight < 32) {
                markShotFailed(tile);
            } else {
                tile.classList.remove('is-loading');
                tile.classList.add('is-loaded');
                row.classList.remove('is-loading');
            }
        };
        img.onerror = () => markShotFailed(tile);
        img.src     = source.dataUrl;

        // Click anywhere on the framed area → enlarge in the lightbox
        frame.addEventListener('click', () => {
            if (!tile.classList.contains('is-loaded')) return;
            openLightbox(source.dataUrl, ts, source.label || '');
        });

        tiles.appendChild(tile);
    });
}

function markRowFailed(row, message) {
    row.classList.remove('is-loading');
    row.classList.add('is-failed');
    const tiles = row.querySelector('.section-shot-tiles');
    if (!tiles) return;
    tiles.innerHTML = '';
    const banner = document.createElement('div');
    banner.className = 'section-shot-banner is-failed';
    banner.innerHTML = `<p>${message || '📷 Screenshot unavailable.'}</p>`;
    tiles.appendChild(banner);
}

function markShotFailed(tile) {
    tile.classList.remove('is-loading');
    tile.classList.add('is-failed');
    const overlay = tile.querySelector('.section-shot-overlay');
    if (overlay) overlay.innerHTML = '<span class="section-shot-fail">📷 Unavailable</span>';
}

function setupScrollSpy() {
    const links = Array.from(document.querySelectorAll('.toc-link'));
    if (!links.length) return;

    const byId = new Map(links.map(a => [a.dataset.target, a]));
    const setActive = (id) => {
        for (const a of links) a.classList.toggle('active', a.dataset.target === id);
    };

    // Default: first section active
    setActive(links[0].dataset.target);

    const obs = new IntersectionObserver((entries) => {
        // Pick the topmost intersecting entry
        const visible = entries
            .filter(e => e.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length) setActive(visible[0].target.id);
    }, { rootMargin: '-160px 0px -60% 0px', threshold: 0 });

    for (const a of links) {
        const el = document.getElementById(a.dataset.target);
        if (el) obs.observe(el);
    }
}

function showLoading() {
    $('loading').style.display = 'flex';
    $('error').style.display   = 'none';
    const page = $('page'); if (page) page.style.display = 'none';
    $('toolbar').style.display = 'none';
    // Keep the tab bar reachable once the AI tools exist (e.g. a lazy notes load) so the
    // user can return to Flashcards/Chat; only hide it on the very first pre-tools load.
    if (!_aiToolsReady) { const tb = $('tabBar'); if (tb) tb.style.display = 'none'; }
    hideAiPanels();
}

function showError(msg, { showRetry = true, showPremium = false } = {}) {
    $('loading').style.display = 'none';
    const page = $('page'); if (page) page.style.display = 'none';
    // Don't strip tab navigation if the tools are already up (e.g. a lazy notes failure)
    // — the user must still be able to get back to Flashcards/Chat.
    if (!_aiToolsReady) { const tb = $('tabBar'); if (tb) tb.style.display = 'none'; }
    hideAiPanels();
    $('error').style.display   = 'flex';
    $('errorMsg').textContent  = msg;
    $('retryBtn').style.display   = showRetry   ? 'inline-block' : 'none';
    $('premiumCta').style.display = showPremium ? 'inline-block' : 'none';
    if (showPremium) $('premiumCta').href = PREMIUM_URL;
}

// ─────────────────────────────────────────────────────────────────────────────
// Minimal Markdown renderer — headings, lists, blockquotes, code, math, bold/italic
// ─────────────────────────────────────────────────────────────────────────────

function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Render a LaTeX fragment with KaTeX. Falls back to the raw TeX (so a malformed
// formula, or a failed KaTeX load, never blanks a section).
function renderTex(tex, displayMode) {
    if (typeof katex !== 'undefined') {
        try {
            return katex.renderToString(tex, {
                displayMode,
                throwOnError: false,     // show the bad TeX in red rather than throwing
                output: 'htmlAndMathml', // HTML for the crisp live view; MathML powers the offline export
            });
        } catch (e) { /* fall through to raw text */ }
    }
    return `<span class="md-math">${escapeHtml(tex)}</span>`;
}

function renderInline(s) {
    // Extract math BEFORE escaping so KaTeX receives raw LaTeX (e.g. "a < b"), then
    // leave NUL-delimited placeholders that survive escaping and the bold/italic/code
    // passes below. Block math ($$…$$) is matched before inline ($…$).
    const math = [];
    const stash = (tex, displayMode) => {
        math.push(renderTex(tex.trim(), displayMode));
        return ` K${math.length - 1} `;
    };
    s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => stash(tex, true));
    s = s.replace(/\$([^$\n]+?)\$/g, (_, tex) => stash(tex, false));

    s = escapeHtml(s);
    // Inline code (must come before bold/italic so it doesn't get processed inside)
    s = s.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');
    // Bold
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
    // Italic
    s = s.replace(/(^|[^*])\*([^*\n]+)\*([^*]|$)/g, '$1<em>$2</em>$3');
    s = s.replace(/(^|[^_])_([^_\n]+)_([^_]|$)/g, '$1<em>$2</em>$3');
    // Restore the rendered math.
    s = s.replace(/ K(\d+) /g, (_, i) => math[+i]);
    return s;
}

function renderMarkdown(md) {
    if (!md) return '';
    md = String(md).replace(/\r\n/g, '\n').trim();

    // Pull out fenced code blocks first so their contents aren't reprocessed
    const codeBlocks = [];
    md = md.replace(/```([a-zA-Z0-9-]*)\n?([\s\S]*?)```/g, (m, lang, code) => {
        codeBlocks.push(`<pre class="md-pre"><code>${escapeHtml(code.replace(/\n$/, ''))}</code></pre>`);
        return ` CB${codeBlocks.length - 1} `;
    });

    const lines  = md.split('\n');
    const out    = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // Restore code block
        const cb = line.match(/^ CB(\d+) $/);
        if (cb) { out.push(codeBlocks[+cb[1]]); i++; continue; }

        // Blank line → paragraph break
        if (!line.trim()) { i++; continue; }

        // Horizontal rule
        if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
            out.push('<hr class="md-hr">'); i++; continue;
        }

        // Heading ## … (note: # is reserved for top-level — Gemini is told not to use it inside content)
        const h = line.match(/^(#{1,6})\s+(.+?)\s*$/);
        if (h) {
            const lvl = Math.min(6, h[1].length + 2);   // ## → h4 visually
            out.push(`<h${lvl} class="md-h md-h${h[1].length}">${renderInline(h[2])}</h${lvl}>`);
            i++; continue;
        }

        // Blockquote (one or more consecutive `>` lines)
        if (/^>\s?/.test(line)) {
            const buf = [];
            while (i < lines.length && /^>\s?/.test(lines[i])) {
                buf.push(lines[i].replace(/^>\s?/, ''));
                i++;
            }
            const inner = buf.join(' ').trim();
            // Detect "**Lead.** rest" pattern for callout styling
            const kind = inner.match(/^\*\*([A-Z][a-z]+)\.\*\*/);
            const cls = kind ? `md-callout md-callout-${kind[1].toLowerCase()}` : 'md-callout';
            out.push(`<blockquote class="${cls}">${renderInline(inner)}</blockquote>`);
            continue;
        }

        // Pipe table: `| a | b |\n| --- | --- |\n| 1 | 2 |`
        if (/^\s*\|.+\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}.*\|/.test(lines[i + 1])) {
            const tableStart = i;
            const rows = [];
            while (i < lines.length && /^\s*\|.+\|\s*$/.test(lines[i])) {
                rows.push(lines[i]);
                i++;
            }
            // Not a table after all: give the header line back so the paragraph
            // branch below renders it instead of silently deleting it.
            if (rows.length < 2) i = tableStart;
            if (rows.length >= 2) {
                const splitRow = (r) => r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
                const header = splitRow(rows[0]);
                // rows[1] is the alignment row — skip
                const bodyRows = rows.slice(2).map(splitRow);
                const thead = '<thead><tr>' + header.map(h => `<th>${renderInline(h)}</th>`).join('') + '</tr></thead>';
                const tbody = '<tbody>' + bodyRows.map(r =>
                    '<tr>' + r.map(c => `<td>${renderInline(c)}</td>`).join('') + '</tr>'
                ).join('') + '</tbody>';
                out.push(`<div class="md-table-wrap"><table class="md-table">${thead}${tbody}</table></div>`);
                continue;
            }
        }

        // Unordered list
        if (/^\s*[-*+]\s+/.test(line)) {
            const items = [];
            while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
                items.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
                i++;
            }
            out.push(`<ul class="md-ul">${items.map(t => `<li>${renderInline(t)}</li>`).join('')}</ul>`);
            continue;
        }

        // Ordered list
        if (/^\s*\d+\.\s+/.test(line)) {
            const items = [];
            while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
                items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
                i++;
            }
            out.push(`<ol class="md-ol">${items.map(t => `<li>${renderInline(t)}</li>`).join('')}</ol>`);
            continue;
        }

        // Standalone block-math line
        if (/^\s*\$\$.+\$\$\s*$/.test(line)) {
            out.push(`<div class="md-math-block-line">${renderInline(line.trim())}</div>`);
            i++; continue;
        }

        // Italic-only line — likely a diagram placeholder *Diagram: …*
        if (/^\s*\*[^*]+\*\s*$/.test(line)) {
            out.push(`<div class="md-diagram">${renderInline(line.trim())}</div>`);
            i++; continue;
        }

        // Paragraph — gather consecutive non-empty, non-special lines.
        // The current line is consumed unconditionally. It used to be subject to the
        // same exclusion test as the lines after it, so a pipe-wrapped line that the
        // table branch declined (a header with no separator row, an ASCII box diagram,
        // a truncated drug/dose table) matched nothing, `i` never advanced, and the
        // notes window spun forever with no error. Reproduced on 11 malformed inputs.
        const para = [lines[i]];
        i++;
        while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|>|\s*[-*+]\s|\s*\d+\.\s|\s*-{3,}\s*$|\s*\|.+\|\s*$)/.test(lines[i])) {
            para.push(lines[i]);
            i++;
        }
        out.push(`<p class="md-p">${renderInline(para.join(' '))}</p>`);
    }

    return out.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Download nudge
// ─────────────────────────────────────────────────────────────────────────────

function showDownloadNudge() {
    if (sessionStorage.getItem('dlNudgeDismissed')) return;
    const list = $('list');
    if (!list) return;

    const nudge = document.createElement('div');
    nudge.className = 'dl-nudge';
    nudge.id = 'dlNudge';

    const icon = document.createElement('span');
    icon.className = 'dl-nudge-icon';
    icon.textContent = '💾';

    const body = document.createElement('div');
    body.className = 'dl-nudge-body';
    body.innerHTML = '<strong>Save your notes.</strong> Screenshots are cached in this browser only — download the HTML to keep them permanently, read offline, or share with others.';

    const dlBtn = document.createElement('button');
    dlBtn.className = 'dl-nudge-btn';
    dlBtn.textContent = '⬇ Download';
    dlBtn.addEventListener('click', () => {
        nudge.remove();
        sessionStorage.setItem('dlNudgeDismissed', '1');
        downloadHtml();
    });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'dl-nudge-close';
    closeBtn.setAttribute('aria-label', 'Dismiss');
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => {
        nudge.remove();
        sessionStorage.setItem('dlNudgeDismissed', '1');
    });

    nudge.appendChild(icon);
    nudge.appendChild(body);
    nudge.appendChild(dlBtn);
    nudge.appendChild(closeBtn);
    list.insertBefore(nudge, list.firstChild);
}

// ─────────────────────────────────────────────────────────────────────────────
// Export helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildMarkdown() {
    let md = `# ${_state.title}\n\n`;
    md += `_Generated by Panopto Speed · Gemini 2.0 Flash_\n\n`;
    if (_state.context.viewerUrl) md += `[Open lecture](${_state.context.viewerUrl})\n\n---\n\n`;
    for (const s of _state.sections) {
        md += `## ${s.heading}\n\n${s.content || ''}\n\n`;
    }
    return md;
}

function safeFilename(s) {
    return (s || 'lecture-notes').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 80);
}

// Build a single self-contained .html file: full stylesheet inlined, every
// screenshot already a data URL, and a tiny embedded script that keeps
// click-to-zoom working — no chrome.storage / Panopto dependency.
function buildStandaloneHtml() {
    // Clone the current rendered document
    const docHtml = document.documentElement.outerHTML;
    const doc = new DOMParser().parseFromString(docHtml, 'text/html');

    // Strip extension-only interactive controls.
    // #openLectureBtn (<a>) and .section-shot-link deep-links are intentionally kept —
    // they are real URLs that work in any browser.
    doc.querySelectorAll(
        '#loading, #error, #downloadBtn, #copyBtn, #regrabBtn, #dlNudge, ' +
        '#tabBar, #aiCallout, #chatPanel, #flashcardsPanel, #ankiModal, #confirmModal, script, link[rel="stylesheet"]'
    ).forEach(el => el.remove());

    // Math fallback: the live view used KaTeX's HTML output, which needs the bundled
    // CSS + fonts we just stripped. Show KaTeX's MathML twin instead — the browser
    // renders it natively, so exported notes typeset offline with nothing embedded.
    const mathStyle = doc.createElement('style');
    // Also stop the header's decorative aurora from animating forever in the static
    // archive — the live popup keeps it, but a saved note shouldn't churn the GPU.
    mathStyle.textContent = '.katex-html{display:none!important}.katex{font-size:1.05em}.katex-display{display:block;text-align:center;margin:.6em 0}'
        + '.header::before{animation:none!important}';
    (doc.head || doc.documentElement).appendChild(mathStyle);

    // Make sure the page is visible.
    const page = doc.getElementById('page'); if (page) page.style.display = 'grid';
    const list = doc.getElementById('list'); if (list) list.style.display = 'block';

    // In the static export there are no JS onload handlers to transition tiles from
    // is-loading → is-loaded, so images stay opacity:0 behind their spinners even
    // though the data URLs are fully embedded. Fix: walk every tile and force
    // is-loaded for any img whose src is already a data URL.
    doc.querySelectorAll('.section-shot').forEach(tile => {
        const img = tile.querySelector('.section-shot-img');
        if (img && (img.getAttribute('src') || '').startsWith('data:')) {
            tile.classList.remove('is-loading');
            tile.classList.add('is-loaded');
        }
    });
    // Also clear the row-level is-loading so any per-row banner state is clean.
    doc.querySelectorAll('.section-shot-row').forEach(row => {
        if (row.querySelector('.section-shot.is-loaded')) {
            row.classList.remove('is-loading');
        }
    });

    // Self-contained lightbox + smooth-scroll TOC, no external dependencies.
    const script = doc.createElement('script');
    script.textContent = `
(function () {
    const $ = id => document.getElementById(id);
    const lb = $('lightbox');
    if (lb) {
        const hide = () => { lb.classList.remove('open'); $('lightboxImg').src = ''; };
        const show = (src, ts, label) => {
            $('lightboxImg').src        = src;
            $('lightboxTs').textContent    = ts    || '';
            $('lightboxLabel').textContent = label || '';
            lb.classList.add('open');
        };
        $('lightboxClose').addEventListener('click', e => { e.stopPropagation(); hide(); });
        lb.addEventListener('click', e => { if (e.target === lb) hide(); });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && lb.classList.contains('open')) hide();
        });
        document.querySelectorAll('.section-shot-row').forEach(row => {
            const ts = row.getAttribute('data-ts') || '';
            row.querySelectorAll('.section-shot').forEach(tile => {
                const frame = tile.querySelector('.section-shot-frame');
                const img   = tile.querySelector('.section-shot-img');
                const label = tile.getAttribute('data-label') || '';
                if (!frame || !img || !img.src) return;
                frame.style.cursor = 'zoom-in';
                frame.addEventListener('click', () => show(img.src, ts, label));
            });
        });
    }
    document.querySelectorAll('.toc-link').forEach(a => {
        a.addEventListener('click', e => {
            const id = a.getAttribute('data-target');
            if (!id) return;
            e.preventDefault();
            const el = document.getElementById(id);
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        });
    });
})();
`;
    doc.body.appendChild(script);

    // Add a tiny note in the header sub so the export is obviously not the
    // live extension popup
    const sub = doc.getElementById('header-sub');
    if (sub) sub.textContent = `Saved by Panopto Custom Speed${_state.model ? ' · ' + _state.model : ''} · ${_state.sections.length} sections`;

    return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
}

function downloadHtml() {
    const blob = new Blob([buildStandaloneHtml()], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    chrome.downloads.download({
        url,
        filename: safeFilename(_state.title) + '_notes.html',
        saveAs: true,    // let the user pick where to put it
    }, () => setTimeout(() => URL.revokeObjectURL(url), 5000));
}

async function copyMarkdown() {
    try {
        await navigator.clipboard.writeText(buildMarkdown());
        const btn = $('copyBtn');
        const orig = btn.textContent;
        btn.textContent = '✓ Copied';
        setTimeout(() => { btn.textContent = orig; }, 1500);
    } catch {
        showError('Could not copy to clipboard. Try the Download button.');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI tools: tabs + Chat + Flashcards (premium, built on the same transcript)
// ─────────────────────────────────────────────────────────────────────────────

let _aiToolsReady = false;
const _chatHistory = [];   // { role: 'user' | 'assistant', text }
let _cards = null;

function hideAiPanels() {
    const c = $('chatPanel'); if (c) c.style.display = 'none';
    const f = $('flashcardsPanel'); if (f) f.style.display = 'none';
    const co = $('aiCallout'); if (co) co.style.display = 'none';
}

function setupAiTools() {
    const tabBar = $('tabBar');
    if (tabBar) tabBar.style.display = 'flex';
    const callout = $('aiCallout');
    if (callout) callout.style.display = 'block';
    if (_aiToolsReady) return;
    _aiToolsReady = true;

    const TABS = [
        { btn: 'tabNotes', panel: 'page',            display: 'grid'  },
        { btn: 'tabChat',  panel: 'chatPanel',       display: 'block' },
        { btn: 'tabCards', panel: 'flashcardsPanel', display: 'block' },
    ];
    const switchTab = (activeBtn) => {
        // The Notes view is built lazily — if the user opens "Generate Notes" before
        // notes exist (e.g. they came straight to Flashcards), generate them now.
        if (activeBtn === 'tabNotes' && !_notesGenerated) {
            $('tabNotes').classList.add('active');
            $('tabChat')?.classList.remove('active');
            $('tabCards')?.classList.remove('active');
            const cp = $('chatPanel');       if (cp) cp.style.display = 'none';
            const fp = $('flashcardsPanel'); if (fp) fp.style.display = 'none';
            const u = new URL(location.href); u.searchParams.set('tab', 'notes'); history.replaceState(null, '', u.toString());
            if (!_notesGenerating) generate();
            return;
        }
        // Returning to a tool clears any notes loading/error overlay.
        const ld = $('loading'); if (ld) ld.style.display = 'none';
        const er = $('error');   if (er) er.style.display = 'none';
        TABS.forEach(({ btn, panel, display }) => {
            const on = btn === activeBtn;
            $(btn).classList.toggle('active', on);
            $(panel).style.display = on ? display : 'none';
        });
        // Reflect the active tool in the URL (?tab=) so a refresh restores this view.
        const tabParam = { tabNotes: 'notes', tabChat: 'chat', tabCards: 'cards' }[activeBtn];
        if (tabParam) {
            const u = new URL(location.href);
            u.searchParams.set('tab', tabParam);
            history.replaceState(null, '', u.toString());
        }
        // Once they engage an AI tool, retire the callout + the NEW pulse.
        if (activeBtn !== 'tabNotes') {
            if (callout) callout.style.display = 'none';
            $('tabChat')?.classList.remove('feature');
            $('tabCards')?.classList.remove('feature');
        }
        if (activeBtn === 'tabChat') {
            // Pin the view at the top so the tabs stay visible, size the chat to fit
            // the viewport (its log scrolls internally), and focus without scrolling.
            window.scrollTo({ top: 0 });
            requestAnimationFrame(() => {
                sizeChatPanel();
                $('chatInput')?.focus({ preventScroll: true });
            });
        }
    };
    TABS.forEach(({ btn }) => $(btn).addEventListener('click', () => switchTab(btn)));
    window.addEventListener('resize', sizeChatPanel);

    setupChat();
    setupFlashcards();

    // Deep link from the popup launcher (?tab=): open straight to a tool.
    const wantedTab = new URLSearchParams(location.search).get('tab');
    if (wantedTab === 'chat') {
        switchTab('tabChat');
    } else if (wantedTab === 'cards') {
        switchTab('tabCards');
        loadFlashcards(false);   // auto-generate, matching the "Generate Flashcards" button
    }
}

// Size the chat box to fill from its top to the bottom of the viewport, so the
// conversation scrolls INSIDE it instead of scrolling (and hiding) the whole page.
function sizeChatPanel() {
    const panel = $('chatPanel');
    if (!panel || panel.style.display === 'none') return;
    const wrap = panel.querySelector('.chat-wrap');
    if (!wrap) return;
    const top = wrap.getBoundingClientRect().top;
    wrap.style.height = Math.max(300, window.innerHeight - top - 20) + 'px';
}

// ── Chat ──
// ── Shared per-lecture chat — synced with the in-page chat via chrome.storage, so
//    the same conversation continues across the notes page and the lecture page. ──
function chatStoreKey() {
    const id = _state && _state.context && _state.context.deliveryId;
    return id ? 'pcsChat_' + id : null;
}
function saveSharedChat() {
    const key = chatStoreKey();
    if (!key || typeof chrome === 'undefined' || !chrome.storage) return;
    const ctx = (_state && _state.context) || {};
    try {
        chrome.storage.local.set({ [key]: {
            captions: ctx.captionsCleaned,
            title:    _state.title || ctx.title || '',
            history:  _chatHistory,
            savedAt:  Date.now(),
        } });
    } catch (e) {}
}
function loadSharedChat() {
    const key = chatStoreKey();
    if (!key || typeof chrome === 'undefined' || !chrome.storage) return;
    chrome.storage.local.get(key, (res) => {
        const saved = res && res[key];
        if (!saved || !Array.isArray(saved.history) || !saved.history.length) return;
        _chatHistory.length = 0;
        saved.history.forEach(m => _chatHistory.push(m));
        const log = $('chatLog');
        if (!log) return;
        log.querySelectorAll('.chat-msg').forEach(n => n.remove());   // avoid duplicates
        const empty = $('chatEmpty'); if (empty) empty.style.display = 'none';
        _chatHistory.forEach(m =>
            appendChatMessage(m.role === 'user' ? 'user' : 'bot',
                m.role === 'user' ? escapeHtml(m.text) : renderMarkdown(m.text)));
    });
}

function setupChat() {
    const input = $('chatInput');
    const send  = $('chatSend');
    if (!input || !send) return;

    const autoGrow = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 140) + 'px'; };
    input.addEventListener('input', autoGrow);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
    });
    send.addEventListener('click', sendChat);

    loadSharedChat();   // restore a conversation started here or on the lecture page
}

function appendChatMessage(role, html, pending) {
    const log   = $('chatLog');
    const empty = $('chatEmpty');
    if (empty) empty.style.display = 'none';
    const div = document.createElement('div');
    div.className = 'chat-msg ' + (role === 'user' ? 'user' : 'bot') + (pending ? ' pending' : '');
    div.innerHTML = html;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
}

function chatErrorText(code) {
    if (code === 'not_premium')      return 'Chat is a premium feature. Get Premium to unlock it.';
    if (code === 'budget_exceeded')  return "You've used your AI allowance for this month. It resets on the 1st.";
    if (code === 'free_ai_exhausted') return "Today's free AI capacity is used up. It resets overnight.";
    if (code === 'rate_limited')     return "You've hit today's chat limit. It resets at midnight UTC.";
    if (code === 'caption_too_long') return 'This lecture is too long for chat.';
    if (code === 'bad_input')        return 'Please ask a shorter question.';
    if (code === 'Unauthorized')     return 'Your sign-in expired. Open the extension popup and sign in again.';
    return "The AI couldn't answer that. Please try again.";
}

async function sendChat() {
    const input = $('chatInput');
    const send  = $('chatSend');
    const hint  = $('chatHint');
    const q = (input.value || '').trim();
    if (!q) return;

    const ctx = _state?.context || {};
    if (!ctx.email || !ctx.authToken) { if (hint) hint.textContent = 'Sign in via the extension popup to use chat.'; return; }

    // Snapshot the conversation BEFORE this turn — the server appends `question`
    // itself, so sending it inside history too would duplicate it.
    const priorHistory = _chatHistory.slice(-12);

    input.value = '';
    input.style.height = 'auto';
    appendChatMessage('user', escapeHtml(q));
    _chatHistory.push({ role: 'user', text: q });

    send.disabled = true;
    if (hint) hint.textContent = '';
    const pending = appendChatMessage('bot', 'Thinking…', true);

    try {
        const res = await fetch(`${BACKEND}/askLecture`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token:           ctx.authToken,
                email:           ctx.email,
                captionsCleaned: ctx.captionsCleaned,
                question:        q,
                history:         priorHistory,
                lang:            ctx.lang || 'en',
                title:           _state.title || ctx.title || '',
            }),
        });
        const data = await res.json().catch(() => ({}));
        pending.classList.remove('pending');
        if (!res.ok || !data.answer) {
            pending.innerHTML = escapeHtml(chatErrorText(data.error));
            _chatHistory.pop();   // drop the unanswered turn so it doesn't poison context
        } else {
            pending.innerHTML = renderMarkdown(data.answer);
            _chatHistory.push({ role: 'assistant', text: data.answer });
            if (hint) {
                if (data.unlimited) hint.textContent = '⚡ Unlimited usage';
                else if (data.used && data.limit) hint.textContent = `${Math.max(0, data.limit - data.used)} messages left today`;
            }
        }
    } catch {
        pending.classList.remove('pending');
        pending.innerHTML = escapeHtml('Network error — please try again.');
        _chatHistory.pop();
    } finally {
        send.disabled = false;
        $('chatLog').scrollTop = $('chatLog').scrollHeight;
        saveSharedChat();   // keep the shared conversation in sync
    }
}

// ── Flashcards ──
function setupFlashcards() {
    $('genCardsBtn')?.addEventListener('click', () => loadFlashcards(false));
    $('cardsRegenBtn')?.addEventListener('click', () => loadFlashcards(true));
    $('cardsRevealBtn')?.addEventListener('click', revealAllCards);
    $('cardsExportBtn')?.addEventListener('click', exportCards);
    $('cardsExportHtmlBtn')?.addEventListener('click', exportCardsHtml);

    // Anki export — choice modal + "select cards" mode
    $('ankiModalClose')?.addEventListener('click', closeAnkiModal);
    $('ankiModal')?.addEventListener('click', (e) => { if (e.target === $('ankiModal')) closeAnkiModal(); });
    $('ankiAllBtn')?.addEventListener('click', () => { closeAnkiModal(); downloadApkg(_cards, $('cardsExportBtn')); });
    $('ankiSelectBtn')?.addEventListener('click', () => { closeAnkiModal(); enterSelectMode(); });
    $('cardsSelAll')?.addEventListener('click', toggleSelectAll);
    $('cardsSelCancel')?.addEventListener('click', exitSelectMode);
    $('cardsSelExport')?.addEventListener('click', exportSelectedCards);

    // Regenerate-one confirmation + "generate another card"
    $('confirmNoBtn')?.addEventListener('click', () => $('confirmModal')?.classList.remove('open'));
    $('confirmYesBtn')?.addEventListener('click', () => doRegenerate(_regenIdx));
    $('confirmModal')?.addEventListener('click', (e) => { if (e.target === $('confirmModal')) $('confirmModal').classList.remove('open'); });
    $('cardsAddBtn')?.addEventListener('click', generateAnotherCard);
    $('cardsAddTopic')?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.repeat) { e.preventDefault(); generateAnotherCard(); } });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { closeAnkiModal(); $('confirmModal')?.classList.remove('open'); }
    });
}

function flashErrorText(code) {
    if (code === 'not_premium')      return 'Flashcards are a premium feature. Get Premium to unlock them.';
    if (code === 'budget_exceeded')  return "You've used your AI allowance for this month. It resets on the 1st.";
    if (code === 'free_ai_exhausted') return "Today's free AI capacity is used up. It resets overnight.";
    if (code === 'rate_limited')     return "You've hit today's flashcard limit. It resets at midnight UTC.";
    if (code === 'caption_too_long') return 'This lecture is too long to make flashcards from.';
    if (code === 'Unauthorized')     return 'Your sign-in expired. Open the extension popup and sign in again.';
    return "Couldn't generate flashcards right now. Please try again.";
}

async function loadFlashcards(regen) {
    const ctx     = _state?.context || {};
    const intro   = $('cardsIntro');
    const deck    = $('cardsDeck');
    const toolbar = $('cardsToolbar');

    if (!ctx.email || !ctx.authToken) { intro.style.display = 'block'; intro.innerHTML = '<p>Sign in via the extension popup to generate flashcards.</p>'; return; }

    intro.style.display = 'block';
    intro.innerHTML = `<p>✨ ${regen ? 'Regenerating' : 'Generating'} flashcards… this takes a few seconds.</p>`;
    deck.innerHTML = '';
    toolbar.style.display = 'none';
    const addRow = $('cardsAdd'); if (addRow) addRow.style.display = 'none';
    const msgEl  = $('cardsMsg'); if (msgEl) msgEl.style.display = 'none';

    const fail = (code) => {
        intro.style.display = 'block';
        intro.innerHTML = `<p>${escapeHtml(flashErrorText(code))}</p><button id="genCardsRetry" class="cards-gen-btn">Try again</button>`;
        $('genCardsRetry')?.addEventListener('click', () => loadFlashcards(false));
    };

    try {
        const res = await fetch(`${BACKEND}/flashcards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token:           ctx.authToken,
                email:           ctx.email,
                captionsCleaned: ctx.captionsCleaned,
                lang:            ctx.lang || 'en',
                title:           _state.title || ctx.title || '',
                regen:           !!regen,
            }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !Array.isArray(data.cards) || !data.cards.length) return fail(data.error);
        _cards = data.cards;
        renderCards(_cards);
        intro.style.display = 'none';
        toolbar.style.display = 'flex';
        const addRow = $('cardsAdd'); if (addRow) addRow.style.display = 'flex';
        const reveal = $('cardsRevealBtn'); if (reveal) reveal.textContent = '👁 Reveal all';
    } catch {
        fail('network');
    }
}

function renderCards(cards) {
    const deck = $('cardsDeck');
    deck.classList.remove('selecting');   // reset any prior "select cards" mode
    deck.innerHTML = '';
    cards.forEach((c, i) => deck.appendChild(createFlashcardEl(c, i)));
}

// Build one flip card: front (question) + back (answer), each with a footer
// (Flip · Regenerate), plus a selection checkbox used by "Select cards" mode.
function createFlashcardEl(c, i) {
    const card = document.createElement('div');
    card.className = 'flashcard';
    card.dataset.idx = i;

    const inner = document.createElement('div');
    inner.className = 'fc-inner';

    const front = document.createElement('div');
    front.className = 'fc-face fc-front';
    front.append(fcChip('Card ' + (i + 1)), fcBody('fc-q', c.question), fcFooter(card));

    const back = document.createElement('div');
    back.className = 'fc-face fc-back';
    back.append(fcChip('Answer'), fcBody('fc-a', c.answer), fcFooter(card));

    inner.append(front, back);
    card.appendChild(inner);

    // Selection checkbox — only shown in "Select cards" mode (outside .fc-inner so it
    // never flips). Clicking it selects, not flips.
    const check = document.createElement('button');
    check.className = 'fc-check';
    check.type = 'button';
    check.setAttribute('aria-label', 'Include this card in the Anki deck');
    check.addEventListener('click', (e) => {
        e.stopPropagation();
        card.classList.toggle('selected');
        updateSelCount();
    });
    card.appendChild(check);

    card.addEventListener('click', () => card.classList.toggle('flipped'));
    return card;
}

function fcChip(text) {
    const d = document.createElement('div');
    d.className = 'fc-num';
    d.textContent = text;
    return d;
}
function fcBody(cls, md) {
    const d = document.createElement('div');
    d.className = cls;
    d.innerHTML = renderMarkdown(md);
    return d;
}
// Footer: "Flip" (bottom-left) + "Regenerate" (bottom-right). Each stops the card's
// own click-to-flip so it acts on its own.
function fcFooter(card) {
    const foot = document.createElement('div');
    foot.className = 'fc-foot';

    const flip = document.createElement('button');
    flip.type = 'button';
    flip.className = 'fc-btn fc-flip';
    flip.innerHTML = '🔄 Flip';
    flip.addEventListener('click', (e) => { e.stopPropagation(); card.classList.toggle('flipped'); });

    const regen = document.createElement('button');
    regen.type = 'button';
    regen.className = 'fc-btn fc-regen';
    regen.innerHTML = '♻ Regenerate';
    regen.addEventListener('click', (e) => { e.stopPropagation(); askRegenerate(+card.dataset.idx); });

    foot.append(flip, regen);
    return foot;
}

// ── Single-card: regenerate one, or add one more ─────────────────────────────
let _regenIdx = null;
let _cardOpBusy = false;   // shared guard: only one single-card op (regen/add) at a time

function askRegenerate(idx) {
    if (_cardOpBusy || idx == null || Number.isNaN(idx) || !_cards?.[idx]) return;
    _regenIdx = idx;
    $('confirmModal')?.classList.add('open');
}

// Maps an error (by HTTP status, then by backend code) to a clean user message —
// never surfaces the raw error.
function cardOpErrText(err) {
    const status = err && err.status;
    const code   = err && err.message;
    if (status === 401 || code === 'Unauthorized')     return 'Your sign-in expired. Reopen the extension popup and sign in again.';
    if (status === 403 || code === 'not_premium')      return 'Flashcards are a premium feature. Get Premium to unlock them.';
    // budget_exceeded is checked before rate_limited: both arrive as 429, but the
    // monthly-allowance message is the accurate one when the server sent that code.
    if (code === 'budget_exceeded')                    return "You've used your AI allowance for this month. It resets on the 1st.";
    if (code === 'free_ai_exhausted')                  return "Today's free AI capacity is used up. It resets overnight.";
    if (status === 429 || code === 'rate_limited')     return "You've hit today's flashcard limit. It resets at midnight UTC.";
    if (status === 413 || code === 'caption_too_long') return 'This lecture is too long to generate cards from.';
    return "Couldn't generate a card right now. Please try again.";
}

function showCardsMsg(text) {
    const el = $('cardsMsg');
    if (!el) return;
    el.textContent = text;
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.display = 'none'; }, 3800);
}

// POST one new card to the backend — distinct from the current deck, optional topic.
async function fetchOneCard(topic) {
    const ctx = _state?.context || {};
    const res = await fetch(`${BACKEND}/flashcard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            token:           ctx.authToken,
            email:           ctx.email,
            captionsCleaned: ctx.captionsCleaned,
            lang:            ctx.lang || 'en',
            title:           _state.title || ctx.title || '',
            existing:        (_cards || []).map((c) => c.question),
            topic:           topic || '',
        }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.card || typeof data.card.question !== 'string') {
        const err = new Error(data.error || 'failed');
        err.status = res.status;
        throw err;
    }
    return data.card;
}

async function doRegenerate(idx) {
    $('confirmModal')?.classList.remove('open');
    if (_cardOpBusy || idx == null || !_cards?.[idx]) return;
    _cardOpBusy = true;
    const cardEl = $('cardsDeck')?.querySelector(`.flashcard[data-idx="${idx}"]`);
    if (cardEl) cardEl.classList.add('regenerating');
    try {
        const card = await fetchOneCard('');   // a fresh card, different from the whole deck
        _cards[idx] = card;
        const fresh = createFlashcardEl(card, idx);
        if (cardEl) cardEl.replaceWith(fresh); else renderCards(_cards);
    } catch (e) {
        if (cardEl) cardEl.classList.remove('regenerating');
        showCardsMsg(cardOpErrText(e));
    } finally {
        _cardOpBusy = false;
    }
}

async function generateAnotherCard() {
    if (_cardOpBusy || !Array.isArray(_cards)) return;
    _cardOpBusy = true;
    const btn     = $('cardsAddBtn');
    const topicEl = $('cardsAddTopic');
    const topic   = topicEl ? topicEl.value.trim() : '';
    const orig    = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Generating…'; }
    if (topicEl) topicEl.disabled = true;
    try {
        const card = await fetchOneCard(topic);
        const idx = _cards.length;
        _cards.push(card);
        const el = createFlashcardEl(card, idx);
        $('cardsDeck')?.appendChild(el);
        if (topicEl) topicEl.value = '';
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) {
        showCardsMsg(cardOpErrText(e));
    } finally {
        _cardOpBusy = false;
        if (btn) { btn.disabled = false; btn.textContent = orig; }
        if (topicEl) topicEl.disabled = false;
    }
}

function revealAllCards() {
    const deck = $('cardsDeck');
    const anyUnflipped = !!deck.querySelector('.flashcard:not(.flipped)');
    deck.querySelectorAll('.flashcard').forEach((card) => card.classList.toggle('flipped', anyUnflipped));
    $('cardsRevealBtn').textContent = anyUnflipped ? '🙈 Flip all back' : '👁 Reveal all';
}

// Export the deck as a genuine Anki package (.apkg) — a real Anki collection
// (note type + deck + one card per flashcard) that imports via Anki's File → Import.
// Markdown becomes HTML and math becomes MathJax (\(…\)), which Anki renders
// natively. The package is built in-page by anki-export.js (sql.js + fflate).
function exportCards() {
    if (!_cards?.length) return;
    // Prompt: export all cards, or hand-pick a subset.
    const cnt = $('ankiAllCount');
    if (cnt) cnt.textContent = `Export the whole deck (${_cards.length} card${_cards.length === 1 ? '' : 's'})`;
    $('ankiModal')?.classList.add('open');
}

function closeAnkiModal() { $('ankiModal')?.classList.remove('open'); }

// Build + download an .apkg from a given set of cards, with button busy/error states.
async function downloadApkg(cards, btn) {
    if (!Array.isArray(cards) || !cards.length) return;
    const orig = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Building deck…'; }
    try {
        const bytes = await buildApkg({ title: _state.title || 'Flashcards', cards });
        const blob  = new Blob([bytes], { type: 'application/octet-stream' });
        const url   = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = safeFilename(_state.title) + '.apkg';
        document.body.appendChild(a);
        a.click();
        a.remove();
        // The .apkg download is the conversion event that matters for this audience,
        // and it logged nothing — so the dashboard could not tell an Anki user from a
        // chat user. Fire-and-forget; a failure here must never touch the download.
        try {
            const c = (_state && _state.context) || {};
            if (c.email && c.authToken) {
                fetch(`${BACKEND}/logPremiumFeature`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: c.authToken, email: c.email, featureClicked: 'anki_export' }),
                }).catch(() => {});
            }
        } catch {}
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        if (btn) { btn.disabled = false; btn.textContent = orig; }
    } catch {
        // Never surface raw build errors to the console or UI — a clean message only.
        if (btn) {
            btn.textContent = '⚠ Export failed';
            setTimeout(() => { btn.disabled = false; btn.textContent = orig; }, 3000);
        }
    }
}

// ── "Select cards" mode ──────────────────────────────────────────────────────
function enterSelectMode() {
    const deck = $('cardsDeck');
    if (!deck) return;
    deck.classList.add('selecting');
    // Start with everything selected — easier to trim a few than to pick many.
    deck.querySelectorAll('.flashcard').forEach((c) => c.classList.add('selected'));
    const tb = $('cardsToolbar'); if (tb) tb.style.display = 'none';
    const add = $('cardsAdd');    if (add) add.style.display = 'none';
    const sb = $('cardsSelBar');  if (sb) sb.style.display = 'flex';
    updateSelCount();
}

function exitSelectMode() {
    const deck = $('cardsDeck');
    if (deck) {
        deck.classList.remove('selecting');
        deck.querySelectorAll('.flashcard.selected').forEach((c) => c.classList.remove('selected'));
    }
    const sb = $('cardsSelBar');  if (sb) sb.style.display = 'none';
    const tb = $('cardsToolbar'); if (tb) tb.style.display = 'flex';
    const add = $('cardsAdd');    if (add) add.style.display = 'flex';
}

function updateSelCount() {
    const deck = $('cardsDeck');
    if (!deck) return;
    const total = deck.querySelectorAll('.flashcard').length;
    const n     = deck.querySelectorAll('.flashcard.selected').length;
    const lbl = $('cardsSelCount');  if (lbl) lbl.textContent = `${n} of ${total} selected`;
    const exp = $('cardsSelExport'); if (exp) exp.disabled = n === 0;
    const all = $('cardsSelAll');    if (all) all.textContent = (n === total && total > 0) ? 'Clear all' : 'Select all';
}

function toggleSelectAll() {
    const deck = $('cardsDeck');
    if (!deck) return;
    const cards = [...deck.querySelectorAll('.flashcard')];
    const selectAll = deck.querySelectorAll('.flashcard.selected').length < cards.length;
    cards.forEach((c) => c.classList.toggle('selected', selectAll));
    updateSelCount();
}

async function exportSelectedCards() {
    const deck = $('cardsDeck');
    if (!deck) return;
    const cards = [...deck.querySelectorAll('.flashcard.selected')]
        .map((el) => _cards[+el.dataset.idx])
        .filter(Boolean);
    if (!cards.length) return;
    await downloadApkg(cards, $('cardsSelExport'));
    exitSelectMode();
}

// Download a self-contained, clickable flashcard page (.html). Math renders via
// KaTeX's MathML twin (no fonts needed); click a card to flip, button reveals all.
function exportCardsHtml() {
    if (!_cards?.length) return;
    const title = _state.title || 'Flashcards';
    const cardsHtml = _cards.map((c, i) => `
      <div class="fc" onclick="this.classList.toggle('show')">
        <div class="fc-n">Card ${i + 1}</div>
        <div class="fc-q">${renderMarkdown(c.question)}</div>
        <div class="fc-a">${renderMarkdown(c.answer)}</div>
        <div class="fc-hint">Click to flip</div>
      </div>`).join('');

    const doc = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} — Flashcards</title>
<style>
  body{margin:0;background:#0d1117;color:#e6edf3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:24px;}
  .wrap{max-width:920px;margin:0 auto;}
  h1{font-size:1.3rem;margin:0 0 4px;}
  .sub{color:#8b949e;font-size:0.85rem;margin-bottom:16px;}
  .bar button{background:#11773D;color:#fff;border:none;border-radius:8px;padding:8px 14px;font-weight:700;font-size:0.85rem;cursor:pointer;margin-bottom:16px;}
  .deck{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;}
  .fc{background:#161b22;border:1px solid #262e38;border-radius:12px;padding:16px;cursor:pointer;min-height:120px;display:flex;flex-direction:column;gap:8px;transition:border-color .15s;}
  .fc:hover{border-color:#22c55e;}
  .fc-n{font-size:0.65rem;text-transform:uppercase;letter-spacing:0.08em;color:#6e7681;font-weight:700;}
  .fc-q{font-weight:700;font-size:0.95rem;line-height:1.5;}
  .fc-a{color:#c2cad3;font-size:0.9rem;line-height:1.6;border-top:1px dashed #262e38;padding-top:8px;display:none;}
  .fc.show .fc-a{display:block;}
  .fc-hint{margin-top:auto;color:#6e7681;font-size:0.72rem;}
  .fc.show .fc-hint{color:#22c55e;}
  .katex-html{display:none!important;} .katex{font-size:1.02em;} .katex-display{display:block;text-align:center;margin:.5em 0;}
  code{background:#0d1117;padding:1px 5px;border-radius:4px;font-family:'SF Mono',Consolas,monospace;}
  ul,ol{margin:5px 0;padding-left:20px;}
</style></head><body><div class="wrap">
  <h1>${escapeHtml(title)}</h1>
  <div class="sub">${_cards.length} flashcards · generated by Panopto Custom Speed</div>
  <div class="bar"><button onclick="document.querySelectorAll('.fc').forEach(function(c){c.classList.toggle('show');});">Reveal / hide all</button></div>
  <div class="deck">${cardsHtml}</div>
</div></body></html>`;

    const blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeFilename(_state.title) + '_flashcards.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
