// ── Single-injection guard ───────────────────────────────────────────────
// Chrome does not inject content scripts into tabs that were already open when the
// extension was installed or updated, so background.js replays them manually. On an
// update that manual injection races Chrome's own, and running twice in one frame
// would double-bind every listener and draw a second copy of every panel. The whole
// file therefore sits inside this guard; the second run does nothing.
//
// The body below is deliberately left at its original indentation so this stays a
// two-line change rather than a whole-file reindent.
if (!window.__pcsContentLoaded__) {
window.__pcsContentLoaded__ = true;

// Every playbackRate write the extension makes itself is stamped here first. The
// 'speed' nudge listens on `ratechange`, which cannot tell a user dragging the slider
// from the silence skipper writing the rate dozens of times a minute — without this,
// auto-skip users burn their one-nudge-a-day budget on a speed they never chose.
let _lastProgrammaticRateAt = 0;
function setRate(video, rate) {
    if (!video) return;
    _lastProgrammaticRateAt = Date.now();
    video.playbackRate = rate;
}
function rateChangeWasOurs() {
    return Date.now() - _lastProgrammaticRateAt < 150;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Screenshot capture overlay ────────────────────────────────────────────────

let _screenshotOverlay    = null;
let _screenshotProgressEl = null;
let _screenshotCancelCb   = null;

function showScreenshotOverlay(total) {
    removeScreenshotOverlay();

    const ov = document.createElement('div');
    ov.id = '__panopto-ext-shot-overlay__';
    ov.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:2147483647',
        'background:rgba(13,17,23,0.88)',
        'backdrop-filter:blur(4px)', '-webkit-backdrop-filter:blur(4px)',
        'display:flex', 'flex-direction:column',
        'align-items:center', 'justify-content:center', 'gap:10px',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
        'pointer-events:all', 'user-select:none',
    ].join(';');

    const logo = document.createElement('div');
    logo.innerHTML =
        '<svg width="52" height="52" viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg">' +
        '<rect width="52" height="52" rx="12" fill="#E6001E"/>' +
        '<polygon points="19,14 40,26 19,38" fill="white"/>' +
        '</svg>';

    const brand = document.createElement('div');
    brand.textContent = 'PANOPTO';
    brand.style.cssText = 'color:rgba(255,255,255,0.6);font-size:0.68rem;font-weight:700;letter-spacing:0.2em;margin-top:-4px;';

    const heading = document.createElement('div');
    heading.textContent = 'Gathering screenshots for lecture notes';
    heading.style.cssText = 'color:#fff;font-size:1rem;font-weight:600;margin-top:10px;text-align:center;max-width:320px;';

    const progress = document.createElement('div');
    progress.textContent = total ? `Preparing ${total} screenshots…` : 'Preparing…';
    progress.style.cssText = 'color:rgba(255,255,255,0.48);font-size:0.8rem;';
    _screenshotProgressEl = progress;

    const btn = document.createElement('button');
    btn.textContent = 'Cancel';
    btn.style.cssText = [
        'margin-top:14px', 'background:rgba(255,255,255,0.1)', 'color:#fff',
        'border:1px solid rgba(255,255,255,0.25)', 'border-radius:7px',
        'padding:8px 28px', 'font-size:0.84rem', 'font-weight:600', 'cursor:pointer',
    ].join(';');
    btn.addEventListener('mouseover', () => { btn.style.background = 'rgba(255,255,255,0.18)'; });
    btn.addEventListener('mouseout',  () => { btn.style.background = 'rgba(255,255,255,0.1)'; });
    btn.addEventListener('click', () => { if (_screenshotCancelCb) _screenshotCancelCb(); });

    ov.appendChild(logo);
    ov.appendChild(brand);
    ov.appendChild(heading);
    ov.appendChild(progress);
    ov.appendChild(btn);
    document.documentElement.appendChild(ov);
    _screenshotOverlay = ov;
}

function removeScreenshotOverlay() {
    if (_screenshotOverlay) { _screenshotOverlay.remove(); _screenshotOverlay = null; }
    _screenshotProgressEl = null;
}

// ─────────────────────────────────────────────────────────────────────────────

function updateSpeed() {
    let speed = localStorage.getItem('panoptoExtSpeed');
    const video = document.querySelector('video');

    if (video && speed) {
        setRate(video, speed);
    } else {
        console.log("Took too long to find video on page, assuming no video.");
    }
}

function track() {
    const video = document.querySelector('video');
    if (!video) {
        console.log("No video found to track.");
        return;
    }
    let lastCurrentTime = video.currentTime;
    let lastRealTime = Date.now();
    let isTracking = false;

    // Nudge bookkeeping for this sitting. Local flags because showNudge()'s own gate
    // is async — without them the milestone would fire on every tick until it resolved.
    let sessionSaved = 0;
    let savedNudged  = false;
    let doneNudged   = false;
    let hasPlayed    = false;

    const trackTimeSaved = () => {
        const currentRealTime = Date.now();
        const currentCurrentTime = video.currentTime;

        // "Finished" is checked before the paused guard below, because a lecture that
        // has run to the end is usually sitting paused on its last frame. It does need
        // evidence of actually watching, though: without hasPlayed and !isSeeking this
        // fires when someone scrubs to the end, or reopens a lecture at a saved position.
        if (!doneNudged && hasPlayed && !isSeeking && video.duration > 0
            && currentCurrentTime / video.duration >= NUDGE_DONE_FRAC) {
            doneNudged = true;
            showNudge('finished');
        }

        // Reset markers if the video is paused.
        if (video.paused) {
            lastCurrentTime = currentCurrentTime;
            lastRealTime = currentRealTime;
            return;
        }

        // Freeze counter during any seek — manual scrubbing must not inflate saved time.
        if (isSeeking) return;

        // Calculate elapsed time in seconds.
        const realTimeDelta = (currentRealTime - lastRealTime) / 1000;
        const currentTimeDelta = currentCurrentTime - lastCurrentTime;

        // Only compute saved time if the playback rate is > 1 
        // (and thereby ignore normal or skipped jumps which have been reset).
        if (video.playbackRate > 1 && video.playbackRate <= 4) {
            const savedTime = currentTimeDelta - realTimeDelta;

            if (savedTime > 0) {
                // Same figure the leaderboard counts, kept per-sitting so the nudge can
                // quote what they actually earned on this lecture rather than all time.
                sessionSaved += savedTime;
                if (!savedNudged && sessionSaved >= NUDGE_SAVED_SECS) {
                    savedNudged = true;
                    showNudge('saved', { mins: Math.round(sessionSaved / 60) });
                }

                chrome.runtime.sendMessage(
                    { type: "updateSavedTime", savedTime },
                    (response) => {
                        if (response && response.status === "success") {
                            //console.log(`Saved time: ${savedTime.toFixed(2)}s`);
                        }
                    }
                );
            }
        }

        // Update tracking markers.
        lastCurrentTime = currentCurrentTime;
        lastRealTime = currentRealTime;
    };

    // Start tracking when the video plays.
    video.addEventListener("play", () => {
        if (!isTracking) {
            // Reset markers at play.
            lastCurrentTime = video.currentTime;
            lastRealTime = Date.now();
            isTracking = true;
        }
    });

    // Update tracking on pause.
    video.addEventListener("pause", () => {
        isTracking = false;
        trackTimeSaved(); // Final update when paused.
    });

    // Evidence that this sitting actually watched something, as opposed to opening
    // the lecture and scrubbing. Gates the 'finished' nudge.
    video.addEventListener("play", () => { hasPlayed = true; });

    // Reset markers as soon as seeking starts so the 1-second interval can't
    // fire between the seek and the seeked event and report a false spike.
    let isSeeking = false;
    video.addEventListener("seeking", () => {
        isSeeking = true;
        lastCurrentTime = video.currentTime;
        lastRealTime    = Date.now();
    });
    video.addEventListener("seeked", () => {
        isSeeking = false;
        lastCurrentTime = video.currentTime;
        lastRealTime    = Date.now();
    });

    // Continue to track saved time regularly.
    setInterval(trackTimeSaved, 1000);
    video.addEventListener("ratechange", trackTimeSaved);
}

// ── Auto-Skip Silence (Premium) ──────────────────────────────────────────────

let _audioCtx         = null;
let _analyser         = null;
let _silenceTimer     = null;
let _noiseFloor       = null;
let _lastSilenceTick  = null; // timestamp of last tick while in silence-speed mode

const SILENCE_SPEED          = 3.0;   // playback rate during short silence
const SILENCE_DELAY_MS       = 600;   // silence must persist this long before speeding up
const LONG_SILENCE_VIDEO_S   = 10;    // after this many video-seconds of silence, switch to seek-scan
const SCAN_CHUNK_S           = 10;    // video-seconds to seek forward each scan step
const SCAN_SETTLE_TICKS      = 3;     // ticks after seek before sampling (~240ms)
const SCAN_SPEECH_TICKS      = 5;     // consecutive above-threshold ticks to confirm speech (~400ms)
const SCAN_SAMPLE_MAX_TICKS  = 12;    // max sample ticks per position before seeking forward (~960ms)
const SPEECH_PRE_ROLL_S      = 2;     // seconds past last-silent position to land when speech found
const SILENCE_RATIO          = 0.4;   // speed UP when amplitude drops below 40% of noise floor
const RESUME_RATIO           = 0.65;  // restore speed when amplitude rises above 65% of noise floor
const CALIBRATION_MS         = 2000;  // how long to sample the noise floor on start

// Skipper bookkeeping added alongside the seek/calibration fixes below.
let _skipperSeek        = null;   // { video, onSeek } so stopSilenceSkipper can detach
let _silenceRetry       = null;   // pending re-calibration timer
let _silenceRetries     = 0;
let _lastSkipperSeekAt  = 0;      // our own scan seeks must not look like user scrubs
const MIN_NOISE_FLOOR       = 3;  // below this the analyser was reading a dead context
const SILENCE_RETRY_MS      = 3000;
const SILENCE_RETRY_MAX     = 40; // ~2 minutes of trying before giving up quietly

function initAudioAnalyser(video) {
    if (_analyser) return true;
    try {
        _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        // A context created before the page has had a user gesture starts SUSPENDED,
        // and Chrome does not auto-resume it when the gesture arrives later. Every
        // analyser read is then zero, the noise floor calibrates to 0, both thresholds
        // clamp to 1, and auto-skip silently never fires for the whole session —
        // checkbox on, nothing happening. resume() is a no-op when already running.
        try { const p = _audioCtx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
        try {
            // Primary: reroute through AudioContext (requires same-origin media)
            const src = _audioCtx.createMediaElementSource(video);
            _analyser = _audioCtx.createAnalyser();
            _analyser.fftSize = 512;
            _analyser.smoothingTimeConstant = 0.4;
            src.connect(_analyser);
            _analyser.connect(_audioCtx.destination); // must connect or audio goes silent
        } catch {
            // Fallback: capture the rendered stream (audio still plays via original pipeline)
            const stream = video.captureStream();
            const src    = _audioCtx.createMediaStreamSource(stream);
            _analyser    = _audioCtx.createAnalyser();
            _analyser.fftSize = 512;
            _analyser.smoothingTimeConstant = 0.4;
            src.connect(_analyser);
        }
        return true;
    } catch (e) {
        console.log('[SilenceSkipper] Init failed:', e);
        _audioCtx = null;
        _analyser = null;
        return false;
    }
}

// Samples audio for CALIBRATION_MS to measure the noise floor of this recording,
// then calls callback(noiseFloor) with the average amplitude observed.
function calibrateNoiseFloor(video, callback) {
    const data    = new Uint8Array(_analyser.frequencyBinCount);
    const samples = [];
    const start   = Date.now();

    const interval = setInterval(() => {
        // Only samples taken while audio is actually flowing mean anything. A paused
        // element or a suspended context reads as flat zero and would calibrate a
        // floor of 0, which latches thresholds nothing real ever crosses.
        const ctxRunning = !_audioCtx || _audioCtx.state === 'running';
        if (!video.paused && !video.ended && ctxRunning) {
            _analyser.getByteFrequencyData(data);
            samples.push(data.reduce((a, b) => a + b, 0) / data.length);
        }

        if (Date.now() - start >= CALIBRATION_MS) {
            clearInterval(interval);
            const floor = samples.length
                ? samples.reduce((a, b) => a + b, 0) / samples.length
                : 0;
            if (samples.length < 5 || floor < MIN_NOISE_FLOOR) {
                console.log(`[SilenceSkipper] Calibration unusable (floor ${floor.toFixed(2)}, ${samples.length} samples) — will retry`);
                callback(null);
                return;
            }
            console.log(`[SilenceSkipper] Noise floor calibrated: ${floor.toFixed(2)}`);
            callback(floor);
        }
    }, 80);
}

let _silenceCalibrating = false;

function startSilenceSkipper() {
    // _silenceTimer is only set once calibration finishes, ~2s in, so the old guard
    // was fully re-entrant during that window: toggling twice leaked an interval.
    if (_silenceTimer || _silenceCalibrating) return;
    const video = document.querySelector('video');
    if (!video || !initAudioAnalyser(video)) return;

    console.log('[SilenceSkipper] Calibrating noise floor...');
    _silenceCalibrating = true;

    calibrateNoiseFloor(video, (floor) => {
        _silenceCalibrating = false;
        // The user may have switched it off while we were sampling.
        if (localStorage.getItem('autoSkipSilence') !== 'true') return;
        if (floor == null) {
            // Nothing usable yet (paused, or the context has not resumed). Try again
            // shortly rather than latching a dead threshold for the session.
            if (_silenceRetries++ < SILENCE_RETRY_MAX) {
                _silenceRetry = setTimeout(() => { _silenceRetry = null; startSilenceSkipper(); }, SILENCE_RETRY_MS);
            }
            return;
        }
        _silenceRetries = 0;
        _noiseFloor = floor;
        const silenceThreshold = Math.max(floor * SILENCE_RATIO, 1);
        const resumeThreshold  = Math.max(floor * RESUME_RATIO,  1);
        console.log(`[SilenceSkipper] silence<${silenceThreshold.toFixed(2)} resume>${resumeThreshold.toFixed(2)}`);

        const data = new Uint8Array(_analyser.frequencyBinCount);
        let silenceStart      = null;
        let silenceVideoStart = null;

        // Seek-scan state (activated after LONG_SILENCE_VIDEO_S of silence)
        let inScanMode    = false;
        let scanPhase     = 'seek';  // 'seek' | 'settle' | 'sample'
        let scanTicks     = 0;
        let confirmTicks  = 0;
        let sampleTicks   = 0;
        let noiseStart    = null;    // video.currentTime when noise first appeared in sample window
        let lastSilentPos = null;    // video.currentTime just before the last scan seek

        // A user scrub used to be invisible here. silenceVideoStart kept the OLD
        // position, so the next tick saw "silence elapsed" = the whole jump, tripped
        // the 10s long-silence rule instantly, and seek-scan mode ran the video away
        // from wherever the user had just clicked. Our own scan seeks are stamped in
        // _lastSkipperSeekAt so they are not mistaken for the user's.
        const userSpeedNow = () => parseFloat(localStorage.getItem('panoptoExtSpeed') || '1');
        const onUserSeek = () => {
            if (Date.now() - _lastSkipperSeekAt < 500) return;
            silenceStart = null; silenceVideoStart = null; _lastSilenceTick = null;
            if (inScanMode) { inScanMode = false; setRate(video, userSpeedNow()); }
        };
        video.addEventListener('seeking', onUserSeek);
        video.addEventListener('seeked',  onUserSeek);
        _skipperSeek = { video, onUserSeek };

        _silenceTimer = setInterval(() => {
            if (video.paused || video.ended) {
                silenceStart = null; silenceVideoStart = null;
                if (inScanMode) { inScanMode = false; setRate(video, parseFloat(localStorage.getItem('panoptoExtSpeed') || '1')); }
                return;
            }

            _analyser.getByteFrequencyData(data);
            const avg       = data.reduce((a, b) => a + b, 0) / data.length;
            const userSpeed = parseFloat(localStorage.getItem('panoptoExtSpeed') || '1');

            // ── Seek-scan mode ────────────────────────────────────────────────────
            if (inScanMode) {
                if (scanPhase === 'seek') {
                    lastSilentPos = video.currentTime;
                    if (video.currentTime + SCAN_CHUNK_S < (video.duration || Infinity)) {
                        _lastSkipperSeekAt = Date.now();
                        video.currentTime += SCAN_CHUNK_S;
                    } else {
                        // Near end of video — give up, resume normally
                        inScanMode = false;
                        silenceStart = null; silenceVideoStart = null;
                        setRate(video, userSpeed);
                        return;
                    }
                    scanPhase = 'settle'; scanTicks = 0; confirmTicks = 0; sampleTicks = 0; noiseStart = null;
                } else if (scanPhase === 'settle') {
                    // Wait for audio analyser to stabilise after the seek
                    if (++scanTicks >= SCAN_SETTLE_TICKS) scanPhase = 'sample';
                } else { // 'sample'
                    sampleTicks++;
                    if (avg > resumeThreshold) {
                        if (noiseStart === null) noiseStart = video.currentTime;
                        if (++confirmTicks >= SCAN_SPEECH_TICKS) {
                            // Sustained audio confirmed as speech — land just after last silent position
                            _lastSkipperSeekAt = Date.now();
                            video.currentTime = Math.max(0, (lastSilentPos || 0) + SPEECH_PRE_ROLL_S);
                            inScanMode = false;
                            silenceStart = null; silenceVideoStart = null; _lastSilenceTick = null;
                            setRate(video, userSpeed);
                            return;
                        }
                    } else {
                        // Noise blip died out — reset consecutive counter
                        confirmTicks = 0;
                        if (avg < silenceThreshold) noiseStart = null;
                    }
                    if (sampleTicks >= SCAN_SAMPLE_MAX_TICKS) {
                        // Nothing confirmed here — jump forward
                        scanPhase = 'seek';
                    }
                }
                return; // skip normal silence logic while scanning
            }

            // ── Normal amplitude tracking ─────────────────────────────────────────
            if (avg < silenceThreshold) {
                if (!silenceStart) { silenceStart = Date.now(); silenceVideoStart = video.currentTime; }
                if (Date.now() - silenceStart >= SILENCE_DELAY_MS) {
                    const videoSilenceElapsed = video.currentTime - silenceVideoStart;
                    // Belt and braces for the seek listeners above: video time cannot
                    // advance faster than wall time × rate. If it did, the position
                    // jumped under us — re-arm from here instead of scanning away.
                    const wallElapsed = (Date.now() - silenceStart) / 1000;
                    if (videoSilenceElapsed > wallElapsed * video.playbackRate * 1.5 + 1) {
                        silenceStart = Date.now(); silenceVideoStart = video.currentTime;
                        return;
                    }
                    if (videoSilenceElapsed >= LONG_SILENCE_VIDEO_S) {
                        // Long silence — switch to seek-scan mode
                        inScanMode = true;
                        scanPhase = 'seek'; scanTicks = 0; confirmTicks = 0; sampleTicks = 0; noiseStart = null;
                        if (video.playbackRate !== userSpeed) setRate(video, userSpeed);
                    } else {
                        const target = Math.max(SILENCE_SPEED, userSpeed);
                        if (video.playbackRate !== target) setRate(video, target);
                    }
                }
            } else if (avg > resumeThreshold) {
                silenceStart = null; silenceVideoStart = null; _lastSilenceTick = null;
                if (video.playbackRate !== userSpeed) setRate(video, userSpeed);
            }
            // Between the two thresholds: hold current state — prevents rapid toggling

            // Track extra time saved by silence-skipping (beyond what normal speed saves)
            if (video.playbackRate > userSpeed) {
                const now = Date.now();
                if (_lastSilenceTick) {
                    const dt    = (now - _lastSilenceTick) / 1000;
                    const extra = dt * (video.playbackRate / userSpeed - 1);
                    if (extra > 0) {
                        chrome.runtime.sendMessage({ type: "updateSilenceSavedTime", savedTime: extra });
                    }
                }
                _lastSilenceTick = now;
            } else {
                _lastSilenceTick = null;
            }
        }, 80);
    });
}

function stopSilenceSkipper() {
    if (_silenceTimer) { clearInterval(_silenceTimer); _silenceTimer = null; }
    if (_silenceRetry) { clearTimeout(_silenceRetry); _silenceRetry = null; }
    _silenceCalibrating = false;   // a calibration in flight checks the flag and bails
    _silenceRetries = 0;
    if (_skipperSeek) {
        _skipperSeek.video.removeEventListener('seeking', _skipperSeek.onUserSeek);
        _skipperSeek.video.removeEventListener('seeked',  _skipperSeek.onUserSeek);
        _skipperSeek = null;
    }
    _noiseFloor = null;
    const video = document.querySelector('video');
    if (video) setRate(video, parseFloat(localStorage.getItem('panoptoExtSpeed') || '1'));
}

// ─────────────────────────────────────────────────────────────────────────────

// ── Picture in Picture ────────────────────────────────────────────────────────

function getVideoLabel(video, index) {
    return index + 1; // 1-based number; popup.js prepends the translated word
}

function setupMediaSession(video) {
    if (!navigator.mediaSession) return;

    // previoustrack / nexttrack are the buttons Chrome actually renders in the
    // PiP overlay (⏮ ⏭). seekbackward / seekforward cover OS-level media keys.
    navigator.mediaSession.setActionHandler('previoustrack', () => {
        video.currentTime = Math.max(0, video.currentTime - 10);
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
        video.currentTime += 10;
    });
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        video.currentTime = Math.max(0, video.currentTime - (details.seekOffset || 10));
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
        video.currentTime += (details.seekOffset || 10);
    });
}

