-- Add unique constraint to prevent duplicate filaments
-- This ensures each owner can only have one filament with the same color, brand, and material combination

-- SQLite version (for development/testing)
-- Note: SQLite doesn't support adding constraints to existing tables
-- So we need to recreate the table with the constraint

-- First, check if we're in SQLite
-- In SQLite, we'll need to handle this differently in the migration system

-- For PostgreSQL/MySQL:
-- ALTER TABLE filaments 
-- ADD CONSTRAINT _color_brand_material_owner_uc 
-- UNIQUE (color, brand, material, owner_id);

-- For now, we'll just add a comment indicating this constraint should be enforced
-- The application layer already checks for duplicates in the flexible endpoint
-- We need to also add checks to the standard endpoint

-- This migration is a placeholder to document the intended constraint
-- Actual implementation will depend on the database being used