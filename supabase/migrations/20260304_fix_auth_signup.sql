-- Fix authentication signup and login issues:
-- 1. Ensure auth_user_id column exists on public.users
-- 2. Make handle_new_user trigger robust (won't fail auth signup on error)
-- 3. Allow authenticated users to insert their own profile as a fallback
-- 4. Handle ON CONFLICT for idempotent profile creation

-- ============================================================================
-- STEP 1: Ensure auth_user_id column exists
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'auth_user_id'
  ) THEN
    ALTER TABLE public.users ADD COLUMN auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Ensure unique index exists
CREATE UNIQUE INDEX IF NOT EXISTS users_auth_user_id_key ON public.users(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- ============================================================================
-- STEP 2: Robust handle_new_user trigger
-- Uses ON CONFLICT to handle duplicate entries and EXCEPTION to never fail
-- the auth signup even if profile creation encounters an error.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (auth_user_id, display_name, balance)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    10000
  )
  ON CONFLICT (auth_user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but do NOT fail the auth signup
    RAISE LOG 'handle_new_user: failed to create profile for auth user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STEP 3: Allow authenticated users to insert their own profile
-- This acts as a client-side fallback if the trigger fails to create the profile.
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can insert their own profile" ON public.users;
CREATE POLICY "Authenticated users can insert their own profile"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

-- ============================================================================
-- STEP 4: Grant INSERT on users to authenticated role (if not already granted)
-- ============================================================================

GRANT INSERT ON public.users TO authenticated;
