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
});

