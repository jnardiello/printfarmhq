-- Migration: Add printer types system
-- This migration creates a printer_types table and refactors the existing printer_profiles 
-- to separate printer types (templates) from printer instances (actual machines)

-- Create printer_types table (similar to how filaments work)
CREATE TABLE printer_types (
    id SERIAL PRIMARY KEY,
    brand VARCHAR(255) NOT NULL,
    model VARCHAR(255) NOT NULL,
    expected_life_hours FLOAT NOT NULL DEFAULT 10000,
    owner_id INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    UNIQUE(brand, model, owner_id)
);

CREATE INDEX idx_printer_types_owner ON printer_types(owner_id);

-- Rename printer_profiles to printers (these will be actual instances)
ALTER TABLE printer_profiles RENAME TO printers;

-- Add printer_type_id column to printers table
ALTER TABLE printers ADD COLUMN printer_type_id INTEGER REFERENCES printer_types(id);

-- Create temporary columns for migration
ALTER TABLE printers ADD COLUMN temp_brand VARCHAR(255);
ALTER TABLE printers ADD COLUMN temp_model VARCHAR(255);

-- Extract brand and model from manufacturer field (assuming format like "Prusa MK3S+")
UPDATE printers 
SET temp_brand = CASE 
    WHEN manufacturer IS NOT NULL THEN manufacturer
    ELSE 'Unknown'
END,
temp_model = CASE 
    WHEN model IS NOT NULL THEN model  
    ELSE name
END;

-- Insert unique printer types from existing printers
INSERT INTO printer_types (brand, model, expected_life_hours, owner_id)
SELECT DISTINCT 
    temp_brand,
    temp_model,
    expected_life_hours,
    owner_id
FROM printers
WHERE temp_brand IS NOT NULL AND temp_model IS NOT NULL;

-- Update printers with printer_type_id
UPDATE printers p
SET printer_type_id = pt.id
FROM printer_types pt
WHERE p.temp_brand = pt.brand 
  AND p.temp_model = pt.model 
  AND p.owner_id = pt.owner_id;

-- Clean up temporary columns
ALTER TABLE printers DROP COLUMN temp_brand;
ALTER TABLE printers DROP COLUMN temp_model;

-- Remove columns that now belong to printer_types
ALTER TABLE printers DROP COLUMN manufacturer;
ALTER TABLE printers DROP COLUMN model;
ALTER TABLE printers DROP COLUMN expected_life_hours;

-- Add purchase_date column to printers (like filament_purchases has)
ALTER TABLE printers ADD COLUMN purchase_date DATE;

-- Rename price_eur to purchase_price_eur for clarity
ALTER TABLE printers RENAME COLUMN price_eur TO purchase_price_eur;

-- Add status column for printer availability
ALTER TABLE printers ADD COLUMN status VARCHAR(50) DEFAULT 'idle' CHECK (status IN ('idle', 'printing', 'maintenance', 'offline'));

-- Update print_jobs to use printer_type_id for COGS calculation
ALTER TABLE print_jobs ADD COLUMN printer_type_id INTEGER REFERENCES printer_types(id);

-- Update print_job_printers to track actual printer assignment
ALTER TABLE print_job_printers ADD COLUMN assigned_printer_id INTEGER REFERENCES printers(id);

-- Rename printer_profile_id to printer_id for clarity
ALTER TABLE print_job_printers RENAME COLUMN printer_profile_id TO printer_id;

-- Update printer_usage_history table references
ALTER TABLE printer_usage_history RENAME COLUMN printer_profile_id TO printer_id;

-- Update foreign key constraint
ALTER TABLE printer_usage_history DROP CONSTRAINT printer_usage_history_printer_profile_id_fkey;
ALTER TABLE printer_usage_history ADD CONSTRAINT printer_usage_history_printer_id_fkey 
    FOREIGN KEY (printer_id) REFERENCES printers(id) ON DELETE CASCADE;

-- Add printer_type_id to print_job_printers for historical tracking
ALTER TABLE print_job_printers ADD COLUMN printer_type_id INTEGER REFERENCES printer_types(id);

-- Create indexes for performance
CREATE INDEX idx_printers_printer_type ON printers(printer_type_id);
CREATE INDEX idx_printers_status ON printers(status);
CREATE INDEX idx_print_jobs_printer_type ON print_jobs(printer_type_id);
CREATE INDEX idx_print_job_printers_assigned ON print_job_printers(assigned_printer_id);