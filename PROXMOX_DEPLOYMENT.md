# Proxmox Deployment Guide

## Option 1: LXC Container (Recommended - Lightweight)

### 1. Create Ubuntu LXC Container in Proxmox

```bash
# In Proxmox web UI:
# - Create CT
# - Template: Ubuntu 22.04 or 24.04
# - Hostname: johnai-predictions
# - Unprivileged: Yes
# - CPU: 2 cores
# - Memory: 4096 MB
# - Network: Bridge, DHCP or Static IP
# - Start after creation: Yes
```

### 2. Enter the Container

```bash
# In Proxmox shell
pct enter <CT_ID>
```

### 3. Install Docker and Docker Compose

```bash
# Update system
apt update && apt upgrade -y

# Install dependencies
apt install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# Set up Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### 4. Transfer Project Files

On your Windows machine:
```powershell
# Option A: Use SCP (if you have SSH access)
scp -r C:\Users\jfost\johnai-predictions root@<LXC_IP>:/opt/

# Option B: Use git (recommended)
# First, push to a git repository, then on the LXC:
```

On the LXC container:
```bash
cd /opt
git clone <your-repo-url> johnai-predictions
# OR if copying manually, create the directory
mkdir -p /opt/johnai-predictions
# Then copy files via SCP
```

### 5. Set Up Cloudflare Tunnel

#### Get Your Tunnel Token

1. Go to https://one.dash.cloudflare.com/
2. Navigate to **Networks** → **Tunnels**
3. Click **Create a tunnel**
4. Name it: `johnai-predictions`
5. Install connector: Choose **Docker**
6. Copy the tunnel token (looks like: `eyJhIjoiXXXXXXXXXXXXX...`)
7. Configure public hostname:
   - **Public hostname**: `predictions.johnfoster.cloud`
   - **Service**: `http://johnai-predictions:3000`
   - **TLS Verify**: Off (since it's internal)

#### Configure the Project

```bash
cd /opt/johnai-predictions

# Create .env file
cat > .env << 'EOF'
# Supabase Configuration
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE
VITE_SUPABASE_PROJECT_ID=local

# PostgreSQL
POSTGRES_PASSWORD=your-super-secret-and-long-postgres-password

# Cloudflare Tunnel Token (paste your token here)
CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoiXXXXXXXXXXXXX...
EOF

# Set proper permissions
chmod 600 .env
```

### 6. Deploy with Cloudflare Tunnel

```bash
# Start all services including Cloudflare Tunnel
docker compose --profile tunnel up -d

# Check logs
docker compose logs -f

# Check tunnel status specifically
docker compose logs cloudflared
```

### 7. Verify Deployment

```bash
# Check all containers are running
docker compose ps

# Should see:
# - johnai-postgres
# - johnai-rest
# - johnai-kong
# - johnai-meta
# - johnai-studio
# - johnai-predictions
# - johnai-cloudflared

# Test local access
curl http://localhost:3000

# Check Cloudflare Tunnel dashboard
# Your tunnel should show as "Healthy" at:
# https://one.dash.cloudflare.com/
```

### 8. Access Your App

- **Public URL**: https://predictions.johnfoster.cloud
- **Local Studio**: http://<LXC_IP>:3001
- **Admin Panel**: https://predictions.johnfoster.cloud/admin

## Option 2: VM Deployment (Alternative)

If you prefer a full VM instead of LXC:

1. Create Ubuntu Server VM in Proxmox
2. Follow same steps as LXC (starting from step 3)

## Automatic Startup on Boot

```bash
# Enable Docker to start on boot
systemctl enable docker

# Set containers to restart automatically
cd /opt/johnai-predictions
docker compose --profile tunnel up -d --restart unless-stopped
```

## Updating the Application

```bash
cd /opt/johnai-predictions

# Pull latest changes (if using git)
git pull

# Rebuild and restart
docker compose --profile tunnel up -d --build

# Or just restart without rebuilding
docker compose --profile tunnel restart johnai-predictions
```

## Monitoring

```bash
# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f johnai-predictions
docker compose logs -f cloudflared

# Check resource usage
docker stats

# Check disk usage
docker system df
```

## Backup Strategy

```bash
# Backup database
docker exec johnai-postgres pg_dump -U postgres postgres > backup_$(date +%Y%m%d).sql

# Backup entire data directory
tar -czf backup_$(date +%Y%m%d).tar.gz /opt/johnai-predictions

# Restore from backup
cat backup_20260214.sql | docker exec -i johnai-postgres psql -U postgres postgres
```

## Troubleshooting

### Cloudflare Tunnel Not Connecting

```bash
# Check tunnel logs
docker compose logs cloudflared

# Restart tunnel
docker compose restart cloudflared

# Verify token is correct in .env
cat .env | grep CLOUDFLARE_TUNNEL_TOKEN
```

### Can't Access Locally

```bash
# Check if containers are running
docker compose ps

# Check firewall
ufw status
# If needed: ufw allow 3000/tcp

# Check container networking
docker network inspect johnai-predictions_default
```

### Database Issues

```bash
# Connect to database
docker exec -it johnai-postgres psql -U postgres

# View migrations
docker compose logs postgres | grep migration

# Restart database
docker compose restart postgres
```

## Security Recommendations

1. **Change PostgreSQL Password**:
   ```bash
   # Update POSTGRES_PASSWORD in .env
   # Restart: docker compose down && docker compose --profile tunnel up -d
   ```

2. **Firewall Configuration**:
   ```bash
   # Only allow SSH and local access
   ufw enable
   ufw allow 22/tcp
   ufw allow from 192.168.0.0/16 to any port 3001  # Supabase Studio (local network only)
   ```

3. **Change Admin Password**:
   - Edit `src/pages/Admin.tsx`
   - Change `ADMIN_PASSWORD` constant
   - Rebuild: `docker compose up -d --build johnai-predictions`

4. **Keep System Updated**:
   ```bash
   apt update && apt upgrade -y
   docker compose pull
   docker compose --profile tunnel up -d
   ```

## Performance Tuning

### For LXC Container

Edit container config on Proxmox host:
```bash
# On Proxmox host
nano /etc/pve/lxc/<CT_ID>.conf

# Add:
# cores: 4
# memory: 8192
# swap: 2048
```

### For PostgreSQL

Create `docker-compose.override.yml`:
```yaml
services:
  postgres:
    command:
      - postgres
      - -c
      - max_connections=100
      - -c
      - shared_buffers=256MB
      - -c
      - effective_cache_size=1GB
      - -c
      - maintenance_work_mem=64MB
      - -c
      - checkpoint_completion_target=0.9
      - -c
      - wal_buffers=16MB
      - -c
      - default_statistics_target=100
      - -c
      - random_page_cost=1.1
```

Then restart:
```bash
docker compose --profile tunnel up -d
```
