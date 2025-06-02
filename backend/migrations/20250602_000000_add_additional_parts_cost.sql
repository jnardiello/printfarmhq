-- 20250602_000000_add_additional_parts_cost.sql
-- Migration: Add additional_parts_cost field to support non-filament component costs
-- Created: 2025-01-02T00:00:00

-- UP: Apply the migration
ALTER TABLE products ADD COLUMN additional_parts_cost FLOAT NOT NULL DEFAULT 0.0;

-- DOWN: Revert the migration
ALTER TABLE products DROP COLUMN additional_parts_cost;