let _pipSyncing = false;

function attachPiPSync(video) {
    // When PiP pause/play is pressed, sync to Panopto's own play button
    video.addEventListener('pause', () => {
        if (document.pictureInPictureElement !== video || _pipSyncing) return;
        const btn = document.getElementById('playButton');
        // Only click if Panopto still thinks it's playing (button lacks 'paused' class)
        if (btn && !btn.classList.contains('paused')) {
            _pipSyncing = true;
            btn.click();
            setTimeout(() => { _pipSyncing = false; }, 300);
        }
    });

    video.addEventListener('play', () => {
        if (document.pictureInPictureElement !== video || _pipSyncing) return;
        const btn = document.getElementById('playButton');
        // Only click if Panopto still thinks it's paused (button has 'paused' class)
        if (btn && btn.classList.contains('paused')) {
            _pipSyncing = true;
            btn.click();
            setTimeout(() => { _pipSyncing = false; }, 300);
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────

// ───────────────────────────────────────────────────────────────────────────
// PLAYER ATTACH
//
// Looking for the <video> once at startup is why the extension appears dead for so
// many people: the player is not in the DOM yet on a slow connection, it arrives
// late inside an embedded viewer, and it is replaced outright when the viewer moves
// between lectures. So scan once, then watch the document and hand every element we
// have not seen before to onVideoAttached — exactly once per element, tracked in a
// WeakSet so nothing is retained after the player is torn down.
// ───────────────────────────────────────────────────────────────────────────

const ATTACH_WATCHDOG_MS = 12000;   // how long a viewer page gets before we call it a failure
const COACH_TIMEOUT_MS   = 8000;    // first-run tooltip auto-dismiss

const _seenVideos    = new WeakSet();
let _videoObserver   = null;
let _scanQueued      = false;
let _attachReported  = false;       // one session per page view / lecture, not per <video>
let _attachWatchdog  = null;
let _lastHref        = location.href;

// Panopto viewer URLs always carry the delivery id, and the player is the other half
// of the signal. Used to decide whether a failed attach is worth reporting.
function looksLikePanoptoViewer() {
    return !!new URLSearchParams(location.search).get('id')
        || !!document.getElementById('reactCaptionsSettingsButton')
        || !!document.querySelector('video');
}

// Stricter than looksLikePanoptoViewer: is this frame a page whose whole job is to
// play one lecture? An `id` param alone is not enough — it appears on Embed.aspx
// thumbnails that legitimately have no <video> until clicked, and on pages across
// www.panopto.com. A course page carrying five unplayed embeds was reporting five
// attach failures per load, which is most of what the attach_failures table contains.
function isPrimaryViewerPage() {
    return /\/Pages\/Viewer\.aspx/i.test(location.pathname)
        && !!new URLSearchParams(location.search).get('id');
}

// Whether this frame has ever held a <video>. Distinguishes "the player never
// appeared" from "an embed nobody clicked".
let _everSawVideo = false;

// Only the frame that actually owns the player reports a session. On a viewer
// embedded in Canvas/Moodle/Blackboard that is the Panopto iframe rather than the
// page around it; on a normal viewer page it is the top frame. Nested side frames
// stay quiet so one lecture is not counted twice.
function isPlayerFrame() {
    if (!document.querySelector('video')) return false;
    return window.top === window.self
        || !!new URLSearchParams(location.search).get('id');
}

function applyStoredSpeed(video) {
    if (localStorage.getItem('speedOnStartup') !== "true") return;
    const speed = parseFloat(localStorage.getItem('panoptoExtSpeed'));
    if (!isNaN(speed) && speed > 0) setRate(video, speed);
}

function scanForVideos() {
    // A content script lives in an isolated world, so patching history.pushState
    // here would never see the page's own calls. Checking the URL on every rescan
    // catches client-side navigation whatever caused it, because swapping lectures
    // always mutates the document too.
    if (location.href !== _lastHref) {
        _lastHref = location.href;
        onViewerNavigated();
    }

    document.querySelectorAll('video').forEach((video) => {
        if (_seenVideos.has(video)) return;
        _seenVideos.add(video);
        _everSawVideo = true;
        onVideoAttached(video);
    });
}

// Coalesced to one scan per frame: the viewer mutates constantly while captions
// tick, and querySelectorAll on every batch would be needless work.
function queueScan() {
    if (_scanQueued) return;
    _scanQueued = true;
    requestAnimationFrame(() => { _scanQueued = false; scanForVideos(); });
}

function startVideoWatch() {
    scanForVideos();
    if (_videoObserver) return;
    _videoObserver = new MutationObserver(queueScan);
    _videoObserver.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('popstate',   queueScan);
    window.addEventListener('hashchange', queueScan);
}

// The viewer can move between lectures without a page load. A brand-new <video> is
// handled by onVideoAttached; a REUSED element is already in the WeakSet and would
// otherwise be left at 1x, so re-apply the speed here and count the new lecture.
function onViewerNavigated() {
    _attachReported = false;
    document.querySelectorAll('video').forEach(applyStoredSpeed);
    if (isPlayerFrame()) reportAttachSuccess();
}

function onVideoAttached(video) {
    attachPiPSync(video);
    applyStoredSpeed(video);
    reportAttachSuccess();
    maybeShowCoachMark();
    watchRateForNudge(video);
}

function reportAttachSuccess() {
    if (_attachReported || !isPlayerFrame()) return;
    _attachReported = true;
    if (_attachWatchdog) { clearTimeout(_attachWatchdog); _attachWatchdog = null; }

    // sessionCount / everAttached / lastHost are written here; the service worker is
    // told so it can clear the tab's badge and re-stamp the uninstall URL, which is
    // a static snapshot and goes stale the moment these change.
    chrome.storage.local.get(['sessionCount', 'everAttached', 'lastHost'], (state) => {
        chrome.storage.local.set({
            sessionCount: (parseInt(state && state.sessionCount, 10) || 0) + 1,
            everAttached: true,
            lastHost:     location.hostname
        }, () => {
            try {
                chrome.runtime.sendMessage(
                    { type: "attach-ok", host: location.hostname },
                    () => { void chrome.runtime.lastError; }   // the worker may be asleep
                );
            } catch (e) {}
        });
    });
}

// Self-diagnosis: this script is clearly running, so if a viewer page still has no
// player after ATTACH_WATCHDOG_MS something is genuinely wrong on this host. Tell
// the service worker, which badges the tab, lets the popup offer a reload, and logs
// the hostname so the failures are a list rather than a guess.
function startAttachWatchdog() {
    if (_attachWatchdog || _attachReported) return;
    // Only a page that exists to play one lecture can meaningfully "fail to attach".
    if (!isPrimaryViewerPage()) return;

    _attachWatchdog = setTimeout(() => {
        _attachWatchdog = null;
        if (_attachReported || !looksLikePanoptoViewer()) return;
        try {
            chrome.runtime.sendMessage(
                {
                    type:  "attach-failed",
                    host:  location.hostname,
                    // Sent so the two populations in attach_failures can finally be told
                    // apart: a top-frame viewer with no player is a real breakage; a
                    // sub-frame that never held a <video> is usually an unopened embed.
                    frameTop: window.top === window.self,
                    hadVideo: _everSawVideo
                },
                () => { void chrome.runtime.lastError; }
            );
        } catch (e) {}
        // Without this, every user who never attaches uninstalls with an empty host —
        // which is exactly the population worth locating.
        try { chrome.storage.local.set({ lastHost: location.hostname }); } catch (e) {}
    }, ATTACH_WATCHDOG_MS);
}

// ── First-run coach mark ──────────────────────────────────────────────
// Shown once, ever, on the first attach that actually works. hintShown is written
// BEFORE the tooltip is drawn so a user who closes the tab immediately still never
// sees it twice. Styles live in content.css under the .__pcs-coach namespace.

function maybeShowCoachMark() {
    if (!isPlayerFrame()) return;
    chrome.storage.local.get('hintShown', (r) => {
        if (r && r.hintShown) return;
        chrome.storage.local.set({ hintShown: true }, () => { showCoachMark(); });
    });
}

function showCoachMark() {
    if (document.querySelector('.__pcs-coach')) return;

    const tip = document.createElement('div');
    tip.className = '__pcs-coach';
    tip.innerHTML =
        '<span class="__pcs-coach-title">Speed control is ready</span>' +
        '<span class="__pcs-coach-body">Open the player\u2019s settings menu for any speed up to 3\u00d7, ' +
        'or click the extension icon for the full controls.</span>' +
        '<span class="__pcs-coach-dismiss">Click to dismiss</span>';

    // Anchored below the settings button that reveals the speed slider, falling back
    // to the player itself and then to a fixed corner. Clamped to the viewport so it
    // can never be drawn off-screen on a small window.
    const anchor = document.getElementById('reactCaptionsSettingsButton')
                || document.querySelector('video');
    const box = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null;
    if (box && box.width && box.height) {
        tip.style.top  = Math.max(8, Math.min(window.innerHeight - 130, box.bottom + 10)) + 'px';
        tip.style.left = Math.max(8, Math.min(window.innerWidth  - 284, box.left)) + 'px';
    } else {
        tip.style.top   = '84px';
        tip.style.right = '16px';
    }

    let timer = null;
    const dismiss = () => {
        if (timer) { clearTimeout(timer); timer = null; }
        tip.removeEventListener('click', dismiss);
        tip.remove();   // removed rather than hidden, so it can never swallow a click
    };
    tip.addEventListener('click', dismiss);
    timer = setTimeout(dismiss, COACH_TIMEOUT_MS);

    document.documentElement.appendChild(tip);
    requestAnimationFrame(() => { tip.classList.add('__pcs-coach-in'); });
}

// ─────────────────────────────────────────────────────────────────────────────
// PREMIUM NUDGES
//
// The free half of the extension — speed, silence skip, PiP — all happens here on
// the player. The paid half — AI notes, flashcards, chat, translation — lives in
// the toolbar popup, which most people open once while installing and never open
// again. These nudges are the only place the Panopto page ever says the rest of
// the product exists.
//
// Deliberately quiet, because the alternative to a quiet nudge is an uninstall:
// one per day at most across every variant, each variant on its own longer
// cooldown, one per page load, and silenced for good once three have been ignored
// in a row. Clicking one resets that counter, so people who engage keep seeing them.
// ─────────────────────────────────────────────────────────────────────────────

const NUDGE_GAP_MS     = 24 * 60 * 60 * 1000;   // never two nudges within a day
const NUDGE_IGNORE_MAX = 3;                     // ignored this many times → stop asking
const NUDGE_TIMEOUT_MS = 11000;                 // a little longer than the coach mark
const NUDGE_SAVED_SECS = 600;                   // 10 minutes saved in one sitting
const NUDGE_RATE_GRACE = 4000;                  // ignore the speed we restore on load
const NUDGE_DONE_FRAC  = 0.97;                  // "finished" once this much has played

const NUDGE_COPY = {
    // Fired when the viewer changes speed themselves. They have just used the free
    // feature, so this is the moment they are most receptive to there being more.
    speed: {
        cooldownMs: 7 * 24 * 60 * 60 * 1000,
        title: 'Watching at {rate}×',
        body:  'This lecture can also become AI notes, flashcards or an Anki deck.',
    },
    // Fired once they have banked real time. Leads with what they earned, not with a pitch.
    saved: {
        cooldownMs: 3 * 24 * 60 * 60 * 1000,
        title: 'You’ve saved {mins} minutes on this lecture',
        body:  'Want the notes as well? They’re generated from the transcript in about 30 seconds.',
    },
    // Fired at the end, when the "I need to revise this" instinct is strongest.
    finished: {
        cooldownMs: 3 * 24 * 60 * 60 * 1000,
        title: 'Lecture finished',
        body:  'Turn it into flashcards while it’s still fresh.',
    },
};

let _nudgeShownThisPage = false;
let _nudgeCleanup = null;   // detaches the fullscreen listeners for the live toast

// Reads the nudge ledger and applies every gate. Calls back with (false) unless
// this variant is genuinely due.
function nudgeAllowed(variant, cb) {
    if (_nudgeShownThisPage || !isPlayerFrame() || !NUDGE_COPY[variant]) return cb(false);
    chrome.storage.local.get(['pcsNudge', 'pcsAuth'], (r) => {
        // Never pitch the paid features at someone who already pays for them.
        if (r && r.pcsAuth && r.pcsAuth.premium) return cb(false);
        const st  = (r && r.pcsNudge) || {};
        const now = Date.now();
        if (st.off) return cb(false);                                    // dismissed for good
        if ((st.ignored || 0) >= NUDGE_IGNORE_MAX) return cb(false);     // asked enough
        if (st.last && now - st.last < NUDGE_GAP_MS) return cb(false);   // one a day
        const seen = (st.shown && st.shown[variant]) || 0;
        if (now - seen < NUDGE_COPY[variant].cooldownMs) return cb(false);
        cb(true, st);
    });
}

// Showing counts as an ignore until they click; nudgeClicked() clears it.
function recordNudgeShown(variant, st) {
    const now   = Date.now();
    const shown = Object.assign({}, st.shown);
    shown[variant] = now;
    chrome.storage.local.set({
        pcsNudge: Object.assign({}, st, { last: now, shown, ignored: (st.ignored || 0) + 1 })
    });
}

function nudgeClicked() {
    chrome.storage.local.get('pcsNudge', (r) => {
        const st = (r && r.pcsNudge) || {};
        chrome.storage.local.set({ pcsNudge: Object.assign({}, st, { ignored: 0 }) });
    });
    // chrome.action.openPopup() only exists on newer Chrome and can refuse; the
    // service worker swallows that and the CTA copy still tells them where to click.
    try {
        chrome.runtime.sendMessage({ type: 'open-popup' }, () => { void chrome.runtime.lastError; });
    } catch (e) {}
}

// Permanently silences nudges. The × is the honest alternative to people uninstalling
// because a toast kept appearing.
function nudgeSilence() {
    chrome.storage.local.get('pcsNudge', (r) => {
        const st = (r && r.pcsNudge) || {};
        chrome.storage.local.set({ pcsNudge: Object.assign({}, st, { off: true }) });
    });
}

function showNudge(variant, vars) {
    nudgeAllowed(variant, (ok, st) => {
        if (!ok || document.querySelector('.__pcs-nudge')) return;
        _nudgeShownThisPage = true;

        const copy = NUDGE_COPY[variant];
        const fill = (s) => s.replace(/\{(\w+)\}/g,
            (m, k) => (vars && vars[k] != null) ? String(vars[k]) : m);

        const el = document.createElement('div');
        el.className = '__pcs-nudge';
        el.innerHTML =
            '<button class="__pcs-nudge-x" type="button" aria-label="Don’t show these again">×</button>' +
            '<span class="__pcs-nudge-title"></span>' +
            '<span class="__pcs-nudge-body"></span>' +
            '<span class="__pcs-nudge-cta">Click the extension icon in your toolbar ↗</span>';
        // textContent, not innerHTML — the lecture title and rate are page-derived.
        el.querySelector('.__pcs-nudge-title').textContent = fill(copy.title);
        el.querySelector('.__pcs-nudge-body').textContent  = fill(copy.body);

        let timer = null;
        const remove = () => {
            if (timer) { clearTimeout(timer); timer = null; }
            if (_nudgeCleanup) { _nudgeCleanup(); _nudgeCleanup = null; }
            el.remove();   // removed rather than hidden, so it can never swallow a click
        };

        el.querySelector('.__pcs-nudge-x').addEventListener('click', (e) => {
            e.stopPropagation();
            nudgeSilence();
            remove();
        });
        el.addEventListener('click', () => { nudgeClicked(); remove(); });

        timer = setTimeout(remove, NUDGE_TIMEOUT_MS);

        // In fullscreen the browser paints only the fullscreened element's subtree, so
        // a toast parented to <html> is invisible — getChapterTip() below already does
        // this dance for the same reason. Re-parent on every fullscreen change so a
        // toast that is up when the user enters or leaves fullscreen follows them.
        const host = () => document.fullscreenElement
                        || document.webkitFullscreenElement
                        || document.documentElement;
        const reparent = () => { if (el.isConnected || !timer) host().appendChild(el); };
        document.addEventListener('fullscreenchange', reparent);
        document.addEventListener('webkitfullscreenchange', reparent);
        _nudgeCleanup = () => {
            document.removeEventListener('fullscreenchange', reparent);
            document.removeEventListener('webkitfullscreenchange', reparent);
        };

        host().appendChild(el);
        // Only now has it actually been shown, so only now does it cost a slot. The
        // old order spent the once-a-day budget even when nothing was painted.
        recordNudgeShown(variant, st);
        requestAnimationFrame(() => { el.classList.add('__pcs-nudge-in'); });
    });
}

// Speed trigger. A ratechange listener catches the change wherever it came from —
// Panopto's own menu, our injected slider, or a keyboard shortcut — but the speed we
// restore ourselves on load fires one too, so the first few seconds are ignored.
function watchRateForNudge(video) {
    if (!isPlayerFrame() || !video || video.__pcsRateNudge) return;
    video.__pcsRateNudge = true;
    const armedAt = Date.now() + NUDGE_RATE_GRACE;
    video.addEventListener('ratechange', () => {
        if (Date.now() < armedAt) return;
        if (rateChangeWasOurs()) return;   // silence skipper / applyStoredSpeed, not the user
        const r = video.playbackRate;
        if (!(r > 1.05)) return;
        showNudge('speed', { rate: String(Math.round(r * 100) / 100) });
    });
}

startVideoWatch();

// ───────────────────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    // This listener now runs in every Panopto frame (all_frames). A side frame with
    // no player must not answer the popup's data requests — its empty reply would win
    // the race and the popup would report "no video" on a page that has one. If no
    // frame answers, the popup falls back to its existing lastError path unchanged.
    if (window.top !== window.self
        && !document.querySelector('video')
        && !new URLSearchParams(location.search).get('id')) return;
    console.log('Injected panopto speed script into page successfully.');
    if (message.action === "updateSpeed") {
        localStorage.setItem('panoptoExtSpeed', message.value);
        updateSpeed();
    }
    if (message.action === "speedOnStartup") {
        localStorage.setItem('speedOnStartup', message.value);
    }
    if (message.action === "autoSkipSilence") {
        localStorage.setItem('autoSkipSilence', message.value);
        if (message.value === 'true' || message.value === true) {
            startSilenceSkipper();
        } else {
            stopSilenceSkipper();
        }
    }
    if (message.action === "getVideos") {
        const videos = Array.from(document.querySelectorAll('video'))
            .filter(v => v.readyState > 0) // only videos that have loaded
            .map((v, i, arr) => ({ label: getVideoLabel(v, i, arr.length) }));
        sendResponse({ videos });
        return true;
    }
    if (message.action === "enterPiP") {
        const videos = Array.from(document.querySelectorAll('video'))
            .filter(v => v.readyState > 0);
        const video = videos[message.value];
        if (video) {
            const enterAndSetup = () => {
                video.requestPictureInPicture().then(() => setupMediaSession(video));
            };
            if (document.pictureInPictureElement) {
                document.exitPictureInPicture().then(enterAndSetup);
            } else {
                enterAndSetup();
            }
        }
    }
    if (message.action === "getDownloadInfo") {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        if (!id) { sendResponse({ error: 'No delivery ID in URL' }); return true; }

        const isHls = u => !u || u.toLowerCase().includes('.m3u8') || u.toLowerCase().includes('.ism');

        // Walk a stream array and return the first non-HLS URL, or null.
        const pickMp4 = (arr) => {
            if (!Array.isArray(arr)) return null;
            // Prefer streams explicitly typed as mp4
            for (const s of arr) {
                const u = s.StreamHttpUrl || s.StreamUrl || s.Url;
                if (u && (s.ViewerMediaFileTypeName || '').toLowerCase() === 'mp4') return u;
            }
            // Any non-HLS URL
            for (const s of arr) {
                const u = s.StreamHttpUrl || s.StreamUrl || s.Url;
                if (u && !isHls(u)) return u;
            }
            return null;
        };

        fetch('/Panopto/Pages/Viewer/DeliveryInfo.aspx', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ deliveryId: id, responseType: 'json', isEmbedded: 'false' }).toString()
        })
        .then(r => r.json())
        .then(async data => {
            const delivery = data.Delivery || {};
            const title    = delivery.SessionName || delivery.Title || 'lecture';

            // PodcastStreams is the dedicated downloadable MP4 — check it first.
            // Streams is usually HLS for the in-browser player.
            let videoUrl = pickMp4(delivery.PodcastStreams)
                        || pickMp4(delivery.Streams)
                        || pickMp4(delivery.AudioStreams);

            // If DeliveryInfo gave us nothing useful, try the REST API v1 session endpoint.
            if (!videoUrl) {
                try {
                    const apiRes = await fetch(`/Panopto/api/v1/sessions/${id}`, { credentials: 'include' });
                    if (apiRes.ok) {
                        const apiData = await apiRes.json();
                        const urls = apiData.Urls || {};
                        const candidate = urls.DownloadUrl || urls.Cast || null;
                        if (candidate && !isHls(candidate)) videoUrl = candidate;
                    }
                } catch {}
            }

            // Genuinely nothing downloadable — tell the user rather than handing them a playlist.
            if (!videoUrl) {
                sendResponse({ error: 'No direct MP4 found. This lecture may only be available as an HLS stream — try opening it in VLC via "Open Network Stream".' });
                return;
            }

            const captionUrls = (delivery.Captions || [])
                .filter(c => c.Url)
                .map(c => ({ lang: c.Language || c.LanguageCode || 'en', url: c.Url }));

            sendResponse({ videoUrl, captionUrls, title });
        })
        .catch(e => sendResponse({ error: e.message }));
        return true; // async response
    }
    if (message.action === "getScreenshots") {
        // Capture screenshots straight from the <video> elements on the
        // Panopto viewer page. Panopto's thumbnail endpoints don't exist on
        // every deployment, but the video stream is right there in the DOM.
        //
        // Setup (once): play() each <video> muted and keep them playing
        //   throughout. Pausing would be more deterministic per seek but
        //   stalls Panopto's HLS segment pipeline so far-future seeks
        //   eventually time out — that's the "first few work then fail"
        //   regression we hit when we tried seek-while-paused.
        //
        // For each requested time, per <video> in parallel:
        //   1. Re-assert play() (Panopto sometimes auto-pauses us).
        //   2. Seek to target; wait for *that* video's `seeked` event (or
        //      a per-video timeout). Waiting per-video — not for the first
        //      event from any video — is critical: secondary streams seek
        //      slower than the primary and we used to ship their stale
        //      frames as the dreaded "all images identical" duplicates.
        //   3. Wait one rVFC tick so the new frame is actually painted,
        //      and read `metadata.mediaTime` — the timeline position of
        //      the frame about to be drawn.
        //   4. Verify BOTH currentTime AND mediaTime are within tolerance
        //      of the target. currentTime alone isn't enough: it can jump
        //      to the target while the painted frame is still from the
        //      previous segment that hasn't finished decoding.
        //   5. If either check fails, retry the seek once. If still off,
        //      drop this source for this timestamp rather than ship a
        //      stale frame.
        //   6. Draw to canvas, encode JPEG, return.
        //
        // Then restore each video's original currentTime + play state.
        //
        // Nothing leaves the user's machine — the caller (notes.js) writes
        // the data URLs to chrome.storage.local.
        const { times } = message || {};
        if (!Array.isArray(times) || !times.length) { sendResponse({ shots: [] }); return true; }

        const findVideos = () => {
            // Walk the whole document, including same-origin iframes AND any open
            // shadow roots. Panopto's player wraps each stream in its own video
            // tag — we want every one of them, even the "pure black" auxiliary
            // stream the lecturer never used.
            const all = [];
            const walk = (root) => {
                if (!root) return;
                try {
                    root.querySelectorAll('video').forEach(v => all.push(v));
                    root.querySelectorAll('*').forEach(el => {
                        if (el.shadowRoot) walk(el.shadowRoot);
                    });
                } catch {}
            };
            walk(document);
            for (const iframe of document.querySelectorAll('iframe')) {
                try { walk(iframe.contentDocument); } catch {}
            }

            // De-dupe (a video element could appear via two walks)
            const seen = new Set();
            const uniq = all.filter(v => seen.has(v) ? false : (seen.add(v), true));

            // Keep every <video> that has a src OR a loaded duration OR any
            // readyState — i.e. anything that's actually a media element, not
            // an empty placeholder. We DON'T filter on videoWidth/Height: an
            // auxiliary stream may have 0x0 dimensions until seek triggers its
            // first decode, and we want it captured anyway.
            const usable = uniq.filter(v =>
                (v.src || v.currentSrc) ||
                (isFinite(v.duration) && v.duration > 0) ||
                v.readyState > 0
            );
            return usable.map((el, i) => ({ el, label: inferVideoLabel(el, i) }));
        };

        const inferVideoLabel = (v, i) => {
            const sig = (
                (v.id || '') + ' ' + (v.className || '') + ' ' +
                (v.parentElement?.id || '') + ' ' + (v.parentElement?.className || '') + ' ' +
                (v.closest('[class*="stream"]')?.className || '')
            ).toLowerCase();
            if (/slide/.test(sig)) return 'Slides';
            if (/screen|display|share|vga|desktop/.test(sig)) return 'Screen';
            if (/secondary|camera|webcam|presenter/.test(sig)) return 'Camera';
            if (/primary|main|content/.test(sig)) return 'Main';
            return i === 0 ? 'Main' : (i === 1 ? 'Camera' : `Stream ${i + 1}`);
        };

        // Seek a single video and wait for *that* video's `seeked` event
        // (or a per-video timeout). Resolves with whether the seek actually
        // landed near the target. We wait per-video — not for the first
        // event from any video — because Panopto's secondary streams seek
        // slower than the primary and we used to capture their stale frames.
        // 12s timeout: HLS segments far ahead of the current buffer can take
        // a while to fetch+decode on slow networks.
        // 4s tolerance: HLS keyframe spacing means a seek to t=600.0 routinely
        // lands at t=601.something on the nearest keyframe. We're picking
        // representative section thumbnails, not surgical frame-grabs — being
        // a few seconds off is fine; what we want to detect is "seek didn't
        // happen at all and we're still showing a frame from 5 minutes ago".
        const SEEK_TIMEOUT_MS = 12_000;
        const TIME_TOLERANCE_S = 4.0;
        const seekOne = (video, time) => new Promise(resolve => {
            let done = false;
            let timer = null;
            const finish = (why) => {
                if (done) return;
                done = true;
                try { video.removeEventListener('seeked', onSeeked); } catch {}
                if (timer !== null) clearTimeout(timer);
                resolve(why);
            };
            const onSeeked = () => finish('seeked');
            try { video.addEventListener('seeked', onSeeked); } catch {}
            const target = Math.max(0, Math.min(time, (video.duration || time) - 0.05));
            // If we're already at the target, no `seeked` will fire — short-circuit.
            if (Math.abs(video.currentTime - target) < 0.05) {
                finish('already-there');
                return;
            }
            timer = setTimeout(() => finish('timeout'), SEEK_TIMEOUT_MS);
            try { video.currentTime = target; } catch (e) { finish('threw'); }
        });

        // Wait until the next decoded video frame is presented and report
        // its mediaTime (= the video timeline position the frame represents).
        // Per HTML5 spec `seeked` implies the frame is ready, but in practice
        // browsers often paint the previous frame for one extra rAF after
        // seeking — especially with HLS segments. rVFC fires exactly when a
        // new frame hits the compositor and gives us its true mediaTime,
        // which is what we use to detect "seek nominally succeeded but the
        // frame on screen is from somewhere else entirely" failures.
        const waitForFrame = (video) => new Promise(resolve => {
            let done = false;
            const finish = (mediaTime) => { if (!done) { done = true; resolve({ mediaTime }); } };
            const timer = setTimeout(() => finish(null), 1500);
            if (typeof video.requestVideoFrameCallback === 'function') {
                try {
                    video.requestVideoFrameCallback((_now, metadata) => {
                        clearTimeout(timer);
                        finish(metadata && typeof metadata.mediaTime === 'number' ? metadata.mediaTime : null);
                    });
                    return;
                } catch {}
            }
            requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(timer); finish(null); }));
        });

        const captureFrame = (video) => {
            const targetW = 1280;            // HD-ish, click-to-enlarge is meaningful at this size
            const srcW = video.videoWidth, srcH = video.videoHeight;
            if (!srcW || !srcH) return { error: 'no_dimensions' };
            const scale = Math.min(1, targetW / srcW);    // never upscale
            const canvas = document.createElement('canvas');
            canvas.width  = Math.round(srcW * scale);
            canvas.height = Math.round(srcH * scale);
            const ctx = canvas.getContext('2d');
            try {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            } catch (e) {
                return { error: 'drawImage_failed: ' + e.message };
            }
            try {
                return { dataUrl: canvas.toDataURL('image/jpeg', 0.85) };
            } catch (e) {
                return { error: 'tainted: ' + e.message };
            }
        };

        const debug = [];

        showScreenshotOverlay(times.length);

        // sendResponse can only fire once; protect against that.
        let responded = false;
        const respond = (data) => {
            if (responded) return;
            responded = true;
            _screenshotCancelCb = null;
            removeScreenshotOverlay();
            try { sendResponse(data); } catch {}
        };

        (async () => {
            const videos = findVideos();
            debug.push(`videos found: ${videos.length}`);
            if (!videos.length) {
                respond({ shots: times.map(() => []), error: 'no_videos', debug });
                return;
            }
            for (const v of videos) {
                const dur = isFinite(v.el.duration) ? v.el.duration.toFixed(1) : '?';
                debug.push(`  [${v.label}] ${v.el.videoWidth}x${v.el.videoHeight}, dur=${dur}, t=${v.el.currentTime.toFixed(1)}, paused=${v.el.paused}, muted=${v.el.muted}`);
            }

            const states = videos.map(v => ({
                el: v.el,
                label: v.label,
                originalTime: v.el.currentTime,
                wasPaused: v.el.paused,
                wasMuted:  v.el.muted,
                originalVolume: v.el.volume,
            }));

            // Mute + play every video and KEEP them playing through the
            // capture loop. Pausing would be more deterministic per seek,
            // but it breaks Panopto's HLS chunk pipeline — far-future seeks
            // (i.e. anything past the initial buffer) then time out because
            // no segments are loading. Muted programmatic play is allowed
            // by Chrome's autoplay policy regardless of tab focus.
            for (const s of states) {
                try { s.el.muted = true; } catch {}
                try { s.el.volume = 0; } catch {}
                try {
                    const p = s.el.play();
                    if (p && typeof p.then === 'function') {
                        await p.catch(e => { debug.push(`[${s.label}] play() rejected: ${e.message}`); });
                    }
                } catch (e) { debug.push(`[${s.label}] play() threw: ${e.message}`); }
            }

            const shots = [];
            _screenshotCancelCb = () => respond({ shots, debug, cancelled: true });

            // Hard cap on total capture time. If we're still grinding after
            // this, ship whatever we've got so the notes page doesn't sit on
            // the loading banner indefinitely.
            const OVERALL_TIMEOUT_MS = 90_000;
            const safety = setTimeout(() => {
                debug.push('overall_timeout — sending partial results');
                respond({ shots, debug, partial: true });
            }, OVERALL_TIMEOUT_MS);

            const captureOne = async (s, targetSecs) => {
                // Re-assert play state — Panopto's player sometimes
                // auto-pauses our videos mid-capture. A paused video can't
                // load new HLS segments, so far-future seeks would hang.
                try { if (s.el.paused) s.el.play().catch(() => {}); } catch {}

                const why = await seekOne(s.el, targetSecs);
                const frame = await waitForFrame(s.el);

                // Two independent checks, both must pass:
                // 1. video.currentTime is near target — confirms the seek
                //    succeeded at the player level
                // 2. metadata.mediaTime is near target — confirms the FRAME
                //    we're about to draw actually represents that moment
                //    (catches the "currentTime jumped but frame is still
                //    decoding the previous segment" stale-frame case)
                const ct = s.el.currentTime;
                const mt = frame.mediaTime;
                const ctOk = Math.abs(ct - targetSecs) < TIME_TOLERANCE_S;
                const mtOk = mt == null || Math.abs(mt - targetSecs) < TIME_TOLERANCE_S;
                if (!ctOk || !mtOk) {
                    return { ok: false, reason: `seek_missed(ct=${ct.toFixed(2)}, mt=${mt == null ? '?' : mt.toFixed(2)}, target=${targetSecs}, why=${why})` };
                }

                const cap = captureFrame(s.el);
                if (!cap.dataUrl) return { ok: false, reason: cap.error };
                return { ok: true, label: s.label, dataUrl: cap.dataUrl, ct, mt, why };
            };

            const startTime = Date.now();
            try {
                for (let ti = 0; ti < times.length; ti++) {
                    if (responded) break;   // bail early if safety timer fired
                    if (Date.now() - startTime > OVERALL_TIMEOUT_MS) {
                        debug.push('wall_clock_timeout — breaking loop');
                        break;
                    }

                    const targetSecs = Math.max(0, parseFloat(times[ti]) || 0);
                    if (_screenshotProgressEl) {
                        _screenshotProgressEl.textContent = `Capturing ${ti + 1} of ${times.length}…`;
                    }
                    debug.push(`--- t=${targetSecs} ---`);

                    // Capture each source in parallel — a slow secondary
                    // stream can't block the primary, and independent
                    // <video> elements seek independently anyway.
                    const attempts = await Promise.all(states.map(async (s) => {
                        let r = await captureOne(s, targetSecs);
                        // Single retry: Panopto's HLS player occasionally
                        // ignores the first currentTime setter while a new
                        // segment is loading. A short wait + retry resolves
                        // this without us having to give up entirely.
                        if (!r.ok) {
                            debug.push(`  [${s.label}] retry: ${r.reason}`);
                            await new Promise(res => setTimeout(res, 400));
                            r = await captureOne(s, targetSecs);
                        }
                        return r;
                    }));

                    const sources = [];
                    for (const r of attempts) {
                        if (r.ok) {
                            sources.push({ label: r.label, dataUrl: r.dataUrl });
                            debug.push(`  [${r.label}] ok @ ct=${r.ct.toFixed(2)} mt=${r.mt == null ? '?' : r.mt.toFixed(2)} (${r.why})`);
                        } else {
                            debug.push(`  FAILED: ${r.reason}`);
                        }
                    }
                    shots.push(sources);
                }
            } finally {
                clearTimeout(safety);
                // Restore everything: seek back, restore play/pause + muted/volume.
                for (const s of states) {
                    try { s.el.currentTime = s.originalTime; } catch {}
                    if (s.wasPaused) {
                        try { s.el.pause(); } catch {}
                    }
                    try { s.el.muted  = s.wasMuted;  } catch {}
                    try { s.el.volume = s.originalVolume; } catch {}
                }
                respond({ shots, debug });
            }
        })();

        return true; // async response
    }
    if (message.action === "getLectureInfo") {
        gatherLectureContext()
            .then(sendResponse)
            .catch(e => sendResponse({ error: e?.message || 'Failed to gather lecture info' }));
        return true; // async response
    }
});

