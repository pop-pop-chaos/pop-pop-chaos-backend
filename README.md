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
- The backend is hosted on Fly.io, designed to support:
  - Real-time synchronization of up to 1,000 bubbles.
  - Efficient handling of player actions and AI decisions.
  - Delta updates to minimize bandwidth usage.
- The frontend will initially be hosted on DreamHost (subdomain: `poppopchaos.chatforest.com`) to serve the static site.

## Development Goals
1. **Create a lightweight, scalable backend** on Fly.io to manage bubble states and real-time gameplay.
2. **Implement a minimal frontend** using React and D3.js for bubble visualization and interactivity.
3. **Develop engaging AI behaviors** to ensure the game remains fun and dynamic with or without human players.
4. **Test and balance mechanics** to maintain fairness, excitement, and accessibility.

## Collaboration
This README marks the beginning of our joint journey to create Pop Pop Chaos. With your vision and creativity combined with AI's technical assistance, we aim to deliver a unique and enjoyable gaming experience.

## Next Steps
1. **Set up backend code** for Fly.io to manage bubble states and actions.
2. **Build a minimal frontend** to visualize bubbles and allow basic interactions.
3. **Iterate and refine mechanics** based on testing and feedback.
