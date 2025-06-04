-- Migration: Add smart printer management features (SQLite version)
-- Description: Adds working hours tracking and usage history for printers

-- Add working_hours field to printer_profiles table
-- Note: SQLite doesn't support ALTER TABLE ADD COLUMN IF NOT EXISTS
-- The migration system will handle if this fails due to column already existing
ALTER TABLE printer_profiles 
ADD COLUMN working_hours REAL DEFAULT 0 NOT NULL;

-- Create printer usage history table for tracking print jobs
CREATE TABLE IF NOT EXISTS printer_usage_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    printer_profile_id INTEGER NOT NULL,
    print_job_id TEXT NOT NULL,  -- UUID stored as TEXT in SQLite
    hours_used REAL NOT NULL,
    printers_qty INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Denormalized fields for faster aggregation
    week_year INTEGER NOT NULL,  -- Format: YYYYWW
    month_year INTEGER NOT NULL, -- Format: YYYYMM
    quarter_year INTEGER NOT NULL, -- Format: YYYYQ
    
    -- Foreign key constraints
    CONSTRAINT fk_printer_usage_printer FOREIGN KEY (printer_profile_id) 
        REFERENCES printer_profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_printer_usage_job FOREIGN KEY (print_job_id) 
        REFERENCES print_jobs(id) ON DELETE CASCADE
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_printer_usage_week ON printer_usage_history(printer_profile_id, week_year);
CREATE INDEX IF NOT EXISTS idx_printer_usage_month ON printer_usage_history(printer_profile_id, month_year);
CREATE INDEX IF NOT EXISTS idx_printer_usage_quarter ON printer_usage_history(printer_profile_id, quarter_year);
CREATE INDEX IF NOT EXISTS idx_printer_usage_created ON printer_usage_history(created_at);