// Fetch + clean this lecture's transcript (and title/id). Returns
// { deliveryId, title, viewerUrl, captionsCleaned, lang, hasCaptions, debug } or
// { error }. Used by the popup's "Generate Notes" and the in-page chat panel.
async function gatherLectureContext() {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        if (!id) return { error: 'No delivery ID in URL' };

        const viewerUrl = window.location.origin + window.location.pathname + window.location.search;

        {
            if (typeof VttUtils === 'undefined' || !VttUtils.cleanPanoptoCaptionsJson) {
                return { error: 'VTT utilities not loaded' };
            }

            // 1. Fetch metadata (title + URL-based caption list + maybe inline captions)
            let title = 'lecture';
            let urlBasedCaptions = [];
            let inlineCaptionsFromMeta = null;
            try {
                const metaRes = await fetch('/Panopto/Pages/Viewer/DeliveryInfo.aspx', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ deliveryId: id, responseType: 'json', isEmbedded: 'false' }).toString()
                });
                if (metaRes.ok) {
                    const metaData = await metaRes.json();
                    const delivery = metaData.Delivery || {};
                    title = delivery.SessionName || delivery.Title || 'lecture';
                    urlBasedCaptions = (delivery.Captions || [])
                        .filter(c => c.Url)
                        .map(c => ({ lang: (c.Language || c.LanguageCode || 'en').toLowerCase(), url: c.Url }));
                    // Some Panopto instances embed the caption text directly here
                    inlineCaptionsFromMeta = delivery.Captions || null;
                }
            } catch {}

            // Transient network blips (Chrome's "Failed to fetch") are common on
            // Panopto — retry a couple of times with a short backoff before giving up.
            const fetchWithRetry = async (input, init, tries = 2) => {
                let lastErr;
                for (let i = 0; i < tries; i++) {
                    try { return await fetch(input, init); }
                    catch (e) { lastErr = e; await sleep(250 * (i + 1)); }
                }
                throw lastErr;
            };

            const tryParseJson = async (resp) => {
                if (!resp || !resp.ok) return null;
                const text = await resp.text();
                if (!text || text.trim()[0] === '<') return null;   // HTML login page
                try { return JSON.parse(text); } catch { return null; }
            };

            // SRT/VTT text endpoints → cleaned transcript (cleanVtt handles both).
            const cleanTextResp = async (resp) => {
                if (!resp || !resp.ok) return '';
                const text = await resp.text();
                if (!text || text.trim()[0] === '<') return '';     // HTML login page
                return VttUtils.cleanVtt(text);
            };

            // 2. Several ways to get the transcript, in order of likelihood. Each
            //    returns a cleaned `[HH:MM:SS] text` string (or ''). We keep the
            //    longest result and stop early once we clearly have a full transcript,
            //    so a partial/empty response from one method can't mask a good one.
            let captionsCleaned = '';
            const debug = [];

            const captionAttempts = [
                {
                    name: 'meta.Captions (inline)',
                    run: async () => VttUtils.cleanPanoptoCaptionsJson(inlineCaptionsFromMeta),
                },
                {
                    name: 'POST getCaptions=true',
                    run: async () => VttUtils.cleanPanoptoCaptionsJson(await tryParseJson(await fetchWithRetry('/Panopto/Pages/Viewer/DeliveryInfo.aspx', {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({
                            deliveryId: id, getCaptions: 'true', language: '0', responseType: 'json'
                        }).toString()
                    }))),
                },
                {
                    name: 'GET getCaptions=true',
                    run: async () => VttUtils.cleanPanoptoCaptionsJson(await tryParseJson(await fetchWithRetry(
                        `/Panopto/Pages/Viewer/DeliveryInfo.aspx?deliveryId=${encodeURIComponent(id)}&getCaptions=true&language=0&responseType=json`,
                        { credentials: 'include' }
                    ))),
                },
                {
                    name: 'POST getCaptions+isEmbedded',
                    run: async () => VttUtils.cleanPanoptoCaptionsJson(await tryParseJson(await fetchWithRetry('/Panopto/Pages/Viewer/DeliveryInfo.aspx', {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({
                            deliveryId: id, getCaptions: 'true', language: '0',
                            responseType: 'json', isEmbedded: 'false'
                        }).toString()
                    }))),
                },
                {
                    // Panopto's dedicated subtitle endpoint — returns SRT text and often
                    // works on instances where the getCaptions JSON paths return nothing.
                    name: 'GenerateSubtitles.ashx',
                    run: async () => cleanTextResp(await fetchWithRetry(
                        `/Panopto/Pages/Transcription/GenerateSubtitles.ashx?deliveryId=${encodeURIComponent(id)}&language=0`,
                        { credentials: 'include' }
                    )),
                },
                {
                    // The viewer's "download transcript" path — SRT keyed by delivery id
                    // (note: ?id=, not ?deliveryId=). A different code path again, so it
                    // can succeed when GenerateSubtitles / getCaptions return nothing.
                    name: 'GenerateSRT.ashx',
                    run: async () => cleanTextResp(await fetchWithRetry(
                        `/Panopto/Pages/Transcription/GenerateSRT.ashx?id=${encodeURIComponent(id)}`,
                        { credentials: 'include' }
                    )),
                },
            ];

            for (const attempt of captionAttempts) {
                try {
                    const cleaned = await attempt.run();
                    debug.push(`${attempt.name}: ${cleaned ? cleaned.length + ' chars' : 'empty'}`);
                    if (cleaned && cleaned.length > captionsCleaned.length) captionsCleaned = cleaned;
                    if (captionsCleaned.length >= 200) break;   // clearly a real transcript
                } catch (e) {
                    debug.push(`${attempt.name}: ${e.message}`);
                }
            }

            // 3. Fallback — fetch the caption file URLs (English first, then every
            //    other language) if the inline/endpoint paths came up short.
            if (captionsCleaned.length < 50 && urlBasedCaptions.length) {
                const ordered = [
                    ...urlBasedCaptions.filter(c => c.lang.startsWith('en')),
                    ...urlBasedCaptions.filter(c => !c.lang.startsWith('en')),
                ];
                for (const cap of ordered) {
                    try {
                        const cleaned = await cleanTextResp(await fetchWithRetry(cap.url, { credentials: 'include' }));
                        debug.push(`vtt url (${cap.lang}): ${cleaned ? cleaned.length + ' chars' : 'empty'}`);
                        if (cleaned && cleaned.length > captionsCleaned.length) captionsCleaned = cleaned;
                        if (captionsCleaned.length >= 200) break;
                    } catch (e) { debug.push(`vtt url (${cap.lang}): ${e.message}`); }
                }
            }

            // 4. Last resort — scrape the transcript out of the viewer's own panel.
            //    Works when the player can show a transcript even though every caption
            //    endpoint above returned nothing (auth/CSRF/timing differences).
            if (captionsCleaned.length < 50) {
                try {
                    const domCleaned = await scrapeTranscriptFromDom(debug);
                    debug.push(`dom scrape: ${domCleaned ? domCleaned.length + ' chars' : 'empty'}`);
                    if (domCleaned && domCleaned.length > captionsCleaned.length) captionsCleaned = domCleaned;
                } catch (e) { debug.push(`dom scrape: ${e.message}`); }
            }

            return {
                deliveryId: id,
                title,
                viewerUrl,
                captionsCleaned,
                lang: 'en',
                hasCaptions: captionsCleaned.length > 0,
                debug,
            };
        }
}

