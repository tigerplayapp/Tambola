// Import necessary modules
const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const { Client, Pool } = require('pg');

// Create an Express app, HTTP server, and Socket.IO instance
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// PostgreSQL configuration
const pgConfig = {
    user: 'tigerplayapp_user',
    host: 'dpg-cm9tcanqd2ns73drfdi0-a',
    database: 'tigerplayapp',
    password: 'BNgDKxnEMyAxS7kvkcXfjp0EHXNdCilg',
    port: 5432, // Adjust the port if needed
};

const pool = new Pool(pgConfig);

const client = new Client(pgConfig);
client.connect()
    .then(() => console.log('Connected to PostgreSQL'))
    .catch((err) => console.error('Error connecting to PostgreSQL', err));

// Initialize countdown value and tickets array
let tickets = [];
let countdownValue;
let countdownInterval;
let generatedNumbers = [];
let userTicketCaches = {};
let lastRandomNumber = null;
let visitedNumbers = [];
let MAX_NUMBERS = 90;
let loadedTickets = [];
let randomNumberLock = false;



// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Client connected');
    const userId = socket.id;
    userTicketCaches[userId] = [];


    if (lastRandomNumber !== null) {
        socket.emit('newRandomNumber', lastRandomNumber);
    }
    socket.emit('existingGeneratedNumbers', generatedNumbers);


    loadTicketsFromDatabase(userId)
        .then((loadedTickets) => {
            socket.emit('ticketsGenerated', loadedTickets);
            console.log('Tickets loaded from the database and emitted to the client:', loadedTickets);
        })
        .catch((error) => {
            console.error('Error loading tickets from the database:', error.message);
        });

    // Emit countdown updates every second
    socket.on('startCountdown', (hours) => {
        // Clear the existing interval before starting a new one
        clearInterval(countdownInterval);
        countdownValue = hours * 60 * 60;

        // Emit countdown updates every second
        countdownInterval = setInterval(() => {
            countdownValue -= 1;
            io.emit('countdownUpdate', countdownValue);

            if (countdownValue <= 0) {
                // Optionally, you can stop the interval or perform other actions when countdown reaches zero
                clearInterval(countdownInterval);
                // Emit an event to notify clients that the countdown has reached zero
                io.emit('countdownZero');
            }
        }, 1000);
    });


    socket.on('generateTickets', (numberOfTickets) => {
        loadTicketsFromDatabase(numberOfTickets)
            .then((existingTickets) => {
                if (existingTickets.length === 0) {
                    const newTickets = generateTickets(numberOfTickets);
                    saveTicketToDatabase(newTickets);
                    io.emit('ticketsGenerated', newTickets);
                } else {
                    io.emit('ticketsGenerated', existingTickets);
                }
            })
            .catch((error) => {
                console.error('Error fetching tickets:', error.message);
            });
    });

    socket.on('getTickets', () => {
        io.emit('tickets', tickets);
    });

    socket.on('adminGenerateTicket', () => {
        // Your logic to generate a new ticket and store it
        const newTicket = generateAndStoreTicket(); // Replace with your actual function

        // Broadcast the new ticket to all connected clients
        io.emit('ticketsGenerated', [newTicket]);
    });





    socket.on('startNowButtonClicked', () => {
        // Set countdownValue to 0
        countdownValue = 0;

        // Emit an event to notify clients that the countdown has reached zero
        io.emit('countdownZero');
    });

    socket.on('newVisitedNumber', (number) => {
        saveVisitedNumberToDatabase(number);
        io.emit('newVisitedNumber', number);
    });


    socket.on('generateTicket', () => {
        const newTicket = generateAndStoreTicket();
        io.emit('generatedTicket', newTicket);
    });




    socket.on('connect', () => {
        const userId = generateUserId(); // Implement your own logic to generate a unique user ID
        socket.userId = userId; // Store the user ID in the socket object
    });

    // On disconnect, use the stored user ID
    socket.on('disconnect', () => {
        const userId = socket.userId;
        if (userId) {
            delete userTicketCaches[userId];
        }
    });


    socket.on('generateRandomNumber', async () => {
        if (!randomNumberLock) {
            randomNumberLock = true;

            let newRandomNumber;
            do {
                // Generate a new random number
                newRandomNumber = Math.floor(Math.random() * MAX_NUMBERS + 1);
            } while (generatedNumbers.includes(newRandomNumber));

            // Add the new random number to the array
            generatedNumbers.push(newRandomNumber);
            await saveVisitedNumberToDatabase(newRandomNumber);

            // Broadcast the new random number to all clients
            io.emit('newRandomNumber', newRandomNumber);

            // Release the lock after broadcasting the random number
            setTimeout(() => {
                randomNumberLock = false;
            }, 1000); // Adjust the timeout as needed
        }
    });

    socket.emit('initialState', {
        visitedNumbers: visitedNumbers,
        lastRandomNumber: lastRandomNumber,
        loadedTickets: loadedTickets,
        // initialBookedTickets: initialBookedTickets,

    });
    socket.on('bookTicket', ({ ticketNumber, playerName }) => {
        saveBookedTicketToDatabase(ticketNumber, playerName); console.log(`Booking ticket ${ticketNumber} for player ${playerName}`);
        const bookedTicket = { ticket_number: ticketNumber, username: playerName };
        io.emit('ticketBooked', bookedTicket);
    });

    // socket.emit('initialBookedTickets', initialBookedTickets);

});




