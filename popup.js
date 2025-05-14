APP_SCRIPT_URL = `https://script.google.com/macros/s/AKfycbxr5AZzyaYAFm8NyhpWj7oSOb3Tc1NhYcTiHlo5OekghLYFiNsmY_Lfp1dWec_UDxUk/exec`;

// function to send a message to the active tab
function sendToTab(action, value) {
    try {
        chrome.tabs.query({
            active: true,
            currentWindow: true
        }, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: action,
                value: value
            });
        });
    } catch {
        console.log("Not connected to tab. (is this apart of https://*.cloud.panopto.eu/* ?)")
    }
}

// depricated as usernames can be made
function generateUniqueId() {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

// on page load
document.addEventListener("DOMContentLoaded", function () {
    // if no email stored, log out if possible
    if (!localStorage.getItem('email')) {
        clientLogout();
    } else {
        // if email is stored, get the rank of the user
        getRank();
    }

    // check if the user has used the app before
    // if not, set the default speed to 1.0x
    // & by default user data is not collected
    checkIfFirstTimeUse = localStorage.getItem('panoptoExtSpeed');
    if (!checkIfFirstTimeUse) {
        localStorage.setItem('panoptoExtSpeed', '1');

        let userDataOptIn = false;
        localStorage.setItem('userDataOptIn', 'false');
    }

    checkIfFirstTimeUse = localStorage.getItem('panoptoExtToggle');
    if (!checkIfFirstTimeUse) {
        localStorage.setItem('panoptoExtToggle', 'false')
    }

    delete(checkIfFirstTimeUse);

    // setup variables for later use
    const slider = document.getElementById('dynamicSlider');
    const editableSpan = document.getElementById('sliderValue');
    const checkBox = document.getElementById('startupSpeed');

    // make sure the check boxes are set to the correct value
    let z = localStorage.getItem('panoptoExtToggle');
    if (z) {
        if (z == "true") {
            checkBox.checked = true;
        }
    }

    z = localStorage.getItem('userDataOptIn');
    if (z) {
        if (z == "true") {
            document.getElementById('userDataOptIn').checked = true;
        }
    }

    // checkbox for startup speed to make sure app runs on startup if user wants it to
    checkBox.addEventListener('click', () => {
        if (checkBox.checked) {
            localStorage.setItem('panoptoExtToggle', 'true');
        } else {
            localStorage.setItem('panoptoExtToggle', 'false');
        }

        console.log(localStorage.getItem('panoptoExtToggle'));
        sendToTab("speedOnStartup", localStorage.getItem('panoptoExtToggle'));
    });

    // checkbox for user data opt in (leaderboard logging)
    document.getElementById('userDataOptIn').addEventListener('click', () => {
        if (document.getElementById('userDataOptIn').checked) {
            localStorage.setItem('userDataOptIn', 'true');
        } else {
            localStorage.setItem('userDataOptIn', 'false');
        }
        console.log(localStorage.getItem('userDataOptIn'));
        optInFunc();
    });

    // shows the current speed in the slider (and allows user to click it to edit)
    editableSpan.textContent = localStorage.getItem('panoptoExtSpeed') + "x";

    // debugging
    console.log(editableSpan.textContent)

    editableSpan.addEventListener('click', () => {
        editableSpan.setAttribute('contenteditable', 'true');
        editableSpan.focus();
    })
    editableSpan.addEventListener('blur', () => {
        editableSpan.removeAttribute('contenteditable');
        editableSpan.textContent = removeAllNonNums(editableSpan.textContent) + "x"

        // send the request to the tab to update speed
        sendToTab("updateSpeed", localStorage.getItem('panoptoExtSpeed'));
    });

    editableSpan.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent new line
            editableSpan.blur(); // Trigger blur event to accept the value
        } else if (!isNumericKey(event)) {
            event.preventDefault(); // Prevent non-numeric characters
        }
    });

    // ensure that slider value cannot be text
    function removeAllNonNums(textStr) {
        let output = textStr.replace(/[^\d.]/g, '')
        const floatValue = parseFloat(output);

        // Attempt to parse as float
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

        // if can't parse, return 1 as default value
        return '1.00'
    }

    // ensure that slider value cannot be text
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

    // update slider on input
    slider.addEventListener('input', function () {
        updateSlider(this);
    });

    slider.addEventListener('mouseup', function () {
        sendSpeed();
    })

    // logic to update other variables
    function updateSlider(sliderElem) {
        let value = parseFloat(sliderElem.value);
        localStorage.setItem('panoptoExtSpeed', value);
        sliderValue.innerText = `${value.toFixed(2)}x`;
    }

    // send the request to the tab to update speed
    function sendSpeed() {
        let value = parseFloat(slider.value);
        sendToTab("updateSpeed", value);
    }

    // time format function -> turn seconds into a human readable format
    function formatTime(seconds) {
        const years = Math.floor(seconds / 31536000); // 31536000 seconds in a year
        seconds %= 31536000;

        const months = Math.floor(seconds / 2592000); // 2592000 seconds in a month
        seconds %= 2592000;

        const days = Math.floor(seconds / 86400); // 86400 seconds in a day
        seconds %= 86400;

        const hours = Math.floor(seconds / 3600); // 3600 seconds in an hour
        seconds %= 3600;

        const minutes = Math.floor(seconds / 60); // 60 seconds in a minute
        seconds = Math.floor(seconds % 60); // Remaining seconds

        let formattedTime = "";

        if (years > 0) formattedTime += `${years} year${years !== 1 ? "s" : ""}, `;
        if (months > 0) formattedTime += `${months} month${months !== 1 ? "s" : ""}, `;
        if (days > 0) formattedTime += `${days} day${days !== 1 ? "s" : ""}, `;
        if (hours > 0) formattedTime += `${hours} hour${hours !== 1 ? "s" : ""}, `;
        if (minutes > 0) formattedTime += `${minutes} minute${minutes !== 1 ? "s" : ""}, `;
        if (seconds > 0 || formattedTime === "") formattedTime += `${seconds} second${seconds !== 1 ? "s" : ""}`;

        return formattedTime.replace(/, $/, "");
    }

    const timeSavedEl = document.getElementById("timeSaved");

    // Function to get the current saved time from the background script
    const updateSavedTime = () => {
        chrome.runtime.sendMessage({
            type: "getSavedTime"
        }, (response) => {
            if (response?.savedTime != null) {
                localStorage.setItem('saved-time', response.savedTime);
                timeSavedEl.textContent = `${formatTime(response.savedTime)}`;
            }
        });
    };

    // Update the saved time every second
    setInterval(updateSavedTime, 1000);

    // Initial update
    updateSavedTime();

    // timesaved = 0 default value
    let ts = 0;


    // uniqueID is deprecated and superseded by the username
    uniqueID = localStorage.getItem('uniqueID');
    //     if (!uniqueID) {
    //     // Generate a simple unique ID (you can use a more robust method if needed)
    //     uniqueID = 'user_' + Math.random().toString(36).substring(2, 9);
    //     localStorage.setItem('uniqueID', uniqueID);
    //     }
    //     console.log('Unique ID:', uniqueID);

    //sleep function
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    temp = localStorage.getItem('saved-time');

    if (!temp) {
        localStorage.setItem('saved-time', 0);
    } else {
        previousSavedTime = temp;
    }

    // get optIn value, then check using optInFunc
    optIn = localStorage.getItem('userDataOptIn');
    optInFunc();

    // Returns a promise that removes the cached token.
    function removeCachedToken(token) {
        return new Promise((resolve) => {
            chrome.identity.removeCachedAuthToken({
                token: token
            }, () => {
                resolve();
            });
        });
    }

    // Returns a promise that gets a new auth token.
    function getAuthToken(options) {
        return new Promise((resolve, reject) => {
            chrome.identity.getAuthToken(options, (token) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(token);
                }
            });
        });
    }

    // check token function -> not used and used on server-side
    async function checkToken(token, email, refreshed = false) {
        if (token == 'null' || token == null) {
            return false;
        }
        const tokenInfoUrl = `https://oauth2.googleapis.com/tokeninfo?access_token=${token}`;
        try {
            console.log("Checking token...");
            const response = await fetch(tokenInfoUrl);

            // Check for HTTP error status (400 etc.)
            if (response.status === 400) {
                if (!refreshed) {
                    console.log("Token invalid. Refreshing token...");
                    await removeCachedToken(token);
                    signIn();
                    try {
                        const newToken = await getAuthToken({
                            interactive: true
                        });
                        // Delay and then re-check the token
                        await new Promise(resolve => setTimeout(resolve, 150));
                        return await checkToken(newToken, email, true);
                    } catch (error) {
                        console.log("Token refresh failed:", error);
                        return false;
                    }
                } else {
                    return false;
                }
            }

            if (!response.ok) {
                console.log("Error: HTTP status", response.status);
                return false;
            }

            const tokenInfo = await response.json();

            if (tokenInfo.error_description) {
                console.log("Error: ", tokenInfo.error_description);
                return false;
            }

            return tokenInfo.email === email;
        } catch (error) {
            console.log("Error during token check:", error);
            return false;
        }
    }

    // simulate a client logout & reset UI
    function clientLogout() {
        try {
            chrome.identity.removeCachedAuthToken({
                token: localStorage.getItem('authToken')
            }, function () {
                if (localStorage.getItem('authToken') == 'null') {
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
        } catch {
            console.log('no token to remove')
        }
        // RESET STORAGE
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

    // validate username function to make sure its not already taken
    function validateUsername() {
        const input = document.getElementById('newUsernameTextbox');
        const username = input.value;
        isValid = /^[a-zA-Z0-9]+$/.test(username);

        // Reset classes
        input.classList.remove('border-green', 'border-red', 'border-orange');
        // Add the correct class
        if (username.length > 0 && isValid) {
            input.classList.add('border-orange');
            console.log(2);
            fetch(APP_SCRIPT_URL +
                    `?user={"username":"${username}", "token":"${localStorage.getItem('authToken')}", "email":"${localStorage.getItem('email')}"}`)
                .then(response => response.text())
                .then(text => {
                    if (text == "true" || text == "false") {
                        input.classList.remove('border-orange');
                        if (text == "true") {
                            input.classList.add('border-green');
                            document.getElementById('newUsernameButton').disabled = false;
                            currentValid = true;
                            return true;
                        } else {
                            input.classList.add('border-red')
                            document.getElementById('newUsernameButton').disabled = true;
                            return false;
                        }
                    }

                })
                .catch(error => console.log('Error:', error));

        } else {
            input.classList.add('border-red');
            return false;
        }
    }

    currentValid = false;

    // not to use
    function migrateConfirm() {

    }

    // debounce function to avoid spamming the server with requests
    function debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }

    // Create a debounced version of validateUsername with 500ms delay
    const debouncedValidateUsername = debounce(validateUsername, 500);

    // simulate a client login and change UI
    function clientLogin() {
        // get username from server
        try {
            // sleep for 1ms (was changed from 500ms)
            sleep(1).then(() => {
                fetch(APP_SCRIPT_URL +
                        `?getUsername={"token":"${localStorage.getItem('authToken')}", "email":"${localStorage.getItem('email')}"}`)
                    .then(response => response.text())
                    .then(text => {
                        console.log(text);
                        if (text == "{username not found}") {
                            document.getElementById('migrationContainer').style.display = "flex";
                            document.getElementById('oldUsernameTextbox').value = "(unknown)";
                            // request username
                            sleep(100).then(() => {
                                usrBox = document.getElementById('newUsernameTextbox');
                                usrBox.addEventListener('input', () => {
                                    // console.log(usrBox.value);
                                    document.getElementById('newUsernameButton').disabled = true;
                                    currentValid = false;
                                    debouncedValidateUsername();
                                });
                            })
                            //alert("WHO R U BOY");
                        } else if (text.length <= 16) {
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

        if (oldUSR) {
            document.getElementById('migrationContainer').style.display = "flex";
            document.getElementById('oldUsernameTextbox').value = oldUSR;

            sleep(100).then(() => {
                usrBox = document.getElementById('newUsernameTextbox');
                usrBox.addEventListener('input', () => {
                    // console.log(usrBox.value);
                    document.getElementById('newUsernameButton').disabled = true;
                    currentValid = false;
                    debouncedValidateUsername();
                });
            })

        } else {
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
        if (currentValid && document.getElementById('newUsernameButton').disabled == false) {
            updateUsername();
        }
    });

    // function that makes a new user from an email
    async function updateUsername() {
        localStorage.setItem('username', document.getElementById('newUsernameTextbox').value);
        document.getElementById('newUsernameButton').disabled = true;
        document.getElementById('newUsernameButton').textContent = "Please wait...";

        testAddr = APP_SCRIPT_URL
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
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        }).then(() => {
            localStorage.removeItem('uniqueID');
            clientLogin();
            document.getElementById('newUsernameButton').textContent = "Confirm";
        });

    }

    // function that logs the time saved if the user opts in
    if (localStorage.getItem('userDataOptIn') == 'true' && localStorage.getItem('email')) {
        testAddr = APP_SCRIPT_URL
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
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        // .then(response => response.json())
        // .then(result => console.log(result))
        // .catch(error => console.log(error));
    }

    // function that stores token & expiry time (so dont need to keep querying)
    function storeToken(token, expiresIn) {
        // Compute the expiry time (in milliseconds)
        const expiryTime = Date.now() + expiresIn * 1000;
        localStorage.setItem('oauthToken', token);
        localStorage.setItem('tokenExpiry', expiryTime);
    }

    // function to check if expiry time has passed
    function isTokenExpired() {
        const tokenExpiry = localStorage.getItem('tokenExpiry');
        if (!tokenExpiry) return true; // No expiry info means token is invalid
        return Date.now() > parseInt(tokenExpiry, 10);
    }

    // function to sign in the user (before simulating a client login)
    function signIn(retry = false) {
        chrome.identity.getAuthToken({
            interactive: true
        }, async function (token) {
            if (chrome.runtime.lastError) {
                console.log("User is not logged in.");
                // Show the sign-in button or prompt the user to log in.
                return;
            }

            console.log("User is logged in. Token:", token);
            authTOKEN = token;
            localStorage.setItem('authToken', authTOKEN);

            const tokenInfoUrl = `https://oauth2.googleapis.com/tokeninfo?access_token=${token}`;
            try {
                console.log("Verifying token...");
                const response = await fetch(tokenInfoUrl);

                // If a 400 error is encountered...
                if (response.status === 400) {
                    if (!retry) {
                        // Remove the cached token and try signing in again
                        chrome.identity.removeCachedAuthToken({
                            token: token
                        }, function () {
                            console.log("Cached token removed. Retrying sign-in...");
                            signIn(true);
                        });
                    } else {
                        // If already retried and still failing, log out the client
                        console.log("Token verification failed on retry. Logging out.");
                        clientLogout();
                    }
                    return;
                }

                const tokenInfo = await response.json();

                // If the token info contains an error description, handle it (optional)
                if (tokenInfo.error_description) {
                    console.log("Token error: " + tokenInfo.error_description);
                    return;
                }

                // Token is valid – proceed with login actions
                console.log("Token is valid for:", tokenInfo.email);
                localStorage.setItem('email', tokenInfo.email);
                document.getElementById('email').textContent = tokenInfo.email;

                logLogin();
                storeToken(token, tokenInfo.expires_in);


                clientLogin();

            } catch (error) {
                console.log("Error during token verification:", error);
            }
        });
    }

    // log the login event to the server
    function logLogin() {
        try {
            fetch("https://script.google.com/macros/s/AKfycbxr5AZzyaYAFm8NyhpWj7oSOb3Tc1NhYcTiHlo5OekghLYFiNsmY_Lfp1dWec_UDxUk/exec", {
                method: 'POST',
                mode: 'no-cors', // This prevents CORS errors, though the response is opaque.
                body: JSON.stringify({
                    option: "logLogin",
                    token: localStorage.getItem('authToken'),
                    email: localStorage.getItem('email'),
                })
            });
        } catch {
            console.log('logLogin failed')
        }
    }

    // if click sign in with google, call signIn function
    document.getElementById('signInWithGoogle').addEventListener('click', () => {
        signIn();
    });


    // check if user has opted in to data collection, if so, save the data the server (leaderboard time saved)
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

    // get the rank of the user when the launch the app
    async function getRank() {
        if (localStorage.getItem('user-rank')) {
            if (localStorage.getItem('user-rank') == -1) {
                document.getElementById('user-rank').textContent = `(rank >20)`;
            } else {
                document.getElementById('user-rank').textContent = `(#${localStorage.getItem('user-rank')})`;
            }
        }

        // place a loading svg beside the rank to make it clear it could be old data
        
        if (localStorage.getItem('authToken') != 'null' && localStorage.getItem('authToken') != null) {
            console.log(8);
            fetch(APP_SCRIPT_URL +
                    `?input=${localStorage.getItem('username')}`)
                .then(response => response.text())
                .then(text => {
                    localStorage.setItem('user-rank', text);
                    // alert(text);
                    if (text != -1) {
                        document.getElementById('user-rank').textContent = `(#${text})`;
                    } else {
                        document.getElementById('user-rank').textContent = `(rank >20)`;
                    }
                    document.getElementById('loader').style.display = "none";
                    document.getElementById('tick').style.display = "inline";


                })
                .catch(error => console.log('Error:', error));
        }
    }

    // open the leaderboard in a new tab if you click show leaderboard
    document.getElementById('leaderboard-popup').addEventListener('click', () => {
        window.open(
            "https://docs.google.com/spreadsheets/d/e/2PACX-1vQY7BsTK4TY5DLMUDF7kbf-dq1Eo0cgv95FKkemrwyIlHwxUNhC4Kz1qBYDrTF5IZ_NYerftRcRlB6q/pubchart?oid=1888302536&format=interactive",
            "popupWindow",
            "width=644,height=620"
        );
    });

    // open web store page if you click rate the extension
    document.getElementById('rate-button').addEventListener('click', () => {
        // open a new tab to the chrome web store (https://chromewebstore.google.com/detail/panopto-custom-speed/fnoppdfnaklabgfllejlefomclegmnam)
        window.open(
            "https://chromewebstore.google.com/detail/panopto-custom-speed/fnoppdfnaklabgfllejlefomclegmnam/reviews",
        );
    });

    // open buy me a coffee page if you click support the extension
    document.getElementById('coffee-button').addEventListener('click', () => {
        window.open(
            "https://buymeacoffee.com/harveychandler",
        );
    });


    

    tempToken = localStorage.getItem('authToken');
    tempEmail = localStorage.getItem('email');

    // on startup logic

    async function r() {
        let a = isTokenExpired();
        if (a) {
            clientLogout();
            signIn();
            clientLogin();
        } else {
            clientLogin();
        }
        //     clientLogout();
        //     signIn();
        //     clientLogin();
        // }
    }

    r();

    let tttemp = localStorage.getItem('aID');
    let timingDiv = document.getElementById('timingDiv');
    let timingSpan = document.getElementById('timingSpan');

    if (!tttemp) {
        // generate a anonymousID for the user
        aID = generateUniqueId();
        localStorage.setItem('aID', aID);
        fetchData();
    } else {
        if (localStorage.getItem('fullTime')) {
            timingDiv.style.display = "block";
            timingSpan.textContent = formatTime(localStorage.getItem('fullTime'));
        }

        // send your anonymousID & time saved to the server
        // server responds with the time saved by ALL users
        function fetchData() {
            fetch(APP_SCRIPT_URL +
                    `?getFullTime={"aID":"${localStorage.getItem('aID')}", "myTime":"${localStorage.getItem('saved-time')}"}`)
                .then(response => response.text())
                .then(text => {
                    if (text) {
                        //   console.log(text);
                        localStorage.setItem('fullTime', text);
                        timingDiv.style.display = "block";
                        timingSpan.textContent = formatTime(localStorage.getItem('fullTime'));
                    }
                })
                .catch(error => console.log('Error:', error));
        }

        // Call immediately
        fetchData();

        // Then schedule to run every 5 seconds
        setInterval(fetchData, 5000);
    }
});