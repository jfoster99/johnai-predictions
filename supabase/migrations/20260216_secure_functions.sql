-- Secure trade execution function
-- This prevents users from directly modifying balances

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
BEGIN
  -- Validate inputs with strict constraints
  IF p_shares <= 0 OR p_shares > 1000000 THEN
    RAISE EXCEPTION 'Shares must be between 1 and 1,000,000';
  END IF;
  
  IF p_price < 0 OR p_price > 100 THEN
    RAISE EXCEPTION 'Price must be between 0 and 100';
  END IF;
  
  IF p_side NOT IN ('yes', 'no') THEN
    RAISE EXCEPTION 'Side must be yes or no';
  END IF;
  
  -- Validate UUIDs are not null
  IF p_user_id IS NULL OR p_market_id IS NULL THEN
    RAISE EXCEPTION 'User ID and Market ID are required';
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
  SELECT id, shares INTO v_position_id, v_existing_shares
  FROM public.positions
  WHERE user_id = p_user_id AND market_id = p_market_id AND side = p_side;
  
  IF v_position_id IS NULL THEN
    -- Create new position
    INSERT INTO public.positions (user_id, market_id, side, shares, avg_price)
    VALUES (p_user_id, p_market_id, p_side, p_shares, p_price);
  ELSE
    -- Update existing position
    UPDATE public.positions
    SET shares = shares + p_shares,
        avg_price = ((avg_price * v_existing_shares) + (p_price * p_shares)) / (v_existing_shares + p_shares)
    WHERE id = v_position_id;
  END IF;
  
  -- Update market volume
  UPDATE public.markets
  SET total_volume = total_volume + v_cost
  WHERE id = p_market_id;
  
  RETURN v_trade_id;
END;
$$;

-- Secure market resolution function
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
  
  -- Only creator can resolve (add admin check if needed)
  IF v_market_creator != p_resolver_id THEN
    RAISE EXCEPTION 'Only market creator can resolve';
  END IF;
  
  -- Update market status
  UPDATE public.markets
  SET status = CASE 
    WHEN p_outcome = 'yes' THEN 'resolved_yes'
    ELSE 'resolved_no'
  END,
  resolved_at = NOW()
  WHERE id = p_market_id;
  
  -- Payout winning positions
  FOR v_position IN 
    SELECT user_id, shares
    FROM public.positions
    WHERE market_id = p_market_id AND side = p_outcome
  LOOP
    v_payout := v_position.shares * 100; -- Each share worth 100 at resolution
    
    UPDATE public.users
    SET balance = balance + v_payout
    WHERE id = v_position.user_id;
  END LOOP;
END;
$$;

-- Secure slot machine function
CREATE OR REPLACE FUNCTION public.play_slots(
  p_user_id UUID,
  p_bet_amount NUMERIC
) RETURNS TABLE(
  won BOOLEAN,
  payout NUMERIC,
  symbols TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance NUMERIC;
  v_symbols TEXT[] := ARRAY['🍒', '💎', '⭐', '🎰', '🎁'];
  v_reel1 TEXT;
  v_reel2 TEXT;
  v_reel3 TEXT;
  v_payout NUMERIC := 0;
BEGIN
  -- Validate bet with strict limits
  IF p_bet_amount <= 0 OR p_bet_amount > 1000 THEN
    RAISE EXCEPTION 'Bet must be between 1 and 1000';
  END IF;
  
  -- Validate user ID
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;
  
  -- Check balance
  SELECT balance INTO v_balance FROM public.users WHERE id = p_user_id;
  
  IF v_balance < p_bet_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  
  -- Deduct bet
  UPDATE public.users SET balance = balance - p_bet_amount WHERE id = p_user_id;
  
  -- Spin reels (weighted randomization)
  v_reel1 := v_symbols[1 + floor(random() * 5)::int];
  v_reel2 := v_symbols[1 + floor(random() * 5)::int];
  v_reel3 := v_symbols[1 + floor(random() * 5)::int];
  
  -- Calculate payout (simplified)
  IF v_reel1 = v_reel2 AND v_reel2 = v_reel3 THEN
    v_payout := p_bet_amount * 10; -- Jackpot
  ELSIF v_reel1 = v_reel2 OR v_reel2 = v_reel3 THEN
    v_payout := p_bet_amount * 2; -- Match 2
  END IF;
  
  -- Add payout
  IF v_payout > 0 THEN
    UPDATE public.users SET balance = balance + v_payout WHERE id = p_user_id;
  END IF;
  
  RETURN QUERY SELECT (v_payout > 0), v_payout, ARRAY[v_reel1, v_reel2, v_reel3];
END;
$$;
