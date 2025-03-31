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
        if (video.playbackRate > 1 && video.playbackRate <= 4) {
            const savedTime = currentTimeDelta - realTimeDelta;

            if (savedTime > 0) {
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

sleep(500).then(() => {
    settingsButton = document.getElementById('reactCaptionsSettingsButton');
    if (settingsButton) {
        settingsButton.addEventListener('click', function() {
            sleep(300).then(() => {
                d = document.querySelectorAll("li[role='menuitem']");
                if(d.length > 0){
                    d[1].addEventListener('click', function() {
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
finalSpan.innerHTML = "Please use the <a target='_blank' href='https://harvey.github.io/panopto-demo.png' style='font-weight: bold;'>extension popup window</a> to get all features.<br><br>" + 
"<a target='_blank' href='https://chromewebstore.google.com/detail/panopto-custom-speed/fnoppdfnaklabgfllejlefomclegmnam' style='font-weight: bold;'>Please rate this extension on the store</a>";

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

