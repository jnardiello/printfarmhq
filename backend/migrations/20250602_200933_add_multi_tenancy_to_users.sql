-- 20250602_200933_add_multi_tenancy_to_users.sql
-- Migration: add_multi_tenancy_to_users
-- Created: 2025-06-02T20:09:33.924595

-- UP: Apply the migration

-- Add god user flag and created_by reference to users table
ALTER TABLE users ADD COLUMN is_god_user BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN created_by_user_id INTEGER REFERENCES users(id);

-- Create index for efficient team member lookups
CREATE INDEX idx_users_created_by ON users(created_by_user_id);

-- Mark any existing super-admin as potential god user (will be updated by migration logic)
-- This is just a safety measure, the actual god user designation happens in app logic

-- DOWN: Revert the migration

-- Drop index
DROP INDEX IF EXISTS idx_users_created_by;

-- SQLite doesn't support DROP COLUMN, so we need to recreate the table
-- Create temporary table without the new columns
CREATE TABLE users_backup AS 
SELECT id, email, name, hashed_password, is_active, is_admin, is_superadmin, 
       token_version, created_at, updated_at
FROM users;

-- Drop the original table
DROP TABLE users;

-- Rename backup to original
ALTER TABLE users_backup RENAME TO users;