async function generateAndStoreTicket() {
    try {
        const newTicket = generateTickets(1)[0]; // Generate a single ticket

        console.log('Generated Ticket:', newTicket);

        // Your logic to store the new ticket in the database
        await saveTicketToDatabase(newTicket);

        console.log('Saved Ticket to Database:', newTicket);

        return newTicket;
    } catch (error) {
        console.error('Error in generateAndStoreTicket:', error.message);
        throw error;
    }
}


async function saveTicketToDatabase(generatedTicket) {
    const client = new Client(pgConfig);

    try {
        await client.connect();

        // Generate a unique ticket number on the server side
        const ticketNumberQuery = 'SELECT MAX(ticket_number) FROM tickets';
        const result = await client.query(ticketNumberQuery);
        const nextTicketNumber = result.rows[0].max || 0;
        generatedTicket.ticket_number = nextTicketNumber + 1;

        // Save the generated ticket to the database
        const keys = Object.keys(generatedTicket).join(', ');
        const values = Object.values(generatedTicket).map(value => `'${value}'`).join(', ');
        const query = `INSERT INTO tickets (${keys}) VALUES (${values}) RETURNING *`;
        const insertionResult = await client.query(query);
        const insertedTicket = insertionResult.rows[0];

        // Update the tickets array only after successful insertion
        tickets.push(insertedTicket);

        io.emit('ticketsGenerated', [insertedTicket]);
        console.log('Ticket saved to the database:', insertedTicket);

    } catch (error) {
        console.error('Error saving ticket to the database:', error.message);
    } finally {
        await client.end();
    }
}



async function loadTicketsFromDatabase(userId) {
    const client = new Client(pgConfig);

    try {
        await client.connect();

        const userCache = userTicketCaches[userId] || [];

        // Create placeholders for parameters based on the number of items in userCache
        const placeholders = userCache.map((_, index) => `$${index + 2}`).join(', ');

        // Use the placeholders in the NOT IN condition
        const query = `SELECT * FROM tickets WHERE ticket_number NOT IN (${placeholders || 'null'})`;

        // Combine the userCache and query parameters
        const queryParams = userCache.map(ticketNumber => parseInt(ticketNumber));

        const result = await client.query(query, queryParams);

        const uniqueTickets = result.rows;
        userTicketCaches[userId] = [...userCache, ...uniqueTickets.map(ticket => ticket.ticket_number)];

        return uniqueTickets;
    } catch (error) {
        console.error('Error loading tickets from the database:', error.message);
        throw error;
    } finally {
        await client.end();
    }
}


loadTicketsFromDatabase()
    .then((loadedTickets) => {
        tickets = loadedTickets;
        console.log('Tickets loaded from the database:', tickets);
    })
    .catch((error) => {
        console.error('Error loading tickets from the database:', error.message);
    });




