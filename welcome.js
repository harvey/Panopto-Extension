// welcome.html — opened once on install. One job: get the person to a lecture.
(function () {
    'use strict';
    const input = document.getElementById('uni');
    const btn   = document.getElementById('findBtn');
    const go = () => {
        const uni = (input.value || '').trim();
        // A web search finds the institution's Panopto host far more reliably than
        // guessing the subdomain: "monash panopto" → monash.au.panopto.com.
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
})();
