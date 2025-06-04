-- Migration: Add printer types system (SQLite version)
-- This migration creates a printer_types table and refactors the existing printer_profiles 
-- to separate printer types (templates) from printer instances (actual machines)

-- Create printer_types table (similar to how filaments work)
CREATE TABLE IF NOT EXISTS printer_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    expected_life_hours REAL NOT NULL DEFAULT 10000,
    owner_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE(brand, model, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_printer_types_owner ON printer_types(owner_id);

-- SQLite doesn't support ALTER TABLE RENAME, so we need to recreate the table
-- Create new printers table with updated structure
CREATE TABLE IF NOT EXISTS printers_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    printer_type_id INTEGER REFERENCES printer_types(id),
    name TEXT NOT NULL,
    purchase_price_eur REAL NOT NULL DEFAULT 0,
    purchase_date DATE,
    working_hours REAL NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'printing', 'maintenance', 'offline')),
    owner_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- Create temporary table to extract printer types
CREATE TEMPORARY TABLE temp_printer_types AS
SELECT DISTINCT 
    COALESCE(manufacturer, 'Unknown') as brand,
    COALESCE(model, name) as model,
    expected_life_hours,
    owner_id
FROM printer_profiles;

-- Insert unique printer types
INSERT INTO printer_types (brand, model, expected_life_hours, owner_id)
SELECT brand, model, expected_life_hours, owner_id
FROM temp_printer_types;

-- Copy data from printer_profiles to printers with proper type references
INSERT INTO printers_new (id, printer_type_id, name, purchase_price_eur, working_hours, owner_id, created_at, updated_at)
SELECT 
    pp.id,
    pt.id as printer_type_id,
    pp.name,
    pp.price_eur,
    pp.working_hours,
    pp.owner_id,
    pp.created_at,
    pp.updated_at
FROM printer_profiles pp
JOIN printer_types pt ON 
    COALESCE(pp.manufacturer, 'Unknown') = pt.brand 
    AND COALESCE(pp.model, pp.name) = pt.model 
    AND pp.owner_id = pt.owner_id;

-- Drop old table and rename new one
DROP TABLE printer_profiles;
ALTER TABLE printers_new RENAME TO printers;

-- Create indexes on printers
CREATE INDEX idx_printers_printer_type ON printers(printer_type_id);
CREATE INDEX idx_printers_status ON printers(status);
CREATE INDEX idx_printers_owner ON printers(owner_id);

-- Update print_jobs table
ALTER TABLE print_jobs ADD COLUMN printer_type_id INTEGER REFERENCES printer_types(id);

-- Update print_job_printers table
ALTER TABLE print_job_printers ADD COLUMN assigned_printer_id INTEGER REFERENCES printers(id);
ALTER TABLE print_job_printers ADD COLUMN printer_type_id INTEGER REFERENCES printer_types(id);
ALTER TABLE print_job_printers RENAME COLUMN printer_profile_id TO printer_id;

-- Update printer_usage_history table
ALTER TABLE printer_usage_history RENAME COLUMN printer_profile_id TO printer_id;

-- Create additional indexes
CREATE INDEX idx_print_jobs_printer_type ON print_jobs(printer_type_id);
CREATE INDEX idx_print_job_printers_assigned ON print_job_printers(assigned_printer_id);

-- Clean up temporary table
DROP TABLE temp_printer_types;