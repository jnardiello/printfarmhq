-- Migration: Fix printer_usage_history table for SQLite
-- This migration recreates the printer_usage_history table with the correct column name

-- SQLite doesn't support column renames, so we need to recreate the table
-- First, create a new table with the correct structure
CREATE TABLE IF NOT EXISTS printer_usage_history_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    printer_id INTEGER NOT NULL,  -- Changed from printer_profile_id
    print_job_id TEXT NOT NULL,
    hours_used REAL NOT NULL,
    printers_qty INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Denormalized fields for faster aggregation
    week_year INTEGER NOT NULL,
    month_year INTEGER NOT NULL,
    quarter_year INTEGER NOT NULL,
    
    -- Foreign key constraints
    CONSTRAINT fk_printer_usage_printer FOREIGN KEY (printer_id) 
        REFERENCES printers(id) ON DELETE CASCADE,
    CONSTRAINT fk_printer_usage_job FOREIGN KEY (print_job_id) 
        REFERENCES print_jobs(id) ON DELETE CASCADE
);

-- Copy existing data if any exists
INSERT INTO printer_usage_history_new (id, printer_id, print_job_id, hours_used, printers_qty, created_at, week_year, month_year, quarter_year)
SELECT id, printer_profile_id, print_job_id, hours_used, printers_qty, created_at, week_year, month_year, quarter_year
FROM printer_usage_history
WHERE EXISTS (SELECT 1 FROM printer_usage_history LIMIT 1);

-- Drop the old table
DROP TABLE IF EXISTS printer_usage_history;

-- Rename the new table
ALTER TABLE printer_usage_history_new RENAME TO printer_usage_history;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_printer_usage_week ON printer_usage_history(printer_id, week_year);
CREATE INDEX IF NOT EXISTS idx_printer_usage_month ON printer_usage_history(printer_id, month_year);
CREATE INDEX IF NOT EXISTS idx_printer_usage_quarter ON printer_usage_history(printer_id, quarter_year);
CREATE INDEX IF NOT EXISTS idx_printer_usage_created ON printer_usage_history(created_at);