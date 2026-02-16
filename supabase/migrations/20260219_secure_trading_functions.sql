-- SECURITY FIX: Remove user_id parameters from trading functions
-- This prevents clients from specifying arbitrary user IDs for trades and market resolutions

-- ============================================================================
-- FIX: Secure execute_trade - Remove user_id parameter
-- ============================================================================

DROP FUNCTION IF EXISTS public.execute_trade(UUID, UUID, TEXT, NUMERIC, NUMERIC) CASCADE;

CREATE OR REPLACE FUNCTION public.execute_trade(
  p_market_id UUID,
  p_side TEXT,
  p_shares NUMERIC,
  p_price NUMERIC
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
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

  -- Get user_id from public.users linked to auth_user_id
  SELECT id INTO v_user_id 
  FROM public.users 
  WHERE auth_user_id = auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Validate inputs
  IF p_shares <= 0 OR p_shares > 1000000 THEN
    RAISE EXCEPTION 'Shares must be between 1 and 1,000,000';
  END IF;

  IF p_side NOT IN ('yes', 'no') THEN
    RAISE EXCEPTION 'Side must be yes or no';
  END IF;

  IF p_price < 0.01 OR p_price > 0.99 THEN
    RAISE EXCEPTION 'Price must be between 0.01 and 0.99';
  END IF;

  -- Verify market exists and is not resolved
  IF NOT EXISTS (SELECT 1 FROM public.markets WHERE id = p_market_id AND status = 'active') THEN
    RAISE EXCEPTION 'Market not found or not active';
  END IF;

  -- Calculate cost
  v_cost := p_shares * p_price;

  -- Get user balance
  SELECT balance INTO v_user_balance FROM public.users WHERE id = v_user_id;

  IF v_user_balance < v_cost THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Deduct cost from user balance
  UPDATE public.users SET balance = balance - v_cost WHERE id = v_user_id;

  -- Create trade record
  INSERT INTO public.trades (user_id, market_id, side, shares, price, cost)
  VALUES (v_user_id, p_market_id, p_side, p_shares, p_price, v_cost)
  RETURNING id INTO v_trade_id;

  -- Update or create position
  SELECT id, shares, average_price INTO v_position_id, v_existing_shares, v_existing_avg_price
  FROM public.positions
  WHERE user_id = v_user_id AND market_id = p_market_id AND side = p_side;

  IF v_position_id IS NOT NULL THEN
    -- Update existing position
    v_new_avg_price := ((v_existing_shares * v_existing_avg_price) + (p_shares * p_price)) / (v_existing_shares + p_shares);
    
    UPDATE public.positions
    SET shares = shares + p_shares,
        average_price = v_new_avg_price
    WHERE id = v_position_id;
  ELSE
    -- Create new position
    INSERT INTO public.positions (user_id, market_id, side, shares, average_price)
    VALUES (v_user_id, p_market_id, p_side, p_shares, p_price);
  END IF;

  -- Log the trade
  PERFORM log_audit_event('execute_trade', 'trade', v_trade_id,
    jsonb_build_object(
      'market_id', p_market_id,
      'side', p_side,
      'shares', p_shares,
      'price', p_price,
      'cost', v_cost
    ), true);

  RETURN v_trade_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_trade(UUID, TEXT, NUMERIC, NUMERIC) TO authenticated;

COMMENT ON FUNCTION public.execute_trade IS 
  'Executes a trade. User ID is derived from auth token, not passed as parameter.';

-- ============================================================================
-- FIX: Secure resolve_market - Remove resolver_id parameter
-- ============================================================================

DROP FUNCTION IF EXISTS public.resolve_market(UUID, TEXT, UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.resolve_market(
  p_market_id UUID,
  p_outcome TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_resolver_id UUID;
  v_market_creator UUID;
  v_position RECORD;
  v_payout NUMERIC;
BEGIN
  -- Verify authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get resolver_id from public.users linked to auth_user_id
  SELECT id INTO v_resolver_id 
  FROM public.users 
  WHERE auth_user_id = auth.uid();

  IF v_resolver_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Validate outcome
  IF p_outcome NOT IN ('yes', 'no') THEN
    RAISE EXCEPTION 'Outcome must be yes or no';
  END IF;
  
  -- Get market creator
  SELECT creator_id INTO v_market_creator
  FROM public.markets
  WHERE id = p_market_id;
  
  IF v_market_creator IS NULL THEN
    RAISE EXCEPTION 'Market not found';
  END IF;
  
  -- Only creator or admin can resolve
  IF v_resolver_id != v_market_creator AND NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only market creator or admin can resolve';
  END IF;
  
  -- Prevent double resolution
  IF EXISTS (SELECT 1 FROM public.markets WHERE id = p_market_id AND status != 'active') THEN
    RAISE EXCEPTION 'Market already resolved';
  END IF;
  
  -- Update market status
  UPDATE public.markets
  SET status = 'resolved',
      outcome = p_outcome
  WHERE id = p_market_id;
  
  -- Calculate and distribute payouts
  FOR v_position IN
    SELECT user_id, side, shares, average_price
    FROM public.positions
    WHERE market_id = p_market_id
  LOOP
    -- Winners get 1 JohnBuck per share
    IF v_position.side = p_outcome THEN
      v_payout := v_position.shares;
      UPDATE public.users
      SET balance = balance + v_payout
      WHERE id = v_position.user_id;
    END IF;
    -- Losers get nothing (already paid when buying shares)
  END LOOP;

  -- Log market resolution
  PERFORM log_audit_event('resolve_market', 'market', p_market_id,
    jsonb_build_object(
      'outcome', p_outcome,
      'resolver_id', v_resolver_id
    ), true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_market(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.resolve_market IS 
  'Resolves a market. Resolver ID is derived from auth token, not passed as parameter.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'SECURITY FIX APPLIED: execute_trade no longer accepts user_id from client';
  RAISE NOTICE 'SECURITY FIX APPLIED: resolve_market no longer accepts resolver_id from client';
END $$;
