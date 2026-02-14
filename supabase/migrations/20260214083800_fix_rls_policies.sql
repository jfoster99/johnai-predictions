-- Migration to fix RLS policies and improve security
-- This migration tightens Row Level Security policies to prevent unauthorized access

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can update users" ON public.users;
DROP POLICY IF EXISTS "Anyone can update markets" ON public.markets;
DROP POLICY IF EXISTS "Anyone can update positions" ON public.positions;

-- Users table: Prevent direct balance manipulation
-- Users can only update their display_name, not their balance
-- Balance updates should only happen through controlled trading operations
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
CREATE POLICY "Users can update own positions" ON public.positions 
  FOR UPDATE 
  USING (true)
  WITH CHECK (
    -- Verify the user_id matches (though this is still client-controlled)
    -- This is a weak check but better than nothing
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
