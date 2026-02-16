-- Restore proper authentication with email and password
-- This migration adds back the auth integration that was removed

-- ============================================================================
-- STEP 1: Add auth_user_id column back to users table
-- ============================================================================

-- Add auth_user_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'auth_user_id'
  ) THEN
    ALTER TABLE public.users ADD COLUMN auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create unique index on auth_user_id
CREATE UNIQUE INDEX IF NOT EXISTS users_auth_user_id_key ON public.users(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- ============================================================================
-- STEP 2: Update RLS policies to require authentication for sensitive operations
-- ============================================================================

-- Drop permissive policies
DROP POLICY IF EXISTS "Anyone can insert users" ON public.users;
DROP POLICY IF EXISTS "Users can update their own record" ON public.users;

-- Create authenticated policies for users table
CREATE POLICY "Authenticated users can read all users"
  ON public.users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert users"
  ON public.users FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- Update market policies
DROP POLICY IF EXISTS "Anyone can create markets" ON public.markets;
DROP POLICY IF EXISTS "Anyone can update markets" ON public.markets;

CREATE POLICY "Authenticated users can create markets"
  ON public.markets FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Creators can update their markets"
  ON public.markets FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = creator_id AND auth_user_id = auth.uid()
  ));

-- Update trade policies
DROP POLICY IF EXISTS "Anyone can insert trades" ON public.trades;

CREATE POLICY "Authenticated users can create trades"
  ON public.trades FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users WHERE id = user_id AND auth_user_id = auth.uid()
  ));

-- Update position policies
DROP POLICY IF EXISTS "Anyone can insert positions" ON public.positions;
DROP POLICY IF EXISTS "Anyone can update positions" ON public.positions;

CREATE POLICY "Authenticated users can create positions"
  ON public.positions FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users WHERE id = user_id AND auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own positions"
  ON public.positions FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = user_id AND auth_user_id = auth.uid()
  ));

-- ============================================================================
-- STEP 3: Update functions to verify authentication
-- ============================================================================

-- Update execute_trade to verify authentication
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
  -- Verify authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Verify user ownership
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND auth_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Cannot trade for another user';
  END IF;

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

-- Update resolve_market to verify authentication
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
  -- Verify authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Verify resolver ownership
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_resolver_id AND auth_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Cannot resolve as another user';
  END IF;

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

-- Update play_slots to verify authentication
CREATE OR REPLACE FUNCTION public.play_slots(p_user_id UUID, p_bet_amount NUMERIC)
RETURNS TABLE (
  won BOOLEAN,
  payout NUMERIC,
  symbols TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance NUMERIC;
  v_win BOOLEAN;
  v_payout NUMERIC := 0;
  v_symbols TEXT[] := ARRAY[]::TEXT[];
  v_random INTEGER;
BEGIN
  -- Verify authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Verify user ownership
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND auth_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Cannot play slots for another user';
  END IF;

  -- Validate bet amount
  IF p_bet_amount < 1 OR p_bet_amount > 1000 THEN
    RAISE EXCEPTION 'Invalid bet: must be between 1 and 1,000';
  END IF;

  SELECT balance INTO v_balance FROM public.users WHERE id = p_user_id;

  IF v_balance < p_bet_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Deduct bet
  UPDATE public.users SET balance = balance - p_bet_amount WHERE id = p_user_id;

  -- Generate random result (simplified)
  v_random := floor(random() * 100)::INTEGER;

  IF v_random < 10 THEN  -- 10% chance to win
    v_win := TRUE;
    v_payout := p_bet_amount * 5;
    UPDATE public.users SET balance = balance + v_payout WHERE id = p_user_id;
  ELSE
    v_win := FALSE;
  END IF;

  v_symbols := ARRAY['🎰', '🎰', '🎰'];

  RETURN QUERY SELECT v_win, v_payout, v_symbols;
END;
$$;

-- Update admin_grant_johnbucks to verify authentication
CREATE OR REPLACE FUNCTION public.admin_grant_johnbucks(
  p_user_id UUID,
  p_amount NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Verify admin role
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Validate amount
  IF p_amount IS NULL OR NOT (p_amount >= 0 AND p_amount <= 1000000) THEN
    RAISE EXCEPTION 'Invalid amount: must be between 0 and 1,000,000';
  END IF;

  IF NOT (p_amount = FLOOR(p_amount)) THEN
    RAISE EXCEPTION 'Invalid amount: must be a whole number';
  END IF;

  -- Grant JohnBucks
  UPDATE public.users 
  SET balance = balance + p_amount 
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$;

-- Update update_user_balance to verify authentication
CREATE OR REPLACE FUNCTION public.update_user_balance(p_user_id UUID, p_amount NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Only allow users to update their own balance OR admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = p_user_id 
    AND (auth_user_id = auth.uid() OR auth.uid() IN (
      SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'
    ))
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify another users balance';
  END IF;

  -- Validate amount
  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'Invalid amount: must be non-negative';
  END IF;

  -- Update balance
  UPDATE public.users 
  SET balance = p_amount 
  WHERE id = p_user_id;
END;
$$;

-- ============================================================================
-- STEP 4: Create trigger to auto-create user profile on signup
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (auth_user_id, display_name, balance)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    10000
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STEP 5: Grant permissions
-- ============================================================================

-- Revoke public access to functions
REVOKE EXECUTE ON FUNCTION public.execute_trade(UUID, UUID, TEXT, NUMERIC, NUMERIC) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resolve_market(UUID, TEXT, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.play_slots(UUID, NUMERIC) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_grant_johnbucks(UUID, NUMERIC) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_user_balance(UUID, NUMERIC) FROM PUBLIC;

-- Grant to authenticated users only
GRANT EXECUTE ON FUNCTION public.execute_trade(UUID, UUID, TEXT, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_market(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.play_slots(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_johnbucks(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_balance(UUID, NUMERIC) TO authenticated;

-- Update table permissions
REVOKE ALL ON public.users FROM PUBLIC;
REVOKE ALL ON public.markets FROM PUBLIC;
REVOKE ALL ON public.trades FROM PUBLIC;
REVOKE ALL ON public.positions FROM PUBLIC;

GRANT SELECT ON public.users TO anon, authenticated;
GRANT SELECT ON public.markets TO anon, authenticated;
GRANT SELECT ON public.trades TO anon, authenticated;
GRANT SELECT ON public.positions TO anon, authenticated;

GRANT INSERT, UPDATE ON public.users TO authenticated, service_role;
GRANT INSERT, UPDATE ON public.markets TO authenticated;
GRANT INSERT ON public.trades TO authenticated;
GRANT INSERT, UPDATE ON public.positions TO authenticated;

COMMENT ON MIGRATION IS 'Restore proper authentication with email and password';
