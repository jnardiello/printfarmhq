-- Migration: Add active print job tracking fields (SQLite version)
-- Date: 2025-06-04
-- Purpose: Support tracking of currently printing jobs with start time and estimated completion

-- Add timestamp fields for tracking active print jobs
ALTER TABLE print_jobs ADD COLUMN started_at DATETIME DEFAULT NULL;
ALTER TABLE print_jobs ADD COLUMN estimated_completion_at DATETIME DEFAULT NULL;

-- Create index on status for faster queries of active jobs
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status);

-- Create index for finding jobs by printer (SQLite doesn't support partial indexes with WHERE)
CREATE INDEX IF NOT EXISTS idx_print_job_printers_status ON print_job_printers(printer_profile_id);

-- Update existing print jobs to ensure valid status values
UPDATE print_jobs 
SET status = 'pending' 
WHERE status IS NULL OR status = '';