# Pop Pop Chaos

Pop Pop Chaos is a lighthearted, colorful game designed to foster human connection while offering a mix of casual observation and active participation. This project is a collaborative effort between you, the creator, and an AI assistant, working together to bring your vision to life.

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

## Development Strategy

### Phase 1: MVP - Real-time Communication
**Goal**: Prove WebSocket connectivity between multiple clients
- Simple click synchronization between browser instances
- Express + Socket.io backend on Render
- React frontend with Socket.io client integration

### Phase 2: Basic Game Mechanics
- Replace clicks with bubble interactions (pop/inflate/deflate)
- Add basic bubble state management
- Simple bubble visualization

### Phase 3: Full Game Features
- Complete bubble physics (air loss over time)
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
