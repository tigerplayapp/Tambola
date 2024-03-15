const socket = io('http://localhost:3000');
let visitedNumbers = [];
let lastRandomNumber;
let gameIsActive = true;
let gameOver = false;

let intervalId;
const displayedTicketNumbers = new Set();

socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

function fetchVisitedNumbers() {
    fetch('http://localhost:3000/getVisitedNumbers')
        .then(response => response.json())
        .then(data => {
            visitedNumbers = data.visitedNumbers || [];
            displayVisitedNumbers();
        })
        .catch(error => {
            console.error('Error fetching visited numbers:', error);
        });

    // socket.on('newVisitedNumber', (number) => {
    //     const div = document.createElement('div');
    //     div.classList.add('nums');
    //     div.textContent = number;
    //     displayNumbers.appendChild(div);
    // });
}

const btn = document.getElementById('button');
const displayNumbers = document.querySelector('.display-numbers');

socket.on('initialState', (initialState) => {
    visitedNumbers = initialState.visitedNumbers;
    lastRandomNumber = initialState.lastRandomNumber;
    displayVisitedNumbers(); // Update the UI with visited numbers
    updateDisplayedNumber(lastRandomNumber); // Update the UI with the last random number


  
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

    checkMatchingCells(randomNumber);
    checkForWinner();

}


socket.on('newRandomNumber', (randomNumber) => {
    // Update the displayed number when a new random number is received
    if (!gameOver) {
        updateDisplayedNumber(randomNumber);
        lastRandomNumber = randomNumber;

        // Fetch loaded tickets here or use the appropriate data source
        fetch('http://localhost:3000/getTickets')
            .then(response => response.json())
            .then(data => {
                const loadedTickets = data.loadedTickets || [];
                // Call displayTicket here after updating lastRandomNumber and fetching loadedTickets
                displayTicket(loadedTickets);
            })
            .catch(error => {
                console.error('Error fetching tickets:', error);
            });
    }
});




function generateRandomNumber() {
    // Emit an event to request the server to generate a new random number
    socket.emit('generateRandomNumber');
}


function removeLast() {
    let lastnum = visitedNumbers.length - 2;
    document.getElementById("n-" + visitedNumbers[lastnum]).classList.remove("last");
}

function resetGameVariables() {
    gameIsActive = true;
    gameOver = false;
    lastRandomNumber = null;
}

btn.addEventListener('click', () => {
    console.log('button clicked');
    window.location.href = '../index.html';
    deleteHighlightedCellsForTicket();
    clearVisitedNumbers();
    resetGameVariables(); // Reset game variables for the next game
    intervalId = setInterval(callGenerateRandomNumber, 1000); // Restart the interval
});

function clearVisitedNumbers() {
    fetch('http://localhost:3000/clearVisitedNumbers', {
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
}


function callGenerateRandomNumber() {
    generateRandomNumber();
}

intervalId = setInterval(callGenerateRandomNumber, 1000);


//Display the tickets

socket.on('generatedTicket', (generatedTicket) => {
    console.log('Received generated ticket:', generatedTicket);
    generatedTicket.completionTime = null;
    generatedTicket.highlightedCellCount = 0;
    displayTicket([generatedTicket]);
});

socket.off('tickets');
socket.on('tickets', (loadedTickets) => {

    // // Update the UI with the loaded ticket data
    // // Render loaded tickets in the container
    displayTicket(loadedTickets);

    // Call checkMatchingCells after loading the tickets and displaying them
    checkMatchingCells();
    fetchHighlightedCells();
    const latestTicketNumber = Math.max(...loadedTickets.map(ticket => ticket.ticket_number), 0);
    ticket_number = latestTicketNumber + 1;

});

function displayTicket(tickets) {
    tickets.forEach((ticket) => {
        const currentTicketNumber = ticket.ticket_number;

        // Check if the ticket is already displayed
        if (!displayedTicketNumbers.has(currentTicketNumber)) {
            let tblstr = "<table>";
            for (let r = 0; r < 3; r++) {
                tblstr += "<tr>";
                for (let c = 0; c < 9; c++) {
                    const cellValue = ticket['row' + (r + 1) + '_col' + (c + 1)];
                    const cellId = 'tbl-' + ticket.ticket_number + '-row' + (r + 1) + '-col' + (c + 1);
                    const cellDataId = 'cell-' + ticket.ticket_number + '-row' + (r + 1) + '-col' + (c + 1);

                    if (cellValue === 0) {
                        tblstr += "<td id='" + cellId + "' data-cell-id='" + cellDataId + "'>&nbsp;</td>";
                    } else {
                        tblstr += "<td id='" + cellId + "' data-cell-id='" + cellDataId + "'>" + cellValue + "</td>";
                    }
                }
                tblstr += "</tr>";
            }
            tblstr += "</table>";

            // Create a button with the class 'book-now' and text 'Book Ticket {ticketNumber}'
            const containerStr = "<div class='ticket-container'>" + tblstr;

            // Create a button with the class 'book-now' and text 'Book Ticket {ticketNumber}'
            var buttonStr = `<button class='book-now' data-ticket="${ticket.ticket_number}">Book Ticket ${ticket.ticket_number}</button>`;

            // Close the div container
            const closingStr = "</div>";

            // Append the new table and button to the existing content
            $("#tbl").append(containerStr + buttonStr + closingStr);

            // Optionally, you can add margin between tables and buttons
            $("#tbl table:not(:last-child)").css("margin-bottom", "20px");
            $("#tbl .ticket-container").css({
                "display": "flex",
                "flexDirection": "column",
                "alignItems": "center",
                "justifyContent": "center",
            });
            
            $("#tbl button:not(:last-child)").css("margin-bottom", "20px");

            // Add the displayed ticket number to the set
            displayedTicketNumbers.add(currentTicketNumber);
        }
    });
    updateWithBookedTickets();
}

function checkMatchingCells(randomNumber) {
    // Array to store matching cells
    const matchingCells = [];

    // Iterate through all ticket tables and check for matching cells
    $(".table").each(function () {
        const ticketTable = $(this);

        // Iterate through all cells in the current ticket table
        ticketTable.find('td[id^="tbl"]').each(function () {
            const cellValue = $(this).text().trim();

            if (cellValue === String(randomNumber).trim()) {
                // Mark the matching cell with a different background color
                // $(this).css('background', 'green');

                // // Optionally, you can add additional styling or effects
                // $(this).addClass('matched-cell');
                const cellId = $(this).attr('id');
                const ticketNumber = extractTicketNumber(cellId);
                matchingCells.push({ ticket_number: ticketNumber, cell_id: cellId });
            }
        });
    });

    // Check if there are matching cells before applying them
    if (matchingCells.length > 0) {
        applyHighlightedCells(matchingCells);
    }
}

function checkForWinner() {
    if (!gameIsActive) {
        return; // Stop checking for a winner if the game is already over
    }

    var isWinner = false;

    // Iterate through all ticket tables and check for a full house
    $(".table table").each(function () {
        const ticketTable = $(this);

        // Iterate through all cells in the current ticket table
        ticketTable.find('.matched-cell').each(function () {
            const cellId = $(this).attr('id');

            // Extract the ticket number from the cellId
            const ticketNumber = extractTicketNumber(cellId);

            // Count the number of highlighted cells in the current ticket table
            const highlightedCellCount = ticketTable.find('.matched-cell').length;
            // Log the highlighted cell count for debugging


            // If all 15 cells are highlighted, declare the winner
            if (highlightedCellCount === 15) {
                console.log(`Player with Ticket ${ticketNumber} has a full house and is the winner!`);
                displayWinnerMessage(ticketNumber);
                isWinner = true;
                gameIsActive = false; // Set the game to inactive
                clearInterval(intervalId);
                gameOver = true; // Set the game over flag to true
                return false; // Exit the each loop
            }
        });

        if (isWinner) {
            return false; // Exit the outer each loop
        }
    });
    return isWinner;
}

// Helper function to extract ticket number from cellId
function extractTicketNumber(cellId) {
    const match = cellId.match(/tbl-(\d+)-row\d+-col\d+/);
    if (match) {
        return parseInt(match[1]);
    }
    return null;
}


function displayWinnerMessage(ticketNumber) {
    // Display your winner message on the webpage
    const winnerMessage = document.getElementById('winner-message');
    winnerMessage.innerHTML = `<span class="winner-text">Player with Ticket ${ticketNumber} has a full house and is the winner!</span>`;
    winnerMessage.style.display = 'block'; // Show the winner message element
    btn.style.display = 'block';

}



function saveHighlightedCellToDatabase(ticket_number, cell_id) {
    // Send a request to the server to save the highlighted cell
    fetch('http://localhost:3000/saveHighlightedCell', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ticket_number, cell_id }),
    })
        .then(response => response.json())
        .then(data => {
            console.log('Highlighted cell saved to database:', data);
        })
        .catch(error => {
            console.error('Error saving highlighted cell to database:', error);
        });
}

