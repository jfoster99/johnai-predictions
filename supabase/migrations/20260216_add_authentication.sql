-- Add authentication to the application
-- This migration links users table to Supabase auth and adds proper security

-- Step 1: Add auth_user_id column to users table to link with auth.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: Create unique index on auth_user_id
CREATE UNIQUE INDEX IF NOT EXISTS users_auth_user_id_key ON public.users(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Step 3: Update RLS policies to require authentication
-- Drop old permissive policies
DROP POLICY IF EXISTS "Anyone can create their own user" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can create markets" ON public.markets;
DROP POLICY IF EXISTS "Users can create their own trades" ON public.trades;
DROP POLICY IF EXISTS "Users can create positions" ON public.positions;

-- Step 4: Create new authenticated policies for users table
CREATE POLICY "Authenticated users can create their profile"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid() AND display_name IS NOT NULL);

-- Step 5: Create new authenticated policies for markets
CREATE POLICY "Authenticated users can create markets"
  ON public.markets
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Step 6: Create new authenticated policies for trades
CREATE POLICY "Authenticated users can create trades"
  ON public.trades
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users WHERE id = user_id AND auth_user_id = auth.uid()
  ));

-- Step 7: Create new authenticated policies for positions
CREATE POLICY "Authenticated users can create positions"
  ON public.positions
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users WHERE id = user_id AND auth_user_id = auth.uid()
  ));

-- Step 8: Update secure functions to verify authentication
CREATE OR REPLACE FUNCTION public.get_user_by_auth_id()
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  balance NUMERIC,
  created_at TIMESTAMPTZ,
  auth_user_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT u.id, u.display_name, u.balance, u.created_at, u.auth_user_id
  FROM public.users u
  WHERE u.auth_user_id = auth.uid();
END;
$$;

-- Step 9: Update execute_trade to verify user ownership
CREATE OR REPLACE FUNCTION public.execute_trade(
  p_user_id UUID,
  p_market_id UUID,
  p_side TEXT,
  p_direction TEXT,
  p_shares NUMERIC,
  p_price NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_balance NUMERIC;
  v_total_cost NUMERIC;
  v_trade_id UUID;
  v_existing_position RECORD;
  v_new_shares NUMERIC;
BEGIN
  -- Verify authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Verify user ownership
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND auth_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Cannot trade for another user';
  END IF;

  -- Input validation
  IF p_user_id IS NULL OR p_market_id IS NULL THEN
    RAISE EXCEPTION 'Invalid input: user_id and market_id are required';
  END IF;

  IF p_shares <= 0 OR p_shares > 1000000 THEN
    RAISE EXCEPTION 'Invalid shares: must be between 1 and 1,000,000';
  END IF;

  IF p_price < 0 OR p_price > 100 THEN
    RAISE EXCEPTION 'Invalid price: must be between 0 and 100';
  END IF;

  IF p_side NOT IN ('yes', 'no') THEN
    RAISE EXCEPTION 'Invalid side: must be yes or no';
  END IF;

  IF p_direction NOT IN ('buy', 'sell') THEN
    RAISE EXCEPTION 'Invalid direction: must be buy or sell';
  END IF;

  -- Get user balance
  SELECT balance INTO v_user_balance FROM public.users WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Calculate total cost
  v_total_cost := p_shares * (p_price / 100.0);

  -- For buys, check if user has enough balance
  IF p_direction = 'buy' AND v_user_balance < v_total_cost THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Insert trade
  INSERT INTO public.trades (user_id, market_id, side, direction, shares, price, total_cost)
  VALUES (p_user_id, p_market_id, p_side, p_direction, p_shares, p_price, v_total_cost)
  RETURNING id INTO v_trade_id;

  -- Update user balance
  IF p_direction = 'buy' THEN
    UPDATE public.users SET balance = balance - v_total_cost WHERE id = p_user_id;
  ELSE
    UPDATE public.users SET balance = balance + v_total_cost WHERE id = p_user_id;
  END IF;

  -- Update or create position
  SELECT * INTO v_existing_position FROM public.positions 
  WHERE user_id = p_user_id AND market_id = p_market_id AND side = p_side;

  IF FOUND THEN
    IF p_direction = 'buy' THEN
      v_new_shares := v_existing_position.shares + p_shares;
    ELSE
      v_new_shares := v_existing_position.shares - p_shares;
    END IF;

    IF v_new_shares > 0 THEN
      UPDATE public.positions 
      SET shares = v_new_shares,
          average_price = CASE 
            WHEN p_direction = 'buy' THEN 
              ((v_existing_position.average_price * v_existing_position.shares) + (p_price * p_shares)) / v_new_shares
            ELSE v_existing_position.average_price
          END
      WHERE user_id = p_user_id AND market_id = p_market_id AND side = p_side;
    ELSE
      DELETE FROM public.positions 
      WHERE user_id = p_user_id AND market_id = p_market_id AND side = p_side;
    END IF;
  ELSE
    IF p_direction = 'buy' THEN
      INSERT INTO public.positions (user_id, market_id, side, shares, average_price)
      VALUES (p_user_id, p_market_id, p_side, p_shares, p_price);
    END IF;
  END IF;

  RETURN v_trade_id;
END;
$$;

-- Step 10: Update update_user_balance to require auth and prevent unauthorized changes
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

-- Step 11: Create admin-only grant money function
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

-- Step 12: Update play_slots to verify user ownership
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

-- Step 13: Update resolve_market to verify creator ownership
CREATE OR REPLACE FUNCTION public.resolve_market(
  p_market_id UUID,
  p_outcome TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_creator_id UUID;
  v_creator_auth_id UUID;
BEGIN
  -- Verify authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get market creator
  SELECT creator_id INTO v_creator_id
  FROM public.markets
  WHERE id = p_market_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Market not found';
  END IF;

  -- Get creator's auth_user_id
  SELECT auth_user_id INTO v_creator_auth_id
  FROM public.users
  WHERE id = v_creator_id;

  -- Verify user is creator OR admin
  IF v_creator_auth_id != auth.uid() AND NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only creator or admin can resolve markets';
  END IF;

  -- Validate outcome
  IF p_outcome NOT IN ('yes', 'no') THEN
    RAISE EXCEPTION 'Invalid outcome: must be yes or no';
  END IF;

  -- Update market
  UPDATE public.markets
  SET status = 'resolved', outcome = p_outcome
  WHERE id = p_market_id;

  -- Payout winners
  UPDATE public.users u
  SET balance = balance + (
    SELECT COALESCE(SUM(p.shares * 100), 0)
    FROM public.positions p
    WHERE p.user_id = u.id 
      AND p.market_id = p_market_id
      AND p.side = p_outcome
  )
  WHERE id IN (
    SELECT DISTINCT user_id 
    FROM public.positions 
    WHERE market_id = p_market_id AND side = p_outcome
  );
END;
$$;

-- Step 14: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_by_auth_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_trade(UUID, UUID, TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_balance(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_johnbucks(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.play_slots(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_market(UUID, TEXT) TO authenticated;

-- Step 15: Create trigger to auto-create user profile on signup
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
    1000
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMENT ON MIGRATION IS 'Add Supabase Auth integration with proper RLS and security';
