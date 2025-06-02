-- 20250602_194344_store_printer_data_in_print_jobs.sql
-- Migration: store_printer_data_in_print_jobs
-- Created: 2025-06-02T19:43:44.725436

-- UP: Apply the migration

-- Step 1: Create new table without foreign key constraint and with printer data columns
CREATE TABLE print_job_printers_new (
    id INTEGER PRIMARY KEY,
    print_job_id VARCHAR(36) NOT NULL,
    printer_profile_id INTEGER,
    printers_qty INTEGER NOT NULL DEFAULT 1,
    hours_each FLOAT NOT NULL DEFAULT 0.0,
    -- New columns to store printer data at time of print job creation
    printer_name TEXT,
    printer_manufacturer TEXT,
    printer_model TEXT,
    printer_price_eur FLOAT,
    printer_expected_life_hours FLOAT,
    FOREIGN KEY (print_job_id) REFERENCES print_jobs(id)
);

-- Step 2: Copy existing data and populate new columns from printer profiles
INSERT INTO print_job_printers_new (
    id, print_job_id, printer_profile_id, printers_qty, hours_each,
    printer_name, printer_manufacturer, printer_model, printer_price_eur, printer_expected_life_hours
)
SELECT 
    pjp.id,
    pjp.print_job_id,
    pjp.printer_profile_id,
    pjp.printers_qty,
    pjp.hours_each,
    pp.name,
    pp.manufacturer,
    pp.model,
    pp.price_eur,
    pp.expected_life_hours
FROM print_job_printers pjp
LEFT JOIN printer_profiles pp ON pjp.printer_profile_id = pp.id;

-- Step 3: Drop old table and rename new one
DROP TABLE print_job_printers;
ALTER TABLE print_job_printers_new RENAME TO print_job_printers;

-- DOWN: Revert the migration

-- Create the original table structure
CREATE TABLE print_job_printers_old (
    id INTEGER PRIMARY KEY,
    print_job_id VARCHAR(36) NOT NULL,
    printer_profile_id INTEGER NOT NULL,
    printers_qty INTEGER NOT NULL DEFAULT 1,
    hours_each FLOAT NOT NULL DEFAULT 0.0,
    FOREIGN KEY (print_job_id) REFERENCES print_jobs(id),
    FOREIGN KEY (printer_profile_id) REFERENCES printer_profiles(id)
);

-- Copy data back (only if printer_profile_id is not null)
INSERT INTO print_job_printers_old (id, print_job_id, printer_profile_id, printers_qty, hours_each)
SELECT id, print_job_id, printer_profile_id, printers_qty, hours_each
FROM print_job_printers
WHERE printer_profile_id IS NOT NULL;

-- Drop new table and rename old one back
DROP TABLE print_job_printers;
ALTER TABLE print_job_printers_old RENAME TO print_job_printers;
