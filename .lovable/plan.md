

# JohnAI Predictions
**A serious-looking parody prediction market platform**

## Overview
A Polymarket/Kalshi clone where users trade shares on prediction markets using fake money. Looks totally legit. Is totally not.

---

## Pages & Features

### 1. Landing / Markets Page
- Hero banner with "JohnAI Predictions" branding — serious fintech aesthetic with dark theme
- Featured/trending markets at the top
- Filterable/searchable list of all active markets
- Each market card shows: question, current YES/NO prices, volume, resolution date
- Categories for markets (Politics, Sports, Memes, etc.)

### 2. User Onboarding (Casual)
- First visit: modal asking for a display name
- Auto-assigned $10,000 in fake "JohnBucks" (or similar gag currency)
- Username stored in browser + database, no login required
- Leaderboard name tied to this identity

### 3. Individual Market Page
- Market question prominently displayed
- Real-time YES/NO share price chart (simplified version)
- Order panel: buy/sell YES or NO shares at current price
- Market details: description, resolution criteria, creator, volume, end date
- Activity feed showing recent trades
- Share prices move based on demand (simple automated market maker)

### 4. Create Market Page
- Form to create a new prediction market
- Fields: question, description, category, resolution date, resolution criteria
- Preview before publishing
- Market goes live immediately (no approval needed)

### 5. Portfolio / Profile Page
- User's current balance of JohnBucks
- Active positions (shares held in each market)
- Trade history
- P&L tracking
- Total portfolio value

### 6. Leaderboard
- Ranked list of users by total portfolio value
- Top traders highlighted
- Fun stats (biggest win, biggest loss, most active)

---

## Backend (Supabase)

- **Users table**: anonymous users with display name, balance
- **Markets table**: prediction questions, prices, status, resolution info
- **Orders/Trades table**: buy/sell records
- **Positions table**: user share holdings per market
- Simple automated market maker (AMM) logic for price movement based on share purchases

---

## Design Direction
- Dark mode, sleek fintech/crypto aesthetic (Polymarket-inspired)
- Clean typography, data-dense cards
- Green/red for price movements
- Subtle absurdity — the predictions can be ridiculous but the UI treats them completely seriously

---

## Custom Domain
- Connect `prediction.johnfoster.cloud` via Lovable's domain settings
- Add A record → `185.158.133.1` and TXT verification record at your DNS provider

