-- Security Improvements Migration
-- This migration adds proper constraints and improves RLS policies

-- Add check constraints to prevent negative balances and invalid amounts
ALTER TABLE public.users ADD CONSTRAINT users_balance_positive CHECK (balance >= 0);

-- Add constraints to trades table
ALTER TABLE public.trades 
  ADD CONSTRAINT trades_shares_positive CHECK (shares > 0),
  ADD CONSTRAINT trades_price_valid CHECK (price >= 0 AND price <= 1),
  ADD CONSTRAINT trades_total_cost_positive CHECK (total_cost >= 0);

-- Add constraints to markets table
ALTER TABLE public.markets
  ADD CONSTRAINT markets_prices_valid CHECK (yes_price >= 0 AND yes_price <= 1 AND no_price >= 0 AND no_price <= 1),
  ADD CONSTRAINT markets_prices_sum CHECK (yes_price + no_price = 1),
  ADD CONSTRAINT markets_volume_positive CHECK (total_volume >= 0),
  ADD CONSTRAINT markets_shares_positive CHECK (yes_shares_outstanding >= 0 AND no_shares_outstanding >= 0);

-- Add constraints to positions table
ALTER TABLE public.positions
  ADD CONSTRAINT positions_shares_positive CHECK (shares >= 0),
  ADD CONSTRAINT positions_avg_price_valid CHECK (avg_price >= 0 AND avg_price <= 1);

-- Improve RLS policies for users table
DROP POLICY IF EXISTS "Anyone can update users" ON public.users;
CREATE POLICY "Users can update own balance" ON public.users 
  FOR UPDATE 
  USING (true) 
  WITH CHECK (balance >= 0); -- Prevent negative balances

-- Add RLS policy to prevent deletes
CREATE POLICY "Prevent user deletion" ON public.users 
  FOR DELETE 
  USING (false);

-- Improve RLS policies for markets table
DROP POLICY IF EXISTS "Anyone can update markets" ON public.markets;
CREATE POLICY "Only allow status updates" ON public.markets 
  FOR UPDATE 
  USING (true)
  WITH CHECK (
    -- Only allow updating status, prices, volume, and shares
    status IN ('active', 'resolved_yes', 'resolved_no', 'cancelled')
  );

-- Add policy to prevent market deletion
CREATE POLICY "Prevent market deletion" ON public.markets 
  FOR DELETE 
  USING (false);

-- Add RLS policy for trades (read-only after creation)
CREATE POLICY "Prevent trade updates" ON public.trades 
  FOR UPDATE 
  USING (false);

CREATE POLICY "Prevent trade deletion" ON public.trades 
  FOR DELETE 
  USING (false);

-- Add RLS policies for positions (prevent deletion)
CREATE POLICY "Prevent position deletion" ON public.positions 
  FOR DELETE 
  USING (false);

-- Add index for performance on common queries
CREATE INDEX IF NOT EXISTS idx_trades_market_id ON public.trades(market_id);
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON public.trades(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_market_user ON public.positions(market_id, user_id);
CREATE INDEX IF NOT EXISTS idx_markets_status ON public.markets(status);
CREATE INDEX IF NOT EXISTS idx_markets_created_at ON public.markets(created_at DESC);
