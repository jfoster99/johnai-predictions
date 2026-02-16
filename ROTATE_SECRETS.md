# Secret Rotation Guide

**Date:** 2026-02-16  
**Reason:** Credentials exposed in git history (commits prior to d2e67eb)

## Status

- [ ] Cloudflare Tunnel Token
- [ ] Postgres Password
- [ ] Admin Password
- [ ] Update GitHub Secrets
- [ ] Redeploy with new secrets
- [ ] Verify application works
- [ ] Update security audit documentation

---

## 1. Rotate Cloudflare Tunnel Token

**Risk Level:** 🔴 CRITICAL - Anyone with the token can route traffic through your tunnel

### Steps:

1. **Login to Cloudflare Dashboard**
   - Go to https://dash.cloudflare.com/
   - Navigate to **Zero Trust > Access > Tunnels**

2. **Delete Old Tunnel**
   - Find your existing tunnel (likely named "johnai-predictions" or similar)
   - Click **Delete** to completely remove it
   - This invalidates the old token immediately

3. **Create New Tunnel**
   ```bash
   # Or create via dashboard:
   # 1. Click "Create a tunnel"
   # 2. Choose "Cloudflared"
   # 3. Name: johnai-predictions-v2
   # 4. Copy the new tunnel token
   ```

4. **Update GitHub Secret**
   - Go to https://github.com/jfoster99/johnai-predictions/settings/secrets/actions
   - Click **CLOUDFLARE_TUNNEL_TOKEN**
   - Paste the new token
   - Save

5. **Configure Public Hostname**
   - In Cloudflare tunnel settings
   - Set hostname: `predictions.johnfoster.cloud`
   - Service: `http://johnai-kong:8000`

---

## 2. Rotate Postgres Password

**Risk Level:** 🟠 HIGH - Database access if port was ever exposed

### Steps:

1. **Generate New Password**
   ```powershell
   # Generate secure random password
   -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 20 | ForEach-Object {[char]$_})
   ```

2. **SSH to VM**
   ```powershell
   ssh predictions@192.168.100.117
   ```

3. **Change Postgres Password**
   ```bash
   # Connect to postgres container
   docker exec -it johnai-postgres psql -U postgres
   
   # Change password (replace YOUR_NEW_PASSWORD)
   ALTER USER postgres WITH PASSWORD 'YOUR_NEW_PASSWORD';
   
   # Verify
   \password postgres
   
   # Exit
   \q
   exit
   ```

4. **Update GitHub Secret**
   - Go to https://github.com/jfoster99/johnai-predictions/settings/secrets/actions
   - Click **POSTGRES_PASSWORD**
   - Paste the new password
   - Save

5. **Update Local .env** (for development)
   ```bash
   # Edit your local .env file
   POSTGRES_PASSWORD=YOUR_NEW_PASSWORD
   ```

---

## 3. Rotate Admin Password

**Risk Level:** 🟡 MEDIUM - Admin panel access only

### Steps:

1. **Generate New Password**
   ```powershell
   # Generate secure random password (minimum 8 characters)
   -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 16 | ForEach-Object {[char]$_})
   ```

2. **Update GitHub Secret**
   - Go to https://github.com/jfoster99/johnai-predictions/settings/secrets/actions
   - Click **VITE_ADMIN_PASSWORD**
   - Paste the new password
   - Save

3. **Update Local .env** (for development)
   ```bash
   # Edit your local .env file
   VITE_ADMIN_PASSWORD=YOUR_NEW_PASSWORD
   ```

---

## 4. Deploy with New Secrets

### Trigger Deployment:

**Option A: Make a small change to trigger deploy**
```powershell
cd C:\Users\jfost\johnai-predictions

# Add comment to force redeploy
git commit --allow-empty -m "Redeploy with rotated secrets"
git push johnai-predictions main
```

**Option B: Manual deployment**
```bash
ssh predictions@192.168.100.117
cd /opt/johnai-predictions

# Stop containers
docker compose --profile tunnel down

# Manually update .env with new values
nano .env

# Start containers
docker compose --profile tunnel up -d

# Verify
docker compose ps
docker logs johnai-cloudflared --tail 20
```

---