// Last-resort caption source: scrape the transcript straight out of the Panopto
// viewer's captions panel. Works whenever the player itself can show a transcript
// — even when every caption endpoint returns nothing — because the data is (or can
// be) rendered right in the page. Returns cleaned "[HH:MM:SS] text" (or '').
async function scrapeTranscriptFromDom(debug) {
    const log = (m) => { if (debug) debug.push(`dom: ${m}`); };
    if (typeof VttUtils === 'undefined') return '';

    const parseTime = (s) => {
        const m = String(s).trim().match(/(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,]\d+)?/);
        if (!m) return null;
        const h = m[1] ? +m[1] : 0;
        return h * 3600 + (+m[2]) * 60 + (+m[3]);
    };

    // The captions list (<ul class="event-tab-list" aria-label="Captions">) is only
    // populated once the transcript tab has been opened — open it if it isn't there.
    const findList = () =>
        document.querySelector('ul.event-tab-list') ||
        document.querySelector('[aria-label="Captions" i]');

    let list = findList();
    if (!list || !list.children || !list.children.length) {
        const tab = document.querySelector('#transcriptTabHeader > span') ||
                    document.querySelector('#transcriptTabHeader');
        if (tab) {
            tab.click();
            for (let i = 0; i < 12 && (!list || !list.children || !list.children.length); i++) {
                await sleep(200);
                list = findList();
            }
            log(`opened transcript tab; rows now: ${list && list.children ? list.children.length : 0}`);
        }
    }

    const items = [];

    // 1. Precise path — each <li> in the captions list has a `.event-text` and a
    //    `.event-time` (m:ss). `.event-timestamp` exists too but is empty, so read
    //    `.event-time` first.
    if (list && list.children && list.children.length) {
        for (const li of Array.from(list.children)) {
            const textEl = li.querySelector('.event-text');
            if (!textEl) continue;
            const text = (textEl.textContent || '').replace(/\s+/g, ' ').trim();
            if (!text) continue;
            const timeEl = li.querySelector('.event-time') || li.querySelector('.event-timestamp');
            const secs = timeEl ? parseTime(timeEl.textContent) : null;
            items.push({ secs, text });
        }
        log(`captions list: ${items.length} rows`);
    }

    // 2. Fallback for other viewer skins — caption text nodes + a nearby timestamp.
    if (!items.length) {
        const nodes = Array.from(document.querySelectorAll('.event-text, .index-event-text'));
        for (const node of nodes) {
            const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
            if (!text) continue;
            let secs = null, el = node;
            for (let d = 0; el && d < 4 && secs == null; d++, el = el.parentElement) {
                let tEl = null;
                try { tEl = el.querySelector && el.querySelector('.event-time, time, [class*="time" i]'); } catch (e) {}
                if (tEl && tEl !== node) secs = parseTime(tEl.textContent);
            }
            items.push({ secs, text });
        }
        if (items.length) log(`fallback scrape: ${items.length} rows`);
    }

    if (!items.length) { log('no transcript rows found in DOM'); return ''; }

    // Build a synthetic WEBVTT and reuse the shared cleaner so the output format,
    // dedupe and grouping exactly match every other caption path. Rows missing a
    // timestamp inherit the previous one (flat 00:00:00 if none were found at all).
    let last = 0;
    const blocks = items.map(i => {
        if (i.secs != null && isFinite(i.secs) && i.secs >= 0) last = Math.floor(i.secs);
        const ts = VttUtils.secsToHHMMSS(last);
        return `${ts}.000 --> ${ts}.000\n${i.text}`;
    });
    return VttUtils.cleanVtt('WEBVTT\n\n' + blocks.join('\n\n'));
}

// Initialization function
function initExtension() {
    if (localStorage.getItem('speedOnStartup') === "true"){
        sleep(500).then(() => {
            updateSpeed();
        });
        sleep(1500).then(() => {  // for slow internet & computers
            updateSpeed();
        });
    }
    track();
    // Resume silence skipper if it was active before page reload. Started on the
    // first PLAY rather than a fixed 1.5s: playing is the moment the page is
    // guaranteed to have had a gesture, so the AudioContext can actually run and
    // calibration samples real audio instead of a suspended context's zeros.
    if (localStorage.getItem('autoSkipSilence') === 'true') {
        const armSkipper = () => {
            const v = document.querySelector('video');
            if (!v) { setTimeout(armSkipper, 1500); return; }
            if (v.paused) v.addEventListener('play', () => startSilenceSkipper(), { once: true });
            else startSilenceSkipper();
        };
        sleep(1500).then(armSkipper);
    }

    // Watch for the player rather than sweeping once: it can arrive long after load
    // on a slow connection or inside an embedded viewer. Idempotent, so this also
    // covers a manual injection into a tab that was already open at install time.
    startVideoWatch();
    startAttachWatchdog();
}

// If the document is already loaded, initialize immediately;
// otherwise, wait for the 'load' event.
if (document.readyState === "complete") {
    initExtension();
} else {
    window.addEventListener("load", initExtension);
}

// How long to keep waiting for Panopto's settings button before giving up. It only
// appears once the player has booted, which on campus wifi is routinely well past
// the 500ms this used to allow.
const SETTINGS_WAIT_MS = 20000;

// Resolves with the element as soon as it exists, or null at the timeout. A one-shot
// sleep() cannot do this: miss the window and the feature is dead for the whole page
// view, silently, which is what produced most of the attach_failures table.
function waitForElement(selector, timeoutMs) {
    return new Promise((resolve) => {
        const immediate = document.querySelector(selector);
        if (immediate) return resolve(immediate);

        let obs = null;
        let timer = null;
        const done = (el) => {
            if (obs)   { obs.disconnect(); obs = null; }
            if (timer) { clearTimeout(timer); timer = null; }
            resolve(el);
        };
        timer = setTimeout(() => done(document.querySelector(selector)), timeoutMs);
        obs = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) done(el);
        });
        obs.observe(document.documentElement, { childList: true, subtree: true });
    });
}

