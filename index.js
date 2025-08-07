require('dotenv').config();

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const server = createServer(app);

// CORS middleware for HTTP requests
app.use((req, res, next) => {
  const allowedOrigins = ["http://localhost:3000", "https://poppopchaos.chatforest.com"];
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  next();
});

// Express middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
});

app.use(sessionMiddleware);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://poppopchaos.chatforest.com"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Share session middleware with Socket.io
io.use((socket, next) => {
  sessionMiddleware(socket.request, socket.request.res || {}, (err) => {
    if (err) {
      console.log('Session middleware error:', err);
      return next(err);
    }
    
    // Debug session info
    const session = socket.request.session;
    console.log(`Socket ${socket.id} session:`, {
      hasSession: !!session,
      userId: session?.userId,
      username: session?.username,
      isSuperadmin: session?.isSuperadmin,
      cookies: socket.request.headers.cookie ? 'present' : 'missing'
    });
    
    next();
  });
});

const port = process.env.PORT || 8080;

// Track connected players
let connectedPlayers = 0;

// Database configuration
let db = null;

const initDatabase = async () => {
  try {
    // Single connection approach - good for shared hosting like Dreamhost
    // Alternative: Connection Pool for higher performance/reliability
    // db = mysql.createPool({
    //   host: process.env.DB_HOST,
    //   user: process.env.DB_USER,
    //   password: process.env.DB_PASSWORD,
    //   database: process.env.DB_NAME,
    //   port: process.env.DB_PORT || 3306,
    //   connectionLimit: 5,      // Conservative for shared hosting
    //   acquireTimeout: 60000,   // 60 seconds
    //   timeout: 60000,          // 60 seconds
    //   reconnect: true,
    //   idleTimeout: 300000      // 5 minutes idle timeout
    // });

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

// Reconnect to database with same configuration
const reconnectDatabase = async () => {
  console.log('🔄 Database connection lost, reconnecting...');
  db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
  });
  console.log('✅ Database reconnected successfully');
};

// Safe database execute with automatic reconnection on connection errors
const safeExecute = async (query, params = []) => {
  try {
    return await db.execute(query, params);
  } catch (error) {
    // Check for connection-related errors
    if (error.code === 'PROTOCOL_CONNECTION_LOST' ||
        error.code === 'ECONNRESET' ||
        error.code === 'EPIPE' ||
        error.message.includes('connection is in closed state')) {

      await reconnectDatabase();
      // Retry the query once after reconnection
      return await db.execute(query, params);
    }
    // Re-throw non-connection errors
    throw error;
  }
};

