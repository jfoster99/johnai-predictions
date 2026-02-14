# Self-Hosted GitHub Actions Runner Setup

Since you're only allowing inbound connections via Cloudflare Tunnel (no port forwarding), you'll run a GitHub Actions runner **inside your Proxmox LXC**. The runner makes an outbound connection to GitHub to receive jobs.

## Benefits

✅ No SSH exposure or port forwarding needed
✅ Runner has direct access to Docker
✅ Faster deployments (local execution)
✅ More secure (no inbound connections)
✅ Works behind any firewall/NAT

## Setup Instructions

### 1. Create Self-Hosted Runner in GitHub

1. Go to your GitHub repository
2. Navigate to **Settings** → **Actions** → **Runners**
3. Click **New self-hosted runner**
4. Select **Linux** and **x64**
5. **Keep this page open** - you'll need the commands shown

### 2. Install Runner on Proxmox LXC

SSH into your Proxmox LXC and run the commands from GitHub:

```bash
# Switch to opt directory
cd /opt

# Download the runner (GitHub will show you the exact version)
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64-2.314.1.tar.gz -L https://github.com/actions/runner/releases/download/v2.314.1/actions-runner-linux-x64-2.314.1.tar.gz

# Extract
tar xzf ./actions-runner-linux-x64-2.314.1.tar.gz

# Configure the runner (use the token from GitHub)
./config.sh --url https://github.com/YOUR_USERNAME/johnai-predictions --token YOUR_TOKEN_FROM_GITHUB

# When prompted:
# - Runner group: Press Enter (default)
# - Runner name: johnai-proxmox (or any name)
# - Work folder: Press Enter (default _work)
# - Labels: Press Enter (default self-hosted,Linux,X64)
```

### 3. Install Runner as a Service

```bash
cd /opt/actions-runner

# Install the service
sudo ./svc.sh install

# Start the service
sudo ./svc.sh start

# Check status
sudo ./svc.sh status

# Enable on boot
systemctl enable actions.runner.*
```

### 4. Verify Runner is Connected

1. Go back to GitHub: **Settings** → **Actions** → **Runners**
2. You should see your runner with a green "Idle" status
3. If it shows "Offline", check the logs: `sudo ./svc.sh status`

### 5. Update Repository Permissions

The runner needs access to Docker:

```bash
# Add the runner user to docker group
sudo usermod -aG docker $(whoami)

# If runner runs as a different user:
# Find the runner user
ps aux | grep Runner.Listener

# Add that user to docker group
sudo usermod -aG docker <runner-user>

# Restart the runner service
sudo ./svc.sh restart
```

### 6. Test Deployment

On your Windows machine:

```powershell
cd C:\Users\jfost\johnai-predictions

# Make a small change
echo "# Testing self-hosted runner" >> README.md

# Commit and push
git add .
git commit -m "Test self-hosted runner deployment"
git push origin main
```

Go to GitHub → **Actions** tab and watch it deploy!

## Runner Management

### View Logs

```bash
# View service logs
sudo journalctl -u actions.runner.* -f

# Or check runner logs directly
cd /opt/actions-runner
tail -f _diag/Runner_*.log
```

### Restart Runner

```bash
cd /opt/actions-runner
sudo ./svc.sh restart
```

### Stop Runner

```bash
cd /opt/actions-runner
sudo ./svc.sh stop
```

### Update Runner

```bash
cd /opt/actions-runner

# Stop the service
sudo ./svc.sh stop

# Download new version (check GitHub for latest)
curl -o actions-runner-linux-x64-NEW_VERSION.tar.gz -L https://github.com/actions/runner/releases/download/vNEW_VERSION/actions-runner-linux-x64-NEW_VERSION.tar.gz

# Extract (overwrites old version)
tar xzf ./actions-runner-linux-x64-NEW_VERSION.tar.gz

# Restart
sudo ./svc.sh start
```

### Remove Runner

```bash
cd /opt/actions-runner

# Stop and uninstall service
sudo ./svc.sh stop
sudo ./svc.sh uninstall

# Remove runner from GitHub
./config.sh remove --token YOUR_REMOVAL_TOKEN_FROM_GITHUB
```

## Troubleshooting

### Runner Shows Offline

Check if service is running:
```bash
sudo ./svc.sh status
systemctl status actions.runner.*
```

Restart the service:
```bash
sudo ./svc.sh restart
```

