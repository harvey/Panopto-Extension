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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "updateSavedTime") {
        savedTime += message.savedTime;
        saveTotalTime();
        sendResponse({ status: "success" });
    }

    if (message.type === "getSavedTime") {
        sendResponse({ savedTime });
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