// Serve static files and set up the root route
app.use(express.static(path.join(__dirname, '..')));
app.use(bodyParser.json());
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, '..', 'index.html');
    res.sendFile(indexPath);
});

const validUser = { username: '123', password: '123' };



app.get('/getVisitedNumbers', async (req, res) => {
    try {
        // Replace this with your actual database query logic
        const client = new Client(pgConfig);
        await client.connect();

        const query = 'SELECT * FROM visited_numbers';
        const result = await client.query(query);
        const visitedNumbers = result.rows.map(row => row.number);

        await client.end();

        res.json({ visitedNumbers });
    } catch (error) {
        console.error('Error fetching visited numbers:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});




app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Validate credentials (replace with your authentication logic)
    if (username === validUser.username && password === validUser.password) {
        res.json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

app.post('/generateAndStoreTickets', (req, res) => {
    try {
        const numberOfTickets = req.body.numberOfTickets;
        const generatedTicket = req.body.ticket;

        if (numberOfTickets === undefined || generatedTicket === undefined) {
            throw new Error('numberOfTickets or generatedTicket is undefined');
        }

        // Save the generated ticket to the database
        saveTicketToDatabase(generatedTicket);

        // Send the generated ticket back to the client or update the UI as needed
        io.emit('ticketsGenerated', [generatedTicket]);

        res.json({ message: 'Ticket generated and stored successfully', generatedTickets: [generatedTicket] });
    } catch (error) {
        console.error('Error generating and storing ticket:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/clearVisitedNumbers', async (req, res) => {
    try {
        // Replace this with your actual database deletion logic for visited numbers
        const client = new Client(pgConfig);
        await client.connect();

        const deleteVisitedNumbersQuery = 'DELETE FROM visited_numbers';
        await client.query(deleteVisitedNumbersQuery);

        // Reset game state variables
        generatedNumbers = [];
        visitedNumbers = [];
        await client.end();

        // Placeholder response for demonstration purposes
        res.json({ message: 'Visited numbers and game state cleared successfully' });
    } catch (error) {
        console.error('Error clearing visited numbers:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});



async function generateTickets(numberOfTickets) {
    const newTickets = [];
    const startingTicketNumber = tickets.length > 0 ? Math.max(...tickets.map(ticket => ticket.ticket_number), 0) + 1 : 1;

    for (let i = startingTicketNumber; i < startingTicketNumber + numberOfTickets; i++) {
        const ticket = {
            ticket_number: i,
            row1_col1: 0,
            row1_col2: 0,
            row1_col3: 0,
            row1_col4: 0,
            row1_col5: 0,
            row1_col6: 0,
            row1_col7: 0,
            row1_col8: 0,
            row1_col9: 0,
            row2_col1: 0,
            row2_col2: 0,
            row2_col3: 0,
            row2_col4: 0,
            row2_col5: 0,
            row2_col6: 0,
            row2_col7: 0,
            row2_col8: 0,
            row2_col9: 0,
            row3_col1: 0,
            row3_col2: 0,
            row3_col3: 0,
            row3_col4: 0,
            row3_col5: 0,
            row3_col6: 0,
            row3_col7: 0,
            row3_col8: 0,
            row3_col9: 0,
        };
        newTickets.push(ticket);
    }

    return newTickets;
}


app.delete('/deleteAllTickets', async (req, res) => {
    try {
        // Replace this with your actual database deletion logic
        // For example, if you are using PostgreSQL with the 'pg' library:
        const client = new Client(pgConfig);
        await client.connect();

        const deleteQuery = 'DELETE FROM tickets'; // Corrected query
        await client.query(deleteQuery);

        // Update the in-memory tickets array if needed
        tickets = [];

        await client.end();

        // Placeholder response for demonstration purposes
        res.json({ message: 'All tickets deleted successfully' });
    } catch (error) {
        console.error('Error deleting tickets:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

async function saveVisitedNumberToDatabase(number) {
    try {
        // Insert the visited number into the database
        await client.query('INSERT INTO visited_numbers (number) VALUES ($1)', [number]);
    } catch (error) {
        console.error('Error saving visited number to the database:', error.message);
    }
}


app.get('/getTickets', (req, res) => {
    try {
        // Return the tickets array to the client
        res.json({ tickets });
    } catch (error) {
        console.error('Error fetching tickets:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Assume you have an endpoint to fetch the state of highlighted cells
app.get('/getHighlightedCells', async (req, res) => {
    try {
        // Fetch highlighted cells from the database or another storage mechanism
        // Adjust the query based on your database schema
        const result = await pool.query('SELECT ticket_number, cell_id FROM highlighted_cells');
        const highlightedCells = result.rows;

        res.json({ success: true, highlightedCells });
    } catch (error) {
        console.error('Error fetching highlighted cells:', error.message);
        res.status(500).json({ success: false, error: 'Error fetching highlighted cells' });
    }
});

// Endpoint to update the state when a cell is highlighted
app.post('/saveHighlightedCell', async (req, res) => {
    try {
        const { ticket_number, cell_id } = req.body;

        // Save the highlighted cell to the database
        // Adjust the query based on your database schema
        await pool.query('INSERT INTO highlighted_cells (ticket_number, cell_id) VALUES ($1, $2)', [ticket_number, cell_id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error highlighting cell:', error.message);
        res.status(500).json({ success: false, error: 'Error saving highlighted cell' });
    }
});

// Endpoint to delete highlighted cells for a specific ticket
app.delete('/deleteHighlightedCells', async (req, res) => {
    try {
        const ticketNumber = req.params.ticketNumber;

        // Delete highlighted cells from the database based on the ticket number
        await pool.query('DELETE FROM highlighted_cells');

        res.json({ success: true, message: 'Highlighted cells deleted successfully' });
    } catch (error) {
        console.error('Error deleting highlighted cells:', error.message);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

app.post('/bookTicket', async (req, res) => {
    try {
        const { ticketNumber, playerName } = req.body;

        // Save the booked ticket information to the database
        await saveBookedTicketToDatabase(ticketNumber, playerName);

        // Broadcast the booked ticket information to all connected clients
        const bookedTicket = { ticket_number: ticketNumber, username: playerName };
        io.emit('ticketBooked', bookedTicket);

        res.json({ message: 'Ticket booked successfully' });
    } catch (error) {
        console.error('Error booking ticket:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

async function saveBookedTicketToDatabase(ticketNumber, playerName) {
    try {
        const query = 'INSERT INTO booked_tickets (ticket_number, player_name) VALUES ($1, $2)';
        await pool.query(query, [ticketNumber, playerName]);
        io.emit('ticketBooked', { ticketNumber, playerName }); // Broadcast the booked ticket information
    } catch (error) {
        console.error('Error saving booked ticket to the database:', error.message);
    }
    io.emit('ticketBooked', { ticketNumber, playerName, isBooked: true });

}

// Load booked tickets from the database on server startup
async function loadBookedTicketsFromDatabase() {
    try {
        const result = await pool.query('SELECT * FROM booked_tickets');
        return result.rows;
    } catch (error) {
        console.error('Error loading booked tickets from the database:', error.message);
        return [];
    }
}




app.get('/getBookedTickets', async (req, res) => {
    try {
        // Fetch booked tickets from the database
        const result = await pool.query('SELECT * FROM booked_tickets');
        const bookedTickets = result.rows;

        // Ensure that bookedTickets is an array
        if (Array.isArray(bookedTickets)) {
            res.json({ bookedTickets });
        } else {
            console.error('Error fetching booked tickets: Invalid data format');
            res.status(500).json({ error: 'Internal Server Error' });
        }
    } catch (error) {
        console.error('Error fetching booked tickets:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.delete('/clearBookedTickets', async (req, res) => {
    try {
        // Implement logic to clear booked tickets in the database
        await pool.query('DELETE FROM booked_tickets');

        res.json({ message: 'Booked tickets cleared successfully' });
    } catch (error) {
        console.error('Error clearing booked tickets:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


function clearUserCache(userId) {
    userTicketCaches[userId] = [];
}



// Define the port and start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
