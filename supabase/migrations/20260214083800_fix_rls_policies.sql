-- Migration to fix RLS policies and improve security
-- This migration tightens Row Level Security policies to prevent unauthorized access
--
-- SECURITY MODEL LIMITATIONS:
-- This application uses localStorage-based authentication where user_id is stored
-- client-side and sent with requests. There is no JWT token with cryptographic proof
-- of identity, so RLS policies cannot use auth.uid() for verification.
--
-- WHAT THESE POLICIES PROTECT AGAINST:
-- ✓ Direct balance manipulation via API (balance field cannot be changed)
-- ✓ Market resolution via public API (markets can only be resolved via admin panel)
-- ✓ NULL user_id in positions (ensures user_id is always set)
--
-- WHAT THESE POLICIES DO NOT FULLY PROTECT AGAINST:
-- ✗ A malicious user modifying requests to impersonate other users
-- ✗ Cross-user data manipulation with forged user_id values
--
-- RECOMMENDED PRODUCTION IMPROVEMENTS:
-- 1. Implement Supabase Auth with JWT tokens
-- 2. Update RLS policies to use auth.uid() instead of client-provided user_id
-- 3. Move critical operations (balance updates, trades) to server-side Cloud Functions
-- 4. Use service_role key only in backend functions, never in client
--
-- Despite these limitations, these policies are a MAJOR improvement over the previous
-- policies that used USING (true) for updates, which allowed ANYONE to change ANYTHING.

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can update users" ON public.users;
DROP POLICY IF EXISTS "Anyone can update markets" ON public.markets;
DROP POLICY IF EXISTS "Anyone can update positions" ON public.positions;

-- Users table: Prevent direct balance manipulation
-- Users can only update their display_name, not their balance
-- Balance updates should only happen through controlled trading operations
--
-- NOTE: This application uses localStorage-based authentication without JWT tokens,
-- so we cannot use auth.uid() to verify identity. The user_id is client-controlled.
-- This policy prevents direct balance changes but does not prevent a malicious user
-- from updating another user's display_name. For full security, proper JWT-based
-- authentication with Supabase Auth should be implemented.
CREATE POLICY "Users can update own display name" ON public.users 
  FOR UPDATE 
  USING (true)
  WITH CHECK (
    -- Allow updates only if balance is not being changed
    -- This requires checking that the new balance equals the old balance
    balance = (SELECT balance FROM public.users WHERE id = users.id)
  );

-- Markets table: Only allow reading and creating
-- Market updates (especially status changes) should only be done by admins
-- Remove the overly permissive update policy
CREATE POLICY "Markets can only be created" ON public.markets 
  FOR UPDATE 
  USING (false); -- Prevent all updates via API

-- Positions table: More restrictive updates
-- Users should only be able to update positions that belong to them
--
-- NOTE: Due to localStorage-based auth, we cannot verify user identity cryptographically.
-- This policy ensures user_id is set but cannot prevent a malicious user from
-- setting another user's user_id. The application logic must validate trades server-side.
-- For production security, move position updates to server-side Cloud Functions that
-- validate the authenticated user before making changes.
CREATE POLICY "Users can update own positions" ON public.positions 
  FOR UPDATE 
  USING (true)
  WITH CHECK (
    -- Verify the user_id is set (weak validation due to client-controlled auth)
    -- This prevents NULL user_id but doesn't prevent cross-user manipulation
    user_id IS NOT NULL
  );

-- Add a comment explaining the security model
COMMENT ON TABLE public.users IS 'Users table with RLS enabled. Balance changes are restricted to prevent direct manipulation.';
COMMENT ON TABLE public.markets IS 'Markets table with RLS enabled. Status changes are restricted to prevent unauthorized resolution.';

-- Create an admin role marker column for users (for future use)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create an index on user balances for performance
CREATE INDEX IF NOT EXISTS idx_users_balance ON public.users(balance);
CREATE INDEX IF NOT EXISTS idx_markets_status ON public.markets(status);
CREATE INDEX IF NOT EXISTS idx_trades_user_market ON public.trades(user_id, market_id);
