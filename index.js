const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://poppopchaos.chatforest.com"],
    methods: ["GET", "POST"]
  }
});

const port = process.env.PORT || 8080;

// Storage configuration
const BUBBLES_FILE = path.join(__dirname, 'bubbles.json');

// Storage functions
const saveBubbles = () => {
  try {
    // Save bubbles without timer property
    const bubblesForStorage = bubbles.map(({timer, ...bubble}) => bubble);
    fs.writeFileSync(BUBBLES_FILE, JSON.stringify({
      bubbles: bubblesForStorage,
      nextBubbleId: nextBubbleId,
      timestamp: new Date().toISOString()
    }, null, 2));
    console.log(`💾 Saved ${bubblesForStorage.length} bubbles to storage`);
  } catch (error) {
    console.error('Error saving bubbles:', error);
  }
};

const loadBubbles = () => {
  try {
    if (fs.existsSync(BUBBLES_FILE)) {
      const data = JSON.parse(fs.readFileSync(BUBBLES_FILE, 'utf8'));
      console.log(`📂 Loading ${data.bubbles.length} bubbles from storage (saved: ${data.timestamp})`);

      // Restore nextBubbleId
      nextBubbleId = data.nextBubbleId || 1;

      // Restore each bubble with new timer
      data.bubbles.forEach(bubbleData => {
        const bubble = createBubbleWithTimer(bubbleData.x, bubbleData.y, bubbleData.size, bubbleData.name);
        // Override the auto-generated ID with the stored one
        bubble.id = bubbleData.id;
        bubbles.push(bubble);
      });

      console.log(`✅ Restored ${bubbles.length} bubbles with active timers`);
      return true;
    }
  } catch (error) {
    console.error('Error loading bubbles:', error);
  }
  return false;
};

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

        // Save bubbles and broadcast updated bubbles to all clients
        saveBubbles();
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

// Load existing bubbles or create initial bubble
if (!loadBubbles()) {
  // No saved bubbles found, create initial bubble for backward compatibility
  bubbles.push(createBubbleWithTimer(200, 150, 120, "Original Bubble"));
  console.log("🫧 Created initial bubble");
}

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

            // Save and broadcast updated bubbles to all connected clients
            saveBubbles();
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

        // Save and broadcast updated bubbles to all connected clients
        saveBubbles();
        const bubblesForClient = bubbles.map(({timer, ...bubble}) => bubble);
        io.emit('bubblesUpdate', {
            bubbles: bubblesForClient,
            reason: 'bubble_created'
        });
    });

    // God mode handlers for debugging
    socket.on('godInflate', (data) => {
        const bubble = bubbles.find(b => b.id === data.bubbleId);
        if (bubble) {
            bubble.size += data.amount;
            console.log(`⚡ GOD INFLATE: ${bubble.name} +${data.amount} → ${bubble.size}`);

            saveBubbles();
            const bubblesForClient = bubbles.map(({timer, ...bubble}) => bubble);
            io.emit('bubblesUpdate', {
                bubbles: bubblesForClient,
                reason: 'god_inflate'
            });
        }
    });

    socket.on('godDeflate', (data) => {
        const bubble = bubbles.find(b => b.id === data.bubbleId);
        if (bubble) {
            bubble.size = Math.max(0, bubble.size - data.amount);
            console.log(`⚡ GOD DEFLATE: ${bubble.name} -${data.amount} → ${bubble.size}`);

            if (bubble.size <= 0) {
                // Bubble popped - remove it
                const bubbleIndex = bubbles.findIndex(b => b.id === bubble.id);
                if (bubbleIndex !== -1) {
                    clearTimeout(bubble.timer);
                    bubbles.splice(bubbleIndex, 1);
                    console.log(`💥 ${bubble.name} popped by god power! 💥`);
                }
            }

            saveBubbles();
            const bubblesForClient = bubbles.map(({timer, ...bubble}) => bubble);
            io.emit('bubblesUpdate', {
                bubbles: bubblesForClient,
                reason: 'god_deflate'
            });
        }
    });

    socket.on('godPop', (data) => {
        const bubble = bubbles.find(b => b.id === data.bubbleId);
        if (bubble) {
            console.log(`⚡💥 GOD POP: ${bubble.name} instantly destroyed! 💥⚡`);

            // Remove bubble immediately
            const bubbleIndex = bubbles.findIndex(b => b.id === bubble.id);
            if (bubbleIndex !== -1) {
                clearTimeout(bubble.timer);
                bubbles.splice(bubbleIndex, 1);
            }

            saveBubbles();
            const bubblesForClient = bubbles.map(({timer, ...bubble}) => bubble);
            io.emit('bubblesUpdate', {
                bubbles: bubblesForClient,
                reason: 'god_pop'
            });
        }
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
