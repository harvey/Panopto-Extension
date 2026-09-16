// silence-map.js — the Silence Skipper's knowledge of where the quiet parts are.
//
// The old skipper listened to the player through a Web Audio analyser: it had
// to reroute the lecture's sound (which went silent whenever the audio context
// could not start, or the media was cross-origin), calibrated against whatever
// two seconds happened to be playing, reacted 600 ms late, and scanned blind
// through long pauses. This replaces all of that with a MAP.
//
// Where the map comes from, cheapest first:
//   1. The player's own downloads. silence-tap.js (page world) copies every
//      fragmented-MP4 segment Panopto's player fetches and posts it here. The
//      audio samples are parsed out of the segment (moof/trun → mdat) and
//      decoded with the browser's WebCodecs AAC decoder. No extra bandwidth.
//   2. Audio-only run-ahead. To know about pauses beyond the player's buffer,
//      segments ahead of the playhead are fetched as two small byte ranges
//      (the moof header, then just the audio samples — about 8% of a segment),
//      low priority, only while the player's buffer is healthy, never on Data
//      Saver or a slow connection.
//   3. The cached map from a previous visit (chrome.storage.local), so the
//      second watch of a lecture knows everything from the first second.
//
// The map is a grid of 25 ms bins holding loudness in dBFS (Int8, -128 =
// unknown). The controller reads it every 60 ms: inside a quiet run it jumps
// straight to 150 ms before speech resumes when the run is long, or plays it
// at 3x when it is short. It never guesses about parts of the lecture it has
// not heard, and it never touches the audio pipeline.
//
// If WebCodecs cannot decode the audio (very old Chrome, unusual codec, a
// player that streams MPEG-TS) the caller falls back to the legacy analyser.

