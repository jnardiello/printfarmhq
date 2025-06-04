-- Migration: Remove multiple printer support
-- Description: Simplify print jobs to only support single printer assignment
-- Author: AI Assistant
-- Date: 2025-06-04

-- Remove printers_qty from print_job_printers table
-- Default all existing values to 1 before dropping
UPDATE print_job_printers SET printers_qty = 1 WHERE printers_qty != 1;
ALTER TABLE print_job_printers DROP COLUMN printers_qty;

-- Remove printers_qty from printer_usage_history table
-- Default all existing values to 1 before dropping
UPDATE printer_usage_history SET printers_qty = 1 WHERE printers_qty != 1;
ALTER TABLE printer_usage_history DROP COLUMN printers_qty;

-- Add comment to document the change
COMMENT ON TABLE print_job_printers IS 'Associates print jobs with printer types and assigned printers. Each job can only have one printer type and one assigned printer.';