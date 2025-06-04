-- Migration: Add active print job tracking fields
-- Date: 2025-06-04
-- Purpose: Support tracking of currently printing jobs with start time and estimated completion

-- Add timestamp fields for tracking active print jobs
ALTER TABLE print_jobs ADD COLUMN started_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE print_jobs ADD COLUMN estimated_completion_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index on status for faster queries of active jobs
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status);

-- Create compound index for finding active jobs by printer
CREATE INDEX IF NOT EXISTS idx_print_job_printers_status ON print_job_printers(printer_profile_id) 
WHERE printer_profile_id IS NOT NULL;

-- Update existing print jobs to ensure valid status values
UPDATE print_jobs 
SET status = 'pending' 
WHERE status IS NULL OR status = '';

-- Add comment to document valid status values
COMMENT ON COLUMN print_jobs.status IS 'Valid values: pending, printing, completed, failed';