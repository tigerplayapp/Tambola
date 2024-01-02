const socket = io('https://tigerplayapp.onrender.com/');

function fetchVisitedNumbers() {
   
    socket.on('newVisitedNumber', (number) => {
        const div = document.createElement('div');
        div.classList.add('nums');
        div.textContent = number;
        displayNumbers.appendChild(div);
    });
}
let random = 0;
const btn = document.getElementById('button');
const displayNumbers = document.querySelector('.display-numbers');
let visitedNumbers = [];
const MAX_NUMBERS = 90;


function displayVisitedNumbers() {
    displayNumbers.innerHTML = ''; // Clear existing content
    visitedNumbers.forEach(number => {
        const div = document.createElement('div');
        div.classList.add('nums');
        div.textContent = number;
        displayNumbers.appendChild(div);
    });
}

function myFunction() {
    random = Math.floor(Math.random() * MAX_NUMBERS + 1);

    if (visitedNumbers.includes(random)) {
        myFunction();
    } else {
        visitedNumbers.push(random);

        document.getElementById("demo").innerHTML = random;
        document.getElementById("n-" + random).classList.add("last");
        document.getElementById("n-" + random).classList.add("done");

        if (visitedNumbers.length == 90) {
            btn.style.display = 'block';
        }
    }

    if (!isNumberDisplayed(random)) {
        const div = document.createElement('div');
        div.classList.add('nums');
        div.textContent = random;
        displayNumbers.appendChild(div);
        socket.emit('newVisitedNumber', random);
    }

}

function callmyFunction() {
    myFunction();
    setTimeout(callmyFunction, 3000);
}

function isNumberDisplayed(number) {
    const displayedNumbers = Array.from(displayNumbers.querySelectorAll('.nums'))
        .map(div => parseInt(div.textContent));

    return displayedNumbers.includes(number);
}

function removeLast() {
    let lastnum = visitedNumbers.length - 2;
    document.getElementById("n-" + visitedNumbers[lastnum]).classList.remove("last");
}

btn.addEventListener('click', () => {
  
    fetch('https://tigerplayapp.onrender.com/clearVisitedNumbers', {
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

// Call the function when the page loads
window.onload = function () {
    fetch('https://tigerplayapp.onrender.com/getVisitedNumbers')
    .then(response => response.json())
    .then(data => {
        visitedNumbers = data.visitedNumbers || [];
        displayVisitedNumbers();
    })
    .catch(error => {
        console.error('Error fetching visited numbers:', error);
    });


    for (const number of visitedNumbers) {
        const div = document.createElement('div');
        div.classList.add('nums');
        div.textContent = number;
        displayNumbers.appendChild(div);
        document.getElementById("n-" + number).classList.add("last");
        document.getElementById("n-" + number).classList.add("done");
    }

    callmyFunction();
};



