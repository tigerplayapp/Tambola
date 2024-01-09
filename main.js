const socket = io('https://tigerplayapp.onrender.com');

const displayedTicketNumbers = [];

socket.on('tickets', (loadedTickets) => {
    // Update the UI with the loaded ticket data
    const ticketContainer = document.getElementById('ticket-container');

    // Render loaded tickets in the container
    displayTicket(loadedTickets);
    const latestTicketNumber = Math.max(...loadedTickets.map(ticket => ticket.ticket_number), 0);
    ticket_number = latestTicketNumber + 1;

});

socket.on('generatedTicket', (generatedTicket) => {
    console.log('Received generated ticket:', generatedTicket);
    generatedTicket.completionTime = null;
    generatedTicket.highlightedCellCount = 0;
    displayTicket([generatedTicket]);
});
var rows = [];
var ticket_number = 1;

function getRandom(arr, n) {
    var result = new Array(n),
        len = arr.length,
        taken = new Array(len);
    if (n > len)
        throw new RangeError("getRandom: more elements taken than available");
    while (n--) {
        var x = Math.floor(Math.random() * len);
        result[n] = arr[x in taken ? taken[x] : x];
        taken[x] = --len in taken ? taken[len] : len;
    }
    return result;
}

function getZeroOne() {
    return Math.round(Math.random());
}

function generateTicket() {
    displayedTicketNumbers.length = 0;
    socket.emit('generateTicket');
    var columnok = false;
    rows = [];

    while (columnok != true) {
        columnok = false;
        rows = [];
        for (var r = 0; r < 3; r++) {
            var row = [];
            var onecount = 0;
            while (onecount != 5) {
                onecount = 0;
                row = [];
                for (var c = 0; c < 9; c++) {
                    var n = getZeroOne();
                    if (n == 1) onecount++;
                    row.push(n);
                }
            }
            rows.push(row);
        }

        // Check if all columns have at least one 1
        for (var c = 0; c < 9; c++) {
            if (rows[0][c] == 1 || rows[1][c] == 1 || rows[2][c] == 1) {
                columnok = true;
            } else {
                columnok = false;
                break;
            }
        }
    }

    // Replace 1s with numbers
    for (var c = 0; c < 9; c++) {
        // Get count of 1s in this column
        var nums = rows[0][c] + rows[1][c] + rows[2][c];
        var min = c * 10 + 1;
        var max = min + 8;
        if (c == 8) max = 90;
        var tmp = [];
        for (var n = min; n <= max; n++) {
            tmp.push(n);
        }
        var arr = getRandom(tmp, nums).sort().reverse();
        for (var r = 0; r < 3; r++) {
            if (rows[r][c] == 1) {
                rows[r][c] = arr.pop();
            }
        }
    }
    const localTicketNumber = ticket_number;

    const ticketData = {
        ticket_number: localTicketNumber,
        row1_col1: rows[0][0],
        row1_col2: rows[0][1],
        row1_col3: rows[0][2],
        row1_col4: rows[0][3],
        row1_col5: rows[0][4],
        row1_col6: rows[0][5],
        row1_col7: rows[0][6],
        row1_col8: rows[0][7],
        row1_col9: rows[0][8],
        row2_col1: rows[1][0],
        row2_col2: rows[1][1],
        row2_col3: rows[1][2],
        row2_col4: rows[1][3],
        row2_col5: rows[1][4],
        row2_col6: rows[1][5],
        row2_col7: rows[1][6],
        row2_col8: rows[1][7],
        row2_col9: rows[1][8],
        row3_col1: rows[2][0],
        row3_col2: rows[2][1],
        row3_col3: rows[2][2],
        row3_col4: rows[2][3],
        row3_col5: rows[2][4],
        row3_col6: rows[2][5],
        row3_col7: rows[2][6],
        row3_col8: rows[2][7],
        row3_col9: rows[2][8],
    };

    const numberOfTickets = 1;
    fetch('/generateAndStoreTickets', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ numberOfTickets, ticket: ticketData }),
    })
        .then(response => response.json())
        .then(data => {
            console.log(data.message);
            const generatedTickets = data.generatedTickets;
            if (generatedTickets && generatedTickets.length > 0) {
                // Update the ticket number after the server responds
                ticket_number = generatedTickets[0].ticket_number + 1;
                console.log('Updated ticket_number:', ticket_number);
                displayTicket(generatedTickets);
            } else {
                console.error('No tickets were generated.');
            }
        })
        .catch(error => {
            console.error('Error generating and storing tickets:', error);
        });
}

