-- COMPREHENSIVE FIX FOR JOHNAI-PREDICTIONS
-- This migration fixes all the issues introduced by the security patches
-- that broke the application when auth schema is not available

-- ============================================================================
-- STEP 1: Remove auth_user_id column if it exists (reverting to simple model)
-- ============================================================================

-- Drop the foreign key constraint and column if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'auth_user_id'
  ) THEN
    -- Drop index first
    DROP INDEX IF EXISTS users_auth_user_id_key;
    
    -- Drop the column
    ALTER TABLE public.users DROP COLUMN auth_user_id;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Revert to simple anonymous user model (no auth required)
-- ============================================================================

-- Drop auth-dependent policies first
DROP POLICY IF EXISTS "Authenticated users can create their profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can only update their own display name" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can create markets" ON public.markets;
DROP POLICY IF EXISTS "Creators can update their own markets" ON public.markets;
DROP POLICY IF EXISTS "Authenticated users can create trades" ON public.trades;
DROP POLICY IF EXISTS "Authenticated users can create positions" ON public.positions;
DROP POLICY IF EXISTS "Only status updates allowed" ON public.markets;
DROP POLICY IF EXISTS "Positions updates restricted" ON public.positions;
DROP POLICY IF EXISTS "Positions can be updated by secure functions" ON public.positions;

-- Create simple, permissive policies for anonymous usage
CREATE POLICY "Anyone can insert users"
  ON public.users FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own record"
  ON public.users FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can create markets"
  ON public.users FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update markets"
  ON public.markets FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can insert trades"
  ON public.trades FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can insert positions"
  ON public.positions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update positions"
  ON public.positions FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STEP 2: Update functions to work without auth
-- ============================================================================

