-- 20250606_000000_add_printer_manufacturer.sql
-- Migration: Add manufacturer field to printer profiles
-- Created: 2025-06-06T00:00:00

-- UP: Apply the migration
ALTER TABLE printer_profiles ADD COLUMN manufacturer TEXT;

-- DOWN: Revert the migration
ALTER TABLE printer_profiles DROP COLUMN manufacturer;