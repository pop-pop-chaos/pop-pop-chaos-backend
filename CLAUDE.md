# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm install` - Install dependencies (currently only Express.js)
- `node index.js` - Run the server locally on port 8080
- `npm test` - No tests configured yet (returns error)

## Deployment Commands

### Render Deployment (Current)
- Connect GitHub repo to Render dashboard
- Render auto-detects Node.js and deploys on git push
- View logs in Render dashboard
- Environment variables set in Render dashboard

### Fly.io (Legacy/Future Option)
- `fly deploy` - Deploy using Dockerfile
- `fly logs` - View application logs
- `fly status` - Check deployment status

## Project Architecture

This is the backend for Pop Pop Chaos, a real-time multiplayer bubble game designed to foster human connection through collaborative gameplay.

### Current Implementation
- **Framework**: Express.js server with minimal setup
- **Entry Point**: `index.js` with basic "Hello World" route
- **Deployment**: Git-based deployment to Render.com
- **Real-time**: Socket.io integration planned for WebSocket support

### Game Architecture (Planned)
The backend is designed to support:
- **Real-time bubble management**: Up to 1,000 bubbles with state synchronization
- **Multiplayer coordination**: Teams of human players and AI
- **AI-driven gameplay**: Fully autonomous teams when no humans active
- **Efficient updates**: Delta synchronization to minimize bandwidth

### Key Game Mechanics
- Bubbles survive within size range (5-500) and lose air over time
- Players inflate/deflate/pop bubbles through real-time interactions
- Teams mix human players and AI with dynamic role switching
- Spectator mode for watching AI-driven matches

### Deployment Details

**Current: Render.com**
- **Platform**: Render free tier for MVP development
- **Deployment**: Git-based, auto-deploy on push
- **Limitations**: Sleeps after 15min inactivity, 750 hours/month
- **Port**: Auto-assigned, HTTPS included

**Future Options:**
- **Railway**: $5/month, always-on, simple deployment
- **Render Paid**: $7/month, no sleep limitations
- **Fly.io**: Docker-based, Sydney region configured