const BACKEND = 'https://panopto-stripe.harveychandler235.workers.dev';

let savedTime = 0;
let silenceSavedTime = 0;

const loadSavedTime = () => {
    chrome.storage.local.get(["totalSavedTime", "totalSilenceSavedTime"], (result) => {
        if (result.totalSavedTime != null) savedTime = parseFloat(result.totalSavedTime);
        if (result.totalSilenceSavedTime != null) silenceSavedTime = parseFloat(result.totalSilenceSavedTime);
    });
};

const saveTotalTime = () => {
    chrome.storage.local.set({
        totalSavedTime: savedTime.toFixed(2),
        totalSilenceSavedTime: silenceSavedTime.toFixed(2)
    });
};

loadSavedTime();

// ─────────────────────────────────────────────────────────────────────────────
// FIRST-RUN INJECTION BACKFILL
//
// Chrome does not inject content scripts into tabs that were already open when the
// extension was installed or updated. A user who installs while sitting on a
// lecture sees no speed control and concludes it is broken; a refresh fixes it, but
// most people never try. So on install/update we replay every content_scripts entry
// from the manifest into the tabs it already matches.
//
// Failures here are expected and ignored: a tab can be on chrome://, on the Web
// Store, discarded, or closed between the query and the injection. content.js
// guards itself against running twice (window.__pcsContentLoaded__), which matters
// on `update` because this manual injection races Chrome's own.
// ─────────────────────────────────────────────────────────────────────────────

