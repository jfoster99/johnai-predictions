-- Rate limiting infrastructure for RPC functions
-- Prevents abuse of trading, slots, and other sensitive operations

-- Rate limit tracking table
CREATE TABLE IF NOT EXISTS public.rpc_rate_limits (
  user_id UUID NOT NULL,
  function_name TEXT NOT NULL,
  call_count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, function_name)
);

-- Index for efficient cleanup
CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON public.rpc_rate_limits(window_start);

-- Enable RLS
ALTER TABLE public.rpc_rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can only see their own rate limits
CREATE POLICY "Users can view own rate limits"
  ON public.rpc_rate_limits FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- System manages rate limits
CREATE POLICY "System manages rate limits"
  ON public.rpc_rate_limits FOR ALL
  USING (false)
  WITH CHECK (false);

-- Rate limit check function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_function_name TEXT,
  p_max_calls INTEGER,
  p_window_seconds INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
  v_window_start TIMESTAMPTZ;
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Clean up old rate limit windows (older than 1 hour)
  DELETE FROM public.rpc_rate_limits 
  WHERE window_start < NOW() - INTERVAL '1 hour';

  -- Get current rate limit record
  SELECT call_count, window_start INTO v_count, v_window_start
  FROM public.rpc_rate_limits
  WHERE user_id = auth.uid() 
    AND function_name = p_function_name;

  -- If no record exists, create one
  IF v_count IS NULL THEN
    INSERT INTO public.rpc_rate_limits (user_id, function_name, call_count, window_start)
    VALUES (auth.uid(), p_function_name, 1, NOW())
    ON CONFLICT (user_id, function_name) DO UPDATE
    SET call_count = 1, window_start = NOW();
    RETURN TRUE;
  END IF;

  -- If window expired, reset counter
  IF v_window_start < NOW() - (p_window_seconds || ' seconds')::INTERVAL THEN
    UPDATE public.rpc_rate_limits 
    SET call_count = 1, window_start = NOW()
    WHERE user_id = auth.uid() AND function_name = p_function_name;
    RETURN TRUE;
  END IF;

  -- If limit exceeded, reject
  IF v_count >= p_max_calls THEN
    RAISE EXCEPTION 'Rate limit exceeded for %. Please wait % seconds.', 
      p_function_name, p_window_seconds;
  END IF;

  -- Increment counter
  UPDATE public.rpc_rate_limits 
  SET call_count = call_count + 1
  WHERE user_id = auth.uid() AND function_name = p_function_name;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) TO authenticated;

-- Update execute_trade with rate limiting
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
  -- Rate limit: 30 trades per minute
  PERFORM check_rate_limit('execute_trade', 30, 60);

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

  -- Log trade execution
  PERFORM log_audit_event('execute_trade', 'trade', v_trade_id,
    jsonb_build_object('market_id', p_market_id, 'side', p_side, 
      'direction', p_direction, 'shares', p_shares, 'price', p_price), true);

  RETURN v_trade_id;
END;
$$;

-- Update play_slots with rate limiting
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
  -- Rate limit: 20 spins per minute
  PERFORM check_rate_limit('play_slots', 20, 60);

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

  -- Generate random result
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

COMMENT ON FUNCTION public.check_rate_limit IS 'Rate limiting for RPC functions to prevent abuse';
COMMENT ON TABLE public.rpc_rate_limits IS 'Tracks rate limits per user per function';
