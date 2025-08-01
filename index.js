require('dotenv').config();

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://poppopchaos.chatforest.com"],
    methods: ["GET", "POST"]
  }
});

const port = process.env.PORT || 8080;

// Database configuration
let db = null;

const initDatabase = async () => {
  try {
    db = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log(`🔌 Connected to MySQL database: ${process.env.DB_NAME}`);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

const checkTableExists = async (tableName) => {
  try {
    const [rows] = await db.execute(
      'SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?',
      [process.env.DB_NAME, tableName]
    );
    return rows[0].count > 0;
  } catch (error) {
    console.error(`Error checking table ${tableName}:`, error.message);
    return false;
  }
};

const ensureSchema = async () => {
  const requiredTables = ['bubble_colors', 'bubbles', 'game_sessions', 'bubble_events'];
  const missingTables = [];

  console.log('🔍 Checking database schema...');

  for (const table of requiredTables) {
    const exists = await checkTableExists(table);
    if (exists) {
      console.log(`✅ Table exists: ${table}`);
    } else {
      console.log(`❌ Missing table: ${table}`);
      missingTables.push(table);
    }
  }

  if (missingTables.length > 0) {
    console.log(`\n⚠️  Database setup incomplete!`);
    console.log(`Missing tables: ${missingTables.join(', ')}`);
    console.log(`Run: mysql -h ${process.env.DB_HOST} -u ${process.env.DB_USER} -p ${process.env.DB_NAME} < schema.sql`);
    return false;
  }

  console.log('✅ Database schema is complete!');
  return true;
};

// Storage configuration
const BUBBLES_FILE = path.join(__dirname, 'bubbles.json');

// Storage functions
const saveBubbles = async () => {
  const storageMode = process.env.STORAGE_MODE || 'file';
  
  if (storageMode === 'mysql' && db) {
    return await saveBubblesToDB();
  } else {
    // File storage fallback
    try {
      const bubblesForStorage = bubbles.map(({timer, ...bubble}) => bubble);
      fs.writeFileSync(BUBBLES_FILE, JSON.stringify({
        bubbles: bubblesForStorage,
        nextBubbleId: nextBubbleId,
        timestamp: new Date().toISOString()
      }, null, 2));
      console.log(`💾 Saved ${bubblesForStorage.length} bubbles to file storage`);
      return true;
    } catch (error) {
      console.error('Error saving bubbles to file:', error);
      return false;
    }
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

// MySQL storage functions
const loadBubblesFromDB = async () => {
  try {
    // Get next bubble ID
    const [idRows] = await db.execute('SELECT MAX(bubble_id) as max_id FROM bubbles');
    nextBubbleId = (idRows[0].max_id || 0) + 1;
    
    // Load all bubbles with color info
    const [rows] = await db.execute(`
      SELECT b.bubble_id, b.name, b.size, b.position_x, b.position_y, 
             c.hex_code as color
      FROM bubbles b 
      JOIN bubble_colors c ON b.color_id = c.color_id
      ORDER BY b.bubble_id
    `);
    
    console.log(`📂 Loading ${rows.length} bubbles from MySQL database`);
    
    // Convert database format to our bubble format
    rows.forEach(row => {
      // Convert percentage positions back to pixels (assuming 400x300 game area)
      const x = row.position_x * 400;
      const y = row.position_y * 300;
      
      const bubble = createBubbleWithTimer(x, y, row.size, row.name);
      bubble.id = row.bubble_id;
      bubble.color = row.color; // Add color property
      bubbles.push(bubble);
    });
    
    console.log(`✅ Restored ${bubbles.length} bubbles from database with active timers`);
    return rows.length > 0;
  } catch (error) {
    console.error('Error loading bubbles from database:', error.message);
    return false;
  }
};

const saveBubblesToDB = async () => {
  try {
    // Clear existing bubbles
    await db.execute('DELETE FROM bubbles');
    
    // Insert current bubbles
    for (const bubble of bubbles) {
      // Convert pixel positions to percentages
      const position_x = bubble.x / 400; // 400px game area width
      const position_y = bubble.y / 300; // 300px game area height
      
      await db.execute(`
        INSERT INTO bubbles (bubble_id, name, size, position_x, position_y, color_id) 
        VALUES (?, ?, ?, ?, ?, ?)
      `, [bubble.id, bubble.name, bubble.size, position_x, position_y, 1]); // default to green (color_id=1)
    }
    
    console.log(`💾 Saved ${bubbles.length} bubbles to MySQL database`);
    return true;
  } catch (error) {
    console.error('Error saving bubbles to database:', error.message);
    return false;
  }
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

// Initialize storage based on STORAGE_MODE
const initStorage = async () => {
  const storageMode = process.env.STORAGE_MODE || 'file';
  console.log(`📦 Storage mode: ${storageMode}`);

  if (storageMode === 'mysql') {
    console.log('🔄 Initializing MySQL storage...');

    // Test database connection
    const dbConnected = await initDatabase();
    if (!dbConnected) {
      console.log('⚠️  Falling back to file storage');
      return initFileStorage();
    }

    // Check schema
    const schemaReady = await ensureSchema();
    if (!schemaReady) {
      console.log('⚠️  Database schema incomplete, falling back to file storage');
      return initFileStorage();
    }

    console.log('✅ MySQL storage ready!');
    
    // Load existing bubbles from database
    const loaded = await loadBubblesFromDB();
    if (!loaded) {
      // No bubbles in database, create initial bubble
      bubbles.push(createBubbleWithTimer(200, 150, 120, "Original Database Bubble"));
      await saveBubblesToDB(); // Save the initial bubble
      console.log("🫧 Created initial bubble in database");
    }
    
    return true;

  } else {
    return initFileStorage();
  }
};

const initFileStorage = () => {
  console.log('📁 Using file storage');
  // Load existing bubbles or create initial bubble
  if (!loadBubbles()) {
    // No saved bubbles found, create initial bubble for backward compatibility
    bubbles.push(createBubbleWithTimer(200, 150, 120, "Original Bubble"));
    console.log("🫧 Created initial bubble");
  }
  return true;
};

// Initialize storage
initStorage().then(() => {
  console.log('🚀 Storage initialization complete');
}).catch(error => {
  console.error('💥 Storage initialization failed:', error);
  process.exit(1);
});

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