const checkTableExists = async (tableName) => {
  try {
    const [rows] = await safeExecute(
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
  const requiredTables = ['colors', 'teams', 'users', 'bubbles', 'game_sessions', 'bubble_events'];
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
let saveInProgress = false;

const saveBubbles = async () => {
  if (saveInProgress) {
    console.log('💾 Skipping save - already in progress');
    return false;
  }
  saveInProgress = true;

  try {
    const storageMode = process.env.STORAGE_MODE || 'file';

    if (storageMode === 'mysql' && db) {
      const result = await saveBubblesToDB();
      return result;
    } else {
      // File storage fallback
      const bubblesForStorage = bubbles.map(({airLossTimer, movementTimer, ...bubble}) => bubble);
      fs.writeFileSync(BUBBLES_FILE, JSON.stringify({
        bubbles: bubblesForStorage,
        nextBubbleId: nextBubbleId,
        timestamp: new Date().toISOString()
      }, null, 2));
      console.log(`💾 Saved ${bubblesForStorage.length} bubbles to file storage`);
      return true;
    }
  } catch (error) {
    console.error('Error saving bubbles:', error);
    return false;
  } finally {
    saveInProgress = false;
  }
};

const loadBubbles = async () => {
  try {
    if (fs.existsSync(BUBBLES_FILE)) {
      const data = JSON.parse(fs.readFileSync(BUBBLES_FILE, 'utf8'));
      console.log(`📂 Loading ${data.bubbles.length} bubbles from storage (saved: ${data.timestamp})`);

      // Restore nextBubbleId
      nextBubbleId = data.nextBubbleId || 1;

      // Restore each bubble with new timer
      for (const bubbleData of data.bubbles) {
        // Handle transition from pixel coordinates to percentage coordinates
        let xPercent, yPercent;
        if (bubbleData.xPercent !== undefined && bubbleData.yPercent !== undefined) {
          // New format: percentage coordinates - ensure they are numbers
          xPercent = parseFloat(bubbleData.xPercent);
          yPercent = parseFloat(bubbleData.yPercent);
        } else {
          // Old format: convert pixel coordinates to percentages
          xPercent = parseFloat(bubbleData.x) / 1000;
          yPercent = parseFloat(bubbleData.y) / 600;
        }

        const bubble = await createBubbleWithTimer(xPercent, yPercent, bubbleData.size, bubbleData.name);
        // Override the auto-generated ID with the stored one
        bubble.id = bubbleData.id;
        // Restore velocity if available, otherwise keep randomly generated values
        if (bubbleData.dx !== undefined && bubbleData.dy !== undefined) {
          bubble.dx = bubbleData.dx;
          bubble.dy = bubbleData.dy;
        }
        bubbles.push(bubble);
      }

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
    const [idRows] = await safeExecute('SELECT MAX(bubble_id) as max_id FROM bubbles');
    nextBubbleId = (idRows[0].max_id || 0) + 1;

    // Load all bubbles with team and color info
    const [rows] = await safeExecute(`
      SELECT b.bubble_id, b.name, b.size, b.position_x, b.position_y, b.team_id,
             t.name as team_name, c.hex_code as color
      FROM bubbles b
      JOIN teams t ON b.team_id = t.team_id
      JOIN colors c ON t.color_id = c.color_id
      ORDER BY b.bubble_id
    `);

    console.log(`📂 Loading ${rows.length} bubbles from MySQL database`);

    // Convert database format to our bubble format
    for (const row of rows) {
      // Use percentage positions directly (they're already stored as 0-1 in database)
      // IMPORTANT: Convert string values from DB to numbers to prevent bugs
      const xPercent = parseFloat(row.position_x);
      const yPercent = parseFloat(row.position_y);

      const bubble = await createBubbleWithTimer(xPercent, yPercent, row.size, row.name, true);
      bubble.id = row.bubble_id;
      bubble.teamId = row.team_id; // Set correct team ID from database
      bubble.team = row.team_name; // Add team name
      bubble.color = row.color; // Add color property
      // Note: Velocity properties will be randomly generated for now
      // Future: Add dx, dy columns to database to persist velocity
      bubbles.push(bubble);
    }

    console.log(`✅ Restored ${bubbles.length} bubbles from database with active timers`);
    return rows.length > 0;
  } catch (error) {
    console.error('Error loading bubbles from database:', error.message);
    return false;
  }
};

const saveBubblesToDB = async () => {
  try {
    // Get current bubble IDs in database
    const [existingRows] = await safeExecute('SELECT bubble_id FROM bubbles');
    const existingIds = new Set(existingRows.map(row => row.bubble_id));
    const currentIds = new Set(bubbles.map(bubble => bubble.id));

    // Delete bubbles that no longer exist in memory
    for (const existingId of existingIds) {
      if (!currentIds.has(existingId)) {
        await safeExecute('DELETE FROM bubbles WHERE bubble_id = ?', [existingId]);
        console.log(`🗑️  Removed bubble ${existingId} from database`);
      }
    }

    // Insert or update current bubbles
    for (const bubble of bubbles) {
      // Use percentage positions directly (already stored as 0-1)
      const position_x = bubble.xPercent;
      const position_y = bubble.yPercent;

      await safeExecute(`
        INSERT INTO bubbles (bubble_id, name, size, position_x, position_y, velocity_dx, velocity_dy, team_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          size = VALUES(size),
          position_x = VALUES(position_x),
          position_y = VALUES(position_y),
          velocity_dx = VALUES(velocity_dx),
          velocity_dy = VALUES(velocity_dy),
          updated_at = CURRENT_TIMESTAMP
      `, [bubble.id, bubble.name, bubble.size, position_x, position_y, bubble.dx || 0, bubble.dy || 0, bubble.teamId || 1]); // use bubble's team ID
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

// Movement configuration
const MOVEMENT_INTERVAL = 50; // 50ms = 20 FPS movement updates
const BASE_SPEED = 0.001; // Base movement speed (percentage per frame)
const SPEED_RANDOMNESS = 0.0005; // Speed variation

// Explosion configuration
// Size-1000 bubble: force=0.1, radius=0.8
// Size-100 bubble: force=0.01, radius=0.1
const calculateExplosionForce = (bubbleSize) => (bubbleSize / 1000) * 0.1;
const calculateExplosionRadius = (bubbleSize) => Math.min(0.8, Math.max(0.1, (bubbleSize / 1000) * 0.8));


// God powers configuration
const GOD_INFLATE_AMOUNT = 100;
const GOD_DEFLATE_AMOUNT = 10;

// Helper function to get team color from database
const getTeamColor = async (teamId) => {
  try {
    const [rows] = await safeExecute(`
      SELECT t.name as team_name, c.hex_code as color
      FROM teams t
      JOIN colors c ON t.color_id = c.color_id
      WHERE t.team_id = ?
    `, [teamId]);

    if (rows.length > 0) {
      return { team: rows[0].team_name, color: rows[0].color };
    }

    // Fallback to default team if team not found
    console.warn(`Team ${teamId} not found, using default team`);
    return { team: 'default', color: '#4CAF50' };
  } catch (error) {
    console.error('Error fetching team color:', error.message);
    return { team: 'default', color: '#4CAF50' };
  }
};

// Helper function to create bubble with individual timer
const createBubbleWithTimer = async (xPercent, yPercent, size, name = null, skipTeamLookup = false) => {
  // Generate random velocity for movement
  const speed = BASE_SPEED + (Math.random() - 0.5) * SPEED_RANDOMNESS * 2;
  const angle = Math.random() * 2 * Math.PI; // Random direction

  // Randomly assign team ID for new bubbles (1-5)
  const randomTeamId = Math.floor(Math.random() * 5) + 1;

  // Get team and color info from database (only for new bubbles, not when loading from DB)
  const storageMode = process.env.STORAGE_MODE || 'file';
  let teamInfo = { team: 'default', color: '#4CAF50' };

  if (storageMode === 'mysql' && db && !skipTeamLookup) {
    teamInfo = await getTeamColor(randomTeamId);
  }

  const bubble = {
    id: nextBubbleId++,
    xPercent: xPercent, // Store as percentage (0-1)
    yPercent: yPercent, // Store as percentage (0-1)
    // Keep x,y for backward compatibility during transition
    x: xPercent * 1000,
    y: yPercent * 600,
    size: size,
    name: name || `Bubble ${nextBubbleId - 1}`, // default name if none provided
    teamId: randomTeamId, // Team ID assignment
    team: teamInfo.team, // Team name from database
    color: teamInfo.color, // Color from database
    // Movement properties
    dx: Math.cos(angle) * speed, // Velocity in x direction (percentage per frame)
    dy: Math.sin(angle) * speed, // Velocity in y direction (percentage per frame)
    airLossTimer: null,
    movementTimer: null
  };

  // Start individual air loss timer with random interval
  const startBubbleTimer = () => {
    const randomInterval = BASE_AIR_LOSS_INTERVAL + (Math.random() - 0.5) * AIR_LOSS_RANDOMNESS * 2;

    bubble.airLossTimer = setTimeout(() => {
      if (bubble.size > 0) {
        bubble.size--;
        console.log(`Air loss! ${bubble.name} (ID: ${bubble.id}) shrunk to: ${bubble.size}`);

        if (bubble.size <= 0) {
          // Bubble popped - remove it
          const bubbleIndex = bubbles.findIndex(b => b.id === bubble.id);
          if (bubbleIndex !== -1) {
            clearTimeout(bubble.airLossTimer);
            clearInterval(bubble.movementTimer);
            bubbles.splice(bubbleIndex, 1);
            console.log(`💥 ${bubble.name} popped! 💥`);
          }
        } else {
          // Schedule next air loss
          startBubbleTimer();
        }

        // Save bubbles and broadcast updated bubbles to all clients
        saveBubbles();
        const bubblesForClient = bubbles.map(({airLossTimer, movementTimer, ...bubble}) => bubble);
        io.emit('bubblesUpdate', {
          bubbles: bubblesForClient,
          reason: 'air_loss'
        });
      }
    }, randomInterval);
  };

  // Start movement timer for continuous movement
  const startMovementTimer = () => {
    bubble.movementTimer = setInterval(() => {
      // Update position
      bubble.xPercent += bubble.dx;
      bubble.yPercent += bubble.dy;

      // SERVER-SIDE PHYSICS:
      // Calculate the bubble's radius in normalized coordinates (0.0 to 1.0).
      // We'll define a 1000-size bubble as having a diameter of 10% (0.1) of the game world.
      // This is a server-authoritative rule, independent of any client's screen size.
      const normalizedRadius = (bubble.size / 1000) * 0.1 / 2;

      // Check for boundary collisions and bounce
      if (bubble.xPercent - normalizedRadius <= 0 || bubble.xPercent + normalizedRadius >= 1) {
        bubble.dx = -bubble.dx * 0.9; // Reverse x velocity with friction (10% energy loss)
        // Clamp position to prevent sticking to walls
        bubble.xPercent = Math.max(normalizedRadius, Math.min(1 - normalizedRadius, bubble.xPercent));
      }

      if (bubble.yPercent - normalizedRadius <= 0 || bubble.yPercent + normalizedRadius >= 1) {
        bubble.dy = -bubble.dy * 0.9; // Reverse y velocity with friction (10% energy loss)
        // Clamp position to prevent sticking to walls
        bubble.yPercent = Math.max(normalizedRadius, Math.min(1 - normalizedRadius, bubble.yPercent));
      }

      // Update backward compatibility coordinates (less important now)
      bubble.x = bubble.xPercent * 1000;
      bubble.y = bubble.yPercent * 600;

      // Broadcast movement updates every frame for smooth animation
      if (true) { // Always broadcast for smooth movement
        const bubblesForClient = bubbles.map(({airLossTimer, movementTimer, ...bubble}) => bubble);
        io.emit('bubblesUpdate', {
          bubbles: bubblesForClient,
          reason: 'movement'
        });
      }
    }, MOVEMENT_INTERVAL);
  };

  startBubbleTimer();
  startMovementTimer();
  return bubble;
};

// Helper function to burst a bubble with explosion physics and cleanup
const BurstYourBubble = (bubble) => {
  applyExplosionForce(bubble);
  clearTimeout(bubble.airLossTimer);
  clearInterval(bubble.movementTimer);
  const bubbleIndex = bubbles.findIndex(b => b.id === bubble.id);
  if (bubbleIndex !== -1) {
    bubbles.splice(bubbleIndex, 1);
  }
};

// Helper function to apply explosion physics
const applyExplosionForce = (burstBubble) => {
  const burstCenterX = burstBubble.xPercent;
  const burstCenterY = burstBubble.yPercent;

  // Calculate explosion properties based on burst bubble size
  const explosionForce = calculateExplosionForce(burstBubble.size);
  const explosionRadius = calculateExplosionRadius(burstBubble.size);

  console.log(`💥 Applying explosion from ${burstBubble.name} (size ${burstBubble.size}) at (${burstCenterX.toFixed(2)},
  ${burstCenterY.toFixed(2)}) - Force: ${explosionForce.toFixed(3)}, Radius: ${explosionRadius.toFixed(2)}`);

  bubbles.forEach(otherBubble => {
    // Don't apply force to the bubble that just burst
    if (otherBubble.id === burstBubble.id) {
      return;
    }

    const vectorX = otherBubble.xPercent - burstCenterX;
    const vectorY = otherBubble.yPercent - burstCenterY;

    // Calculate the distance using Pythagorean theorem
    const distance = Math.sqrt(vectorX * vectorX + vectorY * vectorY);

    // If the bubble is outside the explosion radius, do nothing
    if (distance > explosionRadius || distance === 0) {
      return;
    }

    // Calculate the force magnitude with a linear falloff
    // The closer the bubble, the stronger the force
    const baseForceMagnitude = (1 - (distance / explosionRadius)) * explosionForce;

    // Larger bubbles are less affected by explosions (mass resistance)
    // Size-1000 bubble has resistance factor of 1.0, size-100 has 0.1, etc.
    const resistanceFactor = Math.max(0.1, otherBubble.size / 1000);
    const finalForceMagnitude = baseForceMagnitude / resistanceFactor;

    // Normalize the direction vector (to get a unit vector)
    const normalizedX = vectorX / distance;
    const normalizedY = vectorY / distance;

    // Apply the force to the other bubble's velocity
    otherBubble.dx += normalizedX * finalForceMagnitude;
    otherBubble.dy += normalizedY * finalForceMagnitude;

    console.log(`  -> Pushing ${otherBubble.name}. Force: ${finalForceMagnitude.toFixed(4)}. New velocity: dx=${otherBubble.dx.toFixed(4)}, dy=${otherBubble.dy.toFixed(4)}`);
  });
};

// Function to generate current date with Japanese day of the week kanji
const formatDateWithJapaneseDay = () => {
  const now = new Date();
  
  // Array of Japanese day of the week kanji
  const japaneseWeekdays = ['日', '月', '火', '水', '木', '金', '土'];
  
  // Array of month abbreviations
  const monthAbbrevs = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const day = now.getDate();
  const month = monthAbbrevs[now.getMonth()];
  const year = now.getFullYear();
  const dayOfWeek = japaneseWeekdays[now.getDay()];
  
  return `${day}-${month}-${year} (${dayOfWeek})`;
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
      // No bubbles in database, create initial bubble (centered at 50%, 50%)
      bubbles.push(await createBubbleWithTimer(0.5, 0.5, 120, `Most Honorable Reverend Bubberts Iglesias Jr ${formatDateWithJapaneseDay()}`));
      await saveBubblesToDB(); // Save the initial bubble
      console.log("🫧 Created initial bubble in database");
    }

    return true;

  } else {
    return await initFileStorage();
  }
};

const initFileStorage = async () => {
  console.log('📁 Using file storage');
  // Load existing bubbles or create initial bubble
  if (!(await loadBubbles())) {
    // No saved bubbles found, create initial bubble for backward compatibility (centered at 50%, 50%)
    bubbles.push(await createBubbleWithTimer(0.5, 0.5, 120, "Original Bubble"));
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

// Authentication routes
app.post('/auth/register', async (req, res) => {
    try {
        const { username, password, email } = req.body;

        // Basic validation
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        if (username !== 'tr' && username.length < 3 || username.length > 50) {
            return res.status(400).json({ error: 'Username must be between 3 and 50 characters' });
        }

        // Check if username already exists
        const [existing] = await safeExecute('SELECT user_id FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Hash password
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        // Insert user
        const [result] = await safeExecute(
            'INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)',
            [username, password_hash, email || null]
        );

        // Get the new user
        const [newUser] = await safeExecute(
            'SELECT user_id, username, email, is_superadmin FROM users WHERE user_id = ?',
            [result.insertId]
        );

        // Set session
        req.session.userId = newUser[0].user_id;
        req.session.username = newUser[0].username;
        req.session.isSuperadmin = newUser[0].is_superadmin;

        console.log(`🔐 New user registered: ${username} (ID: ${newUser[0].user_id})`);

        res.json({
            success: true,
            user: {
                user_id: newUser[0].user_id,
                username: newUser[0].username,
                email: newUser[0].email,
                is_superadmin: newUser[0].is_superadmin
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Find user
        const [users] = await safeExecute(
            'SELECT user_id, username, email, password_hash, is_superadmin FROM users WHERE username = ?',
            [username]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const user = users[0];

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Set session
        req.session.userId = user.user_id;
        req.session.username = user.username;
        req.session.isSuperadmin = user.is_superadmin;

        console.log(`🔐 User logged in: ${username} (ID: ${user.user_id}) ${user.is_superadmin ? '[SUPERADMIN]' : ''}`);

        res.json({
            success: true,
            user: {
                user_id: user.user_id,
                username: user.username,
                email: user.email,
                is_superadmin: user.is_superadmin
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/auth/logout', (req, res) => {
    const username = req.session.username;
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Could not log out' });
        }

        console.log(`🔐 User logged out: ${username || 'unknown'}`);
        res.json({ success: true });
    });
});

app.get('/auth/me', (req, res) => {
    if (req.session.userId) {
        res.json({
            user: {
                user_id: req.session.userId,
                username: req.session.username,
                is_superadmin: req.session.isSuperadmin
            }
        });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Increment player count and broadcast update
    connectedPlayers++;
    console.log(`Connected players: ${connectedPlayers}`);
    io.emit('playerCountUpdate', { count: connectedPlayers });

    // Send current bubbles to newly connected client (without timer property)
    const bubblesForClient = bubbles.map(({airLossTimer, movementTimer, ...bubble}) => bubble);
    socket.emit('bubblesUpdate', {
        bubbles: bubblesForClient,
        reason: 'initial_sync'
    });

    // Handle bubble click events
    socket.on('bubbleClick', (data) => {
        const bubbleIndex = bubbles.findIndex(b => b.id === data.bubbleId);
        if (bubbleIndex !== -1) {
            const bubble = bubbles[bubbleIndex];
            bubble.size++;
            console.log(`${bubble.name} clicked! New size: ${bubble.size}`);

            // Check if bubble should burst
            if (bubble.size > 1000) {
                console.log(`💥 ${bubble.name} burst from over-inflation! 💥`);
                BurstYourBubble(bubble);
            }

            // Save and broadcast updated bubbles to all connected clients
            saveBubbles();
            const bubblesForClient = bubbles.map(({airLossTimer, movementTimer, ...bubble}) => bubble);
            io.emit('bubblesUpdate', {
                bubbles: bubblesForClient,
                reason: 'player_click'
            });
        }
    });

    // Handle create bubble events
    socket.on('createBubble', async (data) => {
        const newBubble = await createBubbleWithTimer(data.xPercent, data.yPercent, 10, data.name); // start small
        bubbles.push(newBubble);
        console.log(`✨ New bubble "${newBubble.name}" created at (${(data.xPercent * 100).toFixed(1)}%, ${(data.yPercent * 100).toFixed(1)}%) ✨`);

        // Save and broadcast updated bubbles to all connected clients
        saveBubbles();
        const bubblesForClient = bubbles.map(({airLossTimer, movementTimer, ...bubble}) => bubble);
        io.emit('bubblesUpdate', {
            bubbles: bubblesForClient,
            reason: 'bubble_created'
        });
    });

    // Handle create random bubble events (Superadmin feature)
    socket.on('createRandomBubble', async (data) => {
        // Check if user is authenticated and is superadmin
        const session = socket.request.session;
        const isAuthenticated = session && session.userId;
        const isSuperadmin = session && session.isSuperadmin;

        console.log(`🔍 Random bubble creation requested by socket ${socket.id}, authenticated: ${isAuthenticated}, superadmin: ${isSuperadmin}`);

        if (!isAuthenticated || !isSuperadmin) {
            console.log(`❌ Random bubble creation denied: User not authenticated or not superadmin`);
            return;
        }

        // Generate all properties server-side for security
        const randomX = Math.random(); // Random position 0-1
        const randomY = Math.random(); // Random position 0-1
        const randomSize = Math.floor(Math.random() * 990) + 10; // Random size 10-999

        const newBubble = await createBubbleWithTimer(randomX, randomY, randomSize, data.name);

        // Apply random velocity (more dramatic than default)
        const randomSpeed = BASE_SPEED * (2 + Math.random() * 3); // 2x to 5x normal speed
        const randomAngle = Math.random() * 2 * Math.PI;
        newBubble.dx = Math.cos(randomAngle) * randomSpeed;
        newBubble.dy = Math.sin(randomAngle) * randomSpeed;

        bubbles.push(newBubble);
        console.log(`🎲 Random bubble "${newBubble.name}" created by ${session.username} at (${(randomX * 100).toFixed(1)}%, ${(randomY * 100).toFixed(1)}%) with size ${randomSize} and velocity (${newBubble.dx.toFixed(4)}, ${newBubble.dy.toFixed(4)}) 🎲`);

        // Save and broadcast updated bubbles to all connected clients
        saveBubbles();
        const bubblesForClient = bubbles.map(({airLossTimer, movementTimer, ...bubble}) => bubble);
        io.emit('bubblesUpdate', {
            bubbles: bubblesForClient,
            reason: 'random_bubble_created'
        });
    });

    // God mode handlers for debugging
    socket.on('godInflate', (data) => {
        const bubbleIndex = bubbles.findIndex(b => b.id === data.bubbleId);
        if (bubbleIndex !== -1) {
            const bubble = bubbles[bubbleIndex];
            bubble.size += GOD_INFLATE_AMOUNT;
            console.log(`⚡ GOD INFLATE: ${bubble.name} +${GOD_INFLATE_AMOUNT} → ${bubble.size}`);

            // Check if bubble should burst
            if (bubble.size > 1000) {
                console.log(`💥 ${bubble.name} burst from god-powered over-inflation! 💥`);
                BurstYourBubble(bubble);
            }

            saveBubbles();
            const bubblesForClient = bubbles.map(({airLossTimer, movementTimer, ...bubble}) => bubble);
            io.emit('bubblesUpdate', {
                bubbles: bubblesForClient,
                reason: 'god_inflate'
            });
        }
    });

    socket.on('godDeflate', (data) => {
        const bubble = bubbles.find(b => b.id === data.bubbleId);
        if (bubble) {
            bubble.size = Math.max(0, bubble.size - GOD_DEFLATE_AMOUNT);
            console.log(`⚡ GOD DEFLATE: ${bubble.name} -${GOD_DEFLATE_AMOUNT} → ${bubble.size}`);

            if (bubble.size <= 0) {
                // Bubble popped - remove it
                const bubbleIndex = bubbles.findIndex(b => b.id === bubble.id);
                if (bubbleIndex !== -1) {
                    clearTimeout(bubble.airLossTimer);
                    clearInterval(bubble.movementTimer);
                    bubbles.splice(bubbleIndex, 1);
                    console.log(`💥 ${bubble.name} popped by god power! 💥`);
                }
            }

            saveBubbles();
            const bubblesForClient = bubbles.map(({airLossTimer, movementTimer, ...bubble}) => bubble);
            io.emit('bubblesUpdate', {
                bubbles: bubblesForClient,
                reason: 'god_deflate'
            });
        }
    });

    socket.on('godPop', (data) => {
        // Check if user is authenticated and is superadmin
        const session = socket.request.session;
        const isAuthenticated = session && session.userId;
        const isSuperadmin = session && session.isSuperadmin;

        console.log(`🔍 God pop requested by socket ${socket.id}, authenticated: ${isAuthenticated}, superadmin: ${isSuperadmin}`);

        if (!isAuthenticated || !isSuperadmin) {
            console.log(`❌ God pop denied: User not authenticated or not superadmin`);
            return;
        }

        const bubble = bubbles.find(b => b.id === data.bubbleId);
        if (bubble) {
            console.log(`⚡💥 GOD POP: ${bubble.name} instantly destroyed by ${session.username}! 💥⚡`);

            // Apply explosion physics and remove bubble
            BurstYourBubble(bubble);

            saveBubbles();
            const bubblesForClient = bubbles.map(({airLossTimer, movementTimer, ...bubble}) => bubble);
            io.emit('bubblesUpdate', {
                bubbles: bubblesForClient,
                reason: 'god_pop'
            });
        }
    });

    // Handle get player count request
    socket.on('getPlayerCount', () => {
        socket.emit('playerCountUpdate', { count: connectedPlayers });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);

        // Decrement player count and broadcast update
        connectedPlayers--;
        console.log(`Connected players: ${connectedPlayers}`);
        io.emit('playerCountUpdate', { count: connectedPlayers });
    });
});

// Start the server
server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log('Socket.io server ready for connections');
});
