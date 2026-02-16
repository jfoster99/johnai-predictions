-- FINAL SECURITY HARDENING
-- This migration addresses remaining security vulnerabilities:
-- 1. Removes user_id parameters from game functions (derive from auth.uid())
-- 2. Ensures update_user_balance cannot be called directly from client
-- 3. Adds additional security checks and rate limiting

-- ============================================================================
-- FIX #1: Secure open_loot_box - Remove user_id parameter
-- ============================================================================

DROP FUNCTION IF EXISTS public.open_loot_box(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.open_loot_box()
RETURNS TABLE (
  item_name TEXT,
  item_value NUMERIC,
  item_rarity TEXT,
  item_emoji TEXT,
  new_balance NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_balance NUMERIC;
  v_box_price NUMERIC := 100;
  v_random NUMERIC;
  v_rarity TEXT;
  v_item_name TEXT;
  v_item_value NUMERIC;
  v_item_emoji TEXT;
  v_new_balance NUMERIC;
BEGIN
  -- Verify authentication - derive user_id from auth.uid()
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

  -- Rate limit: 20 boxes per minute
  PERFORM check_rate_limit('open_loot_box', 20, 60);

  -- Get user balance
  SELECT balance INTO v_balance FROM public.users WHERE id = v_user_id;

  IF v_balance < v_box_price THEN
    RAISE EXCEPTION 'Insufficient balance: Need % JohnBucks to open a box', v_box_price;
  END IF;

  -- Deduct box price
  UPDATE public.users SET balance = balance - v_box_price WHERE id = v_user_id;

  -- Generate random result with server-side randomness
  v_random := random() * 100;

  -- Determine rarity based on probabilities
  -- Common: 60%, Uncommon: 25%, Rare: 10%, Epic: 4%, Legendary: 1%
  IF v_random < 60 THEN
    v_rarity := 'common';
    v_random := random() * 5;
    IF v_random < 1 THEN
      v_item_name := 'Nuh Uh Card';
      v_item_value := 1;
      v_item_emoji := '🚫';
    ELSIF v_random < 2 THEN
      v_item_name := 'L + Ratio';
      v_item_value := 2;
      v_item_emoji := '💀';
    ELSIF v_random < 3 THEN
      v_item_name := 'Touch Grass Voucher';
      v_item_value := 3;
      v_item_emoji := '🌱';
    ELSIF v_random < 4 THEN
      v_item_name := 'Cringe Compilation';
      v_item_value := 5;
      v_item_emoji := '😬';
    ELSE
      v_item_name := 'Mid NFT';
      v_item_value := 8;
      v_item_emoji := '🎨';
    END IF;
  ELSIF v_random < 85 THEN  -- 60 + 25
    v_rarity := 'uncommon';
    v_random := random() * 3;
    IF v_random < 1 THEN
      v_item_name := 'Rizz License';
      v_item_value := 20;
      v_item_emoji := '🪪';
    ELSIF v_random < 2 THEN
      v_item_name := 'Gyatt Certificate';
      v_item_value := 30;
      v_item_emoji := '📜';
    ELSE
      v_item_name := 'Skibidi Toilet';
      v_item_value := 50;
      v_item_emoji := '🚽';
    END IF;
  ELSIF v_random < 95 THEN  -- 85 + 10
    v_rarity := 'rare';
    IF random() < 0.5 THEN
      v_item_name := 'Kirkified Meme';
      v_item_value := 100;
      v_item_emoji := '🗿';
    ELSE
      v_item_name := 'Sigma Mindset';
      v_item_value := 150;
      v_item_emoji := '😎';
    END IF;
  ELSIF v_random < 99 THEN  -- 95 + 4
    v_rarity := 'epic';
    IF random() < 0.5 THEN
      v_item_name := '67 (Nice)';
      v_item_value := 300;
      v_item_emoji := '6️⃣7️⃣';
    ELSE
      v_item_name := 'Fanum Tax Exemption';
      v_item_value := 500;
      v_item_emoji := '🍟';
    END IF;
  ELSE  -- 99 + 1
    v_rarity := 'legendary';
    IF random() < 0.5 THEN
      v_item_name := 'Ohio Escape Plan';
      v_item_value := 1500;
      v_item_emoji := '🏃';
    ELSE
      v_item_name := 'Grimace Shake';
      v_item_value := 2500;
      v_item_emoji := '🟣';
    END IF;
  END IF;

  -- Add item value to user balance
  UPDATE public.users SET balance = balance + v_item_value WHERE id = v_user_id
  RETURNING balance INTO v_new_balance;

  -- Log loot box opening
  PERFORM log_audit_event('open_loot_box', 'user', v_user_id,
    jsonb_build_object(
      'item_name', v_item_name,
      'item_value', v_item_value,
      'rarity', v_rarity,
      'cost', v_box_price,
      'profit', v_item_value - v_box_price
    ), true);

  -- Return result
  RETURN QUERY SELECT v_item_name, v_item_value, v_rarity, v_item_emoji, v_new_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_loot_box() TO authenticated;

COMMENT ON FUNCTION public.open_loot_box IS 
  'Securely opens a loot box. User ID is derived from auth token, not passed as parameter.';

-- ============================================================================
-- FIX #2: Secure play_slots - Remove user_id parameter
-- ============================================================================

DROP FUNCTION IF EXISTS public.play_slots(UUID, NUMERIC) CASCADE;

CREATE OR REPLACE FUNCTION public.play_slots(p_bet_amount NUMERIC)
RETURNS TABLE (
  won BOOLEAN,
  payout NUMERIC,
  symbol1 TEXT,
  symbol2 TEXT,
  symbol3 TEXT,
  new_balance NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_balance NUMERIC;
  v_win BOOLEAN;
  v_payout NUMERIC := 0;
  v_symbol1 TEXT;
  v_symbol2 TEXT;
  v_symbol3 TEXT;
  v_new_balance NUMERIC;
  v_random NUMERIC;
  v_matched_symbol TEXT;
BEGIN
  -- Verify authentication - derive user_id from auth.uid()
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

  -- Rate limit: 20 spins per minute
  PERFORM check_rate_limit('play_slots', 20, 60);

  -- Validate bet amount
  IF p_bet_amount < 1 OR p_bet_amount > 1000 THEN
    RAISE EXCEPTION 'Invalid bet: must be between 1 and 1,000';
  END IF;

  -- Get user balance
  SELECT balance INTO v_balance FROM public.users WHERE id = v_user_id;

  IF v_balance < p_bet_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Deduct bet
  UPDATE public.users SET balance = balance - p_bet_amount WHERE id = v_user_id;

  -- Generate weighted random symbols (server-side)
  -- Symbol probabilities: 🍒=25%, 💎=15%, ⭐=30%, 🎰=20%, 🎁=10%
  v_random := random() * 100;
  IF v_random < 25 THEN v_symbol1 := '🍒';
  ELSIF v_random < 40 THEN v_symbol1 := '💎';
  ELSIF v_random < 70 THEN v_symbol1 := '⭐';
  ELSIF v_random < 90 THEN v_symbol1 := '🎰';
  ELSE v_symbol1 := '🎁';
  END IF;

  v_random := random() * 100;
  IF v_random < 25 THEN v_symbol2 := '🍒';
  ELSIF v_random < 40 THEN v_symbol2 := '💎';
  ELSIF v_random < 70 THEN v_symbol2 := '⭐';
  ELSIF v_random < 90 THEN v_symbol2 := '🎰';
  ELSE v_symbol2 := '🎁';
  END IF;

  v_random := random() * 100;
  IF v_random < 25 THEN v_symbol3 := '🍒';
  ELSIF v_random < 40 THEN v_symbol3 := '💎';
  ELSIF v_random < 70 THEN v_symbol3 := '⭐';
  ELSIF v_random < 90 THEN v_symbol3 := '🎰';
  ELSE v_symbol3 := '🎁';
  END IF;

  -- Calculate winnings based on matches
  v_win := FALSE;
  v_payout := 0;

  -- Three matching symbols - JACKPOT!
  IF v_symbol1 = v_symbol2 AND v_symbol2 = v_symbol3 THEN
    v_win := TRUE;
    CASE v_symbol1
      WHEN '💎' THEN v_payout := p_bet_amount * 20;
      WHEN '🎰' THEN v_payout := p_bet_amount * 15;
      WHEN '🎁' THEN v_payout := p_bet_amount * 12;
      WHEN '🍒' THEN v_payout := p_bet_amount * 8;
      WHEN '⭐' THEN v_payout := p_bet_amount * 5;
    END CASE;
  -- Two matching symbols
  ELSIF v_symbol1 = v_symbol2 OR v_symbol2 = v_symbol3 OR v_symbol1 = v_symbol3 THEN
    v_win := TRUE;
    IF v_symbol1 = v_symbol2 THEN v_matched_symbol := v_symbol1;
    ELSIF v_symbol2 = v_symbol3 THEN v_matched_symbol := v_symbol2;
    ELSE v_matched_symbol := v_symbol1;
    END IF;

    CASE v_matched_symbol
      WHEN '💎' THEN v_payout := p_bet_amount * 3;
      WHEN '🎰' THEN v_payout := p_bet_amount * 2.5;
      WHEN '🎁' THEN v_payout := p_bet_amount * 2;
      ELSE v_payout := p_bet_amount * 1.5;
    END CASE;
  -- Special bonus: Any diamond present
  ELSIF v_symbol1 = '💎' OR v_symbol2 = '💎' OR v_symbol3 = '💎' THEN
    v_win := TRUE;
    v_payout := p_bet_amount * 0.5;
  END IF;

  -- Add winnings to balance
  IF v_payout > 0 THEN
    UPDATE public.users SET balance = balance + v_payout WHERE id = v_user_id;
  END IF;

  -- Get new balance
  SELECT balance INTO v_new_balance FROM public.users WHERE id = v_user_id;

  -- Log slot play
  PERFORM log_audit_event('play_slots', 'user', v_user_id,
    jsonb_build_object(
      'bet_amount', p_bet_amount,
      'won', v_win,
      'payout', v_payout,
      'symbols', ARRAY[v_symbol1, v_symbol2, v_symbol3],
      'profit', v_payout - p_bet_amount
    ), true);

  -- Return result
  RETURN QUERY SELECT v_win, v_payout, v_symbol1, v_symbol2, v_symbol3, v_new_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.play_slots(NUMERIC) TO authenticated;

COMMENT ON FUNCTION public.play_slots IS 
  'Securely plays slot machine. User ID is derived from auth token, not passed as parameter.';

-- ============================================================================
-- FIX #3: Ensure update_user_balance is NOT callable from client
-- ============================================================================

-- Double-check that update_user_balance cannot be called by authenticated users
REVOKE ALL ON FUNCTION public.update_user_balance(UUID, NUMERIC) FROM authenticated;
REVOKE ALL ON FUNCTION public.update_user_balance(UUID, NUMERIC) FROM PUBLIC;

-- Only allow execution within SECURITY DEFINER context (internal calls only)
COMMENT ON FUNCTION public.update_user_balance IS 
  'INTERNAL ONLY: Updates user balance. Cannot be called from client. Only callable from other SECURITY DEFINER functions.';

-- ============================================================================
-- FIX #4: Add rate limiting to admin functions
-- ============================================================================

-- Update admin_grant_johnbucks to include rate limiting
CREATE OR REPLACE FUNCTION public.admin_grant_johnbucks(
  p_target_user_id UUID,
  p_amount NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify authentication
  IF auth.uid() IS NULL THEN
    PERFORM log_audit_event('admin_grant_johnbucks', 'user', p_target_user_id, 
      jsonb_build_object('error', 'Not authenticated'), false);
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Verify admin role
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  ) THEN
    PERFORM log_audit_event('admin_grant_johnbucks', 'user', p_target_user_id, 
      jsonb_build_object('error', 'Not admin'), false);
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Rate limit: Prevent admin abuse - 100 grants per hour
  PERFORM check_rate_limit('admin_grant_johnbucks', 100, 3600);

  -- Validate amount (more restrictive limits)
  IF p_amount IS NULL OR p_amount < 0 OR p_amount > 100000 THEN
    PERFORM log_audit_event('admin_grant_johnbucks', 'user', p_target_user_id, 
      jsonb_build_object('error', 'Invalid amount', 'amount', p_amount), false);
    RAISE EXCEPTION 'Invalid amount: must be from 0 to 100,000';
  END IF;

  IF NOT (p_amount = FLOOR(p_amount)) THEN
    PERFORM log_audit_event('admin_grant_johnbucks', 'user', p_target_user_id, 
      jsonb_build_object('error', 'Not whole number', 'amount', p_amount), false);
    RAISE EXCEPTION 'Invalid amount: must be a whole number';
  END IF;

  -- Grant JohnBucks
  UPDATE public.users 
  SET balance = balance + p_amount 
  WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    PERFORM log_audit_event('admin_grant_johnbucks', 'user', p_target_user_id, 
      jsonb_build_object('error', 'User not found'), false);
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Log successful grant
  PERFORM log_audit_event('admin_grant_johnbucks', 'user', p_target_user_id, 
    jsonb_build_object('amount', p_amount, 'admin_id', auth.uid()), true);
END;
$$;

COMMENT ON FUNCTION public.admin_grant_johnbucks IS 
  'Admin function to grant JohnBucks. Includes rate limiting and audit logging.';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Log that this critical security fix has been applied
DO $$
BEGIN
  RAISE NOTICE 'SECURITY FIX APPLIED: Game functions no longer accept user_id from client';
  RAISE NOTICE 'SECURITY FIX APPLIED: update_user_balance cannot be called from client';
  RAISE NOTICE 'SECURITY FIX APPLIED: Admin functions have rate limiting';
END $$;
