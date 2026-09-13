// notes-pdf.js — our own "Save as PDF" for the AI notes.
//
// Why not window.print()? Chrome's print path drops background colours, forces
// its own margins/headers, needs the user to pick "Save as PDF" in a dialog, and
// breaks pages wherever it likes. GoodNotes users want the opposite: one slide
// per page with the notes under it, colours as designed, one click.
//
// How it works — no PDF library:
//   1. Each page is laid out as ordinary HTML using the notes page's own
//      stylesheet (so callouts, tables, code and KaTeX look exactly like the
//      live view) with the palette swapped to paper colours.
//   2. The page is measured in a hidden host, then rasterised by wrapping it in
//      an SVG <foreignObject> (data: URL — Chrome does not taint the canvas for
//      that) and drawing it onto a canvas at 2x.
//   3. Each canvas becomes a JPEG inside a hand-written PDF (one image XObject
//      per page, DCTDecode), with an outline (bookmarks) per chapter.
//
// Pages have variable height: A4 width, and as tall as the content needs
// (minimum A4). GoodNotes/Notability/Preview handle that fine and it means a long
// section is never cut mid-sentence.
//
// Which image becomes the page's slide: every screenshot row has one or more
// sources (Slides/Screen/Main/Camera). A source is a "slide" if its label says
// so, or if it looks like one (a flat, few-colour frame). A webcam frame — the
// lecturer's face — never gets a page of its own: if a chapter has no slide at
// all, its first frame is shown as a small inset beside the title instead.