## 5. Verification Checklist

After deployment with new secrets:

- [ ] **Cloudflare Tunnel**: Check logs show "Connection registered"
  ```bash
  docker logs johnai-cloudflared --tail 50 | grep -i "registered\|connected"
  ```

- [ ] **Website Accessible**: Visit https://predictions.johnfoster.cloud
  - [ ] Homepage loads
  - [ ] Can create user account
  - [ ] Can view markets

- [ ] **Postgres Working**: Database queries succeed
  ```bash
  docker exec johnai-postgres psql -U postgres -d postgres -c "SELECT COUNT(*) FROM users;"
  ```

- [ ] **Admin Panel**: Test new password
  - [ ] Navigate to `/admin`
  - [ ] Login with new password
  - [ ] Can grant JohnBucks
  - [ ] Can resolve markets

- [ ] **All Containers Running**:
  ```bash
  docker compose ps
  # Expected: All containers should show "Up" status
  ```

---

## 6. Update Documentation

After successful rotation, update security docs:

1. **Update SECURITY_AUDIT_SUMMARY.md**
   - Add section: "Secret Rotation Completed"
   - Document date and reason

2. **Update VULNERABILITY_REPORT.md**
   - Note that exposed secrets were rotated
   - Mark git history issue as resolved

3. **Update .env.example** (if needed)
   - Ensure it contains only placeholders
   - No real values

---

## Timeline

| Task | Priority | Est. Time | Status |
|------|----------|-----------|--------|
| Rotate Cloudflare token | 🔴 Critical | 10 min | ⏳ Pending |
| Rotate Postgres password | 🟠 High | 5 min | ⏳ Pending |
| Rotate Admin password | 🟡 Medium | 2 min | ⏳ Pending |
| Update GitHub Secrets | 🟠 High | 5 min | ⏳ Pending |
| Redeploy application | 🟠 High | 5 min | ⏳ Pending |
| Verify functionality | 🟠 High | 10 min | ⏳ Pending |
| Update documentation | 🟢 Low | 5 min | ⏳ Pending |

**Total Time:** ~40 minutes

---

## Post-Rotation Security Posture

**Before Rotation:**
- ❌ Cloudflare tunnel token exposed in git history
- ❌ Postgres password exposed in git history
- ❌ Admin password exposed in git history
- ✅ Secrets removed from tracking
- ✅ GitHub Secrets configured

**After Rotation:**
- ✅ Old secrets are invalid (rotated)
- ✅ New secrets only in GitHub Secrets
- ✅ No valid credentials in git history
- ✅ Application using new credentials
- ✅ All functionality verified working

---

## Optional: Git History Cleanup

⚠️ **Note:** Rotating secrets is sufficient. History cleanup is optional and has tradeoffs.

### Tradeoffs:
- **Pros:** Removes .env file from all commits
- **Cons:** 
  - Breaks existing clones (requires force push)
  - Complex and error-prone
  - Doesn't help if anyone already cloned
  - GitHub keeps original commits for ~90 days

### If you still want to clean history:

```powershell
# Install BFG Repo Cleaner
# Download from: https://rtyley.github.io/bfg-repo-cleaner/

# Backup first
cd C:\Users\jfost
git clone --mirror https://github.com/jfoster99/johnai-predictions.git johnai-backup.git

# Remove .env from all history
java -jar bfg.jar --delete-files .env johnai-backup.git

cd johnai-backup.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (DESTRUCTIVE)
git push --force
```

**Recommendation:** Skip history cleanup. Just rotate secrets. It's simpler, safer, and achieves the same security goal.

---

## Questions?

- **Q: Do I need to clean git history if I rotate secrets?**
  - A: No. Rotating makes old secrets useless. That's sufficient.

- **Q: How urgent is the Cloudflare token rotation?**
  - A: URGENT. Anyone with the token can intercept/route your traffic.

- **Q: Will rotation break my local development?**
  - A: Only if you don't update your local `.env` file. Update it with new passwords.

- **Q: Should I make the repo private?**
  - A: Optional temporary mitigation while rotating. Not required after rotation.

---

**Next Steps:** Start with Cloudflare token rotation (most critical), then postgres, then admin password.