// Picks the playback-speed entry out of Panopto's settings menu.
//
// This used to be a hardcoded d[1]. Two ways that broke: Panopto reordering or adding
// a menu item pointed us at the wrong row, and a menu with exactly one item passed the
// `d.length > 0` guard and then threw on d[1], killing the handler outright. Matching on
// what the row says survives both. The label is localised, so the common translations
// are checked too — the top attach-failure hosts are a Korean and a Hebrew tenant.
function findSpeedMenuItem(items) {
    const list = Array.from(items || []);
    if (!list.length) return null;

    // Bare 속도 matters most: Panopto's Korean label is 속도, not 재생 속도, and requiring
    // the 재생 prefix is why ewha.ap — 156 users, the worst host in attach_failures —
    // fell through to the positional fallback. The Korean rows this could collide with
    // are 자막 (captions), 오디오 설명 (audio description) and 품질 (quality); none contain 속도.
    const wanted = /speed|playback rate|geschwindigkeit|vitesse|velocidad|velocit|snelheid|hastighet|hastighed|prędkoś|скорост|h[ıi]z|ความเร็ว|速度|배속|속도|מהירות|سرعة/i;
    const byLabel = list.find((li) => wanted.test(
        (li.textContent || '') + ' ' + (li.getAttribute('aria-label') || '')
    ));
    if (byLabel) return byLabel;

    // Historical position, but only when it actually exists.
    return list.length > 1 ? list[1] : null;
}

waitForElement('#reactCaptionsSettingsButton', SETTINGS_WAIT_MS).then((foundSettingsButton) => {
    settingsButton = foundSettingsButton;
    if (settingsButton) {
        settingsButton.addEventListener('click', function() {
            sleep(300).then(() => {
                d = document.querySelectorAll("li[role='menuitem']");
                const speedMenuItem = findSpeedMenuItem(d);
                if (!speedMenuItem) {
                    console.warn('[PCS] No speed entry in the settings menu —',
                                 d.length, 'items seen. Speed slider not injected.');
                }
                if (speedMenuItem) {
                    speedMenuItem.addEventListener('click', function() {
                        // console.log('Speed settings button clicked');
                        sleep(1).then(() => {
                            asd = document.querySelector('ul[role="menu"]');
                            if(asd){
                                // Create overall container div
// Create overall container div
const overallDiv = document.createElement("div");
overallDiv.style.display = "flex";
overallDiv.style.alignItems = "center";
overallDiv.style.paddingLeft = "20px";
overallDiv.style.paddingRight = "20px";

// Create the label span ("Select a value:")
const labelSpan = document.createElement("span");
labelSpan.textContent = "Select a value:";
labelSpan.style.fontSize = "0.875rem"; // Tailwind text-sm
labelSpan.style.color = "#71717A"; // Tailwind text-zinc-500
labelSpan.style.marginRight = "8px"; // Tailwind mr-2

// Create the input slider
const slider = document.createElement("input");
slider.type = "range";
slider.id = "dynamicSlider";
slider.name = "dynamicSlider";
slider.min = "0.5";
slider.max = "3";
slider.value = "1";
slider.step = "0.25";
slider.style.width = "100%"; // Tailwind w-full
slider.style.height = "8px"; // Tailwind h-2 (~8px)
slider.style.backgroundColor = "#3b82f6"; // Tailwind bg-blue-500
slider.style.borderRadius = "8px"; // Tailwind rounded-lg
slider.style.appearance = "none";
slider.style.cursor = "pointer";

// Create the editable span displaying the slider value ("1.75x")
const editableSpan = document.createElement("span");
editableSpan.id = "sliderValue";
editableSpan.textContent = "1.00x";
editableSpan.title = "Click to edit the speed";
editableSpan.style.marginLeft = "8px"; // Tailwind ml-2
editableSpan.style.fontSize = "1.125rem"; // Tailwind text-lg
editableSpan.style.fontWeight = "bold"; // Tailwind font-bold
editableSpan.style.color = "#3b82f6"; // Tailwind text-blue-500
editableSpan.style.cursor = "pointer";

// Add hover effect for underline using event listeners
editableSpan.addEventListener("mouseover", function () {
  editableSpan.style.textDecoration = "underline";
});
editableSpan.addEventListener("mouseout", function () {
  editableSpan.style.textDecoration = "none";
});

// Append the created elements to the overall container
overallDiv.appendChild(labelSpan);
overallDiv.appendChild(slider);
overallDiv.appendChild(editableSpan);

// --- Functionality for the editable span and slider ---

// Make the span editable on click
editableSpan.addEventListener('click', () => {
    editableSpan.setAttribute('contenteditable', 'true');
    editableSpan.focus();
});

// When the span loses focus, update its value and send the update
editableSpan.addEventListener('blur', () => {
    editableSpan.removeAttribute('contenteditable');
    // Update the text content after removing any non-numeric characters, then append "x"
    editableSpan.textContent = removeAllNonNums(editableSpan.textContent) + "x";
    // SEND THE THING (using console.log in this example)
    sendToTab("updateSpeed", localStorage.getItem('panoptoExtSpeed'));
});

// Prevent non-numeric keys and allow Enter to commit the change
editableSpan.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();  // Prevent new line
        editableSpan.blur();     // Trigger blur event to accept the value
    } else if (!isNumericKey(event)) {
        event.preventDefault();  // Prevent non-numeric characters
    }
});

// Helper function: remove all non-numeric characters from the input,
// update the slider value and localStorage accordingly
function removeAllNonNums(textStr) {
    let output = textStr.replace(/[^\d.]/g, '');
    const floatValue = parseFloat(output);
    if (!isNaN(floatValue)) {
        localStorage.setItem('panoptoExtSpeed', floatValue.toString());
        slider.value = floatValue.toString();
        return floatValue.toString();
    }
    // Attempt to parse as integer if float fails
    const intValue = parseInt(output);
    if (!isNaN(intValue)) {
        localStorage.setItem('panoptoExtSpeed', intValue.toString());
        slider.value = intValue.toString();
        return intValue.toString();
    }
    return '1.00';
}

// Helper function to allow only numeric input and specific control keys
function isNumericKey(event) {
    const key = event.key;
    return (key >= '0' && key <= '9') || 
           ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'x', 'X', '.', 'Ctrl', 'a'].includes(key);
}

// Set default values if they don't exist in localStorage
let storedSpeed = parseFloat(localStorage.getItem('panoptoExtSpeed'));
if (isNaN(storedSpeed)) {
    storedSpeed = 1;
    localStorage.setItem('panoptoExtSpeed', '1');
}

// Check if the stored speed is above the slider's default max (3) and update if necessary
let currentMax = parseFloat(slider.max);
if (storedSpeed > currentMax) {
    slider.max = storedSpeed; // Update slider max to reflect the actual speed
}

// Set the current slider value and span text to the stored speed
slider.value = storedSpeed;
editableSpan.innerText = `${storedSpeed.toFixed(2)}x`;

// Update slider changes in real time
slider.addEventListener('input', function() {
    updateSlider(this);
});

// When slider is released, "send" the speed
slider.addEventListener('mouseup', function() {
    sendSpeed();
});

// Function to update slider value and reflect it in the span and localStorage
function updateSlider(sliderElem) {
    let value = parseFloat(sliderElem.value);
    localStorage.setItem('panoptoExtSpeed', value);
    editableSpan.innerText = `${value.toFixed(2)}x`;
}

// Function to "send" the speed value (using console.log here)
function sendSpeed() {
    let value = parseFloat(slider.value);
    updateSpeed();
}

// Dummy sendToTab function that logs the message and value
function sendToTab(message, value) {
    console.log(`sendToTab: ${message} with value: ${value}`);
}

// --- Append overallDiv to your container at the top ---
// For example, if d is your container element:
// d.insertBefore(overallDiv, d.firstChild);


if(localStorage.getItem('panoptoExtSpeed')){
    slider.value = localStorage.getItem('panoptoExtSpeed');
    editableSpan.textContent = localStorage.getItem('panoptoExtSpeed') + "x";
} else{
    localStorage.setItem('panoptoExtSpeed', '1');
}



finalSpan = document.createElement('span');
// harvey.github.io 301-redirects to the custom domain, so link the destination
// directly. The store link gets /reviews — the listing root makes people hunt for
// the review box, and ratings are one of the two store ranking inputs Google names.
finalSpan.innerHTML = "Please use the <a target='_blank' href='https://harveychandler.dev/Panopto-Extension/pin_extension.html' style='font-weight: bold;'>extension popup window</a> to get all features.<br><br>" +
"<a target='_blank' href='https://chromewebstore.google.com/detail/panopto-custom-speed/fnoppdfnaklabgfllejlefomclegmnam/reviews' style='font-weight: bold;'>Please rate this extension on the store</a>";

// Create startup container div
const startupDiv = document.createElement("div");
startupDiv.style.display = "flex";
startupDiv.style.alignItems = "center";
startupDiv.style.marginBottom = "5px"; // equivalent to Tailwind's mb-4
startupDiv.style.paddingLeft = "25px";
startupDiv.style.paddingTop = "11px";

// Create the checkbox input element
const startupCheckbox = document.createElement("input");
startupCheckbox.id = "startupSpeed";
startupCheckbox.type = "checkbox";
startupCheckbox.value = "";
startupCheckbox.style.width = "16px"; // w-4
startupCheckbox.style.height = "16px"; // h-4
startupCheckbox.style.backgroundColor = "#F3F4F6"; // bg-gray-100
startupCheckbox.style.border = "1px solid #D1D5DB"; // border-gray-300
startupCheckbox.style.borderRadius = "4px"; // rounded
startupCheckbox.style.verticalAlign = "middle";
startupCheckbox.disabled = true;

// Check if first time use for the toggle
let checkIfFirstTimeUse = localStorage.getItem('speedOnStartup');
if (!checkIfFirstTimeUse) {
    localStorage.setItem('speedOnStartup', 'false');
} else{
    startupCheckbox.checked = true;
}

// Add event listener to the startup checkbox
startupCheckbox.addEventListener('click', () => {
    if (startupCheckbox.checked) {
        localStorage.setItem('speedOnStartup', 'true');
    } else {
        localStorage.setItem('speedOnStartup', 'false');
    }
    console.log(localStorage.getItem('speedOnStartup'));
});

// Create the label for the checkbox
const startupLabel = document.createElement("label");
startupLabel.htmlFor = "startupSpeed"; // make sure it matches the checkbox id
startupLabel.textContent = "Change speed on startup";
startupLabel.style.marginLeft = "8px"; // ms-2
startupLabel.style.fontSize = "0.875rem"; // text-sm
startupLabel.style.color = "#71717A"; // text-zinc-500

// Append checkbox and label to the startupDiv
startupDiv.appendChild(startupCheckbox);
startupDiv.appendChild(startupLabel);

asd.insertBefore(finalSpan, asd.firstChild);
asd.insertBefore(startupDiv, asd.firstChild);
asd.insertBefore(overallDiv, asd.firstChild);

                            }
                        });
                    });
                }
            });
        });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Lecture chapters — clickable jump points sourced from the AI-notes outline.
// Notes generation writes `chapters_<deliveryId>` to chrome.storage; here we show
// a collapsible panel on the player and seek the video when a chapter is clicked.
// ─────────────────────────────────────────────────────────────────────────────
(function initLectureChapters() {
    const deliveryId = new URLSearchParams(window.location.search).get('id');
    if (!deliveryId) return;
    const storageKey = 'chapters_' + deliveryId;

    let _data = null;      // chosen chapter set used by the panel + timeline
    let _panopto = null;   // chapters from Panopto's own table of contents (free, no AI)
    let _notes = null;     // chapters from the AI-notes outline (chrome.storage)
    let _enabled = true;   // user setting (default ON); restores native UI when off
    let _tlInterval = null;

    function tsToSeconds(ts) {
        if (typeof VttUtils !== 'undefined' && VttUtils.timestampToSeconds) return VttUtils.timestampToSeconds(ts);
        const p = String(ts).split(':').map(Number);
        return p.some(isNaN) ? 0 : p.reduce((a, v) => a * 60 + v, 0);
    }

    function seekTo(ts) {
        const video = document.querySelector('video');
        if (!video) return;
        try { video.currentTime = tsToSeconds(ts); video.play().catch(() => {}); } catch {}
    }

    function secsToHHMMSS(s) {
        if (typeof VttUtils !== 'undefined' && VttUtils.secsToHHMMSS) return VttUtils.secsToHHMMSS(Math.floor(s));
        s = Math.floor(s);
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
        return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(sec).padStart(2, '0');
    }

    // Panopto's own table of contents (slide / OCR markers). Free chapters, no AI —
    // returns [{ heading, ts }] sorted by time, or null if the lecture has no TOC.
    async function fetchPanoptoChapters() {
        try {
            const res = await fetch('/Panopto/Pages/Viewer/DeliveryInfo.aspx', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    deliveryId, responseType: 'json',
                    isLiveNotes: 'false', refreshAuthCookie: 'true', isActiveBroadcast: 'false',
                    isEditing: 'false', isKollectiveAgentInstalled: 'false', isEmbed: 'false',
                }).toString(),
            });
            if (!res.ok) return null;
            const text = await res.text();
            if (!text || text.trim()[0] === '<') return null;   // login/HTML page
            const data = JSON.parse(text);
            const stamps = (data && data.Delivery && data.Delivery.Timestamps) || [];
            const chapters = stamps
                .filter(t => t && t.ShowInTableOfContents !== false && typeof t.Time === 'number' && t.Caption && String(t.Caption).trim())
                .map(t => ({ secs: t.Time, heading: String(t.Caption).trim() }))
                .sort((a, b) => a.secs - b.secs);
            const out = [];
            for (const c of chapters) {
                // Drop near-duplicate consecutive entries (Panopto sometimes repeats a slide).
                if (out.length && c.secs - tsToSeconds(out[out.length - 1].ts) < 1 && out[out.length - 1].heading === c.heading) continue;
                out.push({ heading: c.heading, ts: secsToHHMMSS(c.secs) });
            }
            return out.length ? out : null;
        } catch { return null; }
    }

    // Panopto's TOC wins (free + lecturer-structured); AI-notes outline is the fallback.
    function removeChaptersUI() {
        const panel = document.getElementById('__pcs-chapters__'); if (panel) panel.remove();
        document.querySelectorAll('.__pcs-chap-tick__').forEach(t => t.remove());
        const tip = document.getElementById('__pcs-chap-tip__'); if (tip) tip.style.display = 'none';
        if (_tlInterval) { clearInterval(_tlInterval); _tlInterval = null; }
    }

    function applyChapters() {
        const ch = _enabled
            ? ((_panopto && _panopto.length) ? _panopto
               : (_notes && _notes.chapters && _notes.chapters.length) ? _notes.chapters
               : null)
            : null;
        _data = (ch && ch.length) ? { chapters: ch } : null;

        if (!_enabled) { removeChaptersUI(); return; }
        render();
        ensureTimelineChapters();
    }

    function render() {
        const old = document.getElementById('__pcs-chapters__');
        if (old) old.remove();
        if (!_data || !Array.isArray(_data.chapters) || !_data.chapters.length) return;

        const wrap = document.createElement('div');
        wrap.id = '__pcs-chapters__';
        wrap.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483000;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

        const panel = document.createElement('div');
        panel.style.cssText = 'display:none;flex-direction:column;width:300px;max-height:60vh;background:#161b22;color:#e6edf3;border:1px solid #262e38;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,0.45);overflow:hidden;margin-bottom:10px;';

        const header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:linear-gradient(135deg,#0a3d22,#11773D);flex-shrink:0;';
        const htitle = document.createElement('span');
        htitle.textContent = '📖 Lecture Chapters';
        htitle.style.cssText = 'font-size:0.8rem;font-weight:700;color:#fff;';
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = 'background:none;border:none;color:rgba(255,255,255,0.85);cursor:pointer;font-size:0.9rem;line-height:1;padding:0 2px;';
        header.append(htitle, closeBtn);

        const list = document.createElement('div');
        list.style.cssText = 'overflow-y:auto;padding:6px;';
        _data.chapters.forEach((c) => {
            const item = document.createElement('button');
            item.style.cssText = 'display:flex;gap:9px;align-items:baseline;width:100%;text-align:left;background:none;border:none;color:#e6edf3;cursor:pointer;padding:7px 8px;border-radius:7px;font-size:0.8rem;line-height:1.4;';
            item.addEventListener('mouseover', () => { item.style.background = '#1f2630'; });
            item.addEventListener('mouseout',  () => { item.style.background = 'none'; });
            const time = document.createElement('span');
            time.textContent = c.ts;
            time.style.cssText = 'color:#22c55e;font-weight:700;flex-shrink:0;font-family:"SF Mono",Consolas,monospace;';
            const label = document.createElement('span');
            label.textContent = c.heading;
            item.append(time, label);
            item.addEventListener('click', () => seekTo(c.ts));
            list.appendChild(item);
        });

        panel.append(header, list);

        const pill = document.createElement('button');
        pill.textContent = `📖 Chapters (${_data.chapters.length})`;
        pill.style.cssText = 'background:#11773D;color:#fff;border:none;border-radius:999px;padding:9px 16px;font-size:0.82rem;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.35);';

        wrap.append(panel, pill);
        document.documentElement.appendChild(wrap);

        pill.addEventListener('click', () => {
            panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
        });
        closeBtn.addEventListener('click', () => { panel.style.display = 'none'; });
    }

    // Floating label shown when hovering a timeline chapter tick.
    function getChapterTip() {
        let tip = document.getElementById('__pcs-chap-tip__');
        if (!tip) {
            tip = document.createElement('div');
            tip.id = '__pcs-chap-tip__';
            tip.style.cssText = 'position:fixed;z-index:2147483600;display:none;max-width:300px;background:#161b22;color:#e6edf3;border:1px solid #262e38;border-radius:7px;padding:5px 9px;font-size:0.74rem;font-weight:600;line-height:1.35;box-shadow:0 4px 14px rgba(0,0,0,0.5);pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
        }
        // In fullscreen the browser only paints the fullscreened element's subtree, so
        // the tooltip must live inside it (otherwise it's invisible). Re-parent each
        // time based on the current fullscreen state.
        const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
        const container = fsEl || document.documentElement;
        if (tip.parentNode !== container) container.appendChild(tip);
        return tip;
    }

    // YouTube-style chapter markers on the lecture timeline (#positionSlider).
    function renderTimelineChapters() {
        const slider = document.getElementById('positionSlider');
        if (!slider) return false;
        slider.querySelectorAll('.__pcs-chap-tick__').forEach(t => t.remove());   // clear stale first
        if (!_enabled || !_data || !Array.isArray(_data.chapters) || !_data.chapters.length) return true;

        // Need the lecture length to place ticks. Prefer the <video>, fall back to the
        // slider handle's aria-valuemax.
        const video = document.querySelector('video');
        let dur = video && video.duration;
        if (!dur || isNaN(dur)) {
            const handle = document.getElementById('positionHandle');
            const max = handle && parseFloat(handle.getAttribute('aria-valuemax'));
            dur = (max && !isNaN(max)) ? max : 0;
        }
        if (!dur || dur <= 0) return false;   // duration not ready — caller will retry

        _data.chapters.forEach((c) => {
            const secs = tsToSeconds(c.ts);
            if (!(secs >= 0) || secs > dur) return;
            const pct = Math.min(100, Math.max(0, (secs / dur) * 100));

            // Wide, transparent hover/click target so the thin marker is easy to hit.
            const tick = document.createElement('div');
            tick.className = '__pcs-chap-tick__';
            tick.style.cssText = 'position:absolute;top:50%;transform:translateY(-50%);left:' + pct +
                '%;width:11px;height:16px;margin-left:-5.5px;z-index:5;cursor:pointer;display:flex;align-items:center;justify-content:center;';
            const line = document.createElement('div');
            line.style.cssText = 'width:3px;height:12px;background:#fde047;box-shadow:0 0 2px rgba(0,0,0,0.7);border-radius:2px;';
            tick.appendChild(line);

            tick.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); seekTo(c.ts); });
            tick.addEventListener('mouseenter', () => {
                const tip = getChapterTip();
                tip.textContent = c.ts + ' · ' + c.heading;
                tip.style.display = 'block';
                const r = tick.getBoundingClientRect();
                tip.style.left = (r.left + r.width / 2) + 'px';
                tip.style.top  = (r.top - tip.offsetHeight - 8) + 'px';
                tip.style.transform = 'translateX(-50%)';
            });
            tick.addEventListener('mouseleave', () => {
                const tip = document.getElementById('__pcs-chap-tip__');
                if (tip) tip.style.display = 'none';
            });
            slider.appendChild(tick);
        });
        return true;
    }

    function ensureTimelineChapters() {
        if (_tlInterval) clearInterval(_tlInterval);
        let tries = 0;
        _tlInterval = setInterval(() => {
            if (renderTimelineChapters() || ++tries > 40) { clearInterval(_tlInterval); _tlInterval = null; }
        }, 500);   // wait for the player slider + duration to be ready (~up to 20s)
    }

    // Load the on/off setting (default ON) + any saved notes outline, then render.
    chrome.storage.local.get(['pcsChaptersEnabled', storageKey], (res) => {
        _enabled = !(res && res.pcsChaptersEnabled === false);
        if (res && res[storageKey]) _notes = res[storageKey];
        applyChapters();
    });

    // Free, automatic: pull Panopto's own table of contents for this lecture.
    fetchPanoptoChapters().then((ch) => { if (ch && ch.length) { _panopto = ch; applyChapters(); } });

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (changes[storageKey])         _notes   = changes[storageKey].newValue;
        if (changes.pcsChaptersEnabled)  _enabled = changes.pcsChaptersEnabled.newValue !== false;
        if (changes[storageKey] || changes.pcsChaptersEnabled) applyChapters();
    });
})();

