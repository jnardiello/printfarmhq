-- Migration: Add user activity tracking fields
-- Description: Adds last_login and activity tracking to enable DAU/WAU/MAU metrics
-- Author: God Admin Metrics Enhancement
-- Date: 2025-06-03

-- Add activity tracking fields to users table
ALTER TABLE users ADD COLUMN last_login TIMESTAMP;
ALTER TABLE users ADD COLUMN last_activity TIMESTAMP;
ALTER TABLE users ADD COLUMN login_count INTEGER DEFAULT 0;

-- Create index for efficient activity queries
CREATE INDEX idx_users_last_login ON users(last_login);
CREATE INDEX idx_users_last_activity ON users(last_activity);

-- Create user activities log table for detailed tracking
CREATE TABLE IF NOT EXISTS user_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    activity_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata TEXT, -- JSON stored as text in SQLite
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for efficient activity queries
CREATE INDEX idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX idx_user_activities_timestamp ON user_activities(activity_timestamp);
CREATE INDEX idx_user_activities_type ON user_activities(activity_type);
CREATE INDEX idx_user_activities_user_timestamp ON user_activities(user_id, activity_timestamp);

-- Backfill last_login with created_at for existing users (conservative estimate)
UPDATE users 
SET last_login = created_at,
    last_activity = created_at,
    login_count = 1
WHERE last_login IS NULL;

-- Note: After this migration, update the login endpoint to:
-- 1. Set last_login = CURRENT_TIMESTAMP on successful login
-- 2. Increment login_count
-- 3. Insert a record into user_activities with activity_type = 'login'