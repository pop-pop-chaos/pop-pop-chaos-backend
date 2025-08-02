# Pop Pop Chaos - Backend

Pop Pop Chaos is a lighthearted, colorful game designed to foster human connection while offering a mix of casual observation and active participation. This project is a collaborative effort between you, the creator, and an AI assistant, working together to bring your vision to life.

Real-time multiplayer bubble game server built with Node.js, Express, and Socket.io. Features advanced bubble physics, persistent storage, and explosion mechanics.

## Game Overview
Pop Pop Chaos revolves around bubbles that need to be carefully monitored and maintained by players. The game can be played solo, with teams of players, or entirely controlled by AI. The focus is on teamwork, strategy, and fostering a fun, engaging environment without overt competition.

### Core Mechanics
- **Bubble Behavior**:
  - Bubbles survive within a size range (e.g., 5 to 500).
  - They gradually lose air over time and must be inflated to remain stable.
  - Special bubbles introduce unique mechanics (e.g., slower air loss, faster inflation).
- **Player Interaction**:
  - Players alternate between monitoring bubbles and quick interactions to inflate, deflate, or pop bubbles.

### Teams and AI
- Teams consist of a mix of human players and AI.
- AI can fully control teams when no humans are active, making the game fun to watch or join at any time.
- All players have the same abilities and can shift roles dynamically.
- Strategic communication between team members is encouraged but happens outside the game.

### Multiplayer and Lobby
- Players can see the status of teams in the lobby, including how many humans and AI are active.
- The game supports free-for-all matchmaking, allowing players to choose their preferred team.
- Spectator mode enables players to watch AI-driven matches or observe team dynamics.

### Visuals and Feedback
- The game features a minimalist design with colorful, dynamic bubbles.
- Real-time visual indicators highlight bubble health and status.
- Team status dashboards summarize key metrics (e.g., critical bubbles, team performance).

### Hosting and Scalability
- **Backend**: Initially deployed on Render.com (free tier) for MVP development
- **Frontend**: DreamHost hosting (subdomain: `poppopchaos.chatforest.com`) for static site
- **Future scaling**: May migrate to Railway ($5/month) or Render paid tier for production

The system is designed to support:
- Real-time synchronization using WebSockets (Socket.io)
- Efficient handling of player actions and AI decisions
- Delta updates to minimize bandwidth usage

## Features

### Current Implementation
- **Real-time Multiplayer**: WebSocket server supporting unlimited concurrent players
- **Advanced Bubble Physics**: Server-authoritative movement with velocity, wall bouncing, and collision detection
- **Explosion Mechanics**: Size-based force calculations with distance falloff and mass resistance
- **Persistent Storage**: MySQL database with automatic file storage fallback
- **Individual Bubble Timers**: Each bubble has independent air loss and movement cycles
- **God Powers**: Administrative controls for bubble manipulation
- **Team System**: 5-team color assignment with database color mapping
- **Connection Management**: Automatic database reconnection and error handling

### Game Mechanics
- **Air Loss**: Individual timers (5±2 seconds) with automatic cleanup
- **Movement**: 20 FPS physics updates with normalized coordinates (0-1)
- **Explosion Physics**: Force magnitude based on bubble size and distance
- **Burst Threshold**: Bubbles explode at size 1000, triggering explosion physics
- **Wall Bouncing**: Realistic physics with 10% energy loss per bounce
- **Size Persistence**: All bubble state maintained across server restarts

## Development Strategy


### Phase 3: Full Game Features
- Team mechanics and AI players
- Advanced visualizations with D3.js
- Spectator mode and lobby system

## Technical Architecture
- **Backend**: Node.js + Express + Socket.io
- **Frontend**: React + Socket.io-client + D3.js (future)
- **Database**: PostgreSQL (when needed for persistence)
- **Deployment**: Git-based deployment to Render

## Current Status
✅ **MVP Complete**: Real-time bubble creation, inflation, air loss, and god powers
✅ **Persistent Storage**: MySQL database with fallback to file storage
✅ **Named Bubbles**: Emotional attachment through personalized bubble names

## Potential Bubble Characteristics

The following characteristics could be implemented as columns in the `bubbles` table to create unique bubble personalities:

### **Core Behavior Characteristics**

**Air Loss & Timing:**
- `air_loss_rate` - Base deflation speed (0.5 = slow, 2.0 = fast)
- `air_loss_variability` - Timing randomness (0.0 = predictable, 1.0 = chaotic)
- `air_loss_acceleration` - Gets worse as smaller (1.0 = linear, 2.0 = exponential)

**Inflation Response:**
- `inflate_efficiency` - Size gained per click (0.5 = hard, 2.0 = easy)
- `inflate_resistance` - Harder to inflate when large (0.0 = easy, 1.0 = very hard)
- `inflate_variability` - Click effectiveness randomness

**Size & Survival:**
- `burst_threshold` - Max size before exploding (50-500)
- `min_survival_size` - Dies at size X instead of 0 (0-10)
- `critical_size` - Panic mode when below this size

### **Stress & Interaction**
- `stress_sensitivity` - Bursts from rapid clicking (0.0 = zen, 1.0 = anxious)
- `click_cooldown` - Must wait between effective clicks (0-3 seconds)
- `multi_click_bonus` - Rapid clicking gives bonus (0.0 = no bonus, 1.0 = double)

### **Advanced Behaviors**
- `regeneration_rate` - Slowly self-heals (0.0 = none, 0.1 = +1 every 10 seconds)
- `age_bonus` - Gets stronger over time (0.0 = none, 0.01 = 1% per minute)
- `splitting_chance` - Becomes two bubbles when popped (0.0-1.0)
- `revival_chance` - Small chance to respawn after death (0.0-0.1)