Check logs:
```bash
sudo journalctl -u actions.runner.* -n 50
```

### Docker Permission Denied

```bash
# Verify user is in docker group
groups

# If docker is not listed, add user
sudo usermod -aG docker $USER

# Restart runner
sudo ./svc.sh restart

# Or logout and login again
```

### Workflow Stuck on "Waiting for a runner"

- Check runner status in GitHub (Settings → Actions → Runners)
- Verify runner service is running: `sudo ./svc.sh status`
- Check if runner matches the label in workflow (`runs-on: self-hosted`)
- Restart runner: `sudo ./svc.sh restart`

### Network Issues

The runner needs **outbound** HTTPS access to:
- `github.com` (port 443)
- `api.github.com` (port 443)
- `*.actions.githubusercontent.com` (port 443)

Test connectivity:
```bash
curl -I https://github.com
curl -I https://api.github.com
```

## Security Considerations

### Runner Security

✅ **Runs in isolated LXC** - Separate from Proxmox host
✅ **No inbound ports** - Only outbound HTTPS
✅ **Local execution** - No SSH exposure
✅ **Docker isolation** - Containers are isolated

### Additional Hardening

1. **Run as non-root user** (already default):
```bash
# The runner should NOT run as root
ps aux | grep Runner.Listener
```

2. **Limit runner permissions**:
```bash
# Only allow runner to manage specific directories
chown -R runner-user:runner-user /opt/johnai-predictions
```

3. **Use repository secrets** for sensitive data:
   - Never commit `.env` files
   - Store credentials in GitHub Secrets
   - Access in workflows with `${{ secrets.SECRET_NAME }}`

4. **Monitor runner activity**:
```bash
# Check what the runner is doing
sudo journalctl -u actions.runner.* -f
```

## Network Architecture

```
┌─────────────────────────────────────────┐
│  Your Proxmox LXC                       │
│                                         │
│  ┌─────────────────┐                   │
│  │ GitHub Actions  │ ─┐                │
│  │ Runner (outbound│  │ Polls for jobs │
│  │ to GitHub)      │ ─┘                │
│  └─────────────────┘                   │
│           │                             │
│           │ (local execution)           │
│           ↓                             │
│  ┌─────────────────┐                   │
│  │ Docker Compose  │                   │
│  │ (app containers)│                   │
│  └─────────────────┘                   │
│           │                             │
│           │                             │
│  ┌─────────────────┐                   │
│  │ Cloudflared     │ ←─────────────────┼─── Inbound traffic
│  │ (tunnel)        │                   │    from internet
│  └─────────────────┘                   │
│           │                             │
└───────────┼─────────────────────────────┘
            │ (outbound HTTPS)
            ↓
     ┌──────────────┐
     │  Cloudflare  │
     │   Network    │
     └──────────────┘
            │
            ↓
     predictions.johnfoster.cloud
```

**Key Points:**
- ✅ Runner makes **outbound** connection to GitHub
- ✅ Cloudflared makes **outbound** connection to Cloudflare
- ✅ **No inbound ports** needed
- ✅ All traffic through Cloudflare Tunnel
- ✅ GitHub Actions jobs execute locally

## Comparison: Self-Hosted vs SSH

| Feature | SSH Deployment | Self-Hosted Runner |
|---------|----------------|-------------------|
| Port forwarding required | ✅ Yes (SSH port) | ❌ No |
| Inbound firewall rules | ✅ Required | ❌ Not needed |
| Connection direction | GitHub → Your server | Your server → GitHub |
| Security exposure | SSH exposed | No exposure |
| Deployment speed | Slower (SSH overhead) | Faster (local) |
| Setup complexity | Simple | Medium |
| Works with Cloudflare only | ❌ No | ✅ Yes |

## What Changed

**Before (SSH-based - doesn't work for you):**
```yaml
runs-on: ubuntu-latest  # GitHub's servers
steps:
  - uses: appleboy/ssh-action  # SSH into your server
```

**After (Self-hosted - works with Cloudflare only):**
```yaml
runs-on: self-hosted  # Your Proxmox LXC
steps:
  - run: docker compose up -d  # Direct local commands
```

## Next Steps

1. ✅ Install runner on Proxmox LXC (follow steps above)
2. ✅ Push code to GitHub
3. ✅ Watch automatic deployment
4. ✅ Access your app at https://predictions.johnfoster.cloud

The runner will continuously poll GitHub for new commits and deploy automatically!
