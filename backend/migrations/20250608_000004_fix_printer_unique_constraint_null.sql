-- Migration: Fix printer name unique constraint to handle NULL owner_id
-- The problem: SQLite (and SQL in general) doesn't enforce uniqueness on NULL values
-- Solution: Create partial unique indexes

-- Drop the existing unique constraint (it's part of the table definition, so we need to recreate the table)
-- But first, let's create partial unique indexes that will properly handle NULL values

-- Create unique index for printers with non-NULL owner_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_printer_name_normalized_with_owner 
ON printers(name_normalized, owner_id) 
WHERE owner_id IS NOT NULL;

-- Create unique index for printers with NULL owner_id (god user's printers)
CREATE UNIQUE INDEX IF NOT EXISTS idx_printer_name_normalized_no_owner 
ON printers(name_normalized) 
WHERE owner_id IS NULL;

-- Note: The table already has a UNIQUE constraint, but these partial indexes 
-- will provide better enforcement for the NULL case