// PERMISSIONS NOTE — read before touching any of this.
//
// The manifest deliberately does NOT declare "tabs". That permission shows the user
// "Read your browsing history", which is a NEW warning, and Chrome disables an
// extension on update until the user accepts a new warning. So no url filter on
// chrome.tabs.query — we query everything and match the patterns ourselves.
//
// What makes that work is "host_permissions" for the two Panopto patterns. Chrome
// keeps two host sets: content_scripts.matches populate scriptable_hosts, while
// tab.url visibility (HasExplicitAccessToOrigin) and chrome.scripting both require
// explicit_hosts. Without the host_permissions key, tab.url comes back undefined on
// every tab and executeScript is denied — the backfill would silently do nothing.
//
// Declaring those hosts costs no warning: PermissionSet::InitEffectiveHosts unions
// explicit_hosts with scriptable_hosts, and IsHostPrivilegeIncrease compares that
// union. The patterns are already in content_scripts.matches, so the union is
// unchanged, so there is no privilege increase and no re-prompt.
function matchPatternToRegExp(pattern) {
    const m = /^(\*|https?):\/\/([^/]*)(\/.*)$/.exec(pattern);
    if (!m) return null;
    const [, scheme, host, path] = m;
    const esc = (s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    const schemeRe = scheme === "*" ? "https?" : scheme;
    const hostRe = host === "*" ? "[^/]+"
        : host.startsWith("*.") ? "(?:[^/]+\\.)?" + esc(host.slice(2))
        : esc(host);
    return new RegExp("^" + schemeRe + "://" + hostRe + esc(path).replace(/\*/g, ".*") + "$");
}

async function backfillContentScripts() {
    const entries = chrome.runtime.getManifest().content_scripts || [];

    let tabs = [];
    try {
        tabs = await chrome.tabs.query({});
    } catch (e) {
        return;
    }

    for (const entry of entries) {
        if (!entry.matches || !entry.matches.length) continue;
        const patterns = entry.matches.map(matchPatternToRegExp).filter(Boolean);
        if (!patterns.length) continue;

        for (const tab of tabs) {
            if (!tab.id) continue;
            const url = tab.url || "";           // absent for tabs we have no access to
            if (!/^https?:/.test(url)) continue;
            if (!patterns.some((re) => re.test(url))) continue;

            const target = { tabId: tab.id, allFrames: entry.all_frames === true };

            if (entry.css && entry.css.length) {
                try {
                    await chrome.scripting.insertCSS({ target, files: entry.css });
                } catch (e) {}
            }
            if (entry.js && entry.js.length) {
                try {
                    await chrome.scripting.executeScript({ target, files: entry.js });
                } catch (e) {}
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHURN STATE + UNINSTALL URL
//
// chrome.storage.local carries the small amount of state the uninstall URL reports:
//   userId       stable anonymous id (never an email, never the OAuth token)
//   installedAt  epoch ms, written once on `install` and never again
//   sessionCount successful attaches
//   everAttached did the speed control ever come up at all
//   lastHost     hostname of the most recent successful attach
//
// setUninstallURL stores a STATIC string, so the numbers are only as fresh as the
// last time we called it — hence refreshUninstallURL() runs on install, on startup
// and on every state change.
// ─────────────────────────────────────────────────────────────────────────────

const CHURN_KEYS = ["userId", "installedAt", "sessionCount", "everAttached", "lastHost"];

// Returns the churn state, minting userId on first use. The popup may have seeded
// it from its own long-lived anonymous id (aID), so only generate when it is absent.
const ensureUserId = async () => {
    const state = await chrome.storage.local.get(CHURN_KEYS);
    if (!state.userId) {
        state.userId = crypto.randomUUID();
        await chrome.storage.local.set({ userId: state.userId });
    }
    return state;
};

const refreshUninstallURL = async () => {
    try {
        const state = await ensureUserId();
        const auth  = (await chrome.storage.local.get("pcsAuth")).pcsAuth;

        const params = new URLSearchParams();
        params.set("uid",      state.userId);
        params.set("sessions", String(parseInt(state.sessionCount, 10) || 0));
        params.set("attached", state.everAttached ? "1" : "0");
        params.set("premium",  auth && auth.premium ? "1" : "0");
        params.set("host",     state.lastHost || "");
        params.set("v",        chrome.runtime.getManifest().version);

        // `installedAt` only exists for people who installed fresh on a build that had
        // it, so every user who predates it has no install moment to measure from.
        // Omitting the param made the worker fall back to 0, which is indistinguishable
        // from genuine day-zero churn and put 100% of uninstalls in the "<1 day" bucket.
        // -1 means "unknown" and the dashboard counts it separately.
        params.set("days", state.installedAt
            ? String(Math.floor((Date.now() - state.installedAt) / 86400000))
            : "-1");

        chrome.runtime.setUninstallURL(`${BACKEND}/uninstall?${params.toString()}`);
    } catch (e) {
        console.warn("refreshUninstallURL failed:", e?.message);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ATTACH TRACKING
//
// content.js reports both outcomes. A failure badges the action for that tab and
// records it so the popup can lead with the reload prompt instead of the normal UI,
// and is posted to the Worker so the hostnames where injection genuinely fails are
// a list rather than a guess.
// ─────────────────────────────────────────────────────────────────────────────

const FAILED_TABS_KEY = "pcsFailedTabs";

// storage.session, not local: a failed tab is only meaningful until the browser
// restarts, and this must survive the service worker being torn down.
const readFailedTabs = async () => {
    try {
        const r = await chrome.storage.session.get(FAILED_TABS_KEY);
        return (r && r[FAILED_TABS_KEY]) || {};
    } catch (e) {
        return {};
    }
};

const writeFailedTabs = async (map) => {
    try { await chrome.storage.session.set({ [FAILED_TABS_KEY]: map }); } catch (e) {}
};

const markTabFailed = async (tabId, host) => {
    if (tabId == null) return;
    const map = await readFailedTabs();
    map[tabId] = { host: host || "", ts: Date.now() };
    await writeFailedTabs(map);

    try {
        await chrome.action.setBadgeText({ tabId, text: "!" });
        await chrome.action.setBadgeBackgroundColor({ tabId, color: "#E6001E" });
    } catch (e) {}
};

const clearTabFailed = async (tabId) => {
    if (tabId == null) return;
    const map = await readFailedTabs();
    if (map[tabId]) {
        delete map[tabId];
        await writeFailedTabs(map);
    }
    try { await chrome.action.setBadgeText({ tabId, text: "" }); } catch (e) {}
};

// Fire-and-forget; the extension must never be held up by the analytics call.
const postAttachFailed = async (host, frameTop, hadVideo) => {
    try {
        const state = await ensureUserId();
        await fetch(`${BACKEND}/attach-failed`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                uid:      state.userId,
                host:     host || "",
                version:  chrome.runtime.getManifest().version,
                // Lets the dashboard separate a genuinely broken viewer from an
                // embedded player nobody opened.
                frameTop: frameTop === true,
                hadVideo: hadVideo === true
            })
        });
    } catch (e) {}
};

// NB: sessionCount is deliberately NOT incremented here. content.js already bumps it
// in reportAttachSuccess() before sending us `attach-ok`, so incrementing again counted
// every attach twice and doubled the "sessions before leaving" chart. The content script
// is the one guaranteed to run, so it owns the counter; this only mirrors the other two
// keys and re-stamps the uninstall URL, which is a static snapshot that goes stale.
const recordAttachSuccess = async (host) => {
    const state = await ensureUserId();
    await chrome.storage.local.set({
        everAttached: true,
        lastHost:     host || state.lastHost || ""
    });
    await refreshUninstallURL();
};

chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === "install") {
        // Written once, here only — an update must never reset the clock. Awaited,
        // because refreshUninstallURL() below reads installedAt: firing them in the
        // same turn stamped a fresh install's uninstall URL with days=-1 (unknown)
        // and it stayed that way until the next attach or popup open re-stamped it.
        const r = await chrome.storage.local.get("installedAt");
        if (r.installedAt == null) await chrome.storage.local.set({ installedAt: Date.now() });
    }
    if (details.reason === "install" || details.reason === "update") {
        backfillContentScripts();
    }
    await refreshUninstallURL();
});

chrome.runtime.onStartup.addListener(() => {
    refreshUninstallURL();
});

// The popup refreshes pcsAuth on every open, so this keeps `premium` honest without
// the popup having to know the uninstall URL exists.
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.pcsAuth) refreshUninstallURL();
});

