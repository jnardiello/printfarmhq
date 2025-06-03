-- 20250603_000000_add_audit_timestamps_to_core_models.sql
-- Migration: add_audit_timestamps_to_core_models
-- Created: 2025-06-03T00:00:00.000000

-- UP: Apply the migration
-- Add created_at and updated_at columns to core models for proper metrics tracking

-- Add timestamps to products table
ALTER TABLE products ADD COLUMN created_at DATETIME;
ALTER TABLE products ADD COLUMN updated_at DATETIME;

-- Add timestamps to filaments table
ALTER TABLE filaments ADD COLUMN created_at DATETIME;
ALTER TABLE filaments ADD COLUMN updated_at DATETIME;

-- Add timestamps to printer_profiles table
ALTER TABLE printer_profiles ADD COLUMN created_at DATETIME;
ALTER TABLE printer_profiles ADD COLUMN updated_at DATETIME;

-- Add timestamps to subscriptions table
ALTER TABLE subscriptions ADD COLUMN created_at DATETIME;
ALTER TABLE subscriptions ADD COLUMN updated_at DATETIME;

-- Add timestamps to filament_purchases table
ALTER TABLE filament_purchases ADD COLUMN created_at DATETIME;
ALTER TABLE filament_purchases ADD COLUMN updated_at DATETIME;

-- Add timestamps to plates table
ALTER TABLE plates ADD COLUMN created_at DATETIME;
ALTER TABLE plates ADD COLUMN updated_at DATETIME;

-- Set default values for existing records
UPDATE products SET created_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
UPDATE filaments SET created_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
UPDATE printer_profiles SET created_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
UPDATE subscriptions SET created_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
UPDATE filament_purchases SET created_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
UPDATE plates SET created_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;

-- Create triggers for automatic updated_at timestamp updates (SQLite syntax)
CREATE TRIGGER update_products_updated_at 
    AFTER UPDATE ON products 
    FOR EACH ROW 
    BEGIN 
        UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_filaments_updated_at 
    AFTER UPDATE ON filaments 
    FOR EACH ROW 
    BEGIN 
        UPDATE filaments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_printer_profiles_updated_at 
    AFTER UPDATE ON printer_profiles 
    FOR EACH ROW 
    BEGIN 
        UPDATE printer_profiles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_subscriptions_updated_at 
    AFTER UPDATE ON subscriptions 
    FOR EACH ROW 
    BEGIN 
        UPDATE subscriptions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_filament_purchases_updated_at 
    AFTER UPDATE ON filament_purchases 
    FOR EACH ROW 
    BEGIN 
        UPDATE filament_purchases SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_plates_updated_at 
    AFTER UPDATE ON plates 
    FOR EACH ROW 
    BEGIN 
        UPDATE plates SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- DOWN: Revert the migration
-- Drop triggers first
-- DROP TRIGGER IF EXISTS update_products_updated_at;
-- DROP TRIGGER IF EXISTS update_filaments_updated_at;
-- DROP TRIGGER IF EXISTS update_printer_profiles_updated_at;
-- DROP TRIGGER IF EXISTS update_subscriptions_updated_at;
-- DROP TRIGGER IF EXISTS update_filament_purchases_updated_at;
-- DROP TRIGGER IF EXISTS update_plates_updated_at;

-- Remove columns (SQLite doesn't support DROP COLUMN, would need table recreation)
-- ALTER TABLE products DROP COLUMN created_at;
-- ALTER TABLE products DROP COLUMN updated_at;
-- ALTER TABLE filaments DROP COLUMN created_at;
-- ALTER TABLE filaments DROP COLUMN updated_at;
-- ALTER TABLE printer_profiles DROP COLUMN created_at;
-- ALTER TABLE printer_profiles DROP COLUMN updated_at;
-- ALTER TABLE subscriptions DROP COLUMN created_at;
-- ALTER TABLE subscriptions DROP COLUMN updated_at;
-- ALTER TABLE filament_purchases DROP COLUMN created_at;
-- ALTER TABLE filament_purchases DROP COLUMN updated_at;
-- ALTER TABLE plates DROP COLUMN created_at;
-- ALTER TABLE plates DROP COLUMN updated_at;