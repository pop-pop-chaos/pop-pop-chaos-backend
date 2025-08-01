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

// Track multiple bubbles
let bubbles = [];
let nextBubbleId = 1;

// Create initial bubble for backward compatibility
bubbles.push({
  id: nextBubbleId++,
  x: 200, // center of 400px wide game area
  y: 150, // center of 300px tall game area
  size: 120 // start with your current click count
});

// Air loss timer - all bubbles lose 1 size every 5 seconds
const AIR_LOSS_INTERVAL = 5000; // 5 seconds
let airLossTimer = null;

const startAirLoss = () => {
  if (airLossTimer) clearInterval(airLossTimer);

  airLossTimer = setInterval(() => {
    let bubblesChanged = false;

    // Apply air loss to each bubble
    bubbles.forEach(bubble => {
      if (bubble.size > 0) {
        bubble.size--;
        bubblesChanged = true;
        console.log(`Air loss! Bubble ${bubble.id} shrunk to: ${bubble.size}`);
      }
    });

    // Remove bubbles that have shrunk to 0
    const originalCount = bubbles.length;
    bubbles = bubbles.filter(bubble => bubble.size > 0);
    if (bubbles.length < originalCount) {
      console.log(`${originalCount - bubbles.length} bubbles popped!`);
      bubblesChanged = true;
    }

    if (bubblesChanged) {
      // Broadcast updated bubbles to all clients
      io.emit('bubblesUpdate', {
        bubbles: bubbles,
        reason: 'air_loss'
      });
    }
  }, AIR_LOSS_INTERVAL);
};

// Start air loss when server starts
startAirLoss();

// Simple hello world route
app.get('/', (req, res) => {
    const totalSize = bubbles.reduce((sum, bubble) => sum + bubble.size, 0);
    res.send(`Hello World! Welcome to Pop Pop Chaos Backend. ${bubbles.length} bubbles, total size: ${totalSize}`);
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Send current bubbles to newly connected client
    socket.emit('bubblesUpdate', {
        bubbles: bubbles,
        reason: 'initial_sync'
    });

    // Handle bubble click events
    socket.on('bubbleClick', (data) => {
        const bubble = bubbles.find(b => b.id === data.bubbleId);
        if (bubble) {
            bubble.size++;
            console.log(`Bubble ${bubble.id} clicked! New size: ${bubble.size}`);

            // Broadcast updated bubbles to all connected clients
            io.emit('bubblesUpdate', {
                bubbles: bubbles,
                reason: 'player_click'
            });
        }
    });

    // Handle create bubble events
    socket.on('createBubble', (data) => {
        const newBubble = {
            id: nextBubbleId++,
            x: data.x,
            y: data.y,
            size: 10 // start small
        };
        bubbles.push(newBubble);
        console.log(`New bubble ${newBubble.id} created at (${data.x}, ${data.y})`);

        // Broadcast updated bubbles to all connected clients
        io.emit('bubblesUpdate', {
            bubbles: bubbles,
            reason: 'bubble_created'
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
