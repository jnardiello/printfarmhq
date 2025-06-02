-- 20250602_201015_add_owner_id_to_all_tables.sql
-- Migration: add_owner_id_to_all_tables
-- Created: 2025-06-02T20:10:15.020613

-- UP: Apply the migration

-- Add owner_id to all data tables (points to super-admin user who owns the data)
ALTER TABLE filaments ADD COLUMN owner_id INTEGER REFERENCES users(id);
ALTER TABLE products ADD COLUMN owner_id INTEGER REFERENCES users(id);
ALTER TABLE plates ADD COLUMN owner_id INTEGER REFERENCES users(id);
ALTER TABLE plate_filament_usages ADD COLUMN owner_id INTEGER REFERENCES users(id);
ALTER TABLE filament_usages ADD COLUMN owner_id INTEGER REFERENCES users(id);
ALTER TABLE subscriptions ADD COLUMN owner_id INTEGER REFERENCES users(id);
ALTER TABLE filament_purchases ADD COLUMN owner_id INTEGER REFERENCES users(id);
ALTER TABLE printer_profiles ADD COLUMN owner_id INTEGER REFERENCES users(id);
ALTER TABLE print_jobs ADD COLUMN owner_id INTEGER REFERENCES users(id);
ALTER TABLE print_job_products ADD COLUMN owner_id INTEGER REFERENCES users(id);
ALTER TABLE print_job_printers ADD COLUMN owner_id INTEGER REFERENCES users(id);

-- Create indexes for efficient filtering by owner
CREATE INDEX idx_filaments_owner ON filaments(owner_id);
CREATE INDEX idx_products_owner ON products(owner_id);
CREATE INDEX idx_plates_owner ON plates(owner_id);
CREATE INDEX idx_plate_filament_usages_owner ON plate_filament_usages(owner_id);
CREATE INDEX idx_filament_usages_owner ON filament_usages(owner_id);
CREATE INDEX idx_subscriptions_owner ON subscriptions(owner_id);
CREATE INDEX idx_filament_purchases_owner ON filament_purchases(owner_id);
CREATE INDEX idx_printer_profiles_owner ON printer_profiles(owner_id);
CREATE INDEX idx_print_jobs_owner ON print_jobs(owner_id);
CREATE INDEX idx_print_job_products_owner ON print_job_products(owner_id);
CREATE INDEX idx_print_job_printers_owner ON print_job_printers(owner_id);

-- DOWN: Revert the migration

-- Drop all indexes
DROP INDEX IF EXISTS idx_filaments_owner;
DROP INDEX IF EXISTS idx_products_owner;
DROP INDEX IF EXISTS idx_plates_owner;
DROP INDEX IF EXISTS idx_plate_filament_usages_owner;
DROP INDEX IF EXISTS idx_filament_usages_owner;
DROP INDEX IF EXISTS idx_subscriptions_owner;
DROP INDEX IF EXISTS idx_filament_purchases_owner;
DROP INDEX IF EXISTS idx_printer_profiles_owner;
DROP INDEX IF EXISTS idx_print_jobs_owner;
DROP INDEX IF EXISTS idx_print_job_products_owner;
DROP INDEX IF EXISTS idx_print_job_printers_owner;

-- Note: SQLite doesn't support DROP COLUMN
-- To properly rollback, we would need to recreate all tables without owner_id
-- This is omitted for brevity but would be needed for production
