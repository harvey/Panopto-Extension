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

    if(!localStorage.getItem('email')) {
        clientLogout();
    }
    else{
        getRank();
    }

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
        optInFunc();
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
                localStorage.setItem('saved-time',response.savedTime);
                timeSavedEl.textContent = `${formatTime(response.savedTime)}`;
            }
        });
    };

    // Update the saved time every second
    setInterval(updateSavedTime, 1000);

    // Initial update
    updateSavedTime();

    let ts = 0;

    uniqueID = localStorage.getItem('uniqueID');
    //     if (!uniqueID) {
    //     // Generate a simple unique ID (you can use a more robust method if needed)
    //     uniqueID = 'user_' + Math.random().toString(36).substring(2, 9);
    //     localStorage.setItem('uniqueID', uniqueID);
    //     }
    //     console.log('Unique ID:', uniqueID);

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

        optInFunc();

        async function checkToken(token, email) {
            if(token == 'null' || token == null){
                return false;
            }
            const tokenInfoUrl = `https://oauth2.googleapis.com/tokeninfo?access_token=${token}`;
            try {
                console.log(1);
                const response = await fetch(tokenInfoUrl);
                const tokenInfo = await response.json();
            
                if (tokenInfo.error_description) {
                    return false;
                }
            
                if(tokenInfo.email == email) {
                    return true;
                }

                return false;
            }
            catch {
                return false;
            }
        }

        function clientLogout() {
            try{
                chrome.identity.removeCachedAuthToken({ token: localStorage.getItem('authToken') }, function() {
                    if(localStorage.getItem('authToken') == 'null'){
                        console.log("already logged out");
                        localStorage.removeItem('username');
                        localStorage.removeItem('email');
                        // Optionally, update your UI here to show a sign-in button.
                        document.getElementById('signInWithGoogle').style.display = "inline";
                        document.getElementById('leaderboardText').style.display = "flex";
                        document.getElementById('loginText').style.display = "none";
                        document.getElementById('logout').style.display = "none";
                        document.getElementById('optedInContainer').style.display = "none";
                        document.getElementById('migrationContainer').style.display = "none";
                    } else {
                        console.log("User logged out (token removed).");
                        localStorage.setItem('authToken', 'null');
                        localStorage.removeItem('username');
                        localStorage.removeItem('email');
                        // Optionally, update your UI here to show a sign-in button.
                        document.getElementById('signInWithGoogle').style.display = "inline";
                        document.getElementById('leaderboardText').style.display = "flex";
                        document.getElementById('loginText').style.display = "none";
                        document.getElementById('logout').style.display = "none";
                        document.getElementById('optedInContainer').style.display = "none";
                        document.getElementById('migrationContainer').style.display = "none";

                    }
                  });
            }
            catch {console.log('no token to remove')}
            localStorage.removeItem('username');
            localStorage.removeItem('email');
            // Optionally, update your UI here to show a sign-in button.
            document.getElementById('signInWithGoogle').style.display = "inline";
            document.getElementById('leaderboardText').style.display = "flex";
            document.getElementById('loginText').style.display = "none";
            document.getElementById('logout').style.display = "none";
            document.getElementById('optedInContainer').style.display = "none";
            document.getElementById('optInContainer').style.display = "none";
            document.getElementById('leaderboard-popup').style.display = "none";
        }

        function validateUsername() {
            const input = document.getElementById('newUsernameTextbox');
            const username = input.value;
            isValid = /^[a-zA-Z0-9]+$/.test(username);
        
            // Reset classes
            input.classList.remove('border-green', 'border-red', 'border-white');
        
            // Add the correct class
            if (username.length > 0 && isValid) {
              input.classList.add('border-white');
              console.log(2);
              fetch('https://script.google.com/macros/s/AKfycbxr5AZzyaYAFm8NyhpWj7oSOb3Tc1NhYcTiHlo5OekghLYFiNsmY_Lfp1dWec_UDxUk/exec'
                + `?user={"username":"${username}", "token":"${localStorage.getItem('authToken')}", "email":"${localStorage.getItem('email')}"}`)
               .then(response => response.text())
               .then(text => {
                   if(text == "true" || text == "false") {
                        input.classList.remove('border-white');
                        if(text == "true") {
                            input.classList.add('border-green');
                            currentValid = true;
                            return true;
                        }
                        else{
                            input.classList.add('border-red')
                            return false;
                        }
                   }
                     
               })
               .catch(error => console.log('Error:', error));

            }
        }

        currentValid = false;

        function migrateConfirm() {

        }

        function debounce(func, delay) {
            let timeoutId;
            return function(...args) {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    func.apply(this, args);
                }, delay);
            };
        }
        
        // Create a debounced version of validateUsername with 500ms delay
        const debouncedValidateUsername = debounce(validateUsername, 500);

        function clientLogin() {
            // get username from server
            try{
                sleep(1100).then(() => {
                    fetch('https://script.google.com/macros/s/AKfycbxr5AZzyaYAFm8NyhpWj7oSOb3Tc1NhYcTiHlo5OekghLYFiNsmY_Lfp1dWec_UDxUk/exec'
                        + `?getUsername={"token":"${localStorage.getItem('authToken')}", "email":"${localStorage.getItem('email')}"}`)
                       .then(response => response.text())
                       .then(text => {
                           console.log(text);
                           if(text == "{username not found}") {
                                document.getElementById('migrationContainer').style.display = "flex";
                                document.getElementById('oldUsernameTextbox').value = "(unknown)";
                                // request username
                                sleep(100).then(() => {
                                    usrBox = document.getElementById('newUsernameTextbox');
                                    usrBox.addEventListener('keyup', () => {
                                        // console.log(usrBox.value);
                                        currentValid = false;
                                        debouncedValidateUsername();
                                    });
                                    usrBox.addEventListener('keydown', () => {
                                        // console.log(usrBox.value);
                                        currentValid = false;
                                        debouncedValidateUsername();
                                    });
                                })
                                //alert("WHO R U BOY");
                           }
                           else if (text.length <= 16){
                                localStorage.setItem('username', text);
                                document.getElementById('email').textContent = text;
                                document.getElementById('migrationContainer').style = "display: none;";
                                getRank();
                           }
                       });  
                });
            } catch {}
            // localStorage.setItem('username', 'temporaryUsername');
            document.getElementById('signInWithGoogle').style.display = "none";
            document.getElementById('leaderboardText').style.display = "none";
            document.getElementById('logout').style.display = "flex";

            oldUSR = localStorage.getItem('uniqueID');

            if(oldUSR) {
                document.getElementById('migrationContainer').style.display = "flex";
                document.getElementById('oldUsernameTextbox').value = oldUSR;

                sleep(100).then(() => {
                    usrBox = document.getElementById('newUsernameTextbox');
                    usrBox.addEventListener('keyup', () => {
                        // console.log(usrBox.value);
                        currentValid = false;
                        debouncedValidateUsername();
                    });
                    usrBox.addEventListener('keydown', () => {
                        // console.log(usrBox.value);
                        currentValid = false;
                        debouncedValidateUsername();
                    });
                })

            } else{
                document.getElementById('loginText').style.display = "flex";
                document.getElementById('email').textContent = localStorage.getItem('username');
                document.getElementById('optedInContainer').style.display = "flex";
            }
            document.getElementById('optInContainer').style.display = "flex";
        }

        document.getElementById('logout').addEventListener('click', () => {
            clientLogout();    
        });

        document.getElementById('newUsernameButton').addEventListener('click', () => {
            if(currentValid) {
                updateUsername();
            }
        });

        async function updateUsername() {
            localStorage.setItem('username', document.getElementById('newUsernameTextbox').value);
            
            testAddr = 'https://script.google.com/macros/s/AKfycbxr5AZzyaYAFm8NyhpWj7oSOb3Tc1NhYcTiHlo5OekghLYFiNsmY_Lfp1dWec_UDxUk/exec'
            const payload = {
                option: "updateUser",
                token: localStorage.getItem('authToken'),
                email: localStorage.getItem('email'),
                //originalUniqueID: oldUSR || "",
                newUsername: document.getElementById('newUsernameTextbox').value
            }
            console.log(3);
            await fetch(testAddr, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(() => {
                localStorage.removeItem('uniqueID');
                clientLogin();
            });
            
        }

        if(localStorage.getItem('userDataOptIn') == 'true' && localStorage.getItem('email')){
            testAddr = 'https://script.google.com/macros/s/AKfycbxr5AZzyaYAFm8NyhpWj7oSOb3Tc1NhYcTiHlo5OekghLYFiNsmY_Lfp1dWec_UDxUk/exec'
            const payload = {
                option: "logTime",
                token: localStorage.getItem('authToken'),
                email: localStorage.getItem('email'),
                username: localStorage.getItem('username'),
                timeSaved: localStorage.getItem('saved-time'),
                speed: localStorage.getItem('panoptoExtSpeed')
            }
            console.log(4);
            fetch(testAddr, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            // .then(response => response.json())
            // .then(result => console.log(result))
            // .catch(error => console.log(error));
        }

        function signIn() {
            chrome.identity.getAuthToken({ interactive: true }, async function(token) {
                if (chrome.runtime.lastError) {
                  console.log("User is not logged in.");
                  // Show the sign-in button or prompt the user to log in.
                } else {
                  console.log("User is logged in. Token:", token);
                  authTOKEN = token;

                  localStorage.setItem('authToken', authTOKEN);

                  // Optionally, verify the token with your backend or Google’s token info endpoint.
                  const tokenInfoUrl = `https://oauth2.googleapis.com/tokeninfo?access_token=${token}`;
                  try {
                    console.log(5);
                    const response = await fetch(tokenInfoUrl);
                    const tokenInfo = await response.json();
                
                    if (tokenInfo.error_description) {
                      alert(res.status(401).json({ error: "Invalid token" }));
                    }
                
                    // Optional: Check the email, audience, etc.
                    console.log("Token is valid for:", tokenInfo.email);
                    localStorage.setItem('email', tokenInfo.email);
                    document.getElementById('email').textContent = tokenInfo.email;

                    clientLogin();
                    }
                    catch (error) {
                        console.log(error);
                    }
                    }
              });
        }

        document.getElementById('signInWithGoogle').addEventListener('click', () => {
            signIn();
        });

        

        function optInFunc(){
            optIn = localStorage.getItem('userDataOptIn');
            anonContainer = document.getElementById('anon-container');

            if(optIn == "true"){ // if user opts in to ananymous data collection
                anonymousID = document.getElementById('anonymous-user');
                anonymousID.textContent = uniqueID;
                anonContainer.style.display = "flex";
    
                chrome.runtime.sendMessage({ type: "getSavedTime" }, (response) => {
                    if (response?.savedTime != null) {
                        ts = response.savedTime;
                        
                        if(ts == 0){
                            sleep(3000).then(() => {
                                chrome.runtime.sendMessage({ type: "getSavedTime" }, (response) => {
                                    if (response?.savedTime != null) {
                                        ts = response.savedTime;
                                    }
                                });
                                
                                if(ts != 0) {
                                    try{
                                        console.log(6);
                                        fetch("https://script.google.com/macros/s/AKfycbxr5AZzyaYAFm8NyhpWj7oSOb3Tc1NhYcTiHlo5OekghLYFiNsmY_Lfp1dWec_UDxUk/exec", {
                                            method: 'POST',
                                            mode: 'no-cors', // This prevents CORS errors, though the response is opaque.
                                            body: JSON.stringify({
                                                option: "logTime",
                                                token: localStorage.getItem('authToken'),
                                                email: localStorage.getItem('email'),
                                                timeSaved: ts,
                                                speed: localStorage.getItem('panoptoExtSpeed')
                                            })
                                        });
                                        }
                                    catch(e){
                                        console.log(e);
                                        }
                                }
                            });
                        }
                        else{
                            if (ts != previousSavedTime) {
                                
                                // Send the data using fetch in no-cors mode.
                                try{
                                    console.log(7);
                                    fetch("https://script.google.com/macros/s/AKfycbxr5AZzyaYAFm8NyhpWj7oSOb3Tc1NhYcTiHlo5OekghLYFiNsmY_Lfp1dWec_UDxUk/exec", {
                                        method: 'POST',
                                        mode: 'no-cors', // This prevents CORS errors, though the response is opaque.
                                        body: JSON.stringify({
                                            option: "logTime",
                                            token: localStorage.getItem('authToken'),
                                            email: localStorage.getItem('email'),
                                            timeSaved: localStorage.getItem('panoptoExtSpeed')
                                        })
                                    });
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
            else{
                //anonContainer.style.display = "none";
                // only enable if bug fixed where popup window size does not correct once hidden
            }
        }

        async function getRank() {
            if(localStorage.getItem('user-rank')){
                if(localStorage.getItem('user-rank') == -1){
                    document.getElementById('user-rank').textContent = `(rank >20)`;
                }
                else{
                    document.getElementById('user-rank').textContent = `(#${localStorage.getItem('user-rank')})`;
                }
            }

            // place a loading svg beside the rank to make it clear it could be old data
            
            if(localStorage.getItem('authToken') != 'null' && localStorage.getItem('authToken') != null){
                console.log(8);
                fetch('https://script.google.com/macros/s/AKfycbxr5AZzyaYAFm8NyhpWj7oSOb3Tc1NhYcTiHlo5OekghLYFiNsmY_Lfp1dWec_UDxUk/exec'
                    + `?input=${localStorage.getItem('username')}`)
                    .then(response => response.text())
                    .then(text => {
                        localStorage.setItem('user-rank', text);
                        // alert(text);
                        if(text != -1){
                            document.getElementById('user-rank').textContent = `(#${text})`;
                        }
                        else{
                            document.getElementById('user-rank').textContent = `(rank >20)`;
                        }
                        document.getElementById('loader').style.display = "none";
                        document.getElementById('tick').style.display = "inline";
                        
                        
                    })
                    .catch(error => console.log('Error:', error));
            }
        }
        
        document.getElementById('leaderboard-popup').addEventListener('click', () => {
            window.open(
                "https://docs.google.com/spreadsheets/d/e/2PACX-1vQY7BsTK4TY5DLMUDF7kbf-dq1Eo0cgv95FKkemrwyIlHwxUNhC4Kz1qBYDrTF5IZ_NYerftRcRlB6q/pubchart?oid=1888302536&format=interactive",
                "popupWindow",
                "width=644,height=620"
              );
            });

            document.getElementById('rate-button').addEventListener('click', () => {
                // open a new tab to the chrome web store (https://chromewebstore.google.com/detail/panopto-custom-speed/fnoppdfnaklabgfllejlefomclegmnam)
                window.open(
                    "https://chromewebstore.google.com/detail/panopto-custom-speed/fnoppdfnaklabgfllejlefomclegmnam/reviews",
                );
            });
    
            document.getElementById('coffee-button').addEventListener('click', () => {
                window.open(
                    "https://buymeacoffee.com/harveychandler",
                );
            });     

        
        

        tempToken = localStorage.getItem('authToken');
        tempEmail = localStorage.getItem('email');

        async function r() {
            let a = await checkToken(tempToken, tempEmail);
            if(a) {
                clientLogin();
            }
        }

        r();

        
});