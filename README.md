# JohnAI Predictions

A prediction markets platform where users can trade shares on future events using virtual currency (JohnBucks).

## Overview

JohnAI Predictions is a Polymarket/Kalshi-style prediction market application built with:
- **Frontend**: React + TypeScript + Vite
- **UI**: Shadcn/ui components with Tailwind CSS
- **Backend**: Supabase (PostgreSQL + PostgREST)
- **Deployment**: Docker Compose with optional Cloudflare Tunnel

## Features

- **Anonymous Trading**: Create an account with just a username, get 10,000 JohnBucks to start
- **Prediction Markets**: Browse and trade on YES/NO markets for future events
- **Market Creation**: Anyone can create new prediction markets
- **Portfolio Tracking**: View your positions, trades, and profit/loss
- **Leaderboard**: See top traders by balance
- **Games**: Slot machine and loot box for fun

## Quick Start

### Local Development

1. Install Dependencies: `npm install`
2. Set Up Environment: `cp .env.example .env`
3. Start Database: `docker compose up -d postgres`
4. Start Dev Server: `npm run dev`
5. Build for Production: `npm run build`

## Key Concepts

### Users
- Simple username-based accounts
- Start with 10,000 JohnBucks
- No passwords required (local development mode)

### Markets
- Binary YES/NO prediction markets
- Automated market maker (AMM) for pricing
- Resolve to YES or NO when event occurs

## License

MIT License - See LICENSE file for details.
