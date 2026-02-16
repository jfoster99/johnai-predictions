-- One-time admin setup function
-- Allows the first authenticated user to claim admin status
-- Can only be used if no admins exist yet

CREATE OR REPLACE FUNCTION public.claim_admin_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user_id UUID;
  v_admin_count INTEGER;
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Authentication required'
    );
  END IF;

  v_current_user_id := auth.uid();

  -- Check if any admins already exist
  SELECT COUNT(*) INTO v_admin_count
  FROM auth.users
  WHERE raw_user_meta_data->>'role' = 'admin';

  IF v_admin_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Admin already exists. This function can only be used once.'
    );
  END IF;

  -- Grant admin role to current user
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
  WHERE id = v_current_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Admin status granted successfully!',
    'user_id', v_current_user_id
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.claim_admin_status() TO authenticated;

COMMENT ON FUNCTION public.claim_admin_status() IS 'One-time function to claim admin status. Only works if no admin exists yet.';
