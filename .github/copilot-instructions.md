# Pop Pop Chaos Backend - GitHub Copilot Instructions

**Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

Pop Pop Chaos Backend is a Node.js real-time multiplayer bubble game server built with Express.js, Socket.io, and MySQL. The system supports dual storage modes (MySQL primary, JSON file fallback) and features real-time bubble physics, user authentication, and WebSocket-based multiplayer gameplay.

## Working Effectively

### Repository Setup and Dependencies
- **Install dependencies**: `npm install` -- takes ~10 seconds. NEVER CANCEL.
- **Start development server**: `node index.js` -- starts immediately, runs on port 8080
- **Test basic functionality**: `curl http://localhost:8080/` -- should return "Hello World! Welcome to Pop Pop Chaos Backend..."

### Storage Modes and Database Setup
The application supports two storage modes via the `STORAGE_MODE` environment variable:

**File Storage Mode (Default):**
- No additional setup required
- Uses `bubbles.json` for persistent storage
- Automatically creates initial bubble on first run

**MySQL Database Mode:**
- Set `STORAGE_MODE=mysql` in environment variables
- Configure database connection via environment variables:
  ```bash
  DB_HOST=your-mysql-host
  DB_USER=your-username  
  DB_PASSWORD=your-password
  DB_NAME=your-database-name
  DB_PORT=3306
  ```
- **Import database schema**: `mysql -h HOST -u USER -p DATABASE < schema.sql`
- Application automatically falls back to file storage if database unavailable

### Build and Deployment

**Local Development:**
- `npm install` -- install dependencies (10 seconds)
- `node index.js` -- start server locally on port 8080
- Server supports hot-reload via manual restart only

**Docker Build:**
- `docker build -t pop-pop-chaos .` -- takes ~75 seconds. NEVER CANCEL. Set timeout to 120+ seconds.
- **Known Issue**: Docker production build has dependency conflicts with dotenv module
- **Workaround**: Use `npm install` instead of `npm install --production` in Dockerfile for reliable builds

**Deployment (Render.com):**
- Git-based deployment to Render.com (primary platform)
- Auto-deploys on git push to main branch
- Environment variables configured in Render dashboard
- Alternative options: Railway ($5/month), Fly.io (Docker-based)

## Validation and Testing

### Manual Validation Requirements
**ALWAYS run these validation scenarios after making changes:**

1. **Server Startup Validation**:
   ```bash
   node index.js
   # Should see: "Server running on http://localhost:8080"
   # Should see: "Socket.io server ready for connections"
   # Should see air loss messages: "Air loss! [bubble-name] shrunk to: [size]"
   ```

2. **HTTP Endpoint Testing**:
   ```bash
   curl http://localhost:8080/
   # Should return: "Hello World! Welcome to Pop Pop Chaos Backend. X bubbles, total size: Y"
   
   curl http://localhost:8080/auth/me
   # Should return: {"error":"Not authenticated"}
   ```

3. **Real-time Bubble Mechanics**:
   - Observe console output for automatic air loss every ~5 seconds
   - Verify bubble size decreases over time
   - Confirm JSON file updates automatically (`bubbles.json`)

### No Testing Infrastructure
- **npm test** returns error: "Error: no test specified" -- this is expected
- No existing linting, formatting, or testing tools configured
- No CI/CD workflows or automated testing in place

## Key Architecture Components

### Main Files
- **index.js** -- Main application server (1000+ lines, comprehensive game logic)
- **package.json** -- Dependencies: express, socket.io, mysql2, bcrypt, dotenv, express-session
- **schema.sql** -- Complete MySQL database schema with normalized tables
- **Dockerfile** -- Docker build configuration (works but has dependency issues)
- **bubbles.json** -- Runtime storage file for bubble state persistence

### Real-time Game Mechanics
- **Air Loss System**: Individual bubble timers with 5±2 second intervals
- **Movement Physics**: 20 FPS server-authoritative updates with wall bouncing
- **Explosion Physics**: Size-based force calculations with distance falloff
- **WebSocket Events**: bubbleClick, createBubble, godInflate, godDeflate, godPop
- **Team System**: 5-team color assignment with database integration

### Common Tasks and Timing Expectations

| Command | Expected Time | Timeout Setting | Notes |
|---------|---------------|-----------------|--------|
| `npm install` | ~10 seconds | 60 seconds | Downloads ~113 packages |
| `node index.js` | Immediate | N/A | Server starts on port 8080 |
| `docker build` | ~75 seconds | 120+ seconds | NEVER CANCEL - may take longer |
| HTTP requests | <1 second | 30 seconds | Basic endpoint testing |

### Environment Variables and Configuration
```bash
# Required for MySQL mode
STORAGE_MODE=mysql
DB_HOST=your-mysql-host
DB_USER=your-username
DB_PASSWORD=your-password
DB_NAME=your-database-name
DB_PORT=3306

# Optional
SESSION_SECRET=your-secret-key-change-this-in-production
PORT=8080
```

### CORS and External Integration
- Configured for `http://localhost:3000` (development frontend)
- Configured for `https://poppopchaos.chatforest.com` (production frontend)
- WebSocket connections support credentials and sessions

## Development Guidelines

### Making Changes
- **Always test locally** with `node index.js` before committing
- **Verify both storage modes** if making storage-related changes
- **Test real-time functionality** by observing air loss mechanics
- **Check console output** for error messages and bubble state updates

### Performance Characteristics
- **Tested**: Up to 10+ concurrent bubbles
- **Target**: Up to 100+ concurrent bubbles  
- **Physics Updates**: 20 FPS broadcasts to all clients
- **Memory Usage**: ~1MB per 1000 bubbles
- **Connection Handling**: Unlimited concurrent WebSocket connections

### Debugging and Troubleshooting
- Server logs provide detailed bubble state changes and WebSocket events
- Database connection errors automatically trigger file storage fallback
- Physics calculations and explosion effects logged with detailed metrics
- Session and authentication status logged for each WebSocket connection

### Repository Structure
```
.
├── README.md              # Comprehensive project documentation
├── CLAUDE.md              # Development guidance for Claude AI
├── index.js               # Main application server
├── package.json           # Node.js dependencies and scripts
├── schema.sql             # MySQL database schema
├── Dockerfile             # Docker build configuration
├── bubbles.json           # Runtime bubble state storage
├── .gitignore            # Git ignore patterns
└── .dockerignore         # Docker ignore patterns
```

**Critical Reminders:**
- **NEVER CANCEL builds or long-running commands** - they may take 75+ seconds
- **Always validate functionality manually** - automated testing not available
- **Test both storage modes** when making data persistence changes
- **Monitor console output** for real-time game mechanics validation