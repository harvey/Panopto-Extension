function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function updateSpeed() {
    let speed = localStorage.getItem('panoptoExtSpeed');
    const video = document.querySelector('video');

    if(video && speed) {
        video.playbackRate = speed;
    }
    else{
        console.log("Took too long to find video on page, assuming no video.");
    }
}

function track() {
    const video = document.querySelector('video');
    let lastCurrentTime = video.currentTime;
    let lastRealTime = Date.now();
    let isTracking = false;

    const trackTimeSaved = () => {
        const currentRealTime = Date.now();
        const currentCurrentTime = video.currentTime;

        // Update last times if paused
        if (video.paused) {
            lastCurrentTime = currentCurrentTime;
            lastRealTime = currentRealTime;
            return;
        }

        // Calculate deltas
        const realTimeDelta = (currentRealTime - lastRealTime) / 1000; // Seconds
        const currentTimeDelta = currentCurrentTime - lastCurrentTime;

        // Calculate saved time only if playing faster than 1x
        if (video.playbackRate > 1) {
            const savedTime = currentTimeDelta - realTimeDelta;
            
            if (savedTime > 0) {
                chrome.runtime.sendMessage(
                    { type: "updateSavedTime", savedTime },
                    (response) => {
                        if (response.status === "success") {
                            console.log(`Saved time: ${savedTime.toFixed(2)}s`);
                        }
                    }
                );
            }
        }

        // Update tracking markers
        lastCurrentTime = currentCurrentTime;
        lastRealTime = currentRealTime;
    };

    // Start tracking when video plays
    video.addEventListener("play", () => {
        if (!isTracking) {
            // Reset markers on play
            lastCurrentTime = video.currentTime;
            lastRealTime = Date.now();
            isTracking = true;
        }
    });

    // Handle pause events
    video.addEventListener("pause", () => {
        isTracking = false;
        trackTimeSaved(); // Final update when paused
    });

    // Track changes continuously
    setInterval(trackTimeSaved, 1000);
    video.addEventListener("ratechange", trackTimeSaved);
}

chrome.runtime.onMessage.addListener(function(message) {
    console.log('Injected panopto speed script into page successfully.')
    if (message.action === "updateSpeed") {
        localStorage.setItem('panoptoExtSpeed', message.value);
        updateSpeed();
    }
    if (message.action === "speedOnStartup") {
        localStorage.setItem('speedOnStartup', message.value);
    }
    
});

window.addEventListener("load", () => {
    if (localStorage.getItem('speedOnStartup') == "true"){
        sleep(500).then(() => {
            updateSpeed();
        })
        sleep(1500).then(() => {  // for slow internet & computers
            updateSpeed();
        })
    }
    track();
});

