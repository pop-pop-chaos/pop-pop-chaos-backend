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

// Air loss configuration
const BASE_AIR_LOSS_INTERVAL = 5000; // 5 seconds base
const AIR_LOSS_RANDOMNESS = 2000; // +/- 2 seconds randomness

// Helper function to create bubble with individual timer
const createBubbleWithTimer = (x, y, size, name = null) => {
  const bubble = {
    id: nextBubbleId++,
    x: x,
    y: y,
    size: size,
    name: name || `Bubble ${nextBubbleId - 1}`, // default name if none provided
    timer: null
  };

  // Start individual air loss timer with random interval
  const startBubbleTimer = () => {
    const randomInterval = BASE_AIR_LOSS_INTERVAL + (Math.random() - 0.5) * AIR_LOSS_RANDOMNESS * 2;

    bubble.timer = setTimeout(() => {
      if (bubble.size > 0) {
        bubble.size--;
        console.log(`Air loss! ${bubble.name} (ID: ${bubble.id}) shrunk to: ${bubble.size}`);

        if (bubble.size <= 0) {
          // Bubble popped - remove it
          const bubbleIndex = bubbles.findIndex(b => b.id === bubble.id);
          if (bubbleIndex !== -1) {
            clearTimeout(bubble.timer);
            bubbles.splice(bubbleIndex, 1);
            console.log(`💥 ${bubble.name} popped! 💥`);
          }
        } else {
          // Schedule next air loss
          startBubbleTimer();
        }

        // Broadcast updated bubbles to all clients (without timer property)
        const bubblesForClient = bubbles.map(({timer, ...bubble}) => bubble);
        io.emit('bubblesUpdate', {
          bubbles: bubblesForClient,
          reason: 'air_loss'
        });
      }
    }, randomInterval);
  };

  startBubbleTimer();
  return bubble;
};

// Create initial bubble for backward compatibility
bubbles.push(createBubbleWithTimer(200, 150, 120, "Original Bubble"));

// Individual timers handle air loss - no global timer needed!

// Simple hello world route
app.get('/', (req, res) => {
    const totalSize = bubbles.reduce((sum, bubble) => sum + bubble.size, 0);
    res.send(`Hello World! Welcome to Pop Pop Chaos Backend. ${bubbles.length} bubbles, total size: ${totalSize}`);
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Send current bubbles to newly connected client (without timer property)
    const bubblesForClient = bubbles.map(({timer, ...bubble}) => bubble);
    socket.emit('bubblesUpdate', {
        bubbles: bubblesForClient,
        reason: 'initial_sync'
    });

    // Handle bubble click events
    socket.on('bubbleClick', (data) => {
        const bubble = bubbles.find(b => b.id === data.bubbleId);
        if (bubble) {
            bubble.size++;
            console.log(`${bubble.name} clicked! New size: ${bubble.size}`);

            // Broadcast updated bubbles to all connected clients (without timer property)
            const bubblesForClient = bubbles.map(({timer, ...bubble}) => bubble);
            io.emit('bubblesUpdate', {
                bubbles: bubblesForClient,
                reason: 'player_click'
            });
        }
    });

    // Handle create bubble events
    socket.on('createBubble', (data) => {
        const newBubble = createBubbleWithTimer(data.x, data.y, 10, data.name); // start small
        bubbles.push(newBubble);
        console.log(`✨ New bubble "${newBubble.name}" created at (${data.x}, ${data.y}) ✨`);

        // Broadcast updated bubbles to all connected clients (without timer property)
        const bubblesForClient = bubbles.map(({timer, ...bubble}) => bubble);
        io.emit('bubblesUpdate', {
            bubbles: bubblesForClient,
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
