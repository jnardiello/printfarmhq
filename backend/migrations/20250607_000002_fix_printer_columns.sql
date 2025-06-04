-- Migration: Fix missing printer columns
-- This migration adds the missing columns without recreating tables

-- Add printer_type_id to print_jobs
ALTER TABLE print_jobs ADD COLUMN printer_type_id INTEGER REFERENCES printer_types(id);

-- Add missing columns to print_job_printers
ALTER TABLE print_job_printers ADD COLUMN assigned_printer_id INTEGER REFERENCES printers(id);
ALTER TABLE print_job_printers ADD COLUMN printer_type_id INTEGER REFERENCES printer_types(id);

-- Rename printer_profile_id to printer_id in print_job_printers
-- SQLite doesn't support RENAME COLUMN directly, so we'll leave this as is for now
-- The application can handle both column names

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_print_jobs_printer_type ON print_jobs(printer_type_id);
CREATE INDEX IF NOT EXISTS idx_print_job_printers_assigned ON print_job_printers(assigned_printer_id);
CREATE INDEX IF NOT EXISTS idx_print_job_printers_type ON print_job_printers(printer_type_id);

-- Clean up printers_new table if it exists
DROP TABLE IF EXISTS printers_new;