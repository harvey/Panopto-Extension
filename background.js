let savedTime = 0;

// Load saved time from storage
const loadSavedTime = () => {
    chrome.storage.local.get(["totalSavedTime"], (result) => {
        if (result.totalSavedTime != null) {
            savedTime = parseFloat(result.totalSavedTime); // Ensure it's a number
        }
    });
};

// Save total saved time to storage
const saveTotalTime = () => {
    chrome.storage.local.set({ totalSavedTime: savedTime.toFixed(2) });
};

// Load saved time on startup
loadSavedTime();

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "updateSavedTime") {
        savedTime += message.savedTime; // Add only the saved time for this interval
        saveTotalTime(); // Persist the updated total
        sendResponse({ status: "success" });
    }

    if (message.type === "getSavedTime") {
        sendResponse({ savedTime });
    }
});
