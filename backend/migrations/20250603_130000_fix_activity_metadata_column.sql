-- Migration: Fix user_activities metadata column name
-- Description: Rename metadata column to activity_metadata to avoid SQLAlchemy reserved keyword
-- Author: God Admin Metrics Enhancement Fix
-- Date: 2025-06-03

-- SQLite doesn't support RENAME COLUMN directly in older versions
-- So we need to recreate the table with the correct column name

-- Create new table with correct column names
CREATE TABLE user_activities_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    activity_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    activity_metadata TEXT, -- JSON stored as text in SQLite (renamed from metadata)
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Copy existing data from old table to new table
INSERT INTO user_activities_new (id, user_id, activity_type, activity_timestamp, ip_address, user_agent, activity_metadata)
SELECT id, user_id, activity_type, activity_timestamp, ip_address, user_agent, metadata
FROM user_activities;

-- Drop old table
DROP TABLE user_activities;

-- Rename new table to original name
ALTER TABLE user_activities_new RENAME TO user_activities;

-- Recreate indexes for efficient activity queries
CREATE INDEX idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX idx_user_activities_timestamp ON user_activities(activity_timestamp);
CREATE INDEX idx_user_activities_type ON user_activities(activity_type);
CREATE INDEX idx_user_activities_user_timestamp ON user_activities(user_id, activity_timestamp);