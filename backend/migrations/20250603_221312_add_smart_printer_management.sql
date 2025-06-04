-- Migration: Add smart printer management features
-- Description: Adds working hours tracking and usage history for printers

-- Add working_hours field to printer_profiles table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'printer_profiles' 
                   AND column_name = 'working_hours') THEN
        ALTER TABLE printer_profiles 
        ADD COLUMN working_hours DECIMAL(10,2) DEFAULT 0 NOT NULL;
    END IF;
END $$;

-- Create printer usage history table for tracking print jobs
CREATE TABLE IF NOT EXISTS printer_usage_history (
    id SERIAL PRIMARY KEY,
    printer_profile_id INTEGER NOT NULL,
    print_job_id INTEGER NOT NULL,
    hours_used DECIMAL(10,2) NOT NULL,
    printers_qty INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Denormalized fields for faster aggregation
    week_year INTEGER NOT NULL,  -- Format: YYYYWW (e.g., 202401 for week 1 of 2024)
    month_year INTEGER NOT NULL, -- Format: YYYYMM (e.g., 202401 for January 2024)
    quarter_year INTEGER NOT NULL, -- Format: YYYYQ (e.g., 20241 for Q1 2024)
    
    -- Foreign key constraints
    CONSTRAINT fk_printer_usage_printer FOREIGN KEY (printer_profile_id) 
        REFERENCES printer_profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_printer_usage_job FOREIGN KEY (print_job_id) 
        REFERENCES print_jobs(id) ON DELETE CASCADE
);

-- Create indexes for efficient querying if they don't exist
CREATE INDEX IF NOT EXISTS idx_printer_usage_week ON printer_usage_history(printer_profile_id, week_year);
CREATE INDEX IF NOT EXISTS idx_printer_usage_month ON printer_usage_history(printer_profile_id, month_year);
CREATE INDEX IF NOT EXISTS idx_printer_usage_quarter ON printer_usage_history(printer_profile_id, quarter_year);
CREATE INDEX IF NOT EXISTS idx_printer_usage_created ON printer_usage_history(created_at);

-- Add comment for documentation
COMMENT ON COLUMN printer_profiles.working_hours IS 'Total accumulated working hours for this printer';
COMMENT ON TABLE printer_usage_history IS 'Tracks printer usage per print job for analytics and maintenance prediction';