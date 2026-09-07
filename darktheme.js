// Runs at document_start so the dark theme is painted from the very first frame —
// no white flash on load/refresh. Reads the page-local mirror of the setting that
// content.js keeps in sync from chrome.storage.
(function () {
    try {
        if (localStorage.getItem('pcsDarkTheme') !== '1') return;
        // Embed.aspx (LMS embeds) is dark by design - inverting it makes it light.
        if (/\/Pages\/Embed\.aspx/i.test(location.pathname)) return;
        const s = document.createElement('style');
        s.id = '__pcs-dark-page__';
        // Luminance invert keeps every bit of text readable; media + our own injected
        // UI are inverted back so they look normal. The rules after the first two give
        // Panopto's known surfaces pre-filter colours that invert onto a designed dark
        // palette instead of pure black. Identical to PCS_DARK_CSS in content.js.
        s.textContent =
        'html{background:#ececec!important;filter:invert(1) hue-rotate(180deg)!important}' +
        'img,video,canvas,iframe,embed,object,picture,[style*="background-image"],#__pcs-chat__,#__pcs-chapters__,#__pcs-chap-tip__,.__pcs-chap-tick__,#__pcs-dub__,#__pcs-dub-bar__,.__pcs-nudge,.__pcs-coach,.__pcs-hold-hud,#__panopto-ext-shot-overlay__{filter:invert(1) hue-rotate(180deg)!important}' +
        'body,.viewer,#viewer,#viewerContent,#rightPane,#eventTabPanes,.event-pane,.modal-wrapper,.event-tab-spinner,#leftPane .index-event.unseekable:hover{background-color:#ececec!important}' +
        '#viewerHeader,#viewerHeader #revertButton,#eventTabs,#playControls,#transportControls,.thumbnail-strip,#rightPane .secondaryPlayer,.slide-deck,.event-input-options{background-color:#e4e4e4!important}' +
        'input,select,textarea,#volumeFlyout,#secondaryExpander,#secondaryLayoutExpander,.edit-event-menu,.speech-bubble,#importAudioDescriptionsPopup,#slideStackExpandedView{background-color:#dcdcdc!important;color:#292929!important}' +
        '#editDeliveryTitle input:not(:focus),.event-name input:not(:focus){background-color:transparent!important}' +
        '.letterbox,#copyrightNoticeContainer{background-color:#fff!important}' +
        '.thumbnail-strip{box-shadow:none!important}' +
        '.edit-event-menu,#importAudioDescriptionsPopup,#absoluteControls .fullscreen-controls #transportControls{box-shadow:rgba(255,255,255,.4) 0 1px 6px 0!important}' +
        '.branded-button,.accent-background,.safety-background,#elapsedBar,#volumeLevel,#searchHighlight,#hoverTick,.spinner-background{background-color:#6db07c!important;border-color:#6db07c!important}' +
        '.branded-button:hover{background-color:#439756!important;border-color:#439756!important}' +
        '.branded-button:active{background-color:#197e30!important;border-color:#197e30!important}' +
        '.branded-button,.branded-button *{color:#0d0d0d!important}';
        (document.head || document.documentElement).appendChild(s);
    } catch (e) {}
})();
