// anki-export.js — builds a genuine Anki .apkg deck in the browser.
//
// An .apkg is a ZIP containing a SQLite database (`collection.anki2`, Anki schema
// version 11) plus a `media` manifest. We build the DB with sql.js (WASM) and zip
// it with fflate. The schema, the default col config, and the note/card row layout
// are modelled on the long-proven `anki-apkg-export` template so the output imports
// cleanly into every modern Anki version.
//
// Globals expected on the page (loaded before this script):
//   initSqlJs   — from lib/sql-wasm.js
//   fflate      — from lib/fflate.min.js
//   chrome.runtime.getURL, crypto.subtle, TextEncoder — browser/extension built-ins.
(function () {
    'use strict';

    // A fixed note type ("model") shared by every deck we export, so a user's Anki
    // collection ends up with ONE "Panopto Q&A" note type rather than one per lecture.
    // Fixed ids are the genanki-recommended way to keep re-imports stable.
    const MODEL_ID  = 1742500000000;   // arbitrary, stable, unlikely to collide
    const MODEL_NAME = 'Panopto Q&A';
    const FIELD_SEP = String.fromCharCode(0x1f);        // Anki's field separator (unit separator)

    // ── SQLite schema (Anki v11) ─────────────────────────────────────────────────
    const SCHEMA_SQL = `
        CREATE TABLE col (
            id integer primary key, crt integer not null, mod integer not null,
            scm integer not null, ver integer not null, dty integer not null,
            usn integer not null, ls integer not null, conf text not null,
            models text not null, decks text not null, dconf text not null, tags text not null
        );
        CREATE TABLE notes (
            id integer primary key, guid text not null, mid integer not null,
            mod integer not null, usn integer not null, tags text not null,
            flds text not null, sfld integer not null, csum integer not null,
            flags integer not null, data text not null
        );
        CREATE TABLE cards (
            id integer primary key, nid integer not null, did integer not null,
            ord integer not null, mod integer not null, usn integer not null,
            type integer not null, queue integer not null, due integer not null,
            ivl integer not null, factor integer not null, reps integer not null,
            lapses integer not null, left integer not null, odue integer not null,
            odid integer not null, flags integer not null, data text not null
        );
        CREATE TABLE revlog (
            id integer primary key, cid integer not null, usn integer not null,
            ease integer not null, ivl integer not null, lastIvl integer not null,
            factor integer not null, time integer not null, type integer not null
        );
        CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
        CREATE INDEX ix_notes_usn on notes (usn);
        CREATE INDEX ix_cards_usn on cards (usn);
        CREATE INDEX ix_revlog_usn on revlog (usn);
        CREATE INDEX ix_cards_nid on cards (nid);
        CREATE INDEX ix_cards_sched on cards (did, queue, due);
        CREATE INDEX ix_revlog_cid on revlog (cid);
        CREATE INDEX ix_notes_csum on notes (csum);
    `;

    // Card stylesheet shipped inside the deck. Clean, readable, light/dark aware.
    const CARD_CSS =
        '.card{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;' +
        'font-size:20px;line-height:1.5;text-align:left;color:#1a1a1a;background:#fff;padding:14px;}' +
        '@media (prefers-color-scheme:dark){.card{color:#e6edf3;background:#0d1117;}}' +
        'hr#answer{border:none;border-top:1px solid #c9c9c9;margin:14px 0;}' +
        'b{font-weight:700;} code{font-family:Consolas,"SF Mono",monospace;background:rgba(127,127,127,.18);' +
        'padding:1px 5px;border-radius:4px;} pre{text-align:left;overflow:auto;} ul,ol{margin:6px 0;padding-left:22px;}';

    // ── Default collection config (proven-import defaults) ───────────────────────
    function defaultConf(deckId, nextPos) {
        return {
            nextPos: nextPos, estTimes: true, activeDecks: [deckId], sortType: 'noteFld',
            timeLim: 0, sortBackwards: false, addToCur: true, curDeck: deckId,
            newBury: true, newSpread: 0, dueCounts: true, curModel: String(MODEL_ID), collapseTime: 1200,
        };
    }

    function buildModel(deckId) {
        return {
            [MODEL_ID]: {
                vers: [], name: MODEL_NAME, tags: [], did: deckId, usn: -1,
                req: [[0, 'all', [0]]],
                flds: [
                    { name: 'Front', media: [], sticky: false, rtl: false, ord: 0, font: 'Arial', size: 20 },
                    { name: 'Back',  media: [], sticky: false, rtl: false, ord: 1, font: 'Arial', size: 20 },
                ],
                sortf: 0,
                latexPre: '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n',
                latexPost: '\\end{document}',
                tmpls: [{ name: 'Card 1', qfmt: '{{Front}}', did: null, bafmt: '', afmt: '{{FrontSide}}\n\n<hr id="answer">\n\n{{Back}}', ord: 0, bqfmt: '' }],
                type: 0, id: MODEL_ID, css: CARD_CSS, mod: 1435645658,
            },
        };
    }

    function buildDecks(deckId, deckName) {
        const base = (id, name, mod) => ({
            desc: '', name: name, extendRev: 50, usn: -1, collapsed: false,
            newToday: [0, 0], timeToday: [0, 0], dyn: 0, extendNew: 10, conf: 1,
            revToday: [0, 0], lrnToday: [0, 0], id: id, mod: mod,
        });
        const decks = {
            1: Object.assign(base(1, 'Default', 1435645724), { usn: 0 }),
            [deckId]: base(deckId, deckName, 1435588830),
        };
        return decks;
    }

    function defaultDconf() {
        return {
            1: {
                name: 'Default', replayq: true,
                lapse: { leechFails: 8, minInt: 1, delays: [10], leechAction: 0, mult: 0 },
                rev: { perDay: 100, fuzz: 0.05, ivlFct: 1, maxIvl: 36500, ease4: 1.3, bury: true, minSpace: 1 },
                timer: 0, maxTaken: 60, usn: 0,
                new: { perDay: 20, delays: [1, 10], separate: true, ints: [1, 4, 7], initialFactor: 2500, bury: true, order: 1 },
                mod: 0, id: 1, autoplay: true,
            },
        };
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    // SHA-1 hex via WebCrypto (async). Used for csum and per-note guid.
    async function sha1Hex(str) {
        const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str));
        let hex = '';
        for (const b of new Uint8Array(buf)) hex += b.toString(16).padStart(2, '0');
        return hex;
    }

    // Anki field checksum: first 8 hex digits of sha1(flds) as an integer.
    async function fieldChecksum(flds) {
        return parseInt((await sha1Hex(flds)).slice(0, 8), 16);
    }

    // A stable, positive deck id derived from the lecture title (FNV-1a). Same title
    // → same deck on re-import (updates rather than duplicating); different titles get
    // their own deck. Kept well clear of the default deck (1) and the model id.
    function deckIdForTitle(title) {
        let h = 0x811c9dc5;
        const s = String(title || '');
        for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
        return 100000000 + (h >>> 0);   // ~1e8 … ~4.4e9, never 1, never MODEL_ID
    }

    function escapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function inlineMd(t) {
        // Bold first, then italic (avoid the inner-* of bold being italicised).
        t = t.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/__([^_\n]+)__/g, '<b>$1</b>');
        t = t.replace(/(^|[^\w*])\*([^*\n]+)\*(?=[^\w*]|$)/g, '$1<i>$2</i>');
        t = t.replace(/(^|[^\w_])_([^_\n]+)_(?=[^\w_]|$)/g, '$1<i>$2</i>');
        return t;
    }

    // Convert a flashcard's markdown into Anki-flavoured HTML. Math ($…$ / $$…$$) is
    // converted to MathJax delimiters (\(…\) / \[…\]) which modern Anki renders
    // natively — no KaTeX or fonts required inside the deck.
    function mdToAnki(src) {
        if (src == null) return '';
        let s = String(src).replace(/\r\n/g, '\n').trim();

        const stash = [];                       // index → raw replacement (restored last)
        const keep = (html) => { stash.push(html); return '\uE000' + (stash.length - 1) + '\uE000'; };

        // 1. Fenced code blocks, then inline code, then math — protected from escaping/formatting.
        s = s.replace(/```[a-zA-Z0-9-]*\n?([\s\S]*?)```/g, (_, code) => keep('<pre><code>' + escapeHtml(code.replace(/\n$/, '')) + '</code></pre>'));
        s = s.replace(/`([^`]+)`/g, (_, code) => keep('<code>' + escapeHtml(code) + '</code>'));
        // Math content is HTML-escaped so a bare "<" can't open a phantom tag; Anki's
        // MathJax reads the entity-decoded textContent, so the LaTeX still renders.
        s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => keep('\\[' + escapeHtml(tex.trim()) + '\\]'));
        s = s.replace(/\$(?=\S)([^$\n]*?)(?<=\S)\$(?!\d)/g,     (_, tex) => keep('\\(' + escapeHtml(tex.trim()) + '\\)'));

        // 2. Escape the remaining prose.
        s = escapeHtml(s);

        // 3. Block structure: bullet/numbered lists and line breaks.
        const lines = s.split('\n');
        const out = [];
        let i = 0;
        while (i < lines.length) {
            const line = lines[i];
            if (/^\s*[-*+]\s+/.test(line)) {
                const items = [];
                while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { items.push(inlineMd(lines[i].replace(/^\s*[-*+]\s+/, ''))); i++; }
                out.push('<ul>' + items.map((t) => '<li>' + t + '</li>').join('') + '</ul>');
                continue;
            }
            if (/^\s*\d+\.\s+/.test(line)) {
                const items = [];
                while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(inlineMd(lines[i].replace(/^\s*\d+\.\s+/, ''))); i++; }
                out.push('<ol>' + items.map((t) => '<li>' + t + '</li>').join('') + '</ol>');
                continue;
            }
            if (!line.trim()) { i++; continue; }
            const para = [];
            while (i < lines.length && lines[i].trim() && !/^\s*([-*+]|\d+\.)\s+/.test(lines[i])) { para.push(inlineMd(lines[i])); i++; }
            out.push(para.join('<br>'));
        }
        let html = out.join('<br>');

        // 4. Restore protected fragments (code/math) verbatim.
        html = html.replace(/\uE000(\d+)\uE000/g, (_, n) => stash[+n]);
        return html;
    }

    // Lazily initialise sql.js, loading the WASM from the extension's own bundle.
    let _sqlPromise = null;
    function getSql() {
        if (!_sqlPromise) {
            const locate = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
                ? (f) => chrome.runtime.getURL('lib/' + f)
                : (f) => f;
            _sqlPromise = initSqlJs({ locateFile: locate }).catch((e) => { _sqlPromise = null; throw e; });
        }
        return _sqlPromise;
    }

    // ── Public API ───────────────────────────────────────────────────────────────
    // buildApkg({ title, cards }) → Uint8Array (the .apkg zip bytes).
    // `cards` is an array of { question, answer } (markdown strings).
    async function buildApkg({ title, cards }) {
        if (!Array.isArray(cards) || !cards.length) throw new Error('no cards');

        const SQL = await getSql();
        const db = new SQL.Database();
        try {
            db.run(SCHEMA_SQL);

            const deckName = String(title || 'Flashcards').replace(/::/g, ':').trim() || 'Flashcards';
            const deckId   = deckIdForTitle(deckName);
            const nowSec   = Math.floor(Date.now() / 1000);
            const crt      = Math.floor(Date.now() / 86400000) * 86400;   // day-aligned epoch

            // Single col row (id = 1) carrying config, note type, decks.
            db.run(
                'INSERT INTO col VALUES (1, ?, ?, ?, 11, 0, 0, 0, ?, ?, ?, ?, ?)',
                [
                    crt, Date.now(), Date.now(),
                    JSON.stringify(defaultConf(deckId, cards.length + 1)),
                    JSON.stringify(buildModel(deckId)),
                    JSON.stringify(buildDecks(deckId, deckName)),
                    JSON.stringify(defaultDconf()),
                    '{}',
                ]
            );

            // One note + one card per flashcard. Duplicate (front, back) pairs collapse
            // onto a single note via a shared guid.
            const base = Date.now();
            const seenGuid = new Map();    // guid → noteId (dedupe)
            let pos = 0;
            for (let i = 0; i < cards.length; i++) {
                const front = mdToAnki(cards[i] && cards[i].question);
                const back  = mdToAnki(cards[i] && cards[i].answer);
                if (!front && !back) continue;
                const flds = front + FIELD_SEP + back;
                // Anki matches notes on guid. Hashing the answer in too meant every
                // regenerated deck produced fresh guids, so a re-import created
                // duplicates instead of updating the existing cards — the most
                // infuriating thing you can do to someone with a 5,000-card collection.
                // The question is the identity; the answer is allowed to improve.
                const guid = await sha1Hex(deckId + FIELD_SEP + front);

                let noteId = seenGuid.get(guid);
                if (noteId === undefined) {
                    noteId = base + i;
                    seenGuid.set(guid, noteId);
                    db.run(
                        'INSERT OR REPLACE INTO notes VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                        [noteId, guid, MODEL_ID, nowSec, -1, '', flds, front, await fieldChecksum(flds), 0, '']
                    );
                    db.run(
                        'INSERT OR REPLACE INTO cards VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                        [base + 1000000 + i, noteId, deckId, 0, nowSec, -1, 0, 0, pos, 0, 0, 0, 0, 0, 0, 0, 0, '']
                    );
                    pos++;
                }
            }

            if (pos === 0) throw new Error('no cards');   // every card was blank

            const dbBytes = db.export();   // Uint8Array — the SQLite file
            const media = new TextEncoder().encode('{}');
            return fflate.zipSync({ 'collection.anki2': dbBytes, 'media': media });
        } finally {
            db.close();
        }
    }

    const root = (typeof window !== 'undefined') ? window : globalThis;
    root.buildApkg = buildApkg;
    root.mdToAnki  = mdToAnki;   // exposed for testing
    if (typeof module !== 'undefined' && module.exports) module.exports = { buildApkg, mdToAnki };
})();