(function (global) {
    'use strict';

    const PAGE_W   = 595;   // A4 portrait width in points (1 CSS px = 1 pt here)
    const PAGE_MIN = 842;   // A4 height; pages grow past this if the content needs it
    const SCALE    = 2;     // raster scale — 2x is crisp on tablets without huge files
    const JPEG_Q   = 0.88;

    // ── Paper palette + layout for the rendered page ─────────────────────────
    // Redefines the notes page's CSS variables so every existing `.md` rule
    // (callouts, code, tables, maths) renders for white paper.
    const PAPER_CSS = `
      :root, .pdf-page {
        --bg:#ffffff; --bg-soft:#ffffff; --surface:#f6f8fa; --surface2:#eef1f4;
        --border:#d0d7de; --border-soft:#e5e9ee; --text:#111827; --text-soft:#1f2937;
        --muted:#4b5563; --muted-soft:#6b7280; --green:#15803d; --green-bright:#15803d;
        --accent:#1d4ed8; --amber:#b45309; --rose:#be185d; --violet:#6d28d9; --teal:#0f766e; --red:#b91c1c;
      }
      .pdf-page, .pdf-page * { animation: none !important; transition: none !important; }
      .pdf-page {
        box-sizing: border-box; width: ${PAGE_W}px; min-height: ${PAGE_MIN}px; background: #fff; color: var(--text);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
        font-size: 12.5px; line-height: 1.6; padding: 36px 40px 44px; position: relative;
        -webkit-font-smoothing: antialiased;
      }
      .pdf-page *, .pdf-page *::before, .pdf-page *::after { box-sizing: border-box; }
      .pdf-eyebrow { display: flex; align-items: center; gap: 8px; font-size: 9px; font-weight: 800; letter-spacing: .12em;
                     text-transform: uppercase; color: #15803d; margin-bottom: 6px; }
      .pdf-eyebrow .dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; }
      .pdf-eyebrow .sep { color: #9ca3af; font-weight: 600; letter-spacing: 0; }
      .pdf-eyebrow .lec { color: #6b7280; font-weight: 600; letter-spacing: .04em; text-transform: none; margin-left: auto;
                          max-width: 46%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .pdf-title { font-size: 22px; font-weight: 800; letter-spacing: -.015em; line-height: 1.2; color: #0b1220; margin: 0 0 14px; }
      .pdf-title.cont { font-size: 16px; color: #374151; font-weight: 700; }
      .pdf-slide { margin: 0 0 16px; }
      .pdf-slide .frame { border: 1px solid #d0d7de; border-radius: 10px; overflow: hidden; background: #f3f4f6;
                          box-shadow: 0 1px 0 rgba(0,0,0,.03); }
      .pdf-slide img { display: block; width: 100%; height: auto; }
      .pdf-slide figcaption { display: flex; gap: 8px; align-items: center; font-size: 9.5px; color: #6b7280; margin-top: 6px;
                              font-variant-numeric: tabular-nums; }
      .pdf-slide figcaption b { color: #15803d; font-weight: 800; }
      .pdf-inset { float: right; width: 148px; margin: 0 0 10px 16px; }
      .pdf-inset .frame { border: 1px solid #d0d7de; border-radius: 10px; overflow: hidden; background: #f3f4f6; }
      .pdf-inset img { display: block; width: 100%; height: auto; }
      .pdf-inset figcaption { font-size: 8.5px; color: #6b7280; margin-top: 4px; text-align: right; }
      .pdf-page .md { font-size: 12.5px; color: var(--text-soft); }
      .pdf-page .md > * + * { margin-top: 10px; }
      .pdf-page .md .md-h { margin-top: 18px; }
      .pdf-page .md pre, .pdf-page .md .md-pre { white-space: pre-wrap; word-break: break-word; }
      .pdf-page .md table { font-size: 11.5px; }
      .pdf-page .md a { color: #1d4ed8; }
      .pdf-page .katex { font-size: 1.05em; }
      .pdf-page .katex-display { overflow: visible; }
      .pdf-page .md .md-math { color: #3b0764 !important; background: #f3e8ff !important; border-color: #d8b4fe !important; }
      .pdf-page .md .md-math-block, .pdf-page .md .md-math-block-line {
        background: #f5f3ff !important; border-color: #ddd6fe !important; border-left-color: #7c3aed !important; color: #1e1b4b !important;
        opacity: 1 !important; filter: none !important; text-shadow: none !important; box-shadow: none !important; }
      .pdf-page .md .md-math-block *, .pdf-page .md .md-math-block-line * { color: #1e1b4b !important; opacity: 1 !important; text-shadow: none !important; }
      .pdf-page .md .md-pre, .pdf-page .md pre { background: #f3f4f6 !important; border: 1px solid #d0d7de !important; color: #111827 !important; box-shadow: none !important; }
      .pdf-page .md .md-pre code, .pdf-page .md pre code { color: #111827 !important; background: transparent !important; }
      .pdf-page .md .md-code { color: #111827 !important; background: #eef1f4 !important; border-color: #d0d7de !important; }
      .pdf-annotate { clear: both; margin-top: 18px; border-top: 1px dashed #d0d7de; padding-top: 8px;
                      font-size: 9px; color: #9ca3af; letter-spacing: .06em; text-transform: uppercase; }
      .pdf-foot { position: absolute; left: 40px; right: 40px; bottom: 16px; display: flex; justify-content: space-between;
                  font-size: 9px; color: #9ca3af; }
      .pdf-cover { display: flex; flex-direction: column; min-height: ${PAGE_MIN - 80}px; }
      .pdf-cover .kicker { font-size: 10px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: #15803d; }
      .pdf-cover h1 { font-size: 32px; line-height: 1.12; letter-spacing: -.02em; font-weight: 850; color: #0b1220; margin: 14px 0 10px; }
      .pdf-cover .sub { font-size: 12px; color: #4b5563; }
      .pdf-cover .url { font-size: 10px; color: #1d4ed8; word-break: break-all; margin-top: 6px; }
      .pdf-cover .pdf-toc { margin-top: 28px; border-top: 1px solid #e5e9ee; padding-top: 14px; }
      .pdf-cover .pdf-toc h3 { font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #6b7280; margin: 0 0 8px; }
      .pdf-cover .pdf-toc ol { list-style: none; margin: 0; padding: 0; columns: 2; column-gap: 28px; }
      .pdf-cover .pdf-toc li { display: flex; gap: 10px; font-size: 11.5px; color: #1f2937; padding: 4px 0; break-inside: avoid; }
      .pdf-cover .pdf-toc li .n { color: #15803d; font-weight: 800; font-variant-numeric: tabular-nums; min-width: 20px; }
      .pdf-cover .pdf-toc li .p { margin-left: auto; color: #9ca3af; font-variant-numeric: tabular-nums; }
      .pdf-cover .made { margin-top: auto; font-size: 10px; color: #9ca3af; }
    `;

    // ── Assets: page stylesheet + KaTeX with fonts inlined ───────────────────
    let _assetsPromise = null;
    function loadAssets() {
        if (_assetsPromise) return _assetsPromise;
        _assetsPromise = (async () => {
            // Every inline <style> of the notes page (the .md rules live there).
            let pageCss = '';
            for (const el of document.querySelectorAll('style')) {
                if (el.id === 'pdfHostStyle') continue;
                pageCss += el.textContent + '\n';
            }
            // Strip @media print / reduced-motion blocks: irrelevant in the raster and
            // the print block would fight the paper palette (it hides .toc, etc.).
            pageCss = stripMediaBlocks(pageCss, /^@media\s+(print|\(prefers-reduced-motion)/);

            // KaTeX stylesheet with every font it references embedded as a data URL:
            // an SVG image has no network, so anything not inlined renders in fallback.
            let katexCss = '';
            try {
                const base = 'katex/';
                katexCss = await fetch(base + 'katex.min.css').then((r) => r.text());
                const fontUrls = [...new Set([...katexCss.matchAll(/url\((fonts\/[^)]+\.woff2)\)/g)].map((m) => m[1]))];
                const dataUrls = new Map();
                await Promise.all(fontUrls.map(async (u) => {
                    try {
                        const buf = await fetch(base + u).then((r) => r.arrayBuffer());
                        dataUrls.set(u, 'data:font/woff2;base64,' + bytesToBase64(new Uint8Array(buf)));
                    } catch {}
                }));
                katexCss = katexCss
                    .replace(/,\s*url\(fonts\/[^)]+\.woff\)\s*format\("woff"\)/g, '')
                    .replace(/,\s*url\(fonts\/[^)]+\.ttf\)\s*format\("truetype"\)/g, '')
                    .replace(/url\((fonts\/[^)]+\.woff2)\)/g, (m, u) => dataUrls.has(u) ? `url(${dataUrls.get(u)})` : m);
            } catch (e) { console.warn('[AI Notes PDF] KaTeX css unavailable:', e?.message); }

            return { css: pageCss + '\n' + katexCss + '\n' + PAPER_CSS };
        })();
        return _assetsPromise;
    }

    // Removes whole @media blocks whose prelude matches, by brace matching
    // (a lazy regex cannot know where a nested block ends).
    function stripMediaBlocks(css, prelude) {
        let out = '', i = 0;
        while (i < css.length) {
            const at = css.indexOf('@media', i);
            if (at < 0) { out += css.slice(i); break; }
            const brace = css.indexOf('{', at);
            if (brace < 0) { out += css.slice(i); break; }
            const head = css.slice(at, brace).trim();
            let depth = 1, j = brace + 1;
            while (j < css.length && depth > 0) { const ch = css[j]; if (ch === '{') depth++; else if (ch === '}') depth--; j++; }
            out += css.slice(i, at);
            if (!prelude.test(head)) out += css.slice(at, j);
            i = j;
        }
        return out;
    }

    function bytesToBase64(bytes) {
        let s = '';
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return btoa(s);
    }

    // ── Slide-or-webcam heuristic ────────────────────────────────────────────
    // Slides are made of flat fills and crisp edges; camera frames are soft and
    // noisy everywhere. At 320x180:
    //   still — share of pixels whose luminance matches the pixel to their right
    //           within 1 level. Flat slide backgrounds score high, camera noise low.
    //   share — share of pixels in the single most common colour (5 bits/channel).
    // Either being high means "slide". Labels from Panopto take priority anyway.
    const _lookCache = new Map();
    async function looksLikeSlide(dataUrl) {
        if (_lookCache.has(dataUrl)) return _lookCache.get(dataUrl);
        const verdict = await (async () => {
            try {
                const img = await loadImage(dataUrl);
                const w = 320, h = 180;
                const c = document.createElement('canvas'); c.width = w; c.height = h;
                const ctx = c.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(img, 0, 0, w, h);
                const d = ctx.getImageData(0, 0, w, h).data;
                const counts = new Map();
                const lum = new Float32Array(w * h);
                for (let i = 0, p = 0; i < d.length; i += 4, p++) {
                    lum[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                    const k = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
                    counts.set(k, (counts.get(k) || 0) + 1);
                }
                let top = 0; for (const v of counts.values()) if (v > top) top = v;
                const share = top / (w * h);
                let stillN = 0, n = 0;
                for (let y = 0; y < h; y++) for (let x = 0; x < w - 1; x++) { const i = y * w + x; if (Math.abs(lum[i] - lum[i + 1]) <= 1) stillN++; n++; }
                const still = stillN / n;
                return still >= 0.55 || share >= 0.45;
            } catch { return true; }   // unreadable → treat as a slide rather than drop it
        })();
        _lookCache.set(dataUrl, verdict);
        return verdict;
    }

    function loadImage(src) {
        return new Promise((res, rej) => {
            const img = new Image();
            img.onload = () => res(img);
            img.onerror = () => rej(new Error('image failed'));
            img.src = src;
        });
    }

    // Pick the slide for a screenshot row, or null if the row is only faces.
    async function pickSlide(sources) {
        const isCam = (s) => /camera|webcam|presenter/i.test(s.label || '');
        const isSlideLabel = (s) => /slide|screen/i.test(s.label || '');
        for (const s of sources) if (isSlideLabel(s)) return s;
        for (const s of sources) if (!isCam(s) && await looksLikeSlide(s.dataUrl)) return s;
        for (const s of sources) if (isCam(s) && await looksLikeSlide(s.dataUrl)) return s;   // mislabelled stream
        return null;
    }

    // ── Collect chapters from the live DOM ───────────────────────────────────
    function collectChapters(root) {
        const out = [];
        for (const ch of (root || document).querySelectorAll('.chapter')) {
            const heading = ch.querySelector('.chapter-title')?.textContent?.trim() || '';
            const bodyEl  = ch.querySelector('.md');
            const rows = [];
            for (const row of ch.querySelectorAll('.section-shot-row')) {
                const ts = row.dataset.ts || '';
                const sources = [];
                for (const tile of row.querySelectorAll('.section-shot.is-loaded')) {
                    const img = tile.querySelector('.section-shot-img');
                    if (!img || !(img.src || '').startsWith('data:')) continue;
                    sources.push({ dataUrl: img.src, width: img.naturalWidth || 1280, height: img.naturalHeight || 720, label: tile.dataset.label || '' });
                }
                if (sources.length) rows.push({ ts, sources });
            }
            out.push({ heading, bodyHtml: bodyEl ? serializeXhtml(bodyEl) : '', rows });
        }
        return out;
    }

    // foreignObject content must be well-formed XML: serialise the live element
    // rather than trusting innerHTML (void tags, entities, MathML namespaces).
    function serializeXhtml(el) {
        const clone = el.cloneNode(true);
        clone.querySelectorAll('script, iframe, video, audio, canvas').forEach((n) => n.remove());
        return new XMLSerializer().serializeToString(clone);
    }

    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // ── Page HTML builders ───────────────────────────────────────────────────
    function eyebrowHtml(parts, lecture) {
        return `<div class="pdf-eyebrow"><span class="dot"></span>${parts.map(esc).join('<span class="sep"> · </span>')}` +
               (lecture ? `<span class="lec">${esc(lecture)}</span>` : '') + `</div>`;
    }
    function footHtml(pageNo, total) {
        return `<div class="pdf-foot"><span>Panopto Custom Speed · AI notes</span><span>${pageNo} / ${total}</span></div>`;
    }
    function slideHtml(src, ts, label) {
        return `<figure class="pdf-slide"><div class="frame"><img src="${src.dataUrl}" alt=""/></div>` +
               `<figcaption><b>${esc(ts || '')}</b><span>${esc(label || src.label || '')}</span></figcaption></figure>`;
    }
    function insetHtml(src, ts) {
        return `<figure class="pdf-inset"><div class="frame"><img src="${src.dataUrl}" alt=""/></div>` +
               `<figcaption>${esc(ts || '')}${src.label ? ' · ' + esc(src.label) : ''}</figcaption></figure>`;
    }

    // ── Rasterise one page ───────────────────────────────────────────────────
    let _host = null;
    function host() {
        if (_host) return _host;
        const style = document.createElement('style');
        style.id = 'pdfHostStyle';
        style.textContent = '.pdf-host{position:fixed;left:-20000px;top:0;width:' + PAGE_W + 'px;pointer-events:none;visibility:hidden}';
        document.head.appendChild(style);
        _host = document.createElement('div');
        _host.className = 'pdf-host';
        document.body.appendChild(_host);
        return _host;
    }
    function destroyHost() {
        _host?.remove(); _host = null;
        document.getElementById('pdfHostStyle')?.remove();
    }

    async function renderPage(innerHtml, css) {
        // 1. Measure in the live document with the same CSS (images already decoded
        //    there, fonts identical), so the SVG can be sized before it is drawn.
        const h = host();
        h.innerHTML = `<style>${PAPER_CSS}</style><div class="pdf-page">${innerHtml}</div>`;
        const pageEl = h.querySelector('.pdf-page');
        await Promise.all([...pageEl.querySelectorAll('img')].map((im) => im.complete ? null : new Promise((r) => { im.onload = im.onerror = r; })));
        const height = Math.max(PAGE_MIN, Math.ceil(pageEl.getBoundingClientRect().height) + 2);
        h.innerHTML = '';

        // 2. Draw through an SVG foreignObject at 2x.
        // CSS goes in CDATA: a stray `&` or `<` in a stylesheet is fatal to XML.
        const xhtml = `<div xmlns="http://www.w3.org/1999/xhtml" class="pdf-page" style="height:${height}px">` +
                      `<style><![CDATA[${css.replace(/\]\]>/g, ']]]]><![CDATA[>')}]]></style>${innerHtml}</div>`;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${height}">` +
                    `<foreignObject width="${PAGE_W}" height="${height}">${xhtml}</foreignObject></svg>`;
        const img = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
        const canvas = document.createElement('canvas');
        canvas.width = PAGE_W * SCALE; canvas.height = height * SCALE;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const jpeg = canvas.toDataURL('image/jpeg', JPEG_Q);
        const bytes = base64ToBytes(jpeg.slice(jpeg.indexOf(',') + 1));
        return { bytes, width: PAGE_W, height, pxW: canvas.width, pxH: canvas.height };
    }

    function base64ToBytes(b64) {
        const bin = atob(b64);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    }

    // ── Minimal PDF writer: JPEG page images + outline ───────────────────────
    function writePdf({ title, pages, outline }) {
        const enc = new TextEncoder();
        const parts = [];
        const offsets = [];
        let length = 0;
        const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); length += b.length; };

        const objs = [];                       // index → writer fn(objNum) returning parts
        const alloc = () => objs.push(null) && objs.length;
        const set = (n, body) => { objs[n - 1] = body; };

        const catalogN = alloc(), pagesN = alloc(), infoN = alloc();
        const outlinesN = outline.length ? alloc() : 0;
        const pageNums = [], imageNums = [], contentNums = [];
        for (let i = 0; i < pages.length; i++) { pageNums.push(alloc()); imageNums.push(alloc()); contentNums.push(alloc()); }
        const itemNums = outline.map(() => alloc());

        const pdfStr = (s) => {
            // UTF-16BE with BOM so any title survives (bookmarks, document title).
            let hex = 'FEFF';
            for (const ch of String(s)) { const cp = ch.codePointAt(0); if (cp > 0xffff) { const v = cp - 0x10000; hex += (0xd800 + (v >> 10)).toString(16).padStart(4, '0') + (0xdc00 + (v & 0x3ff)).toString(16).padStart(4, '0'); } else hex += cp.toString(16).padStart(4, '0'); }
            return `<${hex}>`;
        };

        set(catalogN, `<< /Type /Catalog /Pages ${pagesN} 0 R` + (outlinesN ? ` /Outlines ${outlinesN} 0 R /PageMode /UseOutlines` : '') + ` >>`);
        set(pagesN, `<< /Type /Pages /Kids [${pageNums.map((n) => n + ' 0 R').join(' ')}] /Count ${pages.length} >>`);
        set(infoN, `<< /Title ${pdfStr(title)} /Producer (Panopto Custom Speed) /Creator (Panopto Custom Speed AI notes) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}Z) >>`);
        pages.forEach((p, i) => {
            set(pageNums[i], `<< /Type /Page /Parent ${pagesN} 0 R /MediaBox [0 0 ${p.width} ${p.height}] /Resources << /XObject << /Im0 ${imageNums[i]} 0 R >> >> /Contents ${contentNums[i]} 0 R >>`);
            const content = `q ${p.width} 0 0 ${p.height} 0 0 cm /Im0 Do Q`;
            set(contentNums[i], [`<< /Length ${content.length} >>\nstream\n`, content, `\nendstream`]);
            set(imageNums[i], [`<< /Type /XObject /Subtype /Image /Width ${p.pxW} /Height ${p.pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`, p.bytes, `\nendstream`]);
        });
        if (outlinesN) {
            set(outlinesN, `<< /Type /Outlines /First ${itemNums[0]} 0 R /Last ${itemNums[itemNums.length - 1]} 0 R /Count ${outline.length} >>`);
            outline.forEach((o, i) => {
                set(itemNums[i], `<< /Title ${pdfStr(o.title)} /Parent ${outlinesN} 0 R` +
                    (i > 0 ? ` /Prev ${itemNums[i - 1]} 0 R` : '') + (i < outline.length - 1 ? ` /Next ${itemNums[i + 1]} 0 R` : '') +
                    ` /Dest [${pageNums[o.page]} 0 R /XYZ 0 ${pages[o.page].height} 0] >>`);
            });
        }

        push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
        objs.forEach((body, i) => {
            offsets[i] = length;
            push(`${i + 1} 0 obj\n`);
            for (const b of (Array.isArray(body) ? body : [body])) push(b);
            push(`\nendobj\n`);
        });
        const xref = length;
        push(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`);
        for (const off of offsets) push(String(off).padStart(10, '0') + ' 00000 n \n');
        push(`trailer\n<< /Size ${objs.length + 1} /Root ${catalogN} 0 R /Info ${infoN} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

        const out = new Uint8Array(length);
        let pos = 0;
        for (const b of parts) { out.set(b, pos); pos += b.length; }
        return out;
    }

    // ── Plan + build ─────────────────────────────────────────────────────────
    // chapters: [{ heading, bodyHtml, rows: [{ ts, sources: [{dataUrl,label,width,height}] }] }]
    async function build({ title, subtitle, lectureUrl, chapters, onProgress }) {
        const { css } = await loadAssets();
        const lecture = title || 'Lecture';

        // Plan pages first so the cover's table of contents can carry page numbers.
        const plan = [];   // { kind, chapterIdx, html-builder inputs }
        plan.push({ kind: 'cover' });
        const chapterFirstPage = [];
        for (let ci = 0; ci < chapters.length; ci++) {
            const ch = chapters[ci];
            const slides = [];
            const faces  = [];
            for (const row of ch.rows) {
                const s = await pickSlide(row.sources);
                if (s) slides.push({ ts: row.ts, src: s });
                else if (row.sources[0]) faces.push({ ts: row.ts, src: row.sources[0] });
            }
            chapterFirstPage[ci] = plan.length;
            if (!slides.length) {
                plan.push({ kind: 'text', ci, inset: faces[0] || null });
            } else {
                slides.forEach((sl, k) => plan.push({ kind: 'slide', ci, slide: sl, withBody: k === 0, cont: k > 0, k, n: slides.length }));
            }
        }
        const total = plan.length;

        const pages = [];
        for (let pi = 0; pi < plan.length; pi++) {
            const p = plan[pi];
            onProgress?.(pi + 1, total);
            let inner = '';
            if (p.kind === 'cover') {
                inner = `<div class="pdf-cover"><div class="kicker">✦ AI lecture notes</div><h1>${esc(lecture)}</h1>` +
                        `<div class="sub">${esc(subtitle || '')}</div>` + (lectureUrl ? `<div class="url">${esc(lectureUrl)}</div>` : '') +
                        `<div class="pdf-toc"><h3>Contents</h3><ol>` +
                        chapters.map((ch, i) => `<li><span class="n">${String(i + 1).padStart(2, '0')}</span><span>${esc(ch.heading)}</span><span class="p">${chapterFirstPage[i] + 1}</span></li>`).join('') +
                        `</ol></div><div class="made">Generated by Panopto Custom Speed from the lecture transcript · one slide per page, room to annotate</div></div>`;
            } else {
                const ch = chapters[p.ci];
                const num = `Chapter ${String(p.ci + 1).padStart(2, '0')}`;
                if (p.kind === 'text') {
                    inner = eyebrowHtml([num, ...(p.inset?.ts ? [p.inset.ts] : [])], lecture) +
                            `<h2 class="pdf-title">${esc(ch.heading)}</h2>` +
                            (p.inset ? insetHtml(p.inset.src, p.inset.ts) : '') +
                            `<div class="md">${ch.bodyHtml}</div>`;
                } else {
                    inner = eyebrowHtml([num, p.slide.ts, ...(p.n > 1 ? [`slide ${p.k + 1} of ${p.n}`] : [])], lecture) +
                            `<h2 class="pdf-title${p.cont ? ' cont' : ''}">${esc(ch.heading)}${p.cont ? ' · continued' : ''}</h2>` +
                            slideHtml(p.slide.src, p.slide.ts, p.slide.src.label) +
                            (p.withBody ? `<div class="md">${ch.bodyHtml}</div>` : `<div class="pdf-annotate">Your notes</div>`);
                }
            }
            inner += footHtml(pi + 1, total);
            pages.push(await renderPage(inner, css));
            await new Promise((r) => setTimeout(r, 0));   // let the UI breathe between pages
        }
        destroyHost();

        const outline = chapters.map((ch, i) => ({ title: `${String(i + 1).padStart(2, '0')}  ${ch.heading}`, page: chapterFirstPage[i] }));
        return writePdf({ title: lecture, pages, outline });
    }

    global.NotesPdf = { build, collectChapters, looksLikeSlide, renderPage, loadAssets };
})(window);