### **Environmental**
- `drift_speed` - Moves around game area (0.0 = stationary, 1.0 = fast drift)
- `crowd_aversion` - Suffers when too many nearby bubbles (0.0-1.0)
- `contagion_effect` - Affects nearby bubbles' air loss (0.0-0.5)

### **Most Impactful for Initial Implementation**
1. `air_loss_rate` - Creates immediate gameplay drama
2. `inflate_efficiency` - Affects click satisfaction and strategy
3. `stress_sensitivity` - Prevents button mashing, adds tension
4. `burst_threshold` - Introduces size management strategy

*Note: All characteristics use DECIMAL columns with sensible defaults (usually 1.0 for rates, appropriate ranges for thresholds)*

## Technology Stack

- **Runtime**: Node.js with Express.js framework
- **Real-time**: Socket.io for WebSocket communication
- **Database**: MySQL with mysql2 driver (connection pooling ready)
- **Storage**: Dual-mode (MySQL primary, JSON file fallback)
- **Environment**: dotenv for configuration management
- **Physics**: Custom server-side calculations with normalized coordinates

## Architecture

### Core Systems
- **Bubble Management**: Individual timers and physics calculations
- **Storage Layer**: Dual MySQL/file storage with automatic fallback
- **Physics Engine**: Server-authoritative movement and collision detection
- **Event System**: Real-time WebSocket events for all game actions
- **Database Schema**: Normalized tables for bubbles, colors, sessions, and events

### Real-time Events
- `bubblesUpdate` - Broadcast bubble state changes
- `bubbleClick` - Player inflation (+1 size)
- `createBubble` - New bubble creation with naming
- `godInflate` - Administrative +100 size inflation
- `godDeflate` - Administrative -10 size deflation
- `godPop` - Instant bubble destruction with explosion

### Physics Implementation
- **Normalized Coordinates**: All positions stored as percentages (0.0-1.0)
- **Velocity System**: Continuous movement with bounce physics
- **Force Calculations**: Mass-based resistance and distance falloff
- **Boundary Detection**: Automatic wall collision with energy loss

## Database Schema

### Tables
- `bubbles` - Main bubble storage with position, velocity, and metadata
- `bubble_colors` - Color lookup table for team assignments
- `game_sessions` - Session tracking for multiplayer features
- `bubble_events` - Event logging for analytics and debugging

### Key Features
- **Automatic Reconnection**: Handles connection drops with retry logic
- **Schema Validation**: Startup checks ensure all required tables exist
- **Position Storage**: Percentage-based coordinates for screen independence
- **Velocity Persistence**: Full physics state maintained in database

## Configuration

### Environment Variables
```bash
# Database Configuration (MySQL mode)
DB_HOST=your-mysql-host
DB_USER=your-username
DB_PASSWORD=your-password
DB_NAME=your-database-name
DB_PORT=3306

# Storage Mode
STORAGE_MODE=mysql  # or 'file' for fallback

# Server Configuration
PORT=8080  # Default port
```

### CORS Configuration
Configured for:
- `http://localhost:3000` (development)
- `https://poppopchaos.chatforest.com` (production)

## Development Commands

### Local Development
```bash
npm install
node index.js
```

### Database Setup
```bash
# Import schema
mysql -h HOST -u USER -p DATABASE < schema.sql

# Set environment variables
cp .env.example .env
# Edit .env with your database credentials
```

### Deployment (Render.com)
- Connect GitHub repository to Render dashboard
- Set environment variables in Render dashboard
- Auto-deploys on git push to main branch

## Storage Modes

### MySQL Mode (Primary)
- Full persistence with relational data
- Automatic reconnection on connection loss
- Schema validation on startup
- Performance optimized with proper indexing

### File Mode (Fallback)
- JSON file storage (`bubbles.json`)
- Automatic fallback when MySQL unavailable
- Maintains bubble state between restarts
- Suitable for development and small deployments

## Performance Characteristics

### Bubble Limits
- **Tested**: Up to 10+ concurrent bubbles
- **Hopeful**: Up to 100+ concurrent bubbles
- **Movement Updates**: 20 FPS broadcasts to all clients
- **Memory Usage**: ~1MB per 1000 bubbles
- **Network**: Delta updates minimize bandwidth

### Server Performance
- **Connection Handling**: Unlimited concurrent WebSocket connections
- **Physics Calculations**: Server-authoritative at 20 FPS
- **Database Queries**: Optimized batch operations
- **Auto-cleanup**: Automatic removal of expired bubbles

## Deployment Architecture

### Current: Render.com Free Tier
- **Platform**: Git-based deployment
- **Limitations**: Sleeps after 15min inactivity
- **Benefits**: HTTPS included, auto-scaling
- **Monitoring**: Built-in logging and metrics

### Future Scaling Options
- **Railway**: $5/month always-on with better performance
- **Render Paid**: $7/month with no sleep restrictions
- **Custom VPS**: Full control with higher maintenance

## Game Design Philosophy

The backend prioritizes:
- **Server Authority**: All game state managed server-side for consistency
- **Emotional Investment**: Named bubbles create player attachment
- **Smooth Physics**: 20 FPS updates provide fluid animations
- **Scalability**: Architecture supports hundreds of concurrent players
- **Persistence**: Bubbles survive server restarts and player disconnections

The system balances performance with rich gameplay mechanics, creating an engaging multiplayer experience that scales from single players to large groups.