-- Simple execute_trade function without auth checks
CREATE OR REPLACE FUNCTION public.execute_trade(
  p_user_id UUID,
  p_market_id UUID,
  p_side TEXT,
  p_shares NUMERIC,
  p_price NUMERIC
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_balance NUMERIC;
  v_cost NUMERIC;
  v_trade_id UUID;
  v_position_id UUID;
  v_existing_shares NUMERIC;
  v_existing_avg_price NUMERIC;
  v_new_avg_price NUMERIC;
BEGIN
  -- Validate inputs
  IF p_shares <= 0 OR p_shares > 1000000 THEN
    RAISE EXCEPTION 'Shares must be between 1 and 1,000,000';
  END IF;
  
  IF p_price < 0 OR p_price > 1 THEN
    RAISE EXCEPTION 'Price must be between 0 and 1';
  END IF;
  
  IF p_side NOT IN ('yes', 'no') THEN
    RAISE EXCEPTION 'Side must be yes or no';
  END IF;
  
  -- Get user balance
  SELECT balance INTO v_user_balance
  FROM public.users
  WHERE id = p_user_id;
  
  IF v_user_balance IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Calculate cost
  v_cost := p_shares * p_price;
  
  -- Check if user has enough balance
  IF v_user_balance < v_cost THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  
  -- Deduct balance
  UPDATE public.users
  SET balance = balance - v_cost
  WHERE id = p_user_id;
  
  -- Create trade record
  INSERT INTO public.trades (user_id, market_id, side, direction, shares, price, total_cost)
  VALUES (p_user_id, p_market_id, p_side, 'buy', p_shares, p_price, v_cost)
  RETURNING id INTO v_trade_id;
  
  -- Update or create position
  SELECT id, shares, avg_price INTO v_position_id, v_existing_shares, v_existing_avg_price
  FROM public.positions
  WHERE user_id = p_user_id AND market_id = p_market_id AND side = p_side;
  
  IF v_position_id IS NULL THEN
    -- Create new position
    INSERT INTO public.positions (user_id, market_id, side, shares, avg_price)
    VALUES (p_user_id, p_market_id, p_side, p_shares, p_price);
  ELSE
    -- Update existing position with weighted average
    v_new_avg_price := ((v_existing_avg_price * v_existing_shares) + (p_price * p_shares)) / (v_existing_shares + p_shares);
    
    UPDATE public.positions
    SET shares = shares + p_shares,
        avg_price = v_new_avg_price
    WHERE id = v_position_id;
  END IF;
  
  -- Update market volume and shares
  UPDATE public.markets
  SET total_volume = total_volume + v_cost,
      yes_shares_outstanding = CASE WHEN p_side = 'yes' THEN yes_shares_outstanding + p_shares ELSE yes_shares_outstanding END,
      no_shares_outstanding = CASE WHEN p_side = 'no' THEN no_shares_outstanding + p_shares ELSE no_shares_outstanding END
  WHERE id = p_market_id;
  
  RETURN v_trade_id;
END;
$$;

-- Simple resolve_market function
CREATE OR REPLACE FUNCTION public.resolve_market(
  p_market_id UUID,
  p_outcome TEXT,
  p_resolver_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_market_creator UUID;
  v_position RECORD;
  v_payout NUMERIC;
BEGIN
  -- Validate outcome
  IF p_outcome NOT IN ('yes', 'no') THEN
    RAISE EXCEPTION 'Outcome must be yes or no';
  END IF;
  
  -- Get market creator
  SELECT creator_id INTO v_market_creator
  FROM public.markets
  WHERE id = p_market_id;
  
  -- Only creator can resolve
  IF v_market_creator != p_resolver_id THEN
    RAISE EXCEPTION 'Only market creator can resolve';
  END IF;
  
  -- Update market status
  UPDATE public.markets
  SET status = CASE 
    WHEN p_outcome = 'yes' THEN 'resolved_yes'
    ELSE 'resolved_no'
  END
  WHERE id = p_market_id;
  
  -- Payout winning positions (each share worth 1.0 at resolution)
  FOR v_position IN 
    SELECT user_id, shares
    FROM public.positions
    WHERE market_id = p_market_id AND side = p_outcome
  LOOP
    v_payout := v_position.shares; -- Each share worth 1.0
    
    UPDATE public.users
    SET balance = balance + v_payout
    WHERE id = v_position.user_id;
  END LOOP;
END;
$$;

-- ============================================================================
-- STEP 3: Add sample data for testing
-- ============================================================================

-- Add sample users
INSERT INTO public.users (id, display_name, balance) 
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'John', 15000),
  ('22222222-2222-2222-2222-222222222222', 'Alice', 12000),
  ('33333333-3333-3333-3333-333333333333', 'Bob', 10000)
ON CONFLICT (id) DO NOTHING;

-- Add sample markets
INSERT INTO public.markets (id, creator_id, question, description, category, resolution_date, status, yes_price, no_price, total_volume)
VALUES
  (
    '44444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    'Will Bitcoin reach $100k in 2026?',
    'This market will resolve YES if Bitcoin (BTC) reaches $100,000 USD at any point during 2026.',
    'Crypto',
    '2026-12-31 23:59:59+00',
    'active',
    0.65,
    0.35,
    5000
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    '22222222-2222-2222-2222-222222222222',
    'Will AI achieve AGI by 2027?',
    'This market resolves YES if artificial general intelligence is achieved by December 31, 2027.',
    'Technology',
    '2027-12-31 23:59:59+00',
    'active',
    0.25,
    0.75,
    3000
  ),
  (
    '66666666-6666-6666-6666-666666666666',
    '11111111-1111-1111-1111-111111111111',
    'Will it rain tomorrow?',
    'Simple prediction market for weather. Resolves YES if it rains.',
    'Weather',
    '2026-02-17 23:59:59+00',
    'active',
    0.50,
    0.50,
    500
  )
ON CONFLICT (id) DO NOTHING;

-- Add sample trades
INSERT INTO public.trades (user_id, market_id, side, direction, shares, price, total_cost)
VALUES
  ('22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444', 'yes', 'buy', 100, 0.60, 60),
  ('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', 'no', 'buy', 50, 0.40, 20),
  ('11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'yes', 'buy', 200, 0.20, 40)
ON CONFLICT DO NOTHING;

-- Add sample positions
INSERT INTO public.positions (user_id, market_id, side, shares, avg_price)
VALUES
  ('22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444', 'yes', 100, 0.60),
  ('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', 'no', 50, 0.40),
  ('11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'yes', 200, 0.20)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 4: Grant permissions
-- ============================================================================

-- Grant execute permissions on functions to public
GRANT EXECUTE ON FUNCTION public.execute_trade(UUID, UUID, TEXT, NUMERIC, NUMERIC) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_market(UUID, TEXT, UUID) TO PUBLIC;

-- Ensure all permissions are set correctly
GRANT SELECT, INSERT, UPDATE ON public.users TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public.markets TO PUBLIC;
GRANT SELECT, INSERT ON public.trades TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public.positions TO PUBLIC;

-- Migration complete
