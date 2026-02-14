# JohnAI Predictions

AI-Powered Prediction Markets platform.

## Technologies

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase

## Local Development

### Prerequisites

- Node.js & npm (or bun) - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

### Setup

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to the project directory
cd johnai-predictions

# Install dependencies
npm install
# or if using bun:
# bun install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:8080`

## Docker Deployment

### Prerequisites

- Docker and Docker Compose installed
- Cloudflared installed (for tunnel)

### Build and Run with Docker

```sh
# Build and start the containers
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the containers
docker-compose down
```

### Cloudflared Tunnel Setup

1. Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/

2. Authenticate:
```sh
cloudflared tunnel login
```

3. Create a tunnel:
```sh
cloudflared tunnel create johnai-predictions
```

4. Configure DNS for your domain `predictions.johnfoster.cloud` to point to the tunnel.

5. Start the tunnel:
```sh
cloudflared tunnel run johnai-predictions
```

The tunnel configuration is in `cloudflared-config.yml`.

## Environment Variables

Create a `.env` file based on your Supabase configuration with the necessary API keys and URLs.