function fetchHighlightedCells() {
    fetch('http://localhost:3000/getHighlightedCells')
        .then(response => response.json())
        .then(data => {
            const highlightedCells = data.highlightedCells || [];

            // Update the client-side UI based on the fetched state
            applyHighlightedCells(highlightedCells);
        })
        .catch(error => {
            console.error('Error fetching highlighted cells:', error);
        });
}

function applyHighlightedCells(highlightedCells) {
    if (Array.isArray(highlightedCells)) {
        highlightedCells.forEach(({ ticket_number, cell_id }) => {
            // Assuming cell_id is in the format 'tbl-TICKET_NUMBER-rowX-colY'
            if (cell_id) {
                const cellElement = document.getElementById(cell_id);

                if (cellElement) {
                    // Mark the matching cell with a different background color
                    cellElement.style.background = 'green';

                    // Optionally, you can add additional styling or effects
                    cellElement.classList.add('matched-cell');
                    saveHighlightedCellToDatabase(ticket_number, cell_id);
                }
            }
        });
    } else {
        console.error('Invalid highlightedCells data:', highlightedCells);
    }
}


// Function to delete highlighted cells for a specific ticket
function deleteHighlightedCellsForTicket() {
    fetch(`http://localhost:3000/deleteHighlightedCells`, {
        method: 'DELETE',
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('Highlighted cells deleted successfully');
            } else {
                console.error('Error deleting highlighted cells:', data.error);
            }
        })
        .catch(error => {
            console.error('Error deleting highlighted cells:', error);
        });
}


