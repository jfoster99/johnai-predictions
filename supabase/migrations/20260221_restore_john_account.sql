-- Restore account for user John (jfoster08@icloud.com)
-- The 20260216_clear_users.sql migration deleted all auth users, which cascaded
-- to remove all public.users records. This migration restores John's account so
-- he can use "Forgot Password" to set a new password and regain access.

DO $$
DECLARE
  v_auth_user_id UUID;
BEGIN
  -- Check if this user already exists in auth
  SELECT id INTO v_auth_user_id
  FROM auth.users
  WHERE email = 'jfoster08@icloud.com';

  -- If the auth user does not exist, re-create it
  IF v_auth_user_id IS NULL THEN
    v_auth_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      v_auth_user_id,
      'authenticated',
      'authenticated',
      'jfoster08@icloud.com',
      NULL,  -- No password set; user must use "Forgot Password" to regain access
      now(),
      '{"provider": "email", "providers": ["email"]}',
      '{"display_name": "John"}',
      now(),
      now()
    );
  END IF;

  -- Ensure the corresponding public profile exists
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE auth_user_id = v_auth_user_id
  ) THEN
    INSERT INTO public.users (auth_user_id, display_name, balance)
    VALUES (v_auth_user_id, 'John', 10000);  -- 10000 is the application default starting balance
  END IF;
END $$;