(function (global) {
    'use strict';

    const BIN_S            = 0.025;  // map resolution
    const UNKNOWN          = -128;
    // Silence is judged RELATIVE TO THE LAST ~20 SECONDS, not the whole lecture:
    // a lecturer who drops their voice, or walks away from the mic, lowers the
    // speech level and the room floor together, and the threshold follows them.
    //   floor  = 10th percentile of the recent window (the room)
    //   speech = 90th percentile of the recent window (the voice)
    //   thr    = floor + THR_FRACTION × (speech − floor)
    // When the voice is barely above the room (contrast under MIN_CONTRAST_DB)
    // nothing is skipped at all — better to leave a quiet passage alone than to
    // speed through someone talking softly.
    const LOCAL_WINDOW_S   = 20;     // seconds before the playhead the threshold is judged on
    const LOCAL_AHEAD_S    = 5;      // plus a little after it
    const THR_FRACTION     = 0.35;   // where the threshold sits between the room and the voice
    const MIN_CONTRAST_DB  = 12;     // voice must stand this far above the room to skip anything
    const THR_MIN_DB       = -75, THR_MAX_DB = -30, THR_DEFAULT_DB = -55;
    const MIN_KNOWN_S      = 8;      // seconds of recent map needed before trusting the local threshold
    const TAIL_DROP_DB     = 4;      // a pause only starts once the level is this far under the threshold
    const MIN_SILENCE_S    = 0.6;    // shorter pauses are speech rhythm, leave them alone
    const GUARD_START_S    = 0.30;   // act this long after a pause starts — trailing "s" and "t" live here
    const GUARD_END_S      = 0.22;   // land this long before speech resumes
    const BLIP_S           = 0.10;   // noise this short inside a pause does not end it
    const SEEK_MIN_S       = 1.2;    // pauses at least this long are jumped, shorter ones sped
    const SILENCE_SPEED    = 3.0;
    const TICK_MS          = 60;
    const LOOKAHEAD_S      = 150;    // keep the map filled this far ahead of the playhead
    const BUFFER_HEALTHY_S = 8;      // only run ahead while the player has this much buffered
    const SAVE_EVERY_MS    = 45000;

    const log = (...a) => { if (S.debug) console.log('[SilenceMap]', ...a); };

    // ── Byte helpers + fMP4 parsing ─────────────────────────────────────────
    const u32 = (a, i) => ((a[i] << 24) >>> 0) + (a[i + 1] << 16) + (a[i + 2] << 8) + a[i + 3];
    const u64 = (a, i) => u32(a, i) * 4294967296 + u32(a, i + 4);
    const str4 = (a, i) => String.fromCharCode(a[i], a[i + 1], a[i + 2], a[i + 3]);
    function* boxes(a, s, e) {
        let p = s;
        while (p + 8 <= e) {
            let size = u32(a, p); const type = str4(a, p + 4); let hdr = 8;
            if (size === 1) { size = u64(a, p + 8); hdr = 16; }
            if (size === 0) size = e - p;
            if (size < hdr) return;
            yield { type, start: p, body: p + hdr, end: Math.min(e, p + size) };
            p += size;
        }
    }
    function find(a, path, s, e) {
        let cur = [{ body: s, end: e }];
        for (const name of path) {
            const next = [];
            for (const c of cur) for (const b of boxes(a, c.body, c.end)) if (b.type === name) next.push(b);
            if (!next.length) return [];
            cur = next;
        }
        return cur;
    }

    // Init segment → { trackId, sampleRate, channels, timescale, asc }
    function parseInit(a) {
        for (const trak of find(a, ['moov', 'trak'], 0, a.length)) {
            const hdlr = find(a, ['mdia', 'hdlr'], trak.body, trak.end)[0];
            if (!hdlr || str4(a, hdlr.body + 8) !== 'soun') continue;
            const tkhd = find(a, ['tkhd'], trak.body, trak.end)[0];
            const trackId = u32(a, tkhd.body + (a[tkhd.body] === 1 ? 20 : 12));
            const mdhd = find(a, ['mdia', 'mdhd'], trak.body, trak.end)[0];
            const timescale = u32(a, mdhd.body + (a[mdhd.body] === 1 ? 20 : 12));
            const stsd = find(a, ['mdia', 'minf', 'stbl', 'stsd'], trak.body, trak.end)[0];
            const entry = [...boxes(a, stsd.body + 8, stsd.end)][0];
            if (!entry || (entry.type !== 'mp4a' && entry.type !== 'enca')) return { trackId, unsupported: entry ? entry.type : 'none' };
            const channels = (a[entry.body + 16] << 8) | a[entry.body + 17];
            const sampleRate = u32(a, entry.body + 24) >>> 16;
            let asc = null;
            const esds = find(a, ['esds'], entry.body + 28, entry.end)[0];
            if (esds) {
                let p = esds.body + 4;
                const len = () => { let n = 0; for (let i = 0; i < 4; i++) { const b = a[p++]; n = (n << 7) | (b & 0x7f); if (!(b & 0x80)) break; } return n; };
                if (a[p] === 0x03) { p++; len(); p += 3; if (a[p] === 0x04) { p++; len(); p += 13; if (a[p] === 0x05) { p++; const n = len(); asc = a.slice(p, p + n); } } }
            }
            return { trackId, sampleRate, channels, timescale, asc };
        }
        return null;
    }

    // Media segment header → the audio track's samples: where they are and when.
    // `absBase` is the segment's byte offset in the file (from the Range header),
    // needed only when the moof uses an absolute base_data_offset.
    function parseMoof(a, trackId, absBase) {
        const moof = [...boxes(a, 0, a.length)].find((b) => b.type === 'moof');
        if (!moof) return null;
        for (const traf of find(a, ['traf'], moof.body, moof.end)) {
            const tfhd = find(a, ['tfhd'], traf.body, traf.end)[0]; if (!tfhd) continue;
            const flags = u32(a, tfhd.body) & 0xffffff;
            if (u32(a, tfhd.body + 4) !== trackId) continue;
            let p = tfhd.body + 8, base = null, defDur = 0, defSize = 0;
            if (flags & 0x1) { base = u64(a, p); p += 8; }
            if (flags & 0x2) p += 4;
            if (flags & 0x8) { defDur = u32(a, p); p += 4; }
            if (flags & 0x10) { defSize = u32(a, p); p += 4; }
            const tfdt = find(a, ['tfdt'], traf.body, traf.end)[0];
            const baseTime = tfdt ? (a[tfdt.body] === 1 ? u64(a, tfdt.body + 4) : u32(a, tfdt.body + 4)) : 0;
            const trun = find(a, ['trun'], traf.body, traf.end)[0]; if (!trun) continue;
            const tf = u32(a, trun.body) & 0xffffff; const count = u32(a, trun.body + 4);
            let q = trun.body + 8, dataOff = 0;
            if (tf & 0x1) { dataOff = u32(a, q) | 0; q += 4; }
            if (tf & 0x4) q += 4;
            const sizes = new Uint32Array(count), durs = new Uint32Array(count);
            for (let i = 0; i < count; i++) {
                let sd = defDur, ss = defSize;
                if (tf & 0x100) { sd = u32(a, q); q += 4; }
                if (tf & 0x200) { ss = u32(a, q); q += 4; }
                if (tf & 0x400) q += 4;
                if (tf & 0x800) q += 4;
                sizes[i] = ss; durs[i] = sd;
            }
            let total = 0; for (let i = 0; i < count; i++) total += sizes[i];
            // Byte position of the first sample, relative to the start of this buffer.
            let rel;
            if (base == null) rel = moof.start + dataOff;                  // default-base-is-moof
            else if (absBase != null) rel = base - absBase + dataOff;      // absolute, and we know where the segment sits
            else return null;
            return { baseTime, sizes, durs, count, dataStart: rel, dataLen: total, moofEnd: moof.end };
        }
        return null;
    }

    // ── State ───────────────────────────────────────────────────────────────
    const S = {
        debug: false, running: false, video: null, deliveryId: null, opts: null,
        tracks: new Map(),      // media url (no query) → { url, init, decoder, dead, frames, lastEnd }
        active: null,           // the track the map follows
        bins: null, binCount: 0, dirty: false, lastSave: 0,
        thr: THR_DEFAULT_DB, thrAt: 0, thrFor: -1,
        tick: null, ourSeekAt: 0, lastTickAt: 0, mode: 'normal',
        playlist: null, playlistPromise: null, playlistTried: false, prefetching: false, prefetchDone: new Set(), prefetchFail: 0,
        stats: { tapSegments: 0, prefetchSegments: 0, decodedFrames: 0, decodeErrors: 0, seeks: 0, spedSecs: 0, savedSecs: 0, source: 'none' },
        firstDataAt: 0, startedAt: 0, fallbackFired: false,
    };

    function ensureBins(seconds) {
        const need = Math.ceil(seconds / BIN_S) + 2;
        if (S.bins && need <= S.binCount) return;
        const grown = Math.max(need, Math.ceil((S.video?.duration || 0) / BIN_S) + 2, S.binCount * 2, 4096);
        const nb = new Int8Array(grown).fill(UNKNOWN);
        if (S.bins) nb.set(S.bins);
        S.bins = nb; S.binCount = grown;
    }
    function writeBins(startS, endS, db) {
        ensureBins(endS);
        const v = Math.max(-100, Math.min(0, Math.round(db)));
        const a = Math.max(0, Math.floor(startS / BIN_S)), b = Math.min(S.binCount - 1, Math.ceil(endS / BIN_S) - 1);
        for (let i = a; i <= b; i++) S.bins[i] = v;
        S.dirty = true;
    }
    const binAt = (t) => { const i = Math.floor(t / BIN_S); return (S.bins && i >= 0 && i < S.binCount) ? S.bins[i] : UNKNOWN; };
    const known = (t) => binAt(t) !== UNKNOWN;

    // Threshold at time t, from the loudness distribution of the bins around it.
    // Returns null when the recent window is unknown or too low-contrast to judge
    // (nothing is skipped then). Cached per second of lecture time.
    function threshold(t) {
        if (t == null) t = S.video ? S.video.currentTime : 0;
        const sec = Math.floor(t);
        if (sec === S.thrFor) return S.thr;
        S.thrFor = sec;
        S.thr = computeThreshold(t);
        return S.thr;
    }
    function computeThreshold(t) {
        if (!S.bins) return null;
        const a = Math.max(0, Math.floor((t - LOCAL_WINDOW_S) / BIN_S));
        const b = Math.min(S.binCount - 1, Math.floor((t + LOCAL_AHEAD_S) / BIN_S));
        const hist = new Int32Array(101); let n = 0;
        for (let i = a; i <= b; i++) { const v = S.bins[i]; if (v !== UNKNOWN) { hist[-v]++; n++; } }
        if (n * BIN_S < MIN_KNOWN_S) return null;
        // percentiles over the window: floor = quietest 10%, speech = loudest 10%
        let acc = 0, floor = -100, speech = 0;
        for (let d = 100; d >= 0; d--) { acc += hist[d]; if (acc >= n * 0.10) { floor = -d; break; } }
        acc = 0;
        for (let d = 0; d <= 100; d++) { acc += hist[d]; if (acc >= n * 0.10) { speech = -d; break; } }
        if (speech - floor < MIN_CONTRAST_DB) return null;      // voice barely above the room: leave it alone
        const thr = floor + THR_FRACTION * (speech - floor);
        return Math.max(THR_MIN_DB, Math.min(THR_MAX_DB, thr));
    }

    // The quiet run containing time t, if any. Returns { start, end, open } where
    // `open` means the run reaches the edge of what has been analysed (end is the
    // frontier, not the return of speech).
    function silenceRunAt(t) {
        if (!S.bins) return null;
        const thr = threshold(t);
        if (thr == null) return null;
        const i0 = Math.floor(t / BIN_S);
        if (i0 < 0 || i0 >= S.binCount || S.bins[i0] === UNKNOWN || S.bins[i0] >= thr) return null;
        const blip = Math.round(BLIP_S / BIN_S);
        // walk back to the start of the run (absorbing blips)
        let i = i0, loud = 0;
        while (i - 1 >= 0 && S.bins[i - 1] !== UNKNOWN) {
            if (S.bins[i - 1] >= thr) { if (++loud > blip) break; } else loud = 0;
            i--;
        }
        // The pause only counts from where the level is clearly under the threshold
        // (TAIL_DROP_DB below it): the fade-out of a word — its trailing "s" — is speech.
        let startBin = i + loud;
        while (startBin < i0 && S.bins[startBin] > thr - TAIL_DROP_DB) startBin++;
        if (startBin >= i0) return null;
        // walk forward to the end
        i = i0; loud = 0; let open = false;
        while (true) {
            if (i + 1 >= S.binCount || S.bins[i + 1] === UNKNOWN) { open = true; break; }
            if (S.bins[i + 1] >= thr) { if (++loud > blip) break; } else loud = 0;
            i++;
        }
        const endBin = i + 1 - loud;   // first bin of speech
        return { start: startBin * BIN_S, end: endBin * BIN_S, open };
    }

    // ── Decoding ────────────────────────────────────────────────────────────
    function trackFor(url) {
        const key = String(url || '').replace(/\?.*$/, '');
        let t = S.tracks.get(key);
        if (!t) { t = { url: key, init: null, decoder: null, dead: false, frames: 0, queue: [] }; S.tracks.set(key, t); }
        return t;
    }

    function configureDecoder(t) {
        if (t.decoder || t.dead || !t.init || t.init.unsupported || typeof AudioDecoder === 'undefined') return;
        const cfg = { codec: 'mp4a.40.2', sampleRate: t.init.sampleRate, numberOfChannels: t.init.channels };
        if (t.init.asc && t.init.asc.length) cfg.description = t.init.asc;
        try {
            t.decoder = new AudioDecoder({
                output: (ad) => {
                    try {
                        const n = ad.numberOfFrames, sr = ad.sampleRate || t.init.sampleRate;
                        const buf = new Float32Array(n);
                        ad.copyTo(buf, { planeIndex: 0, format: 'f32-planar' });
                        let s = 0; for (let i = 0; i < n; i++) s += buf[i] * buf[i];
                        const db = 20 * Math.log10(Math.sqrt(s / n) + 1e-9);
                        const start = ad.timestamp / 1e6, end = start + n / sr;
                        if (t === S.active) { writeBins(start, end, db); if (!S.firstDataAt) S.firstDataAt = Date.now(); }
                        t.frames++; S.stats.decodedFrames++;
                    } catch (e) {}
                    ad.close();
                },
                error: (e) => { S.stats.decodeErrors++; t.dead = true; log('decoder error', e?.message); try { t.decoder.close(); } catch {} t.decoder = null; maybeFallback('decoder'); },
            });
            t.decoder.configure(cfg);
        } catch (e) { t.dead = true; t.decoder = null; log('decoder configure failed', e?.message); maybeFallback('decoder'); }
    }

    // Feed one segment's audio samples to the track's decoder.
    function decodeSamples(t, info, bytes) {
        configureDecoder(t);
        if (!t.decoder) return false;
        let off = 0, ts = info.baseTime;
        for (let i = 0; i < info.count; i++) {
            const sz = info.sizes[i];
            if (off + sz > bytes.length) break;
            try {
                t.decoder.decode(new EncodedAudioChunk({ type: 'key', timestamp: Math.round(ts / t.init.timescale * 1e6), data: bytes.subarray(off, off + sz) }));
            } catch (e) { S.stats.decodeErrors++; break; }
            off += sz; ts += info.durs[i];
        }
        return true;
    }

    function chooseActive() {
        if (S.active && !S.active.dead) return;
        const cands = [...S.tracks.values()].filter((t) => t.init && !t.init.unsupported && !t.dead);
        if (!cands.length) return;
        const dv = S.playlist?.mediaKey;
        S.active = cands.find((t) => dv && t.url === dv) || cands[0];
        log('active track', S.active.url);
    }

    // A full segment buffer (from the tap, or a whole-segment fetch).
    function ingestSegment(url, bytes, rangeStart) {
        const a = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        const t = trackFor(url);
        const first = str4(a, 4);
        if (first === 'ftyp' || (first !== 'styp' && first !== 'moof' && first !== 'sidx' && find(a, ['moov'], 0, a.length).length)) {
            const init = parseInit(a);
            if (init) { t.init = init; log('init', t.url, init.unsupported ? 'unsupported ' + init.unsupported : `${init.sampleRate} Hz ×${init.channels}`); chooseActive(); flushQueue(t); }
            return;
        }
        if (!t.init) { if (t.queue.length < 8) t.queue.push({ a, rangeStart }); return; }
        const info = parseMoof(a, t.init.trackId, rangeStart);
        if (!info || info.dataStart + info.dataLen > a.length) return;
        if (!S.active) chooseActive();
        if (t === S.active && segmentKnown(info, t)) return;   // already mapped (e.g. run-ahead got there first)
        decodeSamples(t, info, a.subarray(info.dataStart, info.dataStart + info.dataLen));
    }
    function segmentKnown(info, t) {
        let dur = 0; for (let i = 0; i < info.count; i++) dur += info.durs[i];
        const start = info.baseTime / t.init.timescale, end = start + dur / t.init.timescale;
        for (let x = start + 0.2; x < end - 0.2; x += 1) if (!known(x)) return false;
        return true;
    }
    function flushQueue(t) { const q = t.queue.splice(0); for (const s of q) ingestSegment(t.url, s.a, s.rangeStart); }

    function onTapMessage(ev) {
        if (ev.source !== window || !ev.data || ev.data.__pcs !== 'media-seg') return;
        if (!S.running) return;
        S.stats.tapSegments++;
        if (S.stats.source === 'none') S.stats.source = 'player';
        try { ingestSegment(ev.data.url, new Uint8Array(ev.data.bytes), ev.data.rangeStart); } catch (e) { log('tap ingest failed', e?.message); }
    }

    // ── Run-ahead over the audio only ───────────────────────────────────────
    function connectionAllowsPrefetch() {
        try {
            const c = navigator.connection;
            if (c) { if (c.saveData) return false; if (/(^|-)2g$|^3g$/.test(c.effectiveType || '')) return false; }
        } catch {}
        return true;
    }

    // One in-flight load shared by every caller (start() and the run-ahead both
    // ask for it; the second must wait for the first, not return empty-handed).
    function loadPlaylist() {
        if (S.playlist || !S.deliveryId) return Promise.resolve();
        if (!S.playlistPromise) S.playlistPromise = loadPlaylistNow().finally(() => { S.playlistTried = true; });
        return S.playlistPromise;
    }
    async function loadPlaylistNow() {
        try {
            const r = await fetch('/Panopto/Pages/Viewer/DeliveryInfo.aspx', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ deliveryId: S.deliveryId, responseType: 'json', isEmbedded: 'false' }).toString() });
            const d = (await r.json()).Delivery || {};
            const streams = d.Streams || [];
            const dv = streams.find((s) => s.Tag === 'DV') || streams[0];
            const master = dv && (dv.StreamHttpUrl || dv.StreamUrl);
            if (!master || !/m3u8/i.test(master)) return;
            const masterTxt = await (await fetch(master, { credentials: 'include' })).text();
            const variant = masterTxt.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('#'));
            if (!variant) return;
            const mediaUrl = new URL(variant, master).href;
            const lines = (await (await fetch(mediaUrl, { credentials: 'include' })).text()).split('\n').map((l) => l.trim()).filter(Boolean);
            let init = null, dur = 0, t = 0, range = null; const segs = []; let m;
            for (const l of lines) {
                if ((m = /^#EXT-X-MAP:URI="([^"]+)"(?:,BYTERANGE="(\d+)@(\d+)")?/.exec(l))) init = { url: new URL(m[1], mediaUrl).href, len: m[2] ? +m[2] : null, off: m[3] ? +m[3] : 0 };
                else if (l.startsWith('#EXTINF:')) dur = parseFloat(l.slice(8)) || 0;
                else if ((m = /^#EXT-X-BYTERANGE:(\d+)@(\d+)/.exec(l))) range = { len: +m[1], off: +m[2] };
                else if (!l.startsWith('#')) { segs.push({ url: new URL(l, mediaUrl).href, start: t, dur, len: range ? range.len : null, off: range ? range.off : 0 }); t += dur; range = null; }
            }
            if (!segs.length) return;
            S.playlist = { init, segs, mediaKey: (init ? init.url : segs[0].url).replace(/\?.*$/, '') };
            log('playlist', segs.length, 'segments,', Math.round(t), 's');
        } catch (e) { log('playlist failed', e?.message); }
    }

    async function rangeFetch(url, off, len) {
        const headers = len != null ? { Range: `bytes=${off}-${off + len - 1}` } : {};
        const res = await fetch(url + '#pcs-own', { credentials: 'include', headers, priority: 'low' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return new Uint8Array(await res.arrayBuffer());
    }

    async function prefetchTick() {
        if (S.prefetching || !S.running || !S.video || !connectionAllowsPrefetch()) return;
        await loadPlaylist();
        const pl = S.playlist; if (!pl) return;
        const v = S.video, t = v.currentTime;
        // Player health: only run ahead when it has a comfortable buffer (or is paused).
        let bufferedAhead = 0;
        try { for (let i = 0; i < v.buffered.length; i++) if (v.buffered.start(i) <= t && v.buffered.end(i) >= t) bufferedAhead = v.buffered.end(i) - t; } catch {}
        if (!v.paused && bufferedAhead < BUFFER_HEALTHY_S) return;
        // First unknown time ahead of the playhead, within the lookahead window.
        let probe = t;
        while (probe < t + LOOKAHEAD_S && known(probe)) probe += BIN_S * 4;
        if (probe >= t + LOOKAHEAD_S) return;
        // First segment at/after the probe that we have not already requested (a
        // requested one may still be decoding, so it can look unknown for a moment).
        let si = pl.segs.findIndex((s) => s.start + s.dur > probe);
        while (si >= 0 && si < pl.segs.length && S.prefetchDone.has(pl.segs[si].start)) si++;
        const seg = si >= 0 && si < pl.segs.length && pl.segs[si].start < t + LOOKAHEAD_S ? pl.segs[si] : null;
        if (!seg) return;
        S.prefetching = true;
        try {
            const track = trackFor(pl.mediaKey);
            if (!track.init) {
                const initBytes = pl.init ? await rangeFetch(pl.init.url, pl.init.off, pl.init.len) : null;
                if (initBytes) ingestSegment(pl.init.url, initBytes, pl.init.off);
                if (!track.init) { S.prefetchFail++; S.prefetchDone.add(seg.start); return; }
            }
            const headLen = Math.min(seg.len != null ? seg.len : 16384, 16384);
            const head = await rangeFetch(seg.url, seg.off, headLen);
            const info = parseMoof(head, track.init.trackId, seg.off);
            if (!info) { S.prefetchDone.add(seg.start); S.prefetchFail++; return; }
            let audio;
            if (info.dataStart + info.dataLen <= head.length) audio = head.subarray(info.dataStart, info.dataStart + info.dataLen);
            else audio = await rangeFetch(seg.url, seg.off + info.dataStart, info.dataLen);
            if (!S.active) chooseActive();
            decodeSamples(track, info, audio);
            S.prefetchDone.add(seg.start); S.stats.prefetchSegments++;
            if (S.stats.source === 'none') S.stats.source = 'run-ahead';
        } catch (e) {
            S.prefetchFail++; S.prefetchDone.add(seg.start); log('prefetch failed', e?.message);
        } finally { S.prefetching = false; }
    }

    // ── Cache ───────────────────────────────────────────────────────────────
    const cacheKey = () => 'silmap_' + S.deliveryId;
    function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
    function unb64(s) { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
    function saveCache(force) {
        if (!S.dirty || !S.bins || !S.deliveryId) return;
        if (!force && Date.now() - S.lastSave < SAVE_EVERY_MS) return;
        S.lastSave = Date.now(); S.dirty = false;
        try {
            let last = S.binCount - 1; while (last > 0 && S.bins[last] === UNKNOWN) last--;
            const slice = new Uint8Array(S.bins.buffer, 0, last + 1);
            chrome.storage.local.set({ [cacheKey()]: { ts: Date.now(), bin: BIN_S, n: last + 1, b64: b64(slice) } });
        } catch (e) {}
    }
    function loadCache() {
        return new Promise((resolve) => {
            try {
                chrome.storage.local.get(cacheKey(), (r) => {
                    const c = r && r[cacheKey()];
                    if (!c || c.bin !== BIN_S || !c.b64 || Date.now() - c.ts > 30 * 86400000) return resolve(false);
                    const u = unb64(c.b64); ensureBins(u.length * BIN_S);
                    S.bins.set(new Int8Array(u.buffer, 0, u.length)); S.dirty = false;
                    S.stats.source = 'cache'; S.firstDataAt = Date.now();
                    resolve(true);
                });
            } catch (e) { resolve(false); }
        });
    }

    // ── Controller ──────────────────────────────────────────────────────────
    function userSpeed() { try { return S.opts.userSpeed(); } catch { return 1; } }
    function setRate(r) { try { S.opts.setRate(r); } catch {} }

    function controllerTick() {
        const v = S.video; if (!v || !S.running) return;
        const now = Date.now();
        const dt = S.lastTickAt ? (now - S.lastTickAt) / 1000 : 0; S.lastTickAt = now;
        const user = userSpeed();
        if ((S.opts.isHold && S.opts.isHold()) || v.paused || v.ended || v.seeking) { if (S.mode === 'fast') { S.mode = 'normal'; } return; }
        const t = v.currentTime;
        const run = silenceRunAt(t);
        if (run && t - run.start >= GUARD_START_S) {
            const target = run.end - GUARD_END_S;
            const remaining = target - t;
            if (!run.open && remaining >= SEEK_MIN_S && run.end - run.start >= MIN_SILENCE_S) {
                S.ourSeekAt = now; S.stats.seeks++; S.stats.savedSecs += remaining / user;
                try { S.opts.onSaved && S.opts.onSaved(remaining / user); } catch {}
                if (S.mode === 'fast') { S.mode = 'normal'; setRate(user); }
                v.currentTime = target;
                log('skip', t.toFixed(2), '→', target.toFixed(2));
                return;
            }
            if (remaining > 0 && run.end - run.start >= MIN_SILENCE_S) {
                const rate = Math.max(SILENCE_SPEED, user);
                if (S.mode !== 'fast' || v.playbackRate !== rate) { S.mode = 'fast'; setRate(rate); }
                if (dt > 0 && dt < 1) { const extra = dt * (rate / user - 1); S.stats.spedSecs += dt; S.stats.savedSecs += extra; try { S.opts.onSaved && S.opts.onSaved(extra); } catch {} }
                return;
            }
        }
        if (S.mode === 'fast') { S.mode = 'normal'; setRate(user); }
    }

    function maybeFallback(why) {
        if (S.fallbackFired || !S.running) return;
        S.fallbackFired = true;
        log('falling back to legacy analyser:', why);
        try { S.opts.onFallback && S.opts.onFallback(why); } catch {}
    }

    // No map data after a while of playing and no way to get any → legacy.
    function healthTick() {
        if (!S.running || S.firstDataAt) return;
        const v = S.video; if (!v || v.paused) return;
        if (Date.now() - S.startedAt > 25000 && S.stats.tapSegments === 0 && (S.prefetchFail >= 3 || !S.playlist)) maybeFallback('no data');
    }

    // ── Public API ──────────────────────────────────────────────────────────
    const api = {
        supported() { return typeof AudioDecoder !== 'undefined' && typeof EncodedAudioChunk !== 'undefined'; },
        active() { return S.running && !!S.firstDataAt; },
        async start(opts) {
            if (S.running) { S.video = opts.video || S.video; return; }
            S.running = true; S.opts = opts; S.video = opts.video; S.deliveryId = opts.deliveryId || null; S.debug = !!opts.debug;
            S.startedAt = Date.now(); S.fallbackFired = false; S.mode = 'normal'; S.lastTickAt = 0;
            window.addEventListener('message', onTapMessage);
            await loadCache();
            S.tick = setInterval(() => { try { controllerTick(); } catch (e) {} }, TICK_MS);
            S.prefetchTimer = setInterval(() => { prefetchTick().catch(() => {}); saveCache(false); healthTick(); }, 1000);
            S.onHide = () => saveCache(true);
            window.addEventListener('pagehide', S.onHide);
            document.addEventListener('visibilitychange', S.onHide);
            loadPlaylist().catch(() => {});
            log('started', S.stats.source === 'cache' ? '(map from cache)' : '');
        },
        stop() {
            if (!S.running) return;
            S.running = false;
            clearInterval(S.tick); clearInterval(S.prefetchTimer); S.tick = S.prefetchTimer = null;
            window.removeEventListener('message', onTapMessage);
            window.removeEventListener('pagehide', S.onHide); document.removeEventListener('visibilitychange', S.onHide);
            saveCache(true);
            if (S.mode === 'fast') { S.mode = 'normal'; setRate(userSpeed()); }
            for (const t of S.tracks.values()) { try { t.decoder && t.decoder.close(); } catch {} t.decoder = null; }
        },
        // True when the last `secs` seconds before the playhead are known and silent.
        trailingSilence(video, secs) {
            if (!S.bins) return false;
            const t = video.currentTime, thr = threshold(t);
            if (thr == null) return false;
            for (let x = t - secs; x < t; x += BIN_S) { const v = binAt(x); if (v === UNKNOWN || v >= thr) return false; }
            return true;
        },
        // Where we are our own seek (so other code can ignore it as a user scrub).
        lastSeekAt() { return S.ourSeekAt; },
        stats() {
            let knownBins = 0; if (S.bins) for (let i = 0; i < S.binCount; i++) if (S.bins[i] !== UNKNOWN) knownBins++;
            return { ...S.stats, knownSeconds: Math.round(knownBins * BIN_S), thresholdDb: threshold(S.video ? S.video.currentTime : 0), tracks: [...S.tracks.values()].map((t) => ({ url: t.url.slice(-40), frames: t.frames, hasInit: !!t.init, dead: t.dead })), activeTrack: S.active ? S.active.url.slice(-40) : null };
        },
        // For tests: feed a segment directly.
        _ingest: ingestSegment, _silenceRunAt: silenceRunAt, _state: S, _controllerTick: controllerTick, _prefetchTick: prefetchTick,
    };
    global.PcsSilence = api;
})(typeof window !== 'undefined' ? window : globalThis);
