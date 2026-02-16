# Authentication Restoration Guide

This guide explains the changes made to restore proper user authentication with email and password.

## What Changed

### Before
- Users signed up with just a username (no password)
- User ID stored in localStorage
- No real authentication
- Permissive database policies allowed anyone to perform any operation

### After
- Users sign up with email, username, and password
- Proper authentication via Supabase Auth (GoTrue)
- JWT-based session management
- Secure database policies requiring authentication
- All database functions verify user ownership

## Frontend Changes

### 1. AuthModal Component
- Added Login/Signup tabs
- Email field for authentication
- Password field (minimum 6 characters)
- Username field for signup
- Proper error handling

### 2. UserContext
- `signUp(email, password, displayName)` - Creates account via Supabase Auth
- `signIn(email, password)` - Authenticates user
- `signOut()` - Signs out user
- Auto-loads user profile from database using `auth_user_id`
- Listens to auth state changes for session management

## Database Changes

### 1. Migration: 20260217_restore_authentication.sql

**Schema Changes:**
- Added `auth_user_id` column to `users` table
- Links to `auth.users(id)` with CASCADE delete
- Unique constraint on `auth_user_id`

**RLS Policies:**
- Users can only read all users (for leaderboard)
- Users can only update their own profile
- Service role can insert users (for trigger)
- Markets require authentication to create
- Trades require authentication and user ownership
- Positions require authentication and user ownership

**Function Updates:**
All functions now verify authentication:
- `execute_trade()` - Checks auth.uid() and user ownership
- `resolve_market()` - Checks auth.uid() and creator ownership
- `play_slots()` - Checks auth.uid() and user ownership
- `admin_grant_johnbucks()` - Checks auth.uid() and admin role
- `update_user_balance()` - Checks auth.uid() and ownership/admin

**Trigger:**
- `handle_new_user()` - Auto-creates user profile on signup
- Grants 10,000 JohnBucks starting balance
- Uses display_name from metadata or email prefix

## Deployment Instructions

### Step 1: Update Environment Variables

Create or update `.env` file with correct Supabase URL:

```bash
# Local development
VITE_SUPABASE_URL=http://localhost:8000

# Production
VITE_SUPABASE_URL=https://your-domain.com

# Use a secure key for production
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here
```

### Step 2: Apply Database Migration

```bash
# SSH into production server
ssh deploy@<APP_CONTAINER_IP>

# Navigate to app directory
cd /opt/johnai-predictions

# Pull latest changes
git pull origin main

# Apply the migration
docker exec -i johnai-postgres psql -U postgres -d postgres < supabase/migrations/20260217_restore_authentication.sql

# Verify migration
docker exec -i johnai-postgres psql -U postgres -d postgres -c "\d users"
# Should show auth_user_id column

docker exec -i johnai-postgres psql -U postgres -d postgres -c "\df public.execute_trade"
# Should show updated function
```

### Step 3: Rebuild and Restart Services

```bash
# Rebuild the application with new code
docker compose down
docker compose build --no-cache johnai-predictions
docker compose up -d

# Verify all services are running
docker compose ps

# Check logs for errors
docker compose logs --tail=50 johnai-predictions
docker compose logs --tail=50 auth
```

### Step 4: Test Authentication

1. **Access the application** at https://your-domain.com
2. **Click "Login/Sign Up"** button
3. **Create a new account:**
   - Email: test@example.com
   - Username: testuser
   - Password: test123456
4. **Verify account creation:**
   - Should redirect to homepage
   - Should show username in navbar
   - Should have 10,000 JohnBucks balance
5. **Test logout and login:**
   - Click logout
   - Login with same credentials
   - Should restore session

### Step 5: Verify Database

```bash
# Check users table
docker exec -i johnai-postgres psql -U postgres -d postgres -c "
SELECT id, display_name, balance, auth_user_id IS NOT NULL as has_auth 
FROM users 
ORDER BY created_at DESC 
LIMIT 5;"

# Check auth.users table
docker exec -i johnai-postgres psql -U postgres -d postgres -c "
SELECT id, email, created_at 
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;"

# Verify trigger works
docker exec -i johnai-postgres psql -U postgres -d postgres -c "
SELECT COUNT(*) as user_count, COUNT(auth_user_id) as auth_linked
FROM users;"
```

## Security Improvements

### Before (Insecure)
```sql
-- Anyone could create users
CREATE POLICY "Anyone can insert users" ON users FOR INSERT WITH CHECK (true);

-- Anyone could trade for any user
-- No authentication checks in execute_trade()
```

### After (Secure)
```sql
-- Only authenticated users can perform operations
CREATE POLICY "Authenticated users can create trades" 
  ON trades FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users WHERE id = user_id AND auth_user_id = auth.uid()
  ));

-- Functions verify authentication
IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Authentication required';
END IF;

-- Functions verify ownership
IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id AND auth_user_id = auth.uid()) THEN
  RAISE EXCEPTION 'Unauthorized: Cannot trade for another user';
END IF;
```

## Migration from Old System

### Existing Users (Username-only)
Existing users who signed up with just a username will need to:
1. Create a new account with email and password
2. Their old account will remain in the database but won't be accessible
3. Consider adding a migration step to let users claim their old accounts

### Migration Script (Optional)
If you want to preserve old usernames:

```sql
-- Add a migration to link existing users to new auth accounts
-- This is complex and requires careful planning
-- Contact the development team for assistance
```

## Troubleshooting

### Issue: "Authentication required" errors
**Solution:** Make sure JWT_SECRET in docker-compose.yml matches across all services (auth, rest, kong)

### Issue: Users can't sign up
**Solution:** 
1. Check if GOTRUE_DISABLE_SIGNUP is set to false
2. Verify auth service is running: `docker compose ps auth`
3. Check auth logs: `docker compose logs auth`

### Issue: Trigger not creating user profiles
**Solution:**
1. Verify trigger exists: `\df public.handle_new_user`
2. Check trigger is attached: `SELECT * FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created';`
3. Manually test trigger by inserting into auth.users

### Issue: Can't access existing markets/trades
**Solution:** This is expected - old data without auth_user_id won't be accessible. Either:
1. Re-create test data with authenticated users
2. Add a migration to link old data to new auth accounts

## Rollback Plan

If issues occur:

```bash
# Rollback Step 1: Revert code changes
cd /opt/johnai-predictions
git checkout HEAD~1

# Rollback Step 2: Revert migration (CAUTION: May lose data)
docker exec -i johnai-postgres psql -U postgres -d postgres <<EOF
-- Drop new column
ALTER TABLE public.users DROP COLUMN IF EXISTS auth_user_id;

-- Restore permissive policies
DROP POLICY IF EXISTS "Authenticated users can create trades" ON trades;
CREATE POLICY "Anyone can insert trades" ON trades FOR INSERT WITH CHECK (true);
-- Repeat for all policies...
EOF

# Rollback Step 3: Restart services
docker compose restart
```

## Support

For issues or questions:
1. Check logs: `docker compose logs -f`
2. Verify auth service: `docker compose ps auth`
3. Test JWT: Use browser dev tools to check Authorization header
4. Contact development team with error messages

## Success Criteria

- ✅ Users can sign up with email and password
- ✅ Users can log in with credentials
- ✅ Sessions persist across page refreshes
- ✅ Users can only perform actions on their own behalf
- ✅ Admin functions require admin role
- ✅ Database functions verify authentication
- ✅ No security vulnerabilities detected
- ✅ Build and tests pass
