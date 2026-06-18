// Runs at document_start so the dark theme is painted from the very first frame —
// no white flash on load/refresh. Reads the page-local mirror of the setting that
// content.js keeps in sync from chrome.storage.
(function () {
    try {
        if (localStorage.getItem('pcsDarkTheme') !== '1') return;
        const s = document.createElement('style');
        s.id = '__pcs-dark-page__';
        // Luminance invert keeps every bit of text readable; media + our own injected
        // UI are inverted back so they look normal.
        s.textContent =
            'html{background:#fff!important;filter:invert(1) hue-rotate(180deg)!important}' +
            'img,video,canvas,iframe,embed,object,picture,[style*="background-image"],' +
            '#__pcs-chat__,#__pcs-chapters__,#__pcs-chap-tip__,.__pcs-chap-tick__' +
            '{filter:invert(1) hue-rotate(180deg)!important}';
        (document.head || document.documentElement).appendChild(s);
    } catch (e) {}
})();
