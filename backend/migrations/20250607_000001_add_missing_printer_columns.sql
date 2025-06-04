-- Migration: Add missing printer type columns
-- This migration adds the printer_type_id columns that were missing

-- Add printer_type_id to print_jobs if it doesn't exist
-- Note: SQLite doesn't support "IF NOT EXISTS" for columns, so this might fail if column exists
-- The migration runner should handle this gracefully
ALTER TABLE print_jobs ADD COLUMN printer_type_id INTEGER REFERENCES printer_types(id);

-- Add columns to print_job_printers if they don't exist
ALTER TABLE print_job_printers ADD COLUMN assigned_printer_id INTEGER REFERENCES printers(id);
ALTER TABLE print_job_printers ADD COLUMN printer_type_id INTEGER REFERENCES printer_types(id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_print_jobs_printer_type ON print_jobs(printer_type_id);
CREATE INDEX IF NOT EXISTS idx_print_job_printers_assigned ON print_job_printers(assigned_printer_id);
CREATE INDEX IF NOT EXISTS idx_print_job_printers_type ON print_job_printers(printer_type_id);