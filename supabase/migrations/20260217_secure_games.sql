-- CRITICAL SECURITY FIX: Secure game functions
-- This migration creates secure server-side functions for games (slots and lootbox)
-- to prevent client-side manipulation of game outcomes and balance updates.

-- ============================================================================
-- SECURE LOOT BOX FUNCTION
-- ============================================================================

-- Create loot_box function with all logic server-side
CREATE OR REPLACE FUNCTION public.open_loot_box(p_user_id UUID)
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
  v_balance NUMERIC;
  v_box_price NUMERIC := 100;
  v_random NUMERIC;
  v_rarity TEXT;
  v_item_name TEXT;
  v_item_value NUMERIC;
  v_item_emoji TEXT;
  v_new_balance NUMERIC;
BEGIN
  -- Rate limit: 20 boxes per minute
  PERFORM check_rate_limit('open_loot_box', 20, 60);

  -- Verify authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Verify user ownership
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND auth_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Cannot open loot box for another user';
  END IF;

  -- Get user balance
  SELECT balance INTO v_balance FROM public.users WHERE id = p_user_id;

  IF v_balance < v_box_price THEN
    RAISE EXCEPTION 'Insufficient balance: Need % JohnBucks to open a box', v_box_price;
  END IF;

  -- Deduct box price
  UPDATE public.users SET balance = balance - v_box_price WHERE id = p_user_id;

  -- Generate random result with server-side randomness
  v_random := random() * 100;

  -- Determine rarity based on probabilities
  -- Common: 60%, Uncommon: 25%, Rare: 10%, Epic: 4%, Legendary: 1%
  IF v_random < 60 THEN
    v_rarity := 'common';
    -- Select random common item
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
  UPDATE public.users SET balance = balance + v_item_value WHERE id = p_user_id
  RETURNING balance INTO v_new_balance;

  -- Log loot box opening
  PERFORM log_audit_event('open_loot_box', 'user', p_user_id,
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

GRANT EXECUTE ON FUNCTION public.open_loot_box(UUID) TO authenticated;

COMMENT ON FUNCTION public.open_loot_box IS 
  'Securely opens a loot box with server-side randomness. Prevents client-side manipulation of outcomes.';

-- ============================================================================
-- REVOKE DANGEROUS PERMISSIONS
-- ============================================================================

-- Remove public execute permission from update_user_balance
-- This function should ONLY be called by other server-side functions, never directly from client
REVOKE EXECUTE ON FUNCTION public.update_user_balance(UUID, NUMERIC) FROM authenticated;

-- Only allow it to be called by other SECURITY DEFINER functions (internal use)
COMMENT ON FUNCTION public.update_user_balance IS 
  'INTERNAL USE ONLY: Updates user balance. Should only be called from other secure server-side functions, never directly from client code.';

-- ============================================================================
-- IMPROVE SLOT MACHINE SECURITY
-- ============================================================================

-- Update play_slots to return more detailed results
-- The existing function is already secure, but let's make it return reel symbols
-- that match the client's expectations

CREATE OR REPLACE FUNCTION public.play_slots(p_user_id UUID, p_bet_amount NUMERIC)
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
  v_balance NUMERIC;
  v_win BOOLEAN;
  v_payout NUMERIC := 0;
  v_symbol1 TEXT;
  v_symbol2 TEXT;
  v_symbol3 TEXT;
  v_new_balance NUMERIC;
  v_random NUMERIC;
  v_symbols TEXT[] := ARRAY['🍒', '💎', '⭐', '🎰', '🎁'];
  v_weights INTEGER[] := ARRAY[25, 15, 30, 20, 10];  -- Weighted probabilities
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

  -- Get user balance
  SELECT balance INTO v_balance FROM public.users WHERE id = p_user_id;

  IF v_balance < p_bet_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Deduct bet
  UPDATE public.users SET balance = balance - p_bet_amount WHERE id = p_user_id;

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
      WHEN '💎' THEN v_payout := p_bet_amount * 20;  -- Diamond jackpot
      WHEN '🎰' THEN v_payout := p_bet_amount * 15;  -- Slot machine jackpot
      WHEN '🎁' THEN v_payout := p_bet_amount * 12;  -- Gift jackpot
      WHEN '🍒' THEN v_payout := p_bet_amount * 8;   -- Cherry jackpot
      WHEN '⭐' THEN v_payout := p_bet_amount * 5;   -- Star jackpot
    END CASE;
  -- Two matching symbols
  ELSIF v_symbol1 = v_symbol2 OR v_symbol2 = v_symbol3 OR v_symbol1 = v_symbol3 THEN
    v_win := TRUE;
    -- Determine which symbol matched
    DECLARE
      v_matched_symbol TEXT;
    BEGIN
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
    END;
  -- Special bonus: Any diamond present
  ELSIF v_symbol1 = '💎' OR v_symbol2 = '💎' OR v_symbol3 = '💎' THEN
    v_win := TRUE;
    v_payout := p_bet_amount * 0.5;  -- 50% of bet back
  END IF;

  -- Add winnings to balance
  IF v_payout > 0 THEN
    UPDATE public.users SET balance = balance + v_payout WHERE id = p_user_id;
  END IF;

  -- Get new balance
  SELECT balance INTO v_new_balance FROM public.users WHERE id = p_user_id;

  -- Log slot play
  PERFORM log_audit_event('play_slots', 'user', p_user_id,
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

COMMENT ON FUNCTION public.play_slots IS 
  'Securely plays slot machine with server-side randomness and payout calculation. Prevents client-side manipulation.';