socket.emit('getTickets');

window.onload = function () {

    fetchVisitedNumbers();
    socket.emit('generateRandomNumber');
    callGenerateRandomNumber();

} 

function updateWithBookedTickets() {
    fetch('/getBookedTickets')
        .then(response => response.json())
        .then(data => {
            console.log('Fetched data:', data);  // Log the fetched data

            const bookedTickets = data.bookedTickets;

            if (Array.isArray(bookedTickets)) {
                bookedTickets.forEach(bookedTicket => {
                    const button = $(`button[data-ticket="${bookedTicket.ticket_number}"]`);
                    if (button) {
                        button.text(`Ticket ${bookedTicket.ticket_number} booked by ${bookedTicket.player_name}`);
                    }
                });
            } else {
                console.error('Error fetching booked tickets: Invalid data format');
            }
        })
        .catch(error => {
            console.error('Error fetching booked tickets:', error);
        });
}

window.addEventListener('load', () => {
    updateWithBookedTickets();
});


socket.on('ticketBooked', (bookedTicket) => {
    console.log('New ticket booked:', bookedTicket);
    const button = $(`button[data-ticket="${bookedTicket.ticketNumber}"]`);
    if (button) {
        button.text(`Ticket booked by ${bookedTicket.playerName}`);
    }
    updateWithBookedTickets();
});