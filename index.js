const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://poppopchaos.chatforest.com"],
    methods: ["GET", "POST"]
  }
});

const port = process.env.PORT || 8080;

// Track click count
let clickCount = 0;

// Simple hello world route
app.get('/', (req, res) => {
    res.send(`Hello World! Welcome to Pop Pop Chaos Backend. Total clicks: ${clickCount}`);
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Send current click count to newly connected client
    socket.emit('clickUpdate', { count: clickCount });

    // Handle click events
    socket.on('click', () => {
        clickCount++;
        console.log(`Click received! Total clicks: ${clickCount}`);

        // Broadcast updated count to all connected clients
        io.emit('clickUpdate', { count: clickCount });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

// Start the server
server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log('Socket.io server ready for connections');
});
