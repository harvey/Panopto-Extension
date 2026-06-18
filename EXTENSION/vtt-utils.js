// Shared VTT cleaning utility. Used by content.js (before upload) and notes.js (for chunking).
// Output format: one [HH:MM:SS] line per grouped chunk, ~3-5 cues per line, rolling-caption dedupe applied.
// This is the exact text the server hashes and feeds to Gemini.

(function (root) {
  const TIMESTAMP_LINE = /(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s+-->\s+(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/;
  const CUE_GROUP_SIZE = 4;

  function stripTags(s) {
    return s
      .replace(/<v[^>]*>/gi, "")
      .replace(/<\/v>/gi, "")
      .replace(/<c[^>]*>/gi, "")
      .replace(/<\/c>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  function dedupeRolling(prevWords, text) {
    if (!prevWords.length || !text) return text;
    const words = text.split(/\s+/).filter(Boolean);
    const maxOverlap = Math.min(prevWords.length, words.length);
    for (let n = maxOverlap; n > 0; n--) {
      const tail = prevWords.slice(prevWords.length - n).join(" ").toLowerCase();
      const head = words.slice(0, n).join(" ").toLowerCase();
      if (tail === head) return words.slice(n).join(" ");
    }
    return text;
  }

  function parseCues(raw) {
    const blocks = raw.replace(/\r\n/g, "\n").split(/\n\s*\n/);
    const cues   = [];
    for (const block of blocks) {
      const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
      if (!lines.length) continue;
      if (/^WEBVTT/i.test(lines[0])) continue;
      if (/^NOTE\b/i.test(lines[0])) continue;

      let tsLine = lines[0];
      let textStart = 1;
      if (!TIMESTAMP_LINE.test(tsLine) && lines[1]) {
        // First line is a cue identifier; timestamp is on next line
        tsLine = lines[1];
        textStart = 2;
      }
      const m = tsLine.match(TIMESTAMP_LINE);
      if (!m) continue;

      const startHHMMSS = `${m[1]}:${m[2]}:${m[3]}`;
      const text = lines.slice(textStart).map(stripTags).filter(Boolean).join(" ");
      if (!text) continue;
      cues.push({ ts: startHHMMSS, text });
    }
    return cues;
  }

  function cleanVtt(raw) {
    if (!raw) return "";
    const cues = parseCues(raw);
    if (!cues.length) return "";

    // Rolling dedupe across all cues
    let prevWords = [];
    for (const c of cues) {
      const remainder = dedupeRolling(prevWords, c.text);
      c.cleaned = remainder;
      const newWords = (prevWords.concat(remainder.split(/\s+/).filter(Boolean))).slice(-20);
      prevWords = newWords;
    }

    // Group CUE_GROUP_SIZE deduped cues per output line, using the first cue's timestamp
    const out = [];
    for (let i = 0; i < cues.length; i += CUE_GROUP_SIZE) {
      const group = cues.slice(i, i + CUE_GROUP_SIZE);
      const text  = group.map(c => c.cleaned).filter(Boolean).join(" ");
      if (!text) continue;
      out.push(`[${group[0].ts}] ${text}`);
    }
    return out.join("\n");
  }

  function timestampToSeconds(hhmmss) {
    const m = /^(\d{2}):(\d{2}):(\d{2})$/.exec(hhmmss);
    if (!m) return 0;
    return (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]);
  }

  function secsToHHMMSS(secs) {
    secs = Math.max(0, Math.floor(Number(secs) || 0));
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  }

  // Accept the various shapes Panopto's getCaptions=true endpoint returns:
  // a bare array, or wrapped under { Captions } / { Delivery: { Captions } } / { captions }
  function extractCaptionsArray(json) {
    if (!json) return null;
    if (Array.isArray(json)) return json;
    if (Array.isArray(json.Captions)) return json.Captions;
    if (Array.isArray(json.captions)) return json.captions;
    if (json.Delivery && Array.isArray(json.Delivery.Captions)) return json.Delivery.Captions;
    return null;
  }

  // Parses Panopto's inline-captions JSON (DeliveryInfo.aspx?getCaptions=true) into the
  // same `[HH:MM:SS] text` format that cleanVtt produces. Keeps only Caption + AbsoluteTime.
  function cleanPanoptoCaptionsJson(input) {
    const arr = extractCaptionsArray(input);
    if (!arr || !arr.length) return "";

    // `Time` is the cue's position within the video (seconds). On pre-recorded
    // lectures, `AbsoluteTime` is always 0 — so prefer `Time` and only fall back
    // to `AbsoluteTime` when `Time` is missing/invalid (some webcast variants).
    const items = arr
      .map(c => {
        if (!c || typeof c.Caption !== "string") return null;
        const text = stripTags(c.Caption);
        if (!text) return null;
        let secs = Number(c.Time);
        if (!isFinite(secs) || secs < 0) secs = Number(c.AbsoluteTime);
        if (!isFinite(secs) || secs < 0) return null;
        return { secs: Math.floor(secs), text };
      })
      .filter(Boolean)
      .sort((a, b) => a.secs - b.secs);

    if (!items.length) return "";

    // Rolling-caption dedupe — usually a no-op for full-sentence cues, but cheap insurance
    let prevWords = [];
    for (const c of items) {
      const remainder = dedupeRolling(prevWords, c.text);
      c.cleaned = remainder;
      prevWords = (prevWords.concat(remainder.split(/\s+/).filter(Boolean))).slice(-20);
    }

    const out = [];
    for (let i = 0; i < items.length; i += CUE_GROUP_SIZE) {
      const group = items.slice(i, i + CUE_GROUP_SIZE);
      const text  = group.map(c => c.cleaned).filter(Boolean).join(" ");
      if (!text) continue;
      out.push(`[${secsToHHMMSS(group[0].secs)}] ${text}`);
    }
    return out.join("\n");
  }

  // ── Timed cue extraction (for the Dubbed Lecture feature) ──────────────────
  // cleanVtt / cleanPanoptoCaptionsJson group ~4 cues per line and stamp only the
  // first. These instead keep ONE entry per cue with its own start time (seconds),
  // so a spoken dub can line up closely with the video. Same dedupe, no grouping.

  function cleanVttTimed(raw) {
    if (!raw) return [];
    const cues = parseCues(raw);
    if (!cues.length) return [];
    let prevWords = [];
    const out = [];
    for (const c of cues) {
      const remainder = dedupeRolling(prevWords, c.text);
      prevWords = (prevWords.concat(remainder.split(/\s+/).filter(Boolean))).slice(-20);
      const text = remainder.trim();
      if (text) out.push({ start: timestampToSeconds(c.ts), text });
    }
    return out;
  }

  function cleanPanoptoCaptionsJsonTimed(input) {
    const arr = extractCaptionsArray(input);
    if (!arr || !arr.length) return [];
    const items = arr
      .map(c => {
        if (!c || typeof c.Caption !== "string") return null;
        const text = stripTags(c.Caption);
        if (!text) return null;
        let secs = Number(c.Time);
        if (!isFinite(secs) || secs < 0) secs = Number(c.AbsoluteTime);
        if (!isFinite(secs) || secs < 0) return null;
        return { start: secs, text };
      })
      .filter(Boolean)
      .sort((a, b) => a.start - b.start);
    if (!items.length) return [];
    let prevWords = [];
    const out = [];
    for (const c of items) {
      const remainder = dedupeRolling(prevWords, c.text);
      prevWords = (prevWords.concat(remainder.split(/\s+/).filter(Boolean))).slice(-20);
      const text = remainder.trim();
      if (text) out.push({ start: c.start, text });
    }
    return out;
  }

  // Last-resort: re-derive (coarse) timed cues from an already-cleaned
  // "[HH:MM:SS] text" transcript when the raw caption source isn't available.
  function parseStampedToTimed(text) {
    if (!text) return [];
    const out = [];
    const re = /\[(\d{2}):(\d{2}):(\d{2})\]\s*([^\n]*)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const start = (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]);
      const t = (m[4] || "").trim();
      if (t) out.push({ start, text: t });
    }
    return out;
  }

  const api = { cleanVtt, cleanPanoptoCaptionsJson, cleanVttTimed, cleanPanoptoCaptionsJsonTimed, parseStampedToTimed, timestampToSeconds, secsToHHMMSS };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.VttUtils = api;
  }
})(typeof self !== "undefined" ? self : this);
