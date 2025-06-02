-- 20250602_202500_populate_owner_id_for_existing_data.sql
-- Migration: populate_owner_id_for_existing_data
-- Created: 2025-06-02T20:25:00.000000

-- UP: Apply the migration

-- Find the first super-admin user and use as default owner for existing data
-- If no super-admin exists yet, the data will remain without owner (NULL)
UPDATE filaments 
SET owner_id = (SELECT id FROM users WHERE is_superadmin = 1 ORDER BY id LIMIT 1)
WHERE owner_id IS NULL;

UPDATE products 
SET owner_id = (SELECT id FROM users WHERE is_superadmin = 1 ORDER BY id LIMIT 1)
WHERE owner_id IS NULL;

UPDATE plates 
SET owner_id = (SELECT id FROM users WHERE is_superadmin = 1 ORDER BY id LIMIT 1)
WHERE owner_id IS NULL;

UPDATE plate_filament_usages 
SET owner_id = (SELECT id FROM users WHERE is_superadmin = 1 ORDER BY id LIMIT 1)
WHERE owner_id IS NULL;

UPDATE filament_usages 
SET owner_id = (SELECT id FROM users WHERE is_superadmin = 1 ORDER BY id LIMIT 1)
WHERE owner_id IS NULL;

UPDATE subscriptions 
SET owner_id = (SELECT id FROM users WHERE is_superadmin = 1 ORDER BY id LIMIT 1)
WHERE owner_id IS NULL;

UPDATE filament_purchases 
SET owner_id = (SELECT id FROM users WHERE is_superadmin = 1 ORDER BY id LIMIT 1)
WHERE owner_id IS NULL;

UPDATE printer_profiles 
SET owner_id = (SELECT id FROM users WHERE is_superadmin = 1 ORDER BY id LIMIT 1)
WHERE owner_id IS NULL;

UPDATE print_jobs 
SET owner_id = (SELECT id FROM users WHERE is_superadmin = 1 ORDER BY id LIMIT 1)
WHERE owner_id IS NULL;

UPDATE print_job_products 
SET owner_id = (SELECT id FROM users WHERE is_superadmin = 1 ORDER BY id LIMIT 1)
WHERE owner_id IS NULL;

UPDATE print_job_printers 
SET owner_id = (SELECT id FROM users WHERE is_superadmin = 1 ORDER BY id LIMIT 1)
WHERE owner_id IS NULL;

-- DOWN: Revert the migration

-- Clear all owner_id values to restore single-tenant behavior
UPDATE filaments SET owner_id = NULL;
UPDATE products SET owner_id = NULL;
UPDATE plates SET owner_id = NULL;
UPDATE plate_filament_usages SET owner_id = NULL;
UPDATE filament_usages SET owner_id = NULL;
UPDATE subscriptions SET owner_id = NULL;
UPDATE filament_purchases SET owner_id = NULL;
UPDATE printer_profiles SET owner_id = NULL;
UPDATE print_jobs SET owner_id = NULL;
UPDATE print_job_products SET owner_id = NULL;
UPDATE print_job_printers SET owner_id = NULL;