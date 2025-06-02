-- 20250602_193618_add_printer_model_field.sql
-- Migration: add_printer_model_field
-- Created: 2025-06-02T19:36:18.551256

-- UP: Apply the migration
ALTER TABLE printer_profiles ADD COLUMN model TEXT;

-- DOWN: Revert the migration
ALTER TABLE printer_profiles DROP COLUMN model;
