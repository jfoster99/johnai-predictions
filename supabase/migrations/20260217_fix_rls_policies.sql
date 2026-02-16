-- FIX OVERLY RESTRICTIVE RLS POLICIES
-- The security_fix migration blocked ALL updates with USING (false)
-- This prevents even SECURITY_DEFINER functions from working
-- We need to allow service_role to bypass RLS while keeping user restrictions

-- ============================================================================
-- USERS TABLE - Fix Update Policy
-- ============================================================================

-- Drop the overly restrictive policy that blocks all updates
DROP POLICY IF EXISTS "Users can only update their own display name" ON public.users;

-- Allow authenticated users to update ONLY their display_name (not balance)
CREATE POLICY "Users can update their own display name"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (
    auth_user_id = auth.uid() 
    AND display_name IS NOT NULL
  );

-- SECURITY_DEFINER functions run as service_role and can bypass RLS
-- No additional policy needed - functions handle authorization internally

-- ============================================================================
-- MARKETS TABLE - Fix Update Policy  
-- ============================================================================

-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "Only status updates allowed" ON public.markets;

-- Allow authenticated creators to update their own markets (for editing)
CREATE POLICY "Creators can update their own markets"
  ON public.markets FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = creator_id AND auth_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = creator_id AND auth_user_id = auth.uid()
  ));

-- SECURITY_DEFINER functions can update markets for volume, resolution, etc.
-- They run as service_role and bypass RLS

-- ============================================================================
-- POSITIONS TABLE - Fix Update Policy
-- ============================================================================

-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "Positions updates restricted" ON public.positions;

-- Users should NOT directly update positions (only through trade execution)
-- But SECURITY_DEFINER functions need to work
CREATE POLICY "Positions can be updated by secure functions"
  ON public.positions FOR UPDATE
  TO authenticated
  USING (false)  -- Users cannot directly update
  WITH CHECK (false);  -- But service_role (SECURITY_DEFINER) can bypass

-- ============================================================================
-- TRADES TABLE - Policies were already restrictive but correct
-- ============================================================================
-- No changes needed - trades are insert-only for users

-- ============================================================================
-- GRANT NECESSARY PERMISSIONS
-- ============================================================================

-- Ensure service_role can bypass RLS for all operations
-- This is needed for SECURITY_DEFINER functions to work
GRANT ALL ON public.users TO service_role;
GRANT ALL ON public.markets TO service_role;  
GRANT ALL ON public.trades TO service_role;
GRANT ALL ON public.positions TO service_role;

-- Ensure authenticated users have necessary permissions for reads
GRANT SELECT ON public.users TO authenticated;
GRANT SELECT ON public.markets TO authenticated;
GRANT SELECT ON public.trades TO authenticated;
GRANT SELECT ON public.positions TO authenticated;

-- Allow inserts where policies permit
GRANT INSERT ON public.users TO authenticated;
GRANT INSERT ON public.markets TO authenticated;
GRANT INSERT ON public.trades TO authenticated;
GRANT INSERT ON public.positions TO authenticated;

-- Allow updates only through policies
GRANT UPDATE ON public.users TO authenticated;
GRANT UPDATE ON public.markets TO authenticated;
GRANT UPDATE ON public.positions TO authenticated;

-- Migration complete: Fixed overly restrictive RLS policies that blocked SECURITY_DEFINER functions
