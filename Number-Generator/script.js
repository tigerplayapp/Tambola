const socket = io('https://tigerplayapp.onrender.com/');

function fetchVisitedNumbers() {

    socket.on('newVisitedNumber', (number) => {
        const div = document.createElement('div');
        div.classList.add('nums');
        div.textContent = number;
        displayNumbers.appendChild(div);
    });
}

const btn = document.getElementById('button');
const displayNumbers = document.querySelector('.display-numbers');

socket.on('generatedNumbersCount90', () => {
    // If the count of generated numbers is 90, show the button
    btn.style.display = 'block';
});

function displayVisitedNumbers() {
    displayNumbers.innerHTML = ''; // Clear existing content

    visitedNumbers.forEach(number => {
        const div = document.createElement('div');
        div.classList.add('nums');
        div.textContent = number;
        displayNumbers.appendChild(div);
    });
}


function updateDisplayedNumber(randomNumber) {
    // Update your UI with the new random number
    document.getElementById("demo").innerHTML = randomNumber;
    document.getElementById("n-" + randomNumber).classList.add("last");
    document.getElementById("n-" + randomNumber).classList.add("done");

    const div = document.createElement('div');
    div.classList.add('nums');
    div.textContent = randomNumber;
    displayNumbers.appendChild(div);
}


socket.on('newRandomNumber', (randomNumber) => {
    // Update the displayed number when a new random number is received
    updateDisplayedNumber(randomNumber);
});

// function myFunction() {
//     random = Math.floor(Math.random() * MAX_NUMBERS + 1);

//     if (visitedNumbers.includes(random)) {
//         myFunction();
//     } else {
//         visitedNumbers.push(random);

//         document.getElementById("demo").innerHTML = random;
//         document.getElementById("n-" + random).classList.add("last");
//         document.getElementById("n-" + random).classList.add("done");

//         if (visitedNumbers.length == 90) {
//             btn.style.display = 'block';
//         }
//     }

//     if (!isNumberDisplayed(random)) {
//         const div = document.createElement('div');
//         div.classList.add('nums');
//         div.textContent = random;
//         displayNumbers.appendChild(div);
//         socket.emit('newVisitedNumber', random);
//     }

// }

function generateRandomNumber() {
    // Emit an event to request the server to generate a new random number
    socket.emit('generateRandomNumber');
}


// function callmyFunction() {
//     myFunction();
//     setTimeout(callmyFunction, 3000);
// }

// function isNumberDisplayed(number) {
//     const displayedNumbers = Array.from(displayNumbers.querySelectorAll('.nums'))
//         .map(div => parseInt(div.textContent));

//     return displayedNumbers.includes(number);
// }

function removeLast() {
    let lastnum = visitedNumbers.length - 2;
    document.getElementById("n-" + visitedNumbers[lastnum]).classList.remove("last");
}

btn.addEventListener('click', () => {

    fetch('http://tigerplayapp.onrender.com/clearVisitedNumbers', {
        method: 'POST',
    })
        .then(response => response.json())
        .then(data => {
            console.log(data.message);
            // Handle the response as needed
        })
        .catch(error => {
            console.error('Error clearing visited numbers:', error);
        });

    // Redirect to the index.html page
    window.location.href = '../index.html';
});

function callGenerateRandomNumber() {
    generateRandomNumber();
}

setTimeout(() => {
    callGenerateRandomNumber();
    setInterval(callGenerateRandomNumber, 3000);
}, 3000);


// Call the function when the page loads
window.onload = function () {
    fetch('http://localhost:3000/getVisitedNumbers')
        .then(response => response.json())
        .then(data => {
            visitedNumbers = data.visitedNumbers || [];
            displayVisitedNumbers();
            })
        .catch(error => {
            console.error('Error fetching visited numbers:', error);
        });


    socket.emit('generateRandomNumber');
    callGenerateRandomNumber();
};