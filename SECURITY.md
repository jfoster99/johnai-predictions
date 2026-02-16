# Security Documentation

## ✅ Implemented Security Measures

### Phase 1: Critical Vulnerabilities (COMPLETED)

#### 1.1 Admin Password Protection
- **Issue**: Hardcoded admin password `'johnai'` in source code
- **Fix**: Admin password now uses environment variable `VITE_ADMIN_PASSWORD`
- **Location**: `src/pages/Admin.tsx`
- **Configuration**: Set `VITE_ADMIN_PASSWORD` in `.env` file (see `.env.example`)

#### 1.2 Database Password Security
- **Issue**: Hardcoded PostgreSQL password `'postgres'` in docker-compose.yml
- **Fix**: PostgreSQL password now uses environment variable `POSTGRES_PASSWORD`
- **Locations**: 
  - `docker-compose.yml` (postgres, rest, meta services)
- **Configuration**: Set `POSTGRES_PASSWORD` in `.env` file

#### 1.3 JWT Secret Security
- **Issue**: Hardcoded JWT secret in docker-compose.yml
- **Fix**: JWT secret now uses environment variable `JWT_SECRET`
- **Location**: `docker-compose.yml` (rest service)
- **Configuration**: Set `JWT_SECRET` (minimum 32 characters) in `.env` file

#### 1.4 Supabase Keys Protection
- **Issue**: Hardcoded demo keys in docker-compose.yml
- **Fix**: Keys now use environment variables with secure defaults
- **Variables**: 
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_KEY`
- **Configuration**: Set in `.env` file for production

#### 1.5 NPM Dependency Vulnerabilities
- **Fixed**: 
  - ✅ React Router XSS vulnerability (updated to 6.30.3+)
  - ✅ glob command injection (updated to 11.x)
  - ✅ lodash prototype pollution (updated to 4.17.21+)
  - ✅ js-yaml prototype pollution (updated to 4.1.0+)
- **Remaining**: esbuild/vite (requires breaking changes, low risk in production)
- **Action**: Run `npm audit` periodically and `npm audit fix` for updates

### Phase 2: Database Security (COMPLETED)

#### 2.1 Row Level Security (RLS) Policies
- **Status**: ✅ Implemented comprehensive RLS policies
- **Migration**: `supabase/migrations/20260216_security_fix.sql`
- **Changes**:
  - All direct UPDATE/DELETE operations blocked via `USING (false)`
  - SELECT operations remain public for leaderboard/market data
  - INSERT operations restricted to appropriate contexts

#### 2.2 Secure Server-Side Functions
- **Status**: ✅ All mutations now go through SECURITY DEFINER functions
- **Migration**: `supabase/migrations/20260216_secure_functions.sql`
- **Functions**:
  - `execute_trade()` - Validates and executes trades atomically
  - `update_user_balance()` - Validates balance updates (no negative balances)
  - `resolve_market()` - Only market creator can resolve
  - `play_slots()` - Atomic slot machine gameplay

#### 2.3 Input Validation
- **Status**: ✅ Comprehensive validation added
- **Validations**:
  - Shares: 1 to 1,000,000 maximum
  - Price: 0 to 100 range enforced
  - Bet amount: 1 to 1,000 maximum
  - Balance: Cannot be negative
  - Side: Must be 'yes' or 'no'
  - UUIDs: Null checks on all required IDs

#### 2.4 Authorization Checks
- **Status**: ✅ Implemented in secure functions
- **Admin Operations**:
  - Market resolution: Only creator can resolve via `resolve_market()`
  - Balance updates: Go through validated `update_user_balance()` function
  - All operations logged in trades/positions tables

### Phase 3: API & Network Security (COMPLETED)

#### 3.1 CORS Restrictions
- **Issue**: Wildcard CORS (`origins: ["*"]`) allowed any domain
- **Fix**: Restricted to specific domains in `kong.yml`
- **Configuration**: Add your production domain to the origins list
- **Default**: localhost:3000, 127.0.0.1:3000
- **Production**: Update to your Cloudflare/custom domain

#### 3.2 Port Exposure Reduction
- **Removed from public access**:
  - ❌ Port 5432 (PostgreSQL) - Database no longer exposed to host
  - ❌ Port 3001 (Supabase Studio) - Studio no longer exposed to host
- **Remaining public ports**:
  - ✅ Port 3000 (Application) - Frontend access
  - ✅ Port 8000 (Kong Gateway) - API access
- **Access Studio**: Use SSH tunnel if needed: `ssh -L 3001:localhost:3000 user@host`

#### 3.3 Rate Limiting
- **Status**: ✅ Implemented in Kong API Gateway
- **Configuration**: `kong.yml`
- **Limits**:
  - 60 requests per minute per client
  - 1,000 requests per hour per client
- **Policy**: Local (per Kong instance)
- **Fault Tolerant**: Yes (allows traffic if Redis unavailable)

#### 3.4 Request Size Validation
- **Status**: ✅ Implemented in Kong API Gateway
- **Configuration**: `kong.yml`
- **Limit**: 1 MB maximum payload size
- **Protection**: Prevents large request DoS attacks

## 🔧 Configuration Required

### Production Deployment Checklist

1. **Create `.env` file** (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

2. **Set secure passwords**:
   ```env
   VITE_ADMIN_PASSWORD=<generate-secure-password>
   POSTGRES_PASSWORD=<generate-secure-password>
   JWT_SECRET=<generate-32+-character-secret>
   ```

3. **Update CORS origins** in `kong.yml`:
   ```yaml
   origins:
     - "https://your-production-domain.com"
   ```

4. **Generate secure keys** (optional, defaults provided for local dev):
   - Visit https://supabase.com/dashboard for production keys
   - Or use the provided demo keys for development

5. **Review and update** GitHub Actions secrets:
   - `SSH_PRIVATE_KEY`
   - `DEPLOY_USER`
   - `APP_CONTAINER_IP`

## 🚨 Known Remaining Issues

### Low Priority
1. **esbuild/vite vulnerability** (moderate severity)
   - Affects development server only
   - Not exploitable in production build
   - Requires breaking Vite upgrade (v7.x)
   - Action: Monitor for stable Vite v7 release

### Administrative
1. **Admin authentication** uses simple password check
   - Consider implementing proper auth (OAuth, JWT, etc.)
   - Current: Session storage only
   - Recommended: Server-side session with httpOnly cookies

2. **Cloudflare Tunnel token** in docker-compose
   - Currently uses environment variable ✅
   - Consider rotating token periodically

## 📊 Security Testing

### Test Database Security
```bash
# Should FAIL - trying to update balance directly
curl -X PATCH http://localhost:8000/rest/v1/users?id=eq.USER_ID \
  -H "Content-Type: application/json" \
  -d '{"balance": 999999}'

