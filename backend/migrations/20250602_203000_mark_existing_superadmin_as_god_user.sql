-- 20250602_203000_mark_existing_superadmin_as_god_user.sql
-- Migration: mark_existing_superadmin_as_god_user
-- Created: 2025-06-02T20:30:00.000000

-- UP: Apply the migration

-- Mark the first super-admin as god user (if exists)
UPDATE users 
SET is_god_user = 1
WHERE is_superadmin = 1 
AND id = (SELECT MIN(id) FROM users WHERE is_superadmin = 1);

-- DOWN: Revert the migration

-- Remove god user flag from all users
UPDATE users SET is_god_user = 0;