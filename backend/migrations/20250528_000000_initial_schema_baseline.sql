-- 20250528_000000_initial_schema_baseline.sql
-- Migration: Initial schema baseline
-- Created: 2025-05-28T00:00:00

-- UP: Apply the migration
-- This migration establishes the baseline for existing database schema
-- It ensures that the current database structure is properly tracked
-- by the migration system without making any actual changes.

-- Create a system info table to track schema version and metadata
CREATE TABLE IF NOT EXISTS system_info (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert baseline schema version marker
INSERT OR IGNORE INTO system_info (key, value) 
VALUES ('schema_baseline', '20250528_000000');

-- Insert migration system initialization marker
INSERT OR IGNORE INTO system_info (key, value) 
VALUES ('migration_system_init', datetime('now'));

-- DOWN: Revert the migration
-- Remove migration system initialization markers
DELETE FROM system_info WHERE key IN ('schema_baseline', 'migration_system_init');

-- Note: We don't drop the system_info table in case other data exists
-- If this is the only data, the table can be manually dropped if needed