chrome.tabs.onRemoved.addListener((tabId) => { clearTabFailed(tabId); });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const tabId = sender.tab && sender.tab.id;

    if (message.type === "attach-ok") {
        clearTabFailed(tabId);
        recordAttachSuccess(message.host);
        sendResponse({ status: "success" });
        return;
    }

    if (message.type === "attach-failed") {
        markTabFailed(tabId, message.host);
        postAttachFailed(message.host, message.frameTop, message.hadVideo);
        sendResponse({ status: "success" });
        return;
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "updateSavedTime") {
        savedTime += message.savedTime;
        saveTotalTime();
        sendResponse({ status: "success" });
    }

    if (message.type === "getSavedTime") {
        sendResponse({ savedTime });
    }

    // A premium nudge on the Panopto page was clicked. openPopup() only exists on
    // Chrome 127+, and can still refuse when the click is too far from a user gesture,
    // so every failure is swallowed — the nudge's own text tells them where the icon
    // is, which is the fallback.
    if (message.type === "open-popup") {
        try {
            if (chrome.action && typeof chrome.action.openPopup === "function") {
                const p = chrome.action.openPopup();
                if (p && typeof p.catch === "function") p.catch(() => {});
            }
        } catch (e) {}
        sendResponse({ status: "ok" });
    }

    if (message.type === "updateSilenceSavedTime") {
        silenceSavedTime += message.savedTime;
        saveTotalTime();
        sendResponse({ status: "success" });
    }

    if (message.type === "getSilenceSavedTime") {
        sendResponse({ silenceSavedTime });
    }

    // Called when server reports a higher saved time than local
    if (message.type === "setSavedTime") {
        if (message.savedTime > savedTime) {
            savedTime = parseFloat(message.savedTime);
            saveTotalTime();
        }
        sendResponse({ status: "success" });
    }

    if (message.type === "setSilenceSavedTime") {
        if (message.silenceSavedTime > silenceSavedTime) {
            silenceSavedTime = parseFloat(message.silenceSavedTime);
            saveTotalTime();
        }
        sendResponse({ status: "success" });
    }

    // Force both device counters back to 0 — used when a different account signs
    // in so the new user doesn't inherit the previous user's totals. (Unlike
    // setSavedTime this is unconditional.)
    if (message.type === "resetUserMetrics") {
        savedTime = 0;
        silenceSavedTime = 0;
        saveTotalTime();
        sendResponse({ status: "success" });
    }
});