# Should SUCCEED - using secure function
curl -X POST http://localhost:8000/rest/v1/rpc/update_user_balance \
  -H "Content-Type: application/json" \
  -d '{"user_id_param": "USER_ID", "new_balance": 10000}'
```

### Test Rate Limiting
```bash
# Send 100 requests rapidly - should start getting 429 responses
for i in {1..100}; do
  curl http://localhost:8000/rest/v1/markets
done
```

### Test Request Size Limiting
```bash
# Should FAIL - payload too large (>1MB)
curl -X POST http://localhost:8000/rest/v1/markets \
  -H "Content-Type: application/json" \
  -d @large-payload.json
```

## 📝 Audit Log

| Date | Change | Author | Status |
|------|--------|--------|--------|
| 2026-02-16 | Comprehensive security audit and remediation | System | ✅ Complete |
| 2026-02-16 | RLS policies and secure functions | System | ✅ Complete |
| 2026-02-16 | Environment variable migration | System | ✅ Complete |
| 2026-02-16 | Network security hardening | System | ✅ Complete |

## 🔐 Best Practices Going Forward

1. **Never commit `.env` file** - It's in `.gitignore`, keep it there
2. **Rotate secrets periodically** - Especially admin password and JWT secret
3. **Monitor npm audit** - Run weekly and apply fixes
4. **Review RLS policies** - When adding new tables/features
5. **Test security changes** - Before deploying to production
6. **Keep dependencies updated** - Use `npm update` regularly
7. **Monitor logs** - Watch for unusual patterns or attacks
8. **Backup database** - Regular backups of production data

## 📞 Security Contact

For security issues, contact the development team immediately. Do not publicly disclose vulnerabilities until they are patched.