function displayTicket(tickets) {
    tickets.forEach((ticket) => {
        if (!displayedTicketNumbers.includes(ticket.ticket_number)) {
            var tblstr = "<table>";
            for (var r = 0; r < 3; r++) {
                tblstr += "<tr>";
                for (var c = 0; c < 9; c++) {
                    if (ticket['row' + (r + 1) + '_col' + (c + 1)] === 0) {
                        tblstr += "<td>&nbsp;</td>";
                    } else {
                        tblstr += "<td>" + ticket['row' + (r + 1) + '_col' + (c + 1)] + "</td>";
                    }
                }
                tblstr += "</tr>";
            }
            tblstr += "</table>";

            // Create a button with the class 'book-now' and text 'Book Ticket {ticketNumber}'
            var buttonStr = "<button class='book-now'>Book Ticket " + ticket.ticket_number + "</button>";

            // Append the new table and button to the existing content
            $("#tbl").append(tblstr + buttonStr);

            // Optionally, you can add margin between tables and buttons
            $("#tbl table:not(:last-child)").css("margin-bottom", "20px");
            $("#tbl button:not(:last-child)").css("margin-bottom", "20px");
            displayedTicketNumbers.push(ticket.ticket_number);
        }
    });
}

const adminButton = document.getElementById('admin-button');
adminButton.addEventListener('click', () => {
    window.open('/admin_index.html', '_blank');
});







const countdownElement = document.getElementById('countdown-display');

function startCountdown(hours) {
    

    socket.emit('startCountdown', hours);
}

function updateCountdown(countdownValue) {
    
    
    const countdownDisplay = document.getElementById('countdown-display');

    // Check if the element exists before updating
    if (countdownDisplay) {
        countdownDisplay.textContent = formatTime(countdownValue);

        if (countdownValue < 0) {

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

            
            document.querySelector('.timer').innerHTML = '<p>Game has started!</p>';
            window.location.href = 'Number-Generator/index.html'
            countdownDisplay.textContent = 0;
        } else {
            setTimeout(() => {
                updateCountdown(countdownValue - 1);
            }, 1000);
        }
    } else {
        console.error("Element with ID 'countdown-display' not found.");
    }
}


function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    return (
        String(hours).padStart(2, '0') +
        ':' +
        String(minutes).padStart(2, '0') +
        ':' +
        String(remainingSeconds).padStart(2, '0')
    );
}

function startNow() {
    // Emit the 'startNowButtonClicked' event
    socket.emit('startNowButtonClicked');
}

// Listen for countdown updates from the server
socket.on('countdownUpdate', (countdownValue) => {
    // Update your UI with the new countdown value
    updateCountdown(countdownValue);
});

// Fetch the initial countdown value from the server
socket.on('initialCountdown', (initialCountdownValue) => {
    updateCountdown(initialCountdownValue);
});



socket.emit('getTickets');

// const countdownBtn = document.getElementById('countdown-button');

// countdownBtn.addEventListener('click', () => {
//     socket.emit('startCountdown');
// })


function makeDeleteRequest() {

    fetch('/deleteAllTickets', {
        method: 'DELETE',
    })
        .then(response => response.json())
        .then(data => {
            console.log('Tickets deleted successfully:', data);
            // You can update the UI or perform other actions if needed
        })
        .catch(error => {
            console.error('Error deleting tickets:', error);
        });
}

// Function to handle the button click event
function deleteAllTickets() {
    const confirmDeletion = confirm('Are you sure you want to delete all tickets?');

    if (confirmDeletion) {
        // Call the server-side function to delete all tickets
        makeDeleteRequest();
    }
}
