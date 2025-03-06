function sendToTab(action, value) {
    try{
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: action, value: value });
        });
    }
    catch{
        console.log("Not connected to tab. (is this apart of https://*.cloud.panopto.eu/* ?)")
    }
}

document.addEventListener("DOMContentLoaded", function() {

    checkIfFirstTimeUse = localStorage.getItem('panoptoExtSpeed');
    if(!checkIfFirstTimeUse) {
        localStorage.setItem('panoptoExtSpeed','1');

        let userDataOptIn = false;
        localStorage.setItem('userDataOptIn', 'false');
    }

    checkIfFirstTimeUse = localStorage.getItem('panoptoExtToggle');
    if(!checkIfFirstTimeUse) {
        localStorage.setItem('panoptoExtToggle','false')
    }

    delete(checkIfFirstTimeUse);

    const slider = document.getElementById('dynamicSlider');
    const editableSpan = document.getElementById('sliderValue');

    const checkBox = document.getElementById('startupSpeed');

    let z = localStorage.getItem('panoptoExtToggle');
    if(z){
        if(z == "true"){
            checkBox.checked = true;
        }
    }

    z = localStorage.getItem('userDataOptIn');
    if(z){
        if(z == "true"){
            document.getElementById('userDataOptIn').checked = true;
        }
    }

    checkBox.addEventListener('click', () => {
        if(checkBox.checked){
            localStorage.setItem('panoptoExtToggle', 'true');
        }
        else{
            localStorage.setItem('panoptoExtToggle', 'false');
        }

        console.log(localStorage.getItem('panoptoExtToggle'));
        sendToTab("speedOnStartup", localStorage.getItem('panoptoExtToggle'));
    });

    document.getElementById('userDataOptIn').addEventListener('click', () => {
        if(document.getElementById('userDataOptIn').checked){
            localStorage.setItem('userDataOptIn', 'true');
        }
        else{
            localStorage.setItem('userDataOptIn', 'false');
        }
        console.log(localStorage.getItem('userDataOptIn'));
    });

    editableSpan.textContent = localStorage.getItem('panoptoExtSpeed') + "x";
    console.log(editableSpan.textContent)

    editableSpan.addEventListener('click', () => {
        editableSpan.setAttribute('contenteditable', 'true');
        editableSpan.focus();
    })
    editableSpan.addEventListener('blur', () => {
        editableSpan.removeAttribute('contenteditable');

        editableSpan.textContent = removeAllNonNums(editableSpan.textContent) + "x"

        // SEND THE THING
        sendToTab("updateSpeed", localStorage.getItem('panoptoExtSpeed'));
    });

    editableSpan.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();  // Prevent new line
            editableSpan.blur();     // Trigger blur event to accept the value
        } else if (!isNumericKey(event)) {
            event.preventDefault();  // Prevent non-numeric characters
        }
    });

    function removeAllNonNums(textStr)
    {
        let output = textStr.replace(/[^\d.]/g, '')
        const floatValue = parseFloat(output);
        if (!isNaN(floatValue)) {
            localStorage.setItem('panoptoExtSpeed', floatValue.toString())
            slider.value = floatValue.toString()
            return floatValue.toString(); // Return as string to preserve decimal places
        }

    // Attempt to parse as integer
    const intValue = parseInt(output);
    if (!isNaN(intValue)) {
        localStorage.setItem('panoptoExtSpeed', intValue.toString())
        slider.value = intValue.toString()
        return intValue.toString(); // Return as string to remove any leading zeros
    }

        return '1.00'
    }

    function isNumericKey(event) {
        // Allow backspace, delete, arrow keys, and numeric input
        const key = event.key;
        return (key >= '0' && key <= '9') || ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'x', 'X', '.', 'Ctrl', 'a'].includes(key);
    }

    // Set default values if they don't exist
    let storedSpeed = parseFloat(localStorage.getItem('panoptoExtSpeed'));
    if (isNaN(storedSpeed)) {
        storedSpeed = 1;
        localStorage.setItem('panoptoExtSpeed', '1');
    }

    const sliderValue = document.getElementById('sliderValue');

    // Check if the stored speed is above the slider's default max (3)
    let currentMax = parseFloat(slider.max);
    if (storedSpeed > currentMax) {
        slider.max = storedSpeed; // Update slider max to reflect the actual speed
    }

    // Set the current slider value to the stored speed
    slider.value = storedSpeed;
    sliderValue.innerText = `${storedSpeed.toFixed(2)}x`;

    slider.addEventListener('input', function() {
        updateSlider(this);
    });

    slider.addEventListener('mouseup', function() {
        sendSpeed();
    })

    function updateSlider(sliderElem) {
        let value = parseFloat(sliderElem.value);
        localStorage.setItem('panoptoExtSpeed', value);
        sliderValue.innerText = `${value.toFixed(2)}x`;
    }

    function sendSpeed() {
        let value = parseFloat(slider.value);
        sendToTab("updateSpeed", value);
    }

    function formatTime(seconds) {
        const days = Math.floor(seconds / 86400); // 86400 seconds in a day
        seconds %= 86400;
    
        const hours = Math.floor(seconds / 3600); // 3600 seconds in an hour
        seconds %= 3600;
    
        const minutes = Math.floor(seconds / 60); // 60 seconds in a minute
        seconds = Math.floor(seconds % 60); // Remaining seconds
    
        let formattedTime = "";
    
        if (days > 0) formattedTime += `${days} day${days !== 1 ? "s" : ""}, `;
        if (hours > 0) formattedTime += `${hours} hour${hours !== 1 ? "s" : ""}, `;
        if (minutes > 0) formattedTime += `${minutes} minute${minutes !== 1 ? "s" : ""}, `;
        if (seconds > 0 || formattedTime === "") formattedTime += `${seconds} second${seconds !== 1 ? "s" : ""}`;
    
        // Remove trailing comma and space if any
        return formattedTime.replace(/, $/, "");
    }

    const timeSavedEl = document.getElementById("timeSaved");

    // Function to get the current saved time from the background script
    const updateSavedTime = () => {
        chrome.runtime.sendMessage({ type: "getSavedTime" }, (response) => {
            if (response?.savedTime != null) {
                timeSavedEl.textContent = `${formatTime(response.savedTime)}`;
            }
        });
    };

    // Update the saved time every second
    setInterval(updateSavedTime, 1000);

    // Initial update
    updateSavedTime();

    let ts = 0;

    let uniqueID = localStorage.getItem('uniqueID');
        if (!uniqueID) {
        // Generate a simple unique ID (you can use a more robust method if needed)
        uniqueID = 'user_' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('uniqueID', uniqueID);
        }
        console.log('Unique ID:', uniqueID);

        function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        temp = localStorage.getItem('saved-time');

        if(!temp) {
            localStorage.setItem('saved-time', 0);
        }
        else {
            previousSavedTime = temp;
        }

        optIn = localStorage.getItem('userDataOptIn');

        if(optIn == "true"){ // if user opts in to ananymous data collection
            chrome.runtime.sendMessage({ type: "getSavedTime" }, (response) => {
                if (response?.savedTime != null) {
                    ts = response.savedTime;
                    let formURL = 'https://docs.google.com/forms/d/e/1FAIpQLSdytuXuxvbVYGJTmjclDos_pS3YHwC-AkJ63tXCXhnOKkIN1Q/formResponse';
                    
        
                    // Replace with your form input field names.
                    const fieldValue1 = 'entry.934660280'; // Field name for "anonymous_id"
                    const fieldValue2 = 'entry.1414306928'; // Field name for "time_saved
                
                    // Prepare your data.
                    const formData = new URLSearchParams();
                    if(ts == 0){
                        sleep(3000).then(() => {
                            chrome.runtime.sendMessage({ type: "getSavedTime" }, (response) => {
                                if (response?.savedTime != null) {
                                    ts = response.savedTime;
                                }
                            });
                            formData.append(fieldValue1, uniqueID);  
                            formData.append(fieldValue2, ts); 
                    
                            // Send the data using fetch in no-cors mode.
                            try{
                            fetch(formURL, {
                                method: 'POST',
                                mode: 'no-cors', // This prevents CORS errors, though the response is opaque.
                                body: formData,
                            })
                            }
                            catch(e){
                            console.log(e);
                            }
                        });
                    }
                    else{
                        if (ts != previousSavedTime) {
                            formData.append(fieldValue1, uniqueID);  // Replace 'Hello' with dynamic data
                            formData.append(fieldValue2, ts);  // Replace 'World' with dynamic data
                    
                            // Send the data using fetch in no-cors mode.
                            try{
                            fetch(formURL, {
                                method: 'POST',
                                mode: 'no-cors', // This prevents CORS errors, though the response is opaque.
                                body: formData,
                            })
                            }
                            catch(e){
                            console.log(e);
                            }
                            localStorage.setItem('saved-time', ts);
                        }
                    }
                }
            });
        }
});