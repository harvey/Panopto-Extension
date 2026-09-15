// silence-tap.js — runs in the page's own JavaScript world (manifest "world":
// "MAIN") so it can see the bytes Panopto's player downloads. It changes no
// request and no response. Every fragmented-MP4 response the player receives
// (the init segment and each media segment) is copied and handed to the
// extension's content script, which builds the silence map from the audio
// track. That is what lets the Silence Skipper know where the quiet parts are
// without streaming the lecture a second time.
(function () {
    'use strict';
    if (window.__pcsTapInstalled) return;
    window.__pcsTapInstalled = true;

    const MP4_TYPES = { ftyp: 1, styp: 1, moof: 1, sidx: 1, moov: 1 };
    const looksLikeMp4 = (buf) => {
        if (!buf || buf.byteLength < 16) return false;
        const b = new Uint8Array(buf, 0, 8);
        return !!MP4_TYPES[String.fromCharCode(b[4], b[5], b[6], b[7])];
    };
    const rangeStart = (h) => { const m = /bytes=(\d+)-/.exec(h || ''); return m ? +m[1] : null; };
    const post = (url, buf, range) => {
        if (/#pcs-own$/.test(String(url || ''))) return;   // the extension's own audio-only fetches
        try {
            const copy = buf.slice(0);
            window.postMessage({ __pcs: 'media-seg', url: String(url || ''), rangeStart: range, bytes: copy }, '*', [copy]);
        } catch (e) {}
    };

    // XMLHttpRequest — what hls.js and most players use for segments.
    try {
        const P = XMLHttpRequest.prototype;
        const open = P.open, send = P.send, setHeader = P.setRequestHeader;
        P.open = function (method, url) { try { this.__pcsUrl = String(url); this.__pcsRange = null; } catch (e) {} return open.apply(this, arguments); };
        P.setRequestHeader = function (name, value) { try { if (String(name).toLowerCase() === 'range') this.__pcsRange = rangeStart(value); } catch (e) {} return setHeader.apply(this, arguments); };
        P.send = function () {
            try {
                this.addEventListener('load', () => {
                    try {
                        if (this.responseType === 'arraybuffer' && looksLikeMp4(this.response)) {
                            post(this.__pcsUrl || this.responseURL, this.response, this.__pcsRange);
                        }
                    } catch (e) {}
                });
            } catch (e) {}
            return send.apply(this, arguments);
        };
    } catch (e) {}

    // fetch — for players that use it instead. Only media-looking URLs are cloned.
    try {
        const F = window.fetch;
        window.fetch = function (input, init) {
            const p = F.apply(this, arguments);
            try {
                const url = typeof input === 'string' ? input : (input && input.url) || '';
                if (/\.(mp4|m4s|m4a|m4v|cmfa|cmfv)(\?|$)/i.test(url)) {
                    let range = null;
                    try {
                        const h = (init && init.headers) || (input && input.headers);
                        if (h) range = rangeStart(typeof h.get === 'function' ? h.get('Range') : (h.Range || h.range));
                    } catch (e) {}
                    p.then((res) => {
                        try { res.clone().arrayBuffer().then((buf) => { if (looksLikeMp4(buf)) post(url, buf, range); }).catch(() => {}); } catch (e) {}
                    }).catch(() => {});
                }
            } catch (e) {}
            return p;
        };
    } catch (e) {}
})();
