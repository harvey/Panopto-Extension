// welcome.html — opened once on install. One job: get the person to a lecture.
(function () {
    'use strict';
    const input = document.getElementById('uni');
    const btn   = document.getElementById('findBtn');
    const go = () => {
        const uni = (input.value || '').trim();
        // A pasted Panopto address (or a bare host like monash.au.panopto.com) opens
        // directly. Anything else is a web search for "<university> panopto", which
        // finds the institution's host far more reliably than guessing the subdomain:
        // monash.au.panopto.com, ox.cloud.panopto.eu, utexas.hosted.panopto.com...
        const m = uni.match(/([a-z0-9-]+\.)+panopto\.(com|eu)/i);
        if (m) { chrome.tabs.create({ url: 'https://' + m[0] + '/' }); return; }
        const q = uni ? `${uni} panopto` : 'my university panopto login';
        chrome.tabs.create({ url: 'https://www.google.com/search?q=' + encodeURIComponent(q) });
    };
    btn.addEventListener('click', go);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    document.getElementById('freeBtn')?.addEventListener('click', (e) => { e.preventDefault(); input.focus(); input.scrollIntoView({ behavior: 'smooth', block: 'center' }); });

    // Feature demos: if a self-recorded clip exists at media/<name>.mp4 it plays in
    // place of the CSS mock-up. Drop the files in and nothing else needs changing.
    document.querySelectorAll('.demo[data-video]').forEach((demo) => {
        const video = demo.querySelector('video');
        if (!video) return;
        video.addEventListener('loadeddata', () => { demo.classList.add('has-video'); video.play().catch(() => {}); });
        video.addEventListener('error', () => { demo.classList.remove('has-video'); });
        video.src = chrome.runtime.getURL(demo.dataset.video);
        video.load();
    });
    input.focus();

    // ── Read-receipts ──────────────────────────────────────────────────────
    // Anonymous, keyed by the uninstall-survey uid: open, scrolled past halfway,
    // clicked "find my Panopto", clicked a pricing button, and seconds on page.
    // Shown on /admin/churn under "Welcome page".
    const BACKEND = 'https://panopto-stripe.harveychandler235.workers.dev';
    const t0 = Date.now();
    const sent = new Set();
    let uid = '';
    const send = (event, extra) => {
        if (!uid) return;
        if (event !== 'dwell') { if (sent.has(event)) return; sent.add(event); }
        const body = JSON.stringify(Object.assign({ uid, event }, extra || {}));
        try {
            if (event === 'dwell' && navigator.sendBeacon) {
                navigator.sendBeacon(BACKEND + '/welcome', new Blob([body], { type: 'application/json' }));
            } else {
                fetch(BACKEND + '/welcome', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
            }
        } catch (e) {}
    };
    chrome.storage.local.get('userId', (r) => { uid = (r && r.userId) || ''; send('open'); });
    window.addEventListener('scroll', () => {
        if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight * 0.5) send('scroll');
    }, { passive: true });
    btn.addEventListener('click', () => send('find'));
    document.querySelectorAll('a[href*="buy.stripe.com"]').forEach((a) => {
        a.addEventListener('click', () => send(/eVqdR1dxweKu8Wt3Ig1VK05/.test(a.href) ? 'year' : 'trial'));
    });
    let dwellSent = false;
    const dwell = () => { if (dwellSent) return; dwellSent = true; send('dwell', { seconds: Math.round((Date.now() - t0) / 1000) }); };
    window.addEventListener('pagehide', dwell);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') dwell(); });
})();
