-- CRITICAL SECURITY FIX
-- This migration fixes the IDOR vulnerability in update_user_balance
-- Previous migration (20260216_security_fix.sql) lacked authentication checks
-- This MUST run after all other migrations to ensure proper security

-- Drop the insecure version
DROP FUNCTION IF EXISTS public.update_user_balance(UUID, NUMERIC);

-- Recreate with proper authentication and authorization
CREATE OR REPLACE FUNCTION public.update_user_balance(
  p_user_id UUID,
  p_amount NUMERIC
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- CRITICAL: Verify authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- CRITICAL: Only allow users to update their own balance OR admin role
  -- This prevents IDOR attacks where User A modifies User B's balance
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = p_user_id 
    AND (
      -- User owns this record
      auth_user_id = auth.uid() 
      OR 
      -- OR user is an admin
      auth.uid() IN (
        SELECT id FROM auth.users 
        WHERE raw_user_meta_data->>'role' = 'admin'
      )
    )
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
  
  -- If no rows updated, user doesn't exist
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$;

-- Grant execute permission only to authenticated users
REVOKE ALL ON FUNCTION public.update_user_balance(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_user_balance(UUID, NUMERIC) TO authenticated;

COMMENT ON FUNCTION public.update_user_balance IS 
  'Securely updates user balance with auth checks. Only the user themselves or admins can modify balances.';
