function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function updateSpeed() {
    let speed = localStorage.getItem('panoptoExtSpeed');
    const video = document.querySelector('video');

    if (video && speed) {
        video.playbackRate = speed;
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

    const trackTimeSaved = () => {
        const currentRealTime = Date.now();
        const currentCurrentTime = video.currentTime;

        // Reset markers if the video is paused.
        if (video.paused) {
            lastCurrentTime = currentCurrentTime;
            lastRealTime = currentRealTime;
            return;
        }

        // Calculate elapsed time in seconds.
        const realTimeDelta = (currentRealTime - lastRealTime) / 1000;
        const currentTimeDelta = currentCurrentTime - lastCurrentTime;

        // Only compute saved time if the playback rate is > 1 
        // (and thereby ignore normal or skipped jumps which have been reset).
        if (video.playbackRate > 1) {
            const savedTime = currentTimeDelta - realTimeDelta;

            if (savedTime > 0) {
                chrome.runtime.sendMessage(
                    { type: "updateSavedTime", savedTime },
                    (response) => {
                        if (response && response.status === "success") {
                            console.log(`Saved time: ${savedTime.toFixed(2)}s`);
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

    // **New code:** Reset markers on manual seeking.
    video.addEventListener("seeked", () => {
        lastCurrentTime = video.currentTime;
        lastRealTime = Date.now();
        console.log("Markers reset due to seeking.");
    });

    // Continue to track saved time regularly.
    setInterval(trackTimeSaved, 1000);
    video.addEventListener("ratechange", trackTimeSaved);
}

chrome.runtime.onMessage.addListener(function(message) {
    console.log('Injected panopto speed script into page successfully.');
    if (message.action === "updateSpeed") {
        localStorage.setItem('panoptoExtSpeed', message.value);
        updateSpeed();
    }
    if (message.action === "speedOnStartup") {
        localStorage.setItem('speedOnStartup', message.value);
    }
    
});

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
}

// If the document is already loaded, initialize immediately;
// otherwise, wait for the 'load' event.
if (document.readyState === "complete") {
    initExtension();
} else {
    window.addEventListener("load", initExtension);
}