// ─────────────────────────────────────────────────────────────────────────────
// In-page AI lecture chat (premium). A right-side panel; "Start chat" grabs the
// transcript for context, then you can ask questions about where you are in the
// video. The popup publishes the setting (pcsInPageChat) and auth (pcsAuth).
// ─────────────────────────────────────────────────────────────────────────────
(function initInPageChat() {
    const CHAT_BACKEND = 'https://panopto-stripe.harveychandler235.workers.dev';
    const deliveryId = new URLSearchParams(window.location.search).get('id');
    if (!deliveryId) return;   // only on the viewer page

    let _auth     = null;   // { email, token, premium }
    let _enabled  = false;  // pcsInPageChat setting
    let _started  = false;
    let _captions = null;
    let _title    = '';
    let _history  = [];      // {role, text}
    let _busy     = false;

    // Shared per-lecture chat store. Lives in chrome.storage so the notes page (Chat
    // tab) and this in-page panel share ONE conversation + transcript per lecture.
    const CHAT_STORE_KEY     = 'pcsChat_' + deliveryId;
    const CHAT_STORE_MAX_AGE = 60 * 24 * 3600 * 1000;   // ignore chats older than 60 days

    function applySavedChat(saved) {
        if (!saved || !saved.captions || !Array.isArray(saved.history)) return false;
        if (saved.savedAt && Date.now() - saved.savedAt > CHAT_STORE_MAX_AGE) return false;
        _captions = saved.captions;
        _title    = saved.title || '';
        _history  = saved.history;
        _started  = true;
        return true;
    }

    function saveChat() {
        if (!_started || !_captions) return;
        try {
            chrome.storage.local.set({
                [CHAT_STORE_KEY]: { captions: _captions, title: _title, history: _history, savedAt: Date.now() },
            });
        } catch (e) {}
    }

    // Render a LaTeX snippet to MathML — needs no CSS/fonts, so it stays light and
    // the browser typesets it natively. Falls back to monospace if KaTeX is missing.
    function renderMath(tex, display) {
        try {
            if (typeof katex !== 'undefined' && katex.renderToString) {
                return katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'mathml' });
            }
        } catch {}
        return '<code style="background:#0d1117;padding:1px 4px;border-radius:4px;">' +
               String(tex).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</code>';
    }

    // Group markdown bullet/numbered lines into real <ul>/<ol> and wrap the rest as
    // paragraphs. Runs after inline formatting, before math placeholders are restored.
    function mdBlocks(s) {
        const lines = s.split('\n');
        const out = [];
        let list = null;   // { type:'ul'|'ol', items:[] }
        let para = [];
        const flushPara = () => { if (para.length) { out.push('<div style="margin:0 0 5px;">' + para.join('<br>') + '</div>'); para = []; } };
        const flushList = () => {
            if (!list) return;
            // Set list-style explicitly so Panopto's page CSS can't strip the markers.
            const marker = list.type === 'ul' ? 'disc' : 'decimal';
            out.push('<' + list.type + ' style="margin:5px 0;padding-left:22px;list-style:' + marker + ';">' +
                     list.items.map(x => '<li style="margin:2px 0;list-style:' + marker + ';">' + x + '</li>').join('') +
                     '</' + list.type + '>');
            list = null;
        };
        for (const raw of lines) {
            const b = raw.match(/^\s*[\*\-+•]\s+(.*)$/);
            const o = raw.match(/^\s*\d+[.)]\s+(.*)$/);
            if (b)                 { flushPara(); if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] }; } list.items.push(b[1]); }
            else if (o)            { flushPara(); if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] }; } list.items.push(o[1]); }
            else if (!raw.trim())  { flushPara(); flushList(); }
            else                   { flushList(); para.push(raw); }
        }
        flushPara(); flushList();
        return out.join('');
    }

    function liteMd(text) {
        const math = [];
        let s = String(text);
        // Pull math out BEFORE escaping so the $…$ / LaTeX survive intact, then
        // drop the rendered MathML back in after escaping the surrounding prose.
        s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => { math.push(renderMath(tex.trim(), true));  return ' M' + (math.length - 1) + ' '; });
        s = s.replace(/\$([^$\n]+?)\$/g,     (_, tex) => { math.push(renderMath(tex.trim(), false)); return ' M' + (math.length - 1) + ' '; });
        s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/`([^`]+)`/g, '<code style="background:#0d1117;padding:1px 4px;border-radius:4px;">$1</code>');
        s = mdBlocks(s);
        s = s.replace(/ M(\d+) /g, (_, i) => math[+i]);
        return s;
    }

    function currentPosition() {
        const v = document.querySelector('video');
        if (!v || isNaN(v.currentTime)) return '';
        if (typeof VttUtils !== 'undefined' && VttUtils.secsToHHMMSS) return VttUtils.secsToHHMMSS(Math.floor(v.currentTime));
        return '';
    }

    function setHint(text, isError) {
        const h = document.getElementById('__pcs-chat-hint__');
        if (h) { h.textContent = text || ''; h.style.color = isError ? '#f87171' : '#8b949e'; }
    }

    function addMsg(role, html, pending) {
        const log = document.getElementById('__pcs-chat-log__');
        if (!log) return null;
        const empty = document.getElementById('__pcs-chat-empty__');
        if (empty) empty.style.display = 'none';
        const d = document.createElement('div');
        d.style.cssText = 'max-width:88%;padding:8px 11px;border-radius:12px;font-size:0.82rem;line-height:1.5;' + (
            role === 'user'
              ? 'align-self:flex-end;background:#11773D;color:#fff;border-bottom-right-radius:3px;'
              : 'align-self:flex-start;background:#0d1117;border:1px solid #262e38;color:#e6edf3;border-bottom-left-radius:3px;' + (pending ? 'opacity:0.7;font-style:italic;' : '')
        );
        d.innerHTML = html;
        log.appendChild(d);
        log.scrollTop = log.scrollHeight;
        return d;
    }

    function chatErr(code) {
        if (code === 'not_premium')   return 'Chat is a premium feature.';
        if (code === 'rate_limited')  return "You've used all 20 messages for today (resets midnight UTC).";
        if (code === 'start_limit')   return "You've started the max chats for today. Try again tomorrow.";
        if (code === 'caption_too_long') return 'This lecture is too long for chat.';
        if (code === 'Unauthorized' || code === 'invalid_token') return 'Sign-in expired — open the extension popup to refresh, then retry.';
        return 'Something went wrong. Please try again.';
    }

    async function startChat() {
        if (!_auth) { setHint(chatErr('Unauthorized'), true); return; }
        const btn = document.getElementById('__pcs-chat-start__');
        if (btn) { btn.disabled = true; btn.textContent = 'Starting…'; }
        setHint('Reserving a chat session…');
        try {
            const res = await fetch(`${CHAT_BACKEND}/inpageChatStart`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: _auth.token, email: _auth.email }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) {
                setHint(res.status === 401 ? chatErr('Unauthorized') : chatErr(data.error), true);
                if (btn) { btn.disabled = false; btn.textContent = '✨ Start chat'; }
                return;
            }
            setHint('Reading the transcript…');
            const ctx = await gatherLectureContext();
            if (!ctx || ctx.error || !ctx.hasCaptions) {
                setHint('Could not load this lecture\'s captions. Refresh the page and try again.', true);
                if (btn) { btn.disabled = false; btn.textContent = '✨ Start chat'; }
                return;
            }
            _captions = ctx.captionsCleaned;
            _title    = ctx.title || '';
            _started  = true;
            saveChat();
            renderBody();
            setHint(data.unlimited
                ? '⚡ Unlimited usage — no daily limit.'
                : `${data.startsLimit - data.startsUsed} chat starts left today · ${data.msgLimit - data.msgsUsed} messages left`);
        } catch {
            setHint('Network error — please try again.', true);
            if (btn) { btn.disabled = false; btn.textContent = '✨ Start chat'; }
        }
    }

    async function sendMsg() {
        if (_busy || !_started || !_auth) return;
        const input = document.getElementById('__pcs-chat-input__');
        const q = (input.value || '').trim();
        if (!q) return;
        input.value = '';
        input.style.height = 'auto';
        addMsg('user', liteMd(q));
        const prior = _history.slice(-12);
        _history.push({ role: 'user', text: q });
        _busy = true;
        const pending = addMsg('bot', 'Thinking…', true);
        try {
            const res = await fetch(`${CHAT_BACKEND}/inpageChat`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: _auth.token, email: _auth.email,
                    captionsCleaned: _captions, question: q, history: prior,
                    position: currentPosition(), lang: 'en', title: _title,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (pending) { pending.style.opacity = '1'; pending.style.fontStyle = 'normal'; }
            if (!res.ok || !data.answer) {
                if (pending) pending.innerHTML = liteMd(res.status === 401 ? chatErr('Unauthorized') : chatErr(data.error));
                _history.pop();
            } else {
                if (pending) pending.innerHTML = liteMd(data.answer);
                _history.push({ role: 'assistant', text: data.answer });
                if (data.unlimited) setHint('⚡ Unlimited usage');
                else if (data.used != null && data.limit != null) setHint(`${Math.max(0, data.limit - data.used)} messages left today`);
            }
        } catch {
            if (pending) pending.innerHTML = liteMd('Network error — please try again.');
            _history.pop();
        } finally {
            _busy = false;
            saveChat();   // persist the conversation so a reload keeps it
        }
    }

    function renderBody() {
        const body = document.getElementById('__pcs-chat-body__');
        if (!body) return;
        if (!_started) {
            body.innerHTML =
                '<div style="color:#8b949e;font-size:0.8rem;line-height:1.55;text-align:center;padding:16px 6px;">' +
                'Chat about this lecture — it reads the transcript for context, so you can ask things like ' +
                '<em>"explain what\'s happening here"</em> or <em>"summarise this section"</em>.</div>' +
                '<button id="__pcs-chat-start__" style="width:100%;background:#11773D;color:#fff;border:none;border-radius:8px;padding:10px;font-weight:700;font-size:0.85rem;cursor:pointer;">✨ Start chat</button>';
            document.getElementById('__pcs-chat-start__').addEventListener('click', startChat);
            return;
        }
        body.innerHTML =
            '<div id="__pcs-chat-log__" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:9px;padding:2px 2px 8px;">' +
            '<div id="__pcs-chat-empty__" style="color:#8b949e;font-size:0.78rem;text-align:center;margin:auto;padding:0 8px;">Ask anything about this lecture.</div></div>' +
            '<div style="display:flex;gap:6px;align-items:flex-end;border-top:1px solid #262e38;padding-top:8px;">' +
            '<textarea id="__pcs-chat-input__" rows="1" placeholder="Ask about this lecture…" style="flex:1;resize:none;max-height:110px;background:#0d1117;color:#e6edf3;border:1px solid #262e38;border-radius:8px;padding:8px;font-size:0.82rem;font-family:inherit;outline:none;"></textarea>' +
            '<button id="__pcs-chat-send__" style="background:#11773D;color:#fff;border:none;border-radius:8px;padding:8px 13px;font-weight:700;font-size:0.82rem;cursor:pointer;flex-shrink:0;">Send</button></div>';
        const input = document.getElementById('__pcs-chat-input__');
        const send  = document.getElementById('__pcs-chat-send__');
        // Replay a saved/earlier conversation (e.g. after a page reload).
        if (_history.length) {
            _history.forEach(m => addMsg(m.role === 'user' ? 'user' : 'bot', liteMd(m.text)));
            setHint('Showing your saved chat for this lecture.');
        }
        input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 110) + 'px'; });
        // Stop key events bubbling to Panopto's player, so Space/M/arrows type into the
        // box instead of pausing/muting/seeking the lecture. (Doesn't preventDefault, so
        // normal typing still works.)
        const stopKeys = (e) => e.stopPropagation();
        input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } });
        input.addEventListener('keyup', stopKeys);
        input.addEventListener('keypress', stopKeys);
        send.addEventListener('click', sendMsg);
    }

    function removePanel() {
        const el = document.getElementById('__pcs-chat__');
        if (el) el.remove();
    }

    function renderPanel() {
        if (document.getElementById('__pcs-chat__')) return;
        const wrap = document.createElement('div');
        wrap.id = '__pcs-chat__';
        wrap.style.cssText = 'position:fixed;right:16px;top:84px;z-index:2147482000;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;flex-direction:column;align-items:flex-end;';

        const pill = document.createElement('button');
        pill.textContent = '💬 AI Chat';
        pill.style.cssText = 'background:#11773D;color:#fff;border:none;border-radius:999px;padding:9px 16px;font-size:0.82rem;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.35);';

        const panel = document.createElement('div');
        panel.style.cssText = 'display:none;flex-direction:column;width:330px;height:62vh;max-height:560px;background:#161b22;color:#e6edf3;border:1px solid #262e38;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,0.5);overflow:hidden;margin-bottom:10px;';

        const header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:linear-gradient(135deg,#0a3d22,#11773D);flex-shrink:0;';
        header.innerHTML = '<span style="font-size:0.82rem;font-weight:700;color:#fff;">💬 Lecture Chat</span>';
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = 'background:none;border:none;color:rgba(255,255,255,0.85);cursor:pointer;font-size:0.9rem;';
        header.appendChild(closeBtn);

        const body = document.createElement('div');
        body.id = '__pcs-chat-body__';
        body.style.cssText = 'flex:1;display:flex;flex-direction:column;min-height:0;padding:12px;';

        const hint = document.createElement('div');
        hint.id = '__pcs-chat-hint__';
        hint.style.cssText = 'font-size:0.7rem;color:#8b949e;padding:0 12px 10px;min-height:1em;';

        panel.append(header, body, hint);
        wrap.append(panel, pill);
        document.documentElement.appendChild(wrap);

        pill.addEventListener('click', () => { panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex'; });
        closeBtn.addEventListener('click', () => { panel.style.display = 'none'; });
        renderBody();
    }

    function refresh() {
        const show = _enabled && _auth && _auth.premium;
        if (show) renderPanel();
        else removePanel();
    }

    // Load settings + the shared per-lecture chat in one go, then render.
    chrome.storage.local.get(['pcsInPageChat', 'pcsAuth', CHAT_STORE_KEY], (res) => {
        _enabled = res && res.pcsInPageChat === true;
        _auth    = (res && res.pcsAuth) || null;
        applySavedChat(res && res[CHAT_STORE_KEY]);
        refresh();
    });

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (changes.pcsInPageChat) _enabled = changes.pcsInPageChat.newValue === true;
        if (changes.pcsAuth)       _auth    = changes.pcsAuth.newValue || null;
        // The notes page (or another tab) updated this lecture's shared conversation.
        if (changes[CHAT_STORE_KEY]) {
            const v = changes[CHAT_STORE_KEY].newValue;
            if (v && Array.isArray(v.history)) {
                const grew = v.history.length !== _history.length;
                applySavedChat(v);
                const input = document.getElementById('__pcs-chat-input__');
                if (grew && document.getElementById('__pcs-chat__') && (!input || !input.value)) renderBody();
            }
        }
        if (changes.pcsInPageChat || changes.pcsAuth) refresh();
    });
})();

// ─────────────────────────────────────────────────────────────────────────────
// Dark theme for the Panopto page. document_start (darktheme.js) paints it with no
// flash on load; this applies it live when toggled and mirrors the setting into the
// page's localStorage so darktheme.js has it on the next refresh.
// ─────────────────────────────────────────────────────────────────────────────
(function initPageDarkTheme() {
    // This script now runs in sub-frames too (all_frames). The top document's invert
    // already covers a same-origin child, and its own `iframe{invert}` rule un-inverts
    // that child so it looks right — a second invert inside the child would flip it
    // back. So only paint where nothing above us is already doing it: the top frame,
    // or an embedded viewer whose parent is a different origin (Canvas/Moodle/etc).
    function ownsPageTheme() {
        if (window.top === window.self) return true;
        try { void window.parent.location.hostname; return false; }  // same-origin ancestor handles it
        catch (e) { return true; }                                   // cross-origin parent: we are the embed
    }
    if (!ownsPageTheme()) return;

    function applyPageDark(on) {
        try { localStorage.setItem('pcsDarkTheme', on ? '1' : '0'); } catch (e) {}
        const existing = document.getElementById('__pcs-dark-page__');
        if (on && !existing) {
            const s = document.createElement('style');
            s.id = '__pcs-dark-page__';
            s.textContent =
                'html{background:#fff!important;filter:invert(1) hue-rotate(180deg)!important}' +
                'img,video,canvas,iframe,embed,object,picture,[style*="background-image"],' +
                '#__pcs-chat__,#__pcs-chapters__,#__pcs-chap-tip__,.__pcs-chap-tick__,#__pcs-dub__,#__pcs-dub-bar__' +
                '{filter:invert(1) hue-rotate(180deg)!important}';
            (document.head || document.documentElement).appendChild(s);
        } else if (!on && existing) {
            existing.remove();
        }
    }

    chrome.storage.local.get('pcsDarkTheme', (r) => { applyPageDark(!!(r && r.pcsDarkTheme)); });
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.pcsDarkTheme) applyPageDark(changes.pcsDarkTheme.newValue === true);
    });
})();

// ─────────────────────────────────────────────────────────────────────────────
// DUBBED LECTURE (ALPHA) — opened from the popup's "Dub Lecture" button, which
// messages this content script (action: openDubModal). We translate the lecture's
// captions via the backend (Gemini), then SPEAK them with the browser's built-in
// speech synthesis in time with the video: the original audio is muted and the
// video is briefly auto-paused whenever a translated line runs longer than its
// on-screen window, so the dub never drifts. Nothing is recorded or uploaded —
// only caption text leaves the page, and only to translate it.
// ─────────────────────────────────────────────────────────────────────────────
(function initDubbedLecture() {
    const BACKEND = 'https://panopto-stripe.harveychandler235.workers.dev';
    const synth   = window.speechSynthesis || null;

    let _auth = null;   // { email, token, premium } — published by the popup
    chrome.storage.local.get('pcsAuth', (r) => { _auth = (r && r.pcsAuth) || null; });
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.pcsAuth) _auth = changes.pcsAuth.newValue || null;
    });

    // ── Engine state ────────────────────────────────────────────────────────────
    let active       = false;  // dub currently running
    let units        = [];     // [{start, text}] translated, sorted by start
    let idx          = 0;      // next unit to speak
    let curIdx       = -1;     // unit currently being spoken (-1 = none)
    let speaking     = false;
    let pausedForDub = false;  // WE paused the video to let the dub catch up
    let lastTime     = 0;      // last seen currentTime — for state-driven seek detection
    let lastWall     = 0;      // wall-clock at lastTime, to tell a seek from normal advance
    let voice        = null;   // chosen SpeechSynthesisVoice
    let langCode     = 'en';
    let primary      = null;   // the video element we drive timing from
    let mutedVideos  = [];     // [{v, prevMuted}] to restore on stop
    let keepAlive    = null;   // interval guarding Chrome's speech cutoff bug
    let curChunks    = [];     // chunks of the unit currently being spoken
    let curChunkIdx  = 0;      // which chunk we're on (so a rate change can restart it)
    let speakGen     = 0;      // bumped to invalidate an in-flight utterance
    let rateTimer    = null;   // debounce for live speed-changer restarts
    let captionEl    = null;   // Panopto's #dockedCaptionText, mirrored to the translation
    let captionObs   = null;   // observer re-applying our caption when Panopto rewrites it
    let lastCaptionFind = 0;   // throttle the DOM search when the caption element is absent
    let resumeSpeaking = false; // user paused mid-line → resume that line on play
    let curOffset    = 0;      // char offset reached in the current chunk (word-boundary)
    let curRate      = 1;      // rate the in-flight utterance is using (to detect changes)
    let dubVolume    = 1;      // 0..1 dub loudness, user-adjustable from the control bar

    const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

    // Restore the saved dub volume (set via the control bar's slider).
    chrome.storage.local.get('pcsDubVolume', (r) => {
        if (r && typeof r.pcsDubVolume === 'number') dubVolume = clamp(r.pcsDubVolume, 0, 1);
    });

    // ── Video discovery ──────────────────────────────────────────────────────────
    function getVideos() {
        const out = [];
        const walk = (root) => {
            if (!root || !root.querySelectorAll) return;
            try {
                root.querySelectorAll('video, audio').forEach(v => out.push(v));
                root.querySelectorAll('*').forEach(el => { if (el.shadowRoot) walk(el.shadowRoot); });
            } catch (e) {}
        };
        walk(document);
        return Array.from(new Set(out));
    }
    function pickPrimary(media) {
        const vids = media.filter(m => m.tagName === 'VIDEO');
        const pool = vids.length ? vids : media;
        const withDur = pool.filter(v => !isNaN(v.duration) && v.duration > 0);
        if (withDur.length) return withDur.sort((a, b) => (b.duration || 0) - (a.duration || 0))[0];
        return pool[0] || null;
    }

    // ── Voices ────────────────────────────────────────────────────────────────────
    function loadVoices() {
        return new Promise((resolve) => {
            if (!synth) return resolve([]);
            const have = synth.getVoices();
            if (have && have.length) return resolve(have);
            let done = false;
            const fin = () => {
                if (done) return; done = true;
                try { synth.removeEventListener('voiceschanged', fin); } catch (e) {}
                resolve(synth.getVoices());
            };
            try { synth.addEventListener('voiceschanged', fin); } catch (e) {}
            setTimeout(fin, 1500);
        });
    }
    function languageLabel(code) {
        try {
            const base = code.split('-')[0];
            const dn = new Intl.DisplayNames([navigator.language || 'en'], { type: 'language' });
            const name = dn.of(base) || code;
            const region = code.includes('-') ? code.split('-').slice(1).join('-') : '';
            return region ? `${name} (${region})` : name;
        } catch (e) { return code; }
    }
    // One entry per BCP-47 code present in the installed voices, best voice chosen.
    function voicesByLanguage(voices) {
        const map = new Map();
        for (const v of voices) {
            if (!v || !v.lang) continue;
            const code  = v.lang.replace('_', '-');
            const score = (v.default ? 2 : 0) + (v.localService ? 1 : 0);
            const cur   = map.get(code);
            if (!cur || score > cur.score) map.set(code, { code, voice: v, score, label: languageLabel(code) });
        }
        return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    }

    // ── Caption gathering (fine-grained timing) ─────────────────────────────────
    async function gatherTimedCues(id) {
        const jsonTimed = async (resp) => {
            if (!resp || !resp.ok) return [];
            const text = await resp.text();
            if (!text || text.trim()[0] === '<') return [];
            let parsed; try { parsed = JSON.parse(text); } catch (e) { return []; }
            return VttUtils.cleanPanoptoCaptionsJsonTimed(parsed);
        };
        const vttTimed = async (resp) => {
            if (!resp || !resp.ok) return [];
            const text = await resp.text();
            if (!text || text.trim()[0] === '<') return [];
            return VttUtils.cleanVttTimed(text);
        };
        const attempts = [
            () => fetch('/Panopto/Pages/Viewer/DeliveryInfo.aspx', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ deliveryId: id, getCaptions: 'true', language: '0', responseType: 'json' }).toString(),
            }).then(jsonTimed),
            () => fetch(`/Panopto/Pages/Viewer/DeliveryInfo.aspx?deliveryId=${encodeURIComponent(id)}&getCaptions=true&language=0&responseType=json`, { credentials: 'include' }).then(jsonTimed),
            () => fetch(`/Panopto/Pages/Transcription/GenerateSubtitles.ashx?deliveryId=${encodeURIComponent(id)}&language=0`, { credentials: 'include' }).then(vttTimed),
        ];
        for (const run of attempts) {
            try { const cues = await run(); if (cues && cues.length >= 3) return cues; } catch (e) {}
        }
        return [];
    }

    // Merge raw cues into ~sentence units (break on sentence end or MAX chars) so the
    // translation flows and we speak fewer, longer lines. Keeps the first cue's start.
    function mergeUnits(cues) {
        const MAX = 220;
        const out = [];
        let cur = null;
        for (const c of cues) {
            const t = (c.text || '').trim();
            if (!t) continue;
            if (!cur) { cur = { start: c.start, text: t }; continue; }
            const endsSentence = /[.!?。！？]["')\]]?\s*$/.test(cur.text);
            const merged = (cur.text + ' ' + t).replace(/\s+/g, ' ').trim();
            if (!endsSentence && merged.length <= MAX) cur.text = merged;
            else { out.push(cur); cur = { start: c.start, text: t }; }
        }
        if (cur) out.push(cur);
        return out;
    }

    // Split text into <=max-char chunks at word boundaries. Short utterances dodge
    // Chrome's ~15s single-utterance speech-cutoff bug.
    function chunkText(text, max) {
        const words = String(text).split(/\s+/).filter(Boolean);
        const chunks = [];
        let buf = '';
        for (const w of words) {
            if (buf && (buf.length + 1 + w.length) > max) { chunks.push(buf); buf = w; }
            else buf = buf ? buf + ' ' + w : w;
        }
        if (buf) chunks.push(buf);
        return chunks.length ? chunks : [String(text)];
    }

    // ── Translation (client cache → server cache → Gemini) ───────────────────────
    const cacheKey = (id, lang) => `dub2_${id}_${lang}`;   // v2: filler-word removal (re-translate)
    function quickHash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); }

    function loadCachedUnits(id, lang, sourceHash) {
        return new Promise((resolve) => {
            const key = cacheKey(id, lang);
            chrome.storage.local.get(key, (r) => {
                const v = r && r[key];
                if (v && v.sourceHash === sourceHash && Array.isArray(v.units) && v.units.length) resolve(v.units);
                else resolve(null);
            });
        });
    }
    function saveCachedUnits(id, lang, sourceHash, u) {
        try { chrome.storage.local.set({ [cacheKey(id, lang)]: { units: u, sourceHash, savedAt: Date.now() } }); } catch (e) {}
    }

    async function translateUnits(srcUnits, lang, langName, title) {
        const res = await fetch(`${BACKEND}/translate-captions`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: _auth.token, email: _auth.email, lines: srcUnits.map(u => u.text), lang, langName, title }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error(data.error || 'translate_failed');
            err.status = res.status; err.code = data.error; err.reason = data.reason;
            throw err;
        }
        const tl = Array.isArray(data.lines) ? data.lines : [];
        return {
            units: srcUnits.map((u, i) => ({ start: u.start, text: tl[i] || u.text })),
            complete: data.complete !== false,   // older/cached responses have no flag → treat as complete
        };
    }

    function translateErr(e) {
        const code = e && (e.code || e.message);
        if (e && e.status === 401)   return 'Sign-in expired — reopen the extension popup to refresh, then try again.';
        if (code === 'not_premium')  return 'You’ve used your free dub. Dubbing is a Premium feature — open the extension popup to upgrade.';
        if (code === 'rate_limited') return 'Daily dub limit reached (resets midnight UTC).';
        if (code === 'caption_too_long') return 'This lecture is too long to dub.';
        if (code === 'gemini_failed')    return 'Translation service is busy right now. Please try again in a moment.';
        return 'Couldn’t translate this lecture. Please try again.';
    }

    // ── Dub engine ────────────────────────────────────────────────────────────────
    function resyncIndex() {
        const t = primary ? primary.currentTime : 0;
        let i = 0;
        while (i < units.length && units[i].start < t - 0.25) i++;
        idx = i;
    }

    function speakRate() {
        // Track the speed changer LIVE. The user's chosen speed lives in the page's
        // localStorage (panoptoExtSpeed) — the same source the speed feature itself uses —
        // so we read it directly. That's more reliable than the ratechange event and
        // ignores the silence-skipper's transient playbackRate bumps (which don't touch it).
        let r = parseFloat(localStorage.getItem('panoptoExtSpeed'));
        if (!isFinite(r) || r <= 0) r = primary ? (primary.playbackRate || 1) : 1;
        return clamp(r, 0.5, 4);
    }

    // Speak the current unit from curChunkIdx onward. A generation token lets a live rate
    // change, pause, seek, or stop invalidate the in-flight utterance: when synth.cancel()
    // fires a stale 'end', the guard ignores it instead of marching on. We also cancel any
    // utterance still playing BEFORE starting, so a restart/resume can never overlap.
    function speakFromCurrentChunk() {
        if (synth && (synth.speaking || synth.pending)) { try { synth.cancel(); } catch (e) {} }
        const myGen = ++speakGen;
        const go = () => {
            if (!active || myGen !== speakGen) return;
            if (curChunkIdx >= curChunks.length) { onUtteranceDone(); return; }
            const base = curOffset;   // resume point within this chunk (0, or a word boundary)
            const text = curChunks[curChunkIdx].slice(base) || curChunks[curChunkIdx];
            curRate = speakRate();
            const utt = new SpeechSynthesisUtterance(text);
            if (voice) utt.voice = voice;
            utt.lang   = voice ? voice.lang : langCode;
            utt.rate   = curRate;
            utt.volume = dubVolume;
            // Track progress by word boundary so a pause, speed or volume change resumes
            // from where we are rather than restarting the whole line.
            utt.onboundary = (e) => { if (myGen !== speakGen) return; if (typeof e.charIndex === 'number') curOffset = base + e.charIndex; };
            utt.onend   = () => { if (myGen !== speakGen) return; curChunkIdx++; curOffset = 0; go(); };
            utt.onerror = () => { if (myGen !== speakGen) return; curChunkIdx++; curOffset = 0; go(); };
            try { synth.speak(utt); } catch (e) { curChunkIdx++; curOffset = 0; go(); }
        };
        go();
    }

    function speakUnit(u) {
        speaking = true;
        // Cap above the merge size (220) so a sentence-unit is ONE utterance — no mid-
        // sentence chunk gaps. Only a freakishly long single caption would ever split.
        curChunks = chunkText(u.text, 240);
        curChunkIdx = 0;
        curOffset = 0;
        applyCaption();           // mirror this line into Panopto's on-screen caption
        speakFromCurrentChunk();
    }

    function onUtteranceDone() {
        speaking = false;
        idx = curIdx + 1;
        curIdx = -1;
        if (pausedForDub && active && primary) { pausedForDub = false; primary.play().catch(() => {}); }
        control();   // a later line may already be due (gap closed, or bunched after a seek)
    }

    // Master control loop. Driven by an interval (so it runs even while paused and is
    // immune to Panopto's irregular play/pause/seek events) plus the media events as
    // immediate triggers. It reads the video's ACTUAL state each call and reconciles —
    // this is what makes scrubbing and pausing self-correct instead of getting stuck.
    function control() {
        if (!active || !primary) return;
        // Keep the original audio muted even if Panopto (or another feature) un-mutes it.
        for (const m of mutedVideos) { if (m.v && !m.v.muted) { try { m.v.muted = true; } catch (e) {} } }
        applyCaption();

        const now = Date.now();
        const t   = primary.currentTime;

        if (primary.seeking) { lastTime = t; lastWall = now; return; }   // mid-seek, wait

        if (primary.paused) {
            // User (not our auto-pace) paused mid-line → stop and resume it on play.
            if (!pausedForDub && speaking) {
                resumeSpeaking = true; speaking = false; speakGen++; try { synth.cancel(); } catch (e) {}
            }
            lastTime = t; lastWall = now;
            return;
        }

        // Playing. Detect a seek even with no clean event by comparing the actual time
        // change against the advance playback alone could produce (this also survives
        // background-tab timer throttling, which would otherwise look like a jump).
        const expected = ((now - lastWall) / 1000) * (primary.playbackRate || 1);
        if (Math.abs((t - lastTime) - expected) > 1.5) {
            if (speaking) { speakGen++; try { synth.cancel(); } catch (e) {} }
            speaking = false; pausedForDub = false; resumeSpeaking = false; curIdx = -1;
            resyncIndex();
        }
        lastTime = t; lastWall = now;

        if (speaking) {
            const nextStart = (curIdx + 1 < units.length) ? units[curIdx + 1].start : Infinity;
            if (t >= nextStart - 0.05) { pausedForDub = true; primary.pause(); }   // auto-pace
            else if (Math.abs(speakRate() - curRate) > 0.05) scheduleRestart();    // live speed
            return;
        }

        if (resumeSpeaking) { resumeSpeaking = false; speaking = true; speakFromCurrentChunk(); return; }
        if (idx < units.length && t >= units[idx].start - 0.05) {
            curIdx = idx;
            speakUnit(units[idx]);
        }
    }

    const onControl = () => control();
    const onSeeking = () => {
        if (!active) return;
        // Stop the current line the instant the user grabs the scrubber.
        speakGen++; try { synth.cancel(); } catch (e) {}
        speaking = false; pausedForDub = false; resumeSpeaking = false; curIdx = -1;
    };
    const onSeeked = () => {
        if (!active || !primary) return;
        resyncIndex(); lastTime = primary.currentTime; lastWall = Date.now(); control();
    };
    // Debounced restart of the current line — re-speaks from the current word boundary
    // (curOffset) at the latest rate and volume. Shared by speed and volume changes.
    function scheduleRestart() {
        if (rateTimer) clearTimeout(rateTimer);
        rateTimer = setTimeout(() => {
            rateTimer = null;
            if (!active || !speaking) return;
            speakFromCurrentChunk();   // cancels the in-flight utterance itself
        }, 140);
    }
    const onRateChange = () => {
        if (!active || !speaking) return;
        if (Math.abs(speakRate() - curRate) > 0.05) scheduleRestart();
    };

    function attach(v) {
        if (!v) return;
        v.addEventListener('timeupdate', onControl);
        v.addEventListener('seeking', onSeeking);
        v.addEventListener('seeked', onSeeked);
        v.addEventListener('pause', onControl);
        v.addEventListener('play', onControl);
        v.addEventListener('ratechange', onRateChange);
    }
    function detach(v) {
        if (!v) return;
        v.removeEventListener('timeupdate', onControl);
        v.removeEventListener('seeking', onSeeking);
        v.removeEventListener('seeked', onSeeked);
        v.removeEventListener('pause', onControl);
        v.removeEventListener('play', onControl);
        v.removeEventListener('ratechange', onRateChange);
    }

    function startEngine() {
        if (active) stopEngine();
        const media = getVideos();   // every <video> and <audio> on the page
        primary = pickPrimary(media);
        if (!primary || !synth) return false;
        mutedVideos = media.map(v => ({ v, prevMuted: v.muted }));
        media.forEach(v => { try { v.muted = true; } catch (e) {} });
        active = true; speaking = false; pausedForDub = false; resumeSpeaking = false; curIdx = -1;
        lastTime = primary.currentTime || 0;
        lastWall = Date.now();
        resyncIndex();
        attach(primary);
        // Master control loop: drives speaking, auto-pace, pause/seek recovery and the
        // cutoff watchdog. Runs on an interval so it self-corrects even while the video is
        // paused and regardless of which media events Panopto's player actually fires.
        keepAlive = setInterval(control, 250);
        control();
        return true;
    }

    function stopEngine() {
        active = false; speaking = false; pausedForDub = false; resumeSpeaking = false; curIdx = -1;
        speakGen++;
        if (keepAlive) { clearInterval(keepAlive); keepAlive = null; }
        if (rateTimer) { clearTimeout(rateTimer); rateTimer = null; }
        try { if (synth) synth.cancel(); } catch (e) {}
        detach(primary);
        stopCaptionMirror();
        mutedVideos.forEach(({ v, prevMuted }) => { try { v.muted = prevMuted; } catch (e) {} });
        mutedVideos = [];
        primary = null;
        removeBar();
    }

    // ── On-screen caption mirroring (#dockedCaptionText) ────────────────────────
    // While dubbing, replace Panopto's on-screen caption with the translated line.
    // Panopto rewrites that element on every cue, so a narrow MutationObserver
    // re-applies our text whenever it changes — the equality check makes that
    // self-terminating (setting the text we already want is a no-op, so no loop).
    function findCaptionEl() {
        let found = document.getElementById('dockedCaptionText');
        if (found) return found;
        const walk = (root) => {
            if (found || !root || !root.querySelectorAll) return;
            try {
                root.querySelectorAll('*').forEach(e => {
                    if (found) return;
                    if (e.id === 'dockedCaptionText') { found = e; return; }
                    if (e.shadowRoot) {
                        const inner = e.shadowRoot.getElementById && e.shadowRoot.getElementById('dockedCaptionText');
                        if (inner) found = inner; else walk(e.shadowRoot);
                    }
                });
            } catch (e) {}
        };
        walk(document);
        if (!found) {
            for (const f of document.querySelectorAll('iframe')) {
                try { const el = f.contentDocument && f.contentDocument.getElementById('dockedCaptionText'); if (el) { found = el; break; } } catch (e) {}
            }
        }
        return found;
    }

    function currentCaptionText() {
        if (!primary || !units.length) return '';
        if (speaking && curIdx >= 0) return units[curIdx].text;   // match the spoken line
        const t = primary.currentTime;
        let i = -1;
        for (let k = 0; k < units.length; k++) { if (units[k].start <= t + 0.05) i = k; else break; }
        return i >= 0 ? units[i].text : '';
    }

    function ensureCaptionObserver() {
        if (captionObs || !captionEl) return;
        try {
            captionObs = new MutationObserver(() => applyCaption());
            captionObs.observe(captionEl, { childList: true, characterData: true, subtree: true });
        } catch (e) {}
    }

    function applyCaption() {
        if (!active) return;
        if (captionEl && !captionEl.isConnected) {
            if (captionObs) { try { captionObs.disconnect(); } catch (e) {} captionObs = null; }
            captionEl = null;
        }
        if (!captionEl) {
            if (Date.now() - lastCaptionFind < 1000) return;   // don't walk the DOM every tick
            lastCaptionFind = Date.now();
            captionEl = findCaptionEl();
        }
        if (!captionEl) return;
        ensureCaptionObserver();
        const target = currentCaptionText();
        if (target && captionEl.textContent !== target) captionEl.textContent = target;
    }

    function stopCaptionMirror() {
        if (captionObs) { try { captionObs.disconnect(); } catch (e) {} captionObs = null; }
        captionEl = null;
    }

    window.addEventListener('pagehide', () => { try { if (active && synth) synth.cancel(); } catch (e) {} });

    // ── Floating control bar ──────────────────────────────────────────────────────
    function showBar(label) {
        removeBar();
        const bar = document.createElement('div');
        bar.id = '__pcs-dub-bar__';
        bar.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483646;display:flex;align-items:center;gap:10px;background:#161b22;border:1px solid #30363d;color:#e6edf3;border-radius:999px;padding:8px 12px 8px 14px;font:600 0.82rem system-ui,-apple-system,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,0.45);';
        const txt = document.createElement('span');
        txt.id = '__pcs-dub-bar-txt__';
        txt.textContent = '🎧 ' + label;
        // Dub volume control.
        const vicon = document.createElement('span');
        vicon.textContent = '🔊';
        vicon.style.cssText = 'font-size:0.95rem;opacity:0.85;';
        const vol = document.createElement('input');
        vol.type = 'range'; vol.min = '0'; vol.max = '100'; vol.step = '1';
        vol.value = String(Math.round(dubVolume * 100));
        vol.title = 'Dub volume';
        vol.style.cssText = 'width:84px;margin:0;accent-color:#11773D;cursor:pointer;';
        vol.addEventListener('input', () => {
            dubVolume = clamp(parseInt(vol.value, 10) / 100, 0, 1);
            if (active && speaking) scheduleRestart();   // apply to the line playing now
        });
        vol.addEventListener('change', () => {
            try { chrome.storage.local.set({ pcsDubVolume: dubVolume }); } catch (e) {}
        });
        const stop = document.createElement('button');
        stop.textContent = 'Stop';
        stop.style.cssText = 'background:#b42318;color:#fff;border:none;border-radius:999px;padding:4px 12px;font:inherit;cursor:pointer;';
        stop.addEventListener('click', () => stopEngine());
        bar.appendChild(txt); bar.appendChild(vicon); bar.appendChild(vol); bar.appendChild(stop);
        document.documentElement.appendChild(bar);
    }
    function setBar(label) { const t = document.getElementById('__pcs-dub-bar-txt__'); if (t) t.textContent = '🎧 ' + label; }
    function removeBar() { const b = document.getElementById('__pcs-dub-bar__'); if (b) b.remove(); }

    // ── Language-picker modal ───────────────────────────────────────────────────
    function closeModal() { const m = document.getElementById('__pcs-dub__'); if (m) m.remove(); }
    function resetGo(goBtn) {
        if (goBtn) { goBtn.disabled = false; goBtn.style.opacity = ''; }
        const sel = document.getElementById('__pcs-dub-lang__');
        if (sel) sel.disabled = false;
    }

    async function openModal() {
        if (document.getElementById('__pcs-dub__')) return;   // already open

        const overlay = document.createElement('div');
        overlay.id = '__pcs-dub__';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);font:400 0.85rem system-ui,-apple-system,sans-serif;';
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

        const card = document.createElement('div');
        card.style.cssText = 'width:380px;max-width:92vw;background:#161b22;color:#e6edf3;border:1px solid #30363d;border-radius:14px;padding:18px;box-shadow:0 16px 48px rgba(0,0,0,0.5);';
        card.innerHTML =
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">' +
              '<span style="font-size:1.02rem;font-weight:700;">🎧 Dub this lecture</span>' +
              '<span style="font-size:0.55rem;background:#f59e0b;color:#1b1b1b;border-radius:4px;padding:1px 5px;font-weight:800;letter-spacing:.04em;">ALPHA</span>' +
              '<span style="flex:1;"></span>' +
              '<button id="__pcs-dub-x__" style="background:none;border:none;color:#8b949e;font-size:1.1rem;cursor:pointer;line-height:1;">✕</button>' +
            '</div>' +
            '<div style="color:#8b949e;font-size:0.78rem;line-height:1.5;margin-bottom:12px;">Translates the captions and speaks them in your language, in time with the video. The original audio is muted, and the video pauses briefly to stay in sync.</div>' +
            '<div id="__pcs-dub-pick__">' +
              '<label style="display:block;font-size:0.72rem;color:#8b949e;margin-bottom:4px;">Language</label>' +
              '<select id="__pcs-dub-lang__" style="width:100%;box-sizing:border-box;background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:8px;padding:8px;font:inherit;"></select>' +
              '<div id="__pcs-dub-voice__" style="font-size:0.7rem;color:#8b949e;margin-top:6px;min-height:1em;"></div>' +
              '<button id="__pcs-dub-go__" style="width:100%;margin-top:14px;background:#11773D;color:#fff;border:none;border-radius:8px;padding:10px;font:600 0.85rem system-ui,sans-serif;cursor:pointer;">Start dubbing</button>' +
            '</div>' +
            '<div id="__pcs-dub-status__" style="font-size:0.76rem;line-height:1.5;margin-top:10px;min-height:1em;"></div>';
        overlay.appendChild(card);
        document.documentElement.appendChild(overlay);
        document.getElementById('__pcs-dub-x__').addEventListener('click', closeModal);

        const sel      = document.getElementById('__pcs-dub-lang__');
        const voiceEl  = document.getElementById('__pcs-dub-voice__');
        const statusEl = document.getElementById('__pcs-dub-status__');
        const goBtn    = document.getElementById('__pcs-dub-go__');
        const pick     = document.getElementById('__pcs-dub-pick__');
        const setStatus = (msg, kind) => {
            statusEl.textContent = msg || '';
            statusEl.style.color = kind === 'error' ? '#f87171' : (kind === 'ok' ? '#3fb950' : '#8b949e');
        };

        if (!synth) { pick.style.display = 'none'; setStatus('Your browser has no built-in speech voices, so live dubbing isn’t available here.', 'error'); return; }

        const voices = await loadVoices();
        const langs  = voicesByLanguage(voices);
        if (!langs.length) {
            pick.style.display = 'none';
            setStatus('No speech voices are installed on this device. On Windows, add one in Settings → Time & Language → Speech, then reopen this.', 'error');
            return;
        }
        for (const l of langs) {
            const opt = document.createElement('option');
            opt.value = l.code; opt.textContent = l.label;
            sel.appendChild(opt);
        }
        const want     = (document.documentElement.lang || navigator.language || 'en').replace('_', '-');
        const wantBase = want.split('-')[0];
        const match = langs.find(l => l.code.toLowerCase() === want.toLowerCase())
                   || langs.find(l => l.code.split('-')[0] === wantBase)
                   || langs[0];
        sel.value = match.code;
        const showVoice = () => { const l = langs.find(x => x.code === sel.value); voiceEl.textContent = l && l.voice ? `Voice: ${l.voice.name}` : ''; };
        showVoice();
        sel.addEventListener('change', showVoice);

        goBtn.addEventListener('click', async () => {
            const chosen = langs.find(x => x.code === sel.value);
            if (!chosen) return;
            if (!_auth || !_auth.token) { setStatus('Sign in via the extension popup first, then try again.', 'error'); return; }

            voice = chosen.voice; langCode = chosen.code;
            const langName = languageLabel(chosen.code);
            goBtn.disabled = true; goBtn.style.opacity = '0.6'; sel.disabled = true;
            setStatus('Reading the transcript…');

            const id = new URLSearchParams(location.search).get('id');
            if (!id) { setStatus('Open a Panopto lecture video first.', 'error'); resetGo(goBtn); return; }

            let ctx = null;
            try { ctx = await gatherLectureContext(); } catch (e) {}
            let cues = await gatherTimedCues(id);
            if ((!cues || !cues.length) && ctx && ctx.captionsCleaned) cues = VttUtils.parseStampedToTimed(ctx.captionsCleaned);
            if (!cues || !cues.length) { setStatus('Couldn’t read this lecture’s captions. Make sure it has captions, refresh, and try again.', 'error'); resetGo(goBtn); return; }

            const srcUnits   = mergeUnits(cues);
            const title      = (ctx && ctx.title) || document.title || 'lecture';
            const sourceHash = quickHash(srcUnits.map(u => u.text).join('|'));

            let translated = await loadCachedUnits(id, chosen.code, sourceHash);
            if (!translated) {
                setStatus(`Translating ${srcUnits.length} lines into ${langName}…`);
                try {
                    const r = await translateUnits(srcUnits, chosen.code, langName, title);
                    translated = r.units;
                    if (r.complete) saveCachedUnits(id, chosen.code, sourceHash, translated);   // don't cache a partial
                } catch (e) { setStatus(translateErr(e), 'error'); resetGo(goBtn); return; }
            }

            units = translated.filter(u => u && u.text && u.text.trim()).sort((a, b) => a.start - b.start);
            idx = 0; curIdx = -1;
            closeModal();
            if (!startEngine()) { showBar('Dub failed — no video found'); setTimeout(removeBar, 4000); return; }
            showBar(`Dubbing in ${langName}`);
        });
    }

    // ── Entry point: popup's "Dub Lecture" button messages us here ───────────────
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!message || message.action !== 'openDubModal') return;   // not ours
        const id = new URLSearchParams(location.search).get('id');
        const hasVideo = getVideos().length > 0;
        // all_frames means every Panopto frame hears this. Only one reply reaches the
        // popup, so a side frame answering "not_viewer" first would beat the frame
        // that actually holds the player. Sub-frames stay silent unless they own it;
        // the top frame still reports the failure so the popup keeps its hint.
        if (window.top !== window.self && !(id && hasVideo)) return;
        if (!id || !hasVideo) { sendResponse({ ok: false, reason: 'not_viewer' }); return; }
        openModal();
        sendResponse({ ok: true });
    });
})();

}   // end single-injection guard
