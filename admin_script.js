function showLoginPopup() {
    document.body.classList.add('overlay-active')
    document.getElementById('loginOverlay').style.display = 'flex';
}

// Function to close the login popup
function closeLoginPopup() {
    document.body.classList.remove('overlay-active');
    document.getElementById('loginOverlay').style.display = 'none';
}

// Function to handle login
function performLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // Send a request to the server to validate the credentials
    $.ajax({
        type: 'POST',
        url: 'https://tigerplayapp.onrender.com/login',
        contentType: 'application/json',
        data: JSON.stringify({ username, password }),
        success: function (response) {
            if (response.success) {
                alert('Login successful');
                closeLoginPopup();
            } else {
                alert('Invalid credentials');
            }
        },
        error: function () {
            alert('Error during login');
        }
    });
}

const startNowButton = document.getElementById('startNowButton');



window.onload = showLoginPopup;

