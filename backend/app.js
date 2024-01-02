// Import necessary modules
const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const { Client } = require('pg');

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

const client = new Client(pgConfig);
client.connect()
    .then(() => console.log('Connected to PostgreSQL'))
    .catch((err) => console.error('Error connecting to PostgreSQL', err));

// Initialize countdown value and tickets array
let tickets = [];
let countdownInterval;
let visitedNumbers = [];

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Client connected');
    loadTicketsFromDatabase()
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
    
    
    
});

async function generateAndStoreTicket() {
    const newTicket = generateTickets(1)[0]; // Generate a single ticket

    // Your logic to store the new ticket in the database
    await saveTicketToDatabase(newTicket);

    return newTicket;
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




let loadedTicketsCache = [];

async function loadTicketsFromDatabase() {
    const client = new Client(pgConfig);

    try {
        await client.connect();

        const query = 'SELECT DISTINCT ON (ticket_number) * FROM tickets ORDER BY ticket_number, RANDOM()';
        const result = await client.query(query);
        const uniqueTickets = result.rows.filter(ticket => !loadedTicketsCache.includes(ticket.ticket_number));

        loadedTicketsCache = [...loadedTicketsCache, ...uniqueTickets.map(ticket => ticket.ticket_number)];

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
        // Replace this with your actual database deletion logic
        const client = new Client(pgConfig);
        await client.connect();

        const deleteQuery = 'DELETE FROM visited_numbers';
        await client.query(deleteQuery);

        await client.end();

        // Placeholder response for demonstration purposes
        res.json({ message: 'Visited numbers cleared successfully' });
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
    const client = new Client(pgConfig);

    try {
        await client.connect();

        // Ensure that the number is a valid integer
        const validNumber = parseInt(number);

        if (isNaN(validNumber)) {
            throw new Error('Invalid input: Not a valid integer');
        }

        // Insert the visited number into the database
        const insertQuery = 'INSERT INTO visited_numbers (number) VALUES ($1)';
        await client.query(insertQuery, [validNumber]);

        // Emit a newVisitedNumber event to all clients
        io.emit('newVisitedNumber', validNumber);

        console.log('New visited number saved to the database:', validNumber);
    } catch (error) {
        console.error('Error saving new visited number to the database', error);
    } finally {
        await client.end();
    }
}




// Define the port and start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
