-- Create audit logging infrastructure for security monitoring
-- This enables tracking of sensitive operations for compliance and security

-- Audit log table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL DEFAULT true
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_user_time ON public.audit_log(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action_time ON public.audit_log(action, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON public.audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON public.audit_log(timestamp DESC);

-- Enable RLS on audit log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can read all logs
CREATE POLICY "Admins can read audit logs"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Users can read their own logs
CREATE POLICY "Users can read their own audit logs"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Only system can insert audit logs (via SECURITY DEFINER functions)
CREATE POLICY "Only system can insert audit logs"
  ON public.audit_log FOR INSERT
  WITH CHECK (false);

-- Helper function to log audit events
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action TEXT,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT NULL,
  p_success BOOLEAN DEFAULT true
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.audit_log (
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    success
  ) VALUES (
    auth.uid(),
    p_action,
    p_resource_type,
    p_resource_id,
    p_details,
    p_success
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit_event(TEXT, TEXT, UUID, JSONB, BOOLEAN) TO authenticated;

-- Update critical functions to include audit logging
-- Update admin_grant_johnbucks with logging
CREATE OR REPLACE FUNCTION public.admin_grant_johnbucks(
  p_user_id UUID,
  p_amount NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify authentication
  IF auth.uid() IS NULL THEN
    PERFORM log_audit_event('admin_grant_johnbucks', 'user', p_user_id, 
      jsonb_build_object('error', 'Not authenticated'), false);
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Verify admin role
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  ) THEN
    PERFORM log_audit_event('admin_grant_johnbucks', 'user', p_user_id, 
      jsonb_build_object('error', 'Not admin'), false);
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Validate amount
  IF p_amount IS NULL OR p_amount < 0 OR p_amount > 1000000 THEN
    PERFORM log_audit_event('admin_grant_johnbucks', 'user', p_user_id, 
      jsonb_build_object('error', 'Invalid amount', 'amount', p_amount), false);
    RAISE EXCEPTION 'Invalid amount: must be from 0 to 1,000,000';
  END IF;

  IF NOT (p_amount = FLOOR(p_amount)) THEN
    PERFORM log_audit_event('admin_grant_johnbucks', 'user', p_user_id, 
      jsonb_build_object('error', 'Not whole number', 'amount', p_amount), false);
    RAISE EXCEPTION 'Invalid amount: must be a whole number';
  END IF;

  -- Grant JohnBucks
  UPDATE public.users 
  SET balance = balance + p_amount 
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    PERFORM log_audit_event('admin_grant_johnbucks', 'user', p_user_id, 
      jsonb_build_object('error', 'User not found'), false);
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Log successful grant
  PERFORM log_audit_event('admin_grant_johnbucks', 'user', p_user_id, 
    jsonb_build_object('amount', p_amount, 'admin_id', auth.uid()), true);
END;
$$;

-- Update claim_admin_status with better locking and logging
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

  -- Use advisory lock to prevent race conditions
  -- Lock number is deterministic hash of 'admin_claim'
  PERFORM pg_advisory_xact_lock(hashtext('admin_claim'));

  -- Check if any admins already exist (inside lock)
  SELECT COUNT(*) INTO v_admin_count
  FROM auth.users
  WHERE raw_user_meta_data->>'role' = 'admin';

  IF v_admin_count > 0 THEN
    PERFORM log_audit_event('claim_admin_status', NULL, NULL, 
      jsonb_build_object('error', 'Admin already exists'), false);
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Admin already exists. This function can only be used once.'
    );
  END IF;

  -- Grant admin role
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', 'admin', 'claimed_at', NOW()::TEXT)
  WHERE id = v_current_user_id;

  -- Log successful admin claim
  PERFORM log_audit_event('claim_admin_status', 'user', v_current_user_id, 
    jsonb_build_object('first_admin', true), true);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Admin status granted successfully!',
    'user_id', v_current_user_id
  );
END;
$$;

COMMENT ON TABLE public.audit_log IS 'Security audit log for tracking sensitive operations';
COMMENT ON FUNCTION public.log_audit_event IS 'Helper function to log security events for monitoring and compliance';
