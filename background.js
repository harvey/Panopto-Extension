let savedTime = 0;

const loadSavedTime = () => {
    chrome.storage.local.get(["totalSavedTime"], (result) => {
        if (result.totalSavedTime != null) {
            savedTime = parseFloat(result.totalSavedTime);
        }
    });
};

const saveTotalTime = () => {
    chrome.storage.local.set({ totalSavedTime: savedTime.toFixed(2) });
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

    // Called when server reports a higher saved time than local
    if (message.type === "setSavedTime") {
        if (message.savedTime > savedTime) {
            savedTime = parseFloat(message.savedTime);
            saveTotalTime();
        }
        sendResponse({ status: "success" });
    }
});
