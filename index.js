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

// Air loss timer - bubble loses 1 click every 5 seconds
const AIR_LOSS_INTERVAL = 5000; // 5 seconds
let airLossTimer = null;

const startAirLoss = () => {
  if (airLossTimer) clearInterval(airLossTimer);

  airLossTimer = setInterval(() => {
    if (clickCount > 0) {
      clickCount--;
      console.log(`Air loss! Bubble shrunk to: ${clickCount}`);

      // Broadcast air loss to all clients
      io.emit('clickUpdate', {
        count: clickCount,
        reason: 'air_loss'
      });
    }
  }, AIR_LOSS_INTERVAL);
};

// Start air loss when server starts
startAirLoss();

// Simple hello world route
app.get('/', (req, res) => {
    res.send(`Hello World! Welcome to Pop Pop Chaos Backend. Total clicks: ${clickCount}`);
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Send current click count to newly connected client
    socket.emit('clickUpdate', {
        count: clickCount,
        reason: 'initial_sync'
    });

    // Handle click events
    socket.on('click', () => {
        clickCount++;
        console.log(`Click received! Total clicks: ${clickCount}`);

        // Broadcast updated count to all connected clients
        io.emit('clickUpdate', {
            count: clickCount,
            reason: 'player_click'
        });
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
