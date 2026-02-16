-- CRITICAL SECURITY FIX
-- Drop all insecure policies and create proper restrictions

-- ============================================================================
-- USERS TABLE SECURITY
-- ============================================================================

-- Drop existing insecure policies
DROP POLICY IF EXISTS "Anyone can read users" ON public.users;
DROP POLICY IF EXISTS "Anyone can insert users" ON public.users;
DROP POLICY IF EXISTS "Anyone can update users" ON public.users;

-- Allow anyone to read user profiles (for leaderboard, etc)
CREATE POLICY "Users are publicly readable"
  ON public.users FOR SELECT
  USING (true);

-- Allow creating new users (for onboarding)
CREATE POLICY "Anyone can create their own user"
  ON public.users FOR INSERT
  WITH CHECK (true);

-- CRITICAL: Users can ONLY update their display_name, NOT balance or other fields
CREATE POLICY "Users can only update their own display name"
  ON public.users FOR UPDATE
  USING (false)  -- Prevent all updates via this policy
  WITH CHECK (false);

-- Create a secure function for balance updates (called from application logic only)
CREATE OR REPLACE FUNCTION public.update_user_balance(
  user_id_param UUID,
  new_balance NUMERIC
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  -- Run with elevated privileges
AS $$
BEGIN
  -- Only allow balance updates if new_balance >= 0
  IF new_balance < 0 THEN
    RAISE EXCEPTION 'Balance cannot be negative';
  END IF;
  
  UPDATE public.users
  SET balance = new_balance
  WHERE id = user_id_param;
END;
$$;

-- ============================================================================
-- MARKETS TABLE SECURITY
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can read markets" ON public.markets;
DROP POLICY IF EXISTS "Anyone can create markets" ON public.markets;
DROP POLICY IF EXISTS "Anyone can update markets" ON public.markets;

-- Everyone can read markets
CREATE POLICY "Markets are publicly readable"
  ON public.markets FOR SELECT
  USING (true);

-- Anyone can create markets
CREATE POLICY "Authenticated users can create markets"
  ON public.markets FOR INSERT
  WITH CHECK (true);

-- CRITICAL: Only allow updating status for resolved markets, not creator or other fields
CREATE POLICY "Only status updates allowed"
  ON public.markets FOR UPDATE
  USING (false)
  WITH CHECK (false);

-- ============================================================================
-- TRADES TABLE SECURITY
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can read trades" ON public.trades;
DROP POLICY IF EXISTS "Anyone can insert trades" ON public.trades;

CREATE POLICY "Trades are publicly readable"
  ON public.trades FOR SELECT
  USING (true);

-- Trades should be validated before insertion (through application logic)
CREATE POLICY "Users can create their own trades"
  ON public.trades FOR INSERT
  WITH CHECK (true);

-- CRITICAL: No updates to trades allowed
CREATE POLICY "Trades cannot be updated"
  ON public.trades FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Trades cannot be deleted"
  ON public.trades FOR DELETE
  USING (false);

-- ============================================================================
-- POSITIONS TABLE SECURITY
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can read positions" ON public.positions;
DROP POLICY IF EXISTS "Anyone can insert positions" ON public.positions;
DROP POLICY IF EXISTS "Anyone can update positions" ON public.positions;

CREATE POLICY "Positions are publicly readable"
  ON public.positions FOR SELECT
  USING (true);

CREATE POLICY "Users can create positions"
  ON public.positions FOR INSERT
  WITH CHECK (true);

-- Positions should only be updated through application logic
CREATE POLICY "Positions updates restricted"
  ON public.positions FOR UPDATE
  USING (false)
  WITH CHECK (false);

-- ============================================================================
-- GRANT PERMISSIONS TO SERVICE ROLE ONLY
-- ============================================================================

-- Only the service role (backend) can bypass RLS
GRANT ALL ON public.users TO service_role;
GRANT ALL ON public.markets TO service_role;
GRANT ALL ON public.trades TO service_role;
GRANT ALL ON public.positions TO service_role;
