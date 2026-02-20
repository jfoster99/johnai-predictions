-- SECURITY FIX: Restrict claim_admin_status to the configured admin email only
--
-- This replaces the insecure "first user wins" design with a check against a
-- server-side PostgreSQL configuration variable that only a database administrator
-- can set.  The value is never sent to the browser, so an attacker who can
-- observe network traffic or read the JS bundle cannot discover it.
--
-- To configure the admin email run the following SQL as a superuser (e.g. via
-- the Supabase Dashboard -> SQL Editor, or psql):
--
--   ALTER DATABASE postgres SET "app.admin_email" = 'john@example.com';
--
-- Replace 'john@example.com' with John's actual email address.
-- The setting takes effect immediately for new connections without a restart.

CREATE OR REPLACE FUNCTION public.claim_admin_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user_id UUID;
  v_admin_count      INTEGER;
  v_user_email       TEXT;
  v_admin_email      TEXT;
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Authentication required'
    );
  END IF;

  v_current_user_id := auth.uid();

  -- Read the configured admin email from a server-side PostgreSQL setting.
  -- current_setting() with the second argument TRUE returns NULL instead of
  -- raising an error when the setting is not set.
  v_admin_email := current_setting('app.admin_email', true);

  -- Block the claim if no admin email has been configured by the operator.
  IF v_admin_email IS NULL OR trim(v_admin_email) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Admin claim is not configured on this server'
    );
  END IF;

  -- Fetch the authenticated user's email from auth.users.
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = v_current_user_id;

  -- Only allow the specific pre-configured admin email to proceed.
  IF lower(trim(v_user_email)) != lower(trim(v_admin_email)) THEN
    -- Log the failed attempt for audit purposes
    PERFORM log_audit_event(
      'claim_admin_status',
      'auth_user',
      v_current_user_id,
      jsonb_build_object('error', 'Email not authorized'),
      false
    );
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not authorized to claim admin status'
    );
  END IF;

  -- Check if any admins already exist (one-time operation)
  SELECT COUNT(*) INTO v_admin_count
  FROM auth.users
  WHERE raw_user_meta_data->>'role' = 'admin';

  IF v_admin_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'An admin already exists'
    );
  END IF;

  -- Grant admin role to the authenticated user
  UPDATE auth.users
  SET raw_user_meta_data =
        COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
  WHERE id = v_current_user_id;

  -- Log the successful grant
  PERFORM log_audit_event(
    'claim_admin_status',
    'auth_user',
    v_current_user_id,
    jsonb_build_object('message', 'Admin status granted'),
    true
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Admin status granted successfully!',
    'user_id', v_current_user_id
  );
END;
$$;

-- Only authenticated users can call this function
GRANT EXECUTE ON FUNCTION public.claim_admin_status() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_admin_status() FROM anon;

COMMENT ON FUNCTION public.claim_admin_status() IS
  'One-time admin claim. Restricted to the email stored in the server-side '
  'PostgreSQL setting "app.admin_email". Set it with: '
  'ALTER DATABASE postgres SET "app.admin_email" = ''john@example.com'';';
