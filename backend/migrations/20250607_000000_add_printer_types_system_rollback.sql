-- Rollback Migration: Add printer types system
-- This rollback script reverses the printer types system migration

-- Revert print_job_printers changes
ALTER TABLE print_job_printers DROP COLUMN printer_type_id;
ALTER TABLE print_job_printers DROP COLUMN assigned_printer_id;
ALTER TABLE print_job_printers RENAME COLUMN printer_id TO printer_profile_id;

-- Revert print_jobs changes
ALTER TABLE print_jobs DROP COLUMN printer_type_id;

-- Revert printer_usage_history changes
ALTER TABLE printer_usage_history DROP CONSTRAINT printer_usage_history_printer_id_fkey;
ALTER TABLE printer_usage_history RENAME COLUMN printer_id TO printer_profile_id;
ALTER TABLE printer_usage_history ADD CONSTRAINT printer_usage_history_printer_profile_id_fkey 
    FOREIGN KEY (printer_profile_id) REFERENCES printers(id) ON DELETE CASCADE;

-- Add back columns to printers that were moved to printer_types
ALTER TABLE printers ADD COLUMN manufacturer VARCHAR(255);
ALTER TABLE printers ADD COLUMN model VARCHAR(255);
ALTER TABLE printers ADD COLUMN expected_life_hours FLOAT NOT NULL DEFAULT 10000;

-- Populate the columns from printer_types
UPDATE printers p
SET manufacturer = pt.brand,
    model = pt.model,
    expected_life_hours = pt.expected_life_hours
FROM printer_types pt
WHERE p.printer_type_id = pt.id;

-- Remove new columns
ALTER TABLE printers DROP COLUMN printer_type_id;
ALTER TABLE printers DROP COLUMN purchase_date;
ALTER TABLE printers DROP COLUMN status;

-- Rename purchase_price_eur back to price_eur
ALTER TABLE printers RENAME COLUMN purchase_price_eur TO price_eur;

-- Rename printers back to printer_profiles
ALTER TABLE printers RENAME TO printer_profiles;

-- Drop printer_types table
DROP TABLE printer_types;

-- Drop indexes
DROP INDEX IF EXISTS idx_printer_types_owner;
DROP INDEX IF EXISTS idx_printers_printer_type;
DROP INDEX IF EXISTS idx_printers_status;
DROP INDEX IF EXISTS idx_print_jobs_printer_type;
DROP INDEX IF EXISTS idx_print_job_printers_assigned;