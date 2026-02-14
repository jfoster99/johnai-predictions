# Proxmox Setup Guide for JohnAI Predictions (4GB RAM)

## Overview
This guide sets up JohnAI Predictions on a 4GB RAM Proxmox server using:
- **LXC Container** for the app (memory-efficient)
- **GitHub Actions** with self-hosted runner for CI/CD
- **Memory limits** on all Docker services (~1.1GB total)

## Step 1: Create LXC Container in Proxmox

```bash
# In Proxmox web UI or CLI
pct create 200 local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst \
  --hostname johnai-app \
  --memory 3072 \
  --swap 1024 \
  --cores 2 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --storage local-lvm \
  --rootfs local-lvm:16 \
  --unprivileged 1 \
  --features nesting=1

pct start 200
```

**Memory Allocation:**
- Container: 3GB RAM + 1GB swap
- Leaves ~1GB for host OS
- Docker limits ensure containers don't exceed allocation

## Step 2: Install Docker in Container

```bash
# Enter container
pct enter 200

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
rm get-docker.sh

# Install Docker Compose plugin
apt install docker-compose-plugin -y

# Verify installation
docker --version
docker compose version
```

## Step 3: Setup GitHub Runner (if not already done)

### Option A: Runner in same container (saves ~200MB)

```bash
# Create runner directory
mkdir -p /opt/actions-runner
cd /opt/actions-runner

# Download runner
curl -o actions-runner-linux-x64-2.321.0.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.321.0/actions-runner-linux-x64-2.321.0.tar.gz

# Extract
tar xzf ./actions-runner-linux-x64-2.321.0.tar.gz

# Configure (get token from GitHub repo Settings > Actions > Runners)
./config.sh --url https://github.com/YOUR_USERNAME/johnai-predictions --token YOUR_RUNNER_TOKEN

# Install as service
sudo ./svc.sh install
sudo ./svc.sh start
```

### Option B: Runner in separate container (current setup)

If your runner is already in another container, ensure it has access to the app container:
```bash
# In runner container, install Docker CLI
apt install docker.io -y

# Give runner access to host Docker socket (from Proxmox host)
pct set RUNNER_CT_ID -mp0 /var/run/docker.sock,mp=/var/run/docker.sock
```

## Step 4: Clone Repository and Configure

```bash
# Create deployment directory
mkdir -p /opt/johnai-predictions
cd /opt/johnai-predictions

# Clone repository (use deploy key or PAT)
git clone https://github.com/YOUR_USERNAME/johnai-predictions.git .

# Create .env file
cat > .env << 'EOF'
VITE_SUPABASE_URL=https://predictions.johnfoster.cloud/api
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here
VITE_SUPABASE_PROJECT_ID=local
CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token-here
EOF

# Set permissions
chmod 600 .env
```

## Step 5: Configure GitHub Secrets

In your GitHub repository:
1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add these secrets:
   - `VITE_SUPABASE_URL`: `https://predictions.johnfoster.cloud/api`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: Your Supabase anon key
   - `CLOUDFLARE_TUNNEL_TOKEN`: Your Cloudflare tunnel token

## Step 6: Test Manual Deployment

```bash
cd /opt/johnai-predictions

# Build and start (first time will take ~5 minutes)
docker compose --profile tunnel up -d --build

# Check status
docker compose ps
docker stats --no-stream

# Expected memory usage:
# postgres:       128-256MB
# rest:           64-128MB
# kong:           64-128MB
# meta:           64-128MB
# studio:         64-128MB
# predictions:    128-256MB
# cloudflared:    32-64MB
# TOTAL:          ~1.1GB
```

## Step 7: Push to GitHub to Trigger Deployment

```bash
# From your development machine
git add .
git commit -m "Add CI/CD workflow and memory limits"
git push origin main
```

The GitHub Actions workflow will automatically:
1. Run on the self-hosted runner
2. Pull latest code
3. Rebuild containers with memory limits
4. Restart services
5. Verify deployment

## Step 8: Monitor and Verify

```bash
# Check container logs
docker compose logs -f

# Check memory usage
docker stats

# Check deployment from GitHub Actions tab
# Should see green checkmark if successful
```

## Memory Optimization Tips

### 1. Reduce Studio Resources (optional)
If you don't need the web UI, comment out the studio service:
```yaml
# studio:
#   ...
```
**Saves:** ~128MB

### 2. Adjust PostgreSQL Settings
```bash
# Edit docker-compose.yml
environment:
  POSTGRES_SHARED_BUFFERS: 64MB
  POSTGRES_MAX_CONNECTIONS: 50
```

### 3. Monitor Memory Pressure
```bash
# Watch memory in real-time
watch -n 1 free -h

# Check for OOM kills
dmesg | grep -i "out of memory"
```

### 4. Enable Swap (if needed)
```bash
# On Proxmox host, increase container swap
pct set 200 -swap 2048
```

### 5. Clean Up Old Images
```bash
# Auto-cleanup (happens in CI/CD)
docker image prune -af --filter "until=24h"

# Manual cleanup
docker system prune -af --volumes
```

## Troubleshooting

### Memory Errors During Build

**Problem:** Docker build fails with "out of memory"

**Solution 1:** Build on more powerful machine
```bash
# On powerful machine
docker build -t ghcr.io/YOUR_USERNAME/johnai-predictions:latest .
docker push ghcr.io/YOUR_USERNAME/johnai-predictions:latest

# On Proxmox
docker pull ghcr.io/YOUR_USERNAME/johnai-predictions:latest
```

**Solution 2:** Increase container memory temporarily
```bash
# On Proxmox host
pct set 200 -memory 4096

# After build, reduce back
pct set 200 -memory 3072
```

### Container Keeps Restarting

**Check logs:**
```bash
docker compose logs postgres
docker compose logs johnai-predictions
```

**Common issues:**
- PostgreSQL needs more memory → increase to 512MB
- Build files too large → clean up `node_modules`, `dist`

### Slow Performance

**Options:**
1. Disable Studio (saves 128MB)
2. Use remote build (GitHub Actions runners have more resources)
3. Upgrade Proxmox server RAM to 8GB
4. Use external PostgreSQL database

### GitHub Actions Not Triggering

**Check:**
1. Runner is online: GitHub repo → Settings → Actions → Runners
2. Runner service is running: `systemctl status actions.runner.*`
3. Webhook is configured: Settings → Webhooks

## Maintenance

### Update Application

Just push to GitHub - auto-deploys via Actions!

```bash
# From dev machine
git add .
git commit -m "Update feature"
git push origin main
```

### Manual Restart

```bash
cd /opt/johnai-predictions
docker compose restart
```

### Backup Database

```bash
# Backup
docker compose exec postgres pg_dump -U postgres postgres > backup.sql

# Restore
docker compose exec -T postgres psql -U postgres postgres < backup.sql
```

### Check Deployment Status

```bash
# Health check
curl http://localhost:3000

# Or via Cloudflare
curl https://predictions.johnfoster.cloud
```

## Resource Summary

**Total Memory Usage:**
- Host OS: ~500MB
- Docker containers: ~1.1GB
- Swap available: 1GB
- Remaining: ~400MB buffer

**Disk Usage:**
- Docker images: ~1.5GB
- Data volumes: <1GB
- Total: ~3GB (out of 16GB allocated)

**Network:**
- Inbound: Cloudflare Tunnel only
- Outbound: GitHub, Docker Hub, Cloudflare
- No port forwarding needed

## Next Steps

1. ✅ App deployed and running
2. ✅ CI/CD configured
3. ✅ Memory limits in place
4. 🔐 TODO: Change default passwords
5. 🔒 TODO: Harden RLS policies
6. 📊 TODO: Set up monitoring (Uptime Kuma, Grafana)
7. 💾 TODO: Configure automated backups

## Support

If you encounter issues:
1. Check container logs: `docker compose logs -f`
2. Check memory: `free -h` and `docker stats`
3. Check GitHub Actions tab for build/deploy errors
4. Verify runner is online in GitHub repo settings
