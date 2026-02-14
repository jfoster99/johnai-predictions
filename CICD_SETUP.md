# CI/CD Setup Guide

## Overview

This project uses GitHub Actions for automated testing and deployment to your Proxmox instance.

## Workflows

### 1. Test Workflow (`.github/workflows/test.yml`)
- **Triggers**: On push to main or pull requests
- **Actions**: 
  - Installs dependencies
  - Runs linter (if configured)
  - Runs tests (if configured)
  - Builds the application

### 2. Deploy Workflow (`.github/workflows/deploy.yml`)
- **Triggers**: On push to main (after tests pass) or manual trigger
- **Actions**:
  - SSH into Proxmox LXC
  - Pull latest code
  - Rebuild and restart Docker containers
  - Verify deployment

## Setup Instructions

### 1. Create GitHub Repository

```powershell
# In your project directory
cd C:\Users\jfost\johnai-predictions

# Initialize git
git init
git add .
git commit -m "Initial commit with CI/CD"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/johnai-predictions.git
git branch -M main
git push -u origin main
```

### 2. Generate SSH Key for GitHub Actions

On your Proxmox LXC:

```bash
# Generate SSH key (press Enter for all prompts)
ssh-keygen -t ed25519 -C "github-actions" -f /root/.ssh/github-actions

# Add public key to authorized_keys
cat /root/.ssh/github-actions.pub >> /root/.ssh/authorized_keys

# Display private key (you'll need this for GitHub)
cat /root/.ssh/github-actions
```

### 3. Configure GitHub Secrets

Go to your GitHub repository:
1. Navigate to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add these secrets:

| Secret Name | Value | Description |
|------------|-------|-------------|
| `PROXMOX_HOST` | Your LXC IP address | e.g., `192.168.1.100` |
| `PROXMOX_USER` | `root` | SSH username |
| `PROXMOX_SSH_KEY` | Private key content | Paste entire content from `/root/.ssh/github-actions` |

**Example for PROXMOX_SSH_KEY:**
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
...entire key content...
-----END OPENSSH PRIVATE KEY-----
```

### 4. Initialize Git Repository on Proxmox

On your Proxmox LXC:

```bash
cd /opt/johnai-predictions

# Initialize git
git init

# Add remote (use your actual GitHub repo URL)
git remote add origin https://github.com/YOUR_USERNAME/johnai-predictions.git

# Set up credentials (one-time)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Pull initial code
git branch -M main
git pull origin main
```

### 5. Test the Pipeline

#### Option A: Push a change
```powershell
# On your Windows machine
cd C:\Users\jfost\johnai-predictions

# Make a small change
echo "# Test change" >> README.md

# Commit and push
git add .
git commit -m "Test CI/CD pipeline"
git push origin main
```

#### Option B: Manual trigger
1. Go to GitHub → **Actions** tab
2. Click **Deploy to Proxmox** workflow
3. Click **Run workflow** → **Run workflow**

### 6. Monitor Deployment

1. Go to GitHub → **Actions** tab
2. Click on the running workflow
3. Watch the deployment steps in real-time
4. Check your app: https://predictions.johnfoster.cloud

## Deployment Process

When you push to `main`, the following happens automatically:

```
1. GitHub receives push
   ↓
2. Run tests workflow
   - Install dependencies
   - Build application
   - Verify no errors
   ↓
3. Run deploy workflow (if tests pass)
   - SSH into Proxmox LXC
   - Pull latest code (git pull)
   - Rebuild containers (docker compose build)
   - Restart services (docker compose up -d)
   - Verify containers are running
   ↓
4. Deployment complete!
   - Your app is updated
   - Cloudflare Tunnel serves new version
```

## Troubleshooting

### SSH Connection Failed

Check SSH connectivity:
```bash
# On Windows, test SSH connection
ssh -i path\to\private-key root@<PROXMOX_LXC_IP>
```

If it fails:
- Verify IP address is correct
- Check firewall allows port 22
- Verify SSH key was added to `authorized_keys`
- Ensure private key format is correct in GitHub secrets

### Git Pull Failed

On Proxmox LXC:
```bash
cd /opt/johnai-predictions

# Check git status
git status

# If there are local changes, stash them
git stash

# Pull again
git pull origin main
```

### Docker Build Failed

On Proxmox LXC:
```bash
cd /opt/johnai-predictions

# Check logs
docker compose logs

# Manual rebuild
docker compose --profile tunnel up -d --build

# Check container status
docker compose ps
```

### View Deployment Logs

On Proxmox LXC:
```bash
# View all container logs
docker compose logs -f

# View specific service
docker compose logs -f johnai-predictions
docker compose logs -f cloudflared
```

## Advanced Configuration

### Add Environment-Specific Deployments

Create separate workflows for staging and production:

```yaml
# .github/workflows/deploy-staging.yml
on:
  push:
    branches:
      - develop
```

### Add Slack/Discord Notifications

Add to deploy workflow:
```yaml
- name: Notify Slack
  if: always()
  uses: slackapi/slack-github-action@v1.24.0
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK }}
    payload: |
      {
        "text": "Deployment ${{ job.status }}: ${{ github.repository }}"
      }
```

### Add Database Migrations

Add migration step before restarting:
```yaml
script: |
  cd /opt/johnai-predictions
  git pull origin main
  
  # Run migrations (if you add a migration system)
  docker compose exec -T postgres psql -U postgres -d postgres < migrations/new_migration.sql
  
  docker compose --profile tunnel up -d --build
```

### Rollback Strategy

Create a rollback workflow:
```yaml
# .github/workflows/rollback.yml
name: Rollback Deployment

on:
  workflow_dispatch:
    inputs:
      commit:
        description: 'Commit SHA to rollback to'
        required: true

jobs:
  rollback:
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.PROXMOX_HOST }}
          username: ${{ secrets.PROXMOX_USER }}
          key: ${{ secrets.PROXMOX_SSH_KEY }}
          script: |
            cd /opt/johnai-predictions
            git reset --hard ${{ github.event.inputs.commit }}
            docker compose --profile tunnel up -d --build
```

## Security Best Practices

1. **Never commit `.env` files** - Already in `.gitignore`
2. **Use GitHub Secrets** for sensitive data
3. **Restrict SSH access** - Use key-based auth only
4. **Keep dependencies updated** - Regularly run `npm update`
5. **Monitor deployments** - Check logs after each deployment
6. **Use branch protection** - Require PR reviews for main branch

## Workflow Benefits

✅ **Automated deployments** - Push code, it deploys automatically
✅ **Consistent builds** - Same process every time
✅ **Easy rollbacks** - Git history = deployment history
✅ **Testing before deploy** - Catch errors before production
✅ **Deployment history** - See all deployments in GitHub Actions
✅ **Manual control** - Can trigger deployments manually if needed

## Next Steps

1. Set up the GitHub repository and secrets
2. Test with a small change
3. Consider adding:
   - Automated tests (vitest)
   - Database migrations
   - Staging environment
   - Slack/Discord notifications
   - Health checks after deployment
