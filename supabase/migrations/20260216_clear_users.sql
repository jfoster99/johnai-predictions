-- One-time script to clear all users (auth and profiles)
-- This will delete all users from auth.users which cascades to public.users

-- Delete all users from auth schema (cascades to public.users)
DELETE FROM auth.users;

-- Reset any sequences if needed
-- (Users table uses UUID so no sequence to reset)

-- Verify cleanup
SELECT 'Auth users count:' as info, COUNT(*) as count FROM auth.users
UNION ALL
SELECT 'Public users count:' as info, COUNT(*) as count FROM public.users;
