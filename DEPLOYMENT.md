# Docker Deployment Guide for JohnAI Predictions

This guide will help you deploy JohnAI Predictions locally using Docker and expose it via Cloudflare Tunnel.

## Prerequisites

1. **Docker Desktop** for Windows - https://www.docker.com/products/docker-desktop
2. **Cloudflared** - https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/

## Step 1: Environment Setup

1. Copy the environment template:
```powershell
Copy-Item .env.example .env
```

2. Edit `.env` and add your Supabase credentials:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Step 2: Build and Run with Docker

### Option A: Using Docker Compose (Recommended)

1. Build and start the application:
```powershell
docker-compose up -d --build
```

2. Check if containers are running:
```powershell
docker-compose ps
```

3. View logs:
```powershell
docker-compose logs -f johnai-predictions
```

4. Access the app locally at: http://localhost:3000

### Option B: Using Docker directly

1. Build the image:
```powershell
docker build -t johnai-predictions .
```

2. Run the container:
```powershell
docker run -d -p 3000:80 --name johnai-predictions johnai-predictions
```

3. Access the app locally at: http://localhost:3000

## Step 3: Cloudflare Tunnel Setup

### Initial Setup (One-time)

1. Install cloudflared for Windows:
```powershell
# Using winget
winget install --id Cloudflare.cloudflared

# Or download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
```

2. Authenticate with Cloudflare:
```powershell
cloudflared tunnel login
```
This will open a browser window. Select your Cloudflare account and authorize.

3. Create a tunnel:
```powershell
cloudflared tunnel create johnai-predictions
```
Save the tunnel ID that is displayed.

4. Create a DNS record for your domain:
```powershell
cloudflared tunnel route dns johnai-predictions predictions.johnfoster.cloud
```

### Running the Tunnel

#### Option A: Using Docker Compose with Token

1. Get your tunnel token from Cloudflare Zero Trust Dashboard:
   - Go to https://one.dash.cloudflare.com/
   - Navigate to Networks > Tunnels
   - Click on your tunnel
   - Click "Configure"
   - Get the token

2. Add the token to your `.env` file:
```
CLOUDFLARE_TUNNEL_TOKEN=your-token-here
```

3. Start everything with docker-compose:
```powershell
docker-compose up -d
```

#### Option B: Running Cloudflared Locally

1. Start the tunnel using the config file:
```powershell
cloudflared tunnel --config cloudflared-config.yml run johnai-predictions
```

Or run it in the background as a service:
```powershell
cloudflared service install
cloudflared --config cloudflared-config.yml service start
```

## Verification

1. Check that the app is running:
```powershell
# Test locally
curl http://localhost:3000/health

# Test via tunnel (after a minute or two)
curl https://predictions.johnfoster.cloud
```

2. Open in browser: https://predictions.johnfoster.cloud

## Updating the Application

1. Pull latest changes:
```powershell
git pull
```

2. Rebuild and restart:
```powershell
docker-compose up -d --build
```

## Stopping the Application

```powershell
# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

## Troubleshooting

### Check container logs:
```powershell
docker-compose logs -f johnai-predictions
docker-compose logs -f cloudflared
```

### Restart a specific service:
```powershell
docker-compose restart johnai-predictions
```

### Check tunnel status:
```powershell
cloudflared tunnel info johnai-predictions
```

### Rebuild from scratch:
```powershell
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

## Security Notes

- Never commit `.env` file to git
- Keep your tunnel credentials secure
- Regularly update Docker images for security patches
- Consider enabling Cloudflare Access for additional security

## Additional Resources

- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Nginx Documentation](https://nginx.org/en/docs/)
