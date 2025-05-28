-- 20250528_231946_add_product_plates_structure.sql
-- Migration: add_product_plates_structure
-- Created: 2025-05-28T23:19:46.928076

-- UP: Apply the migration

-- Create plates table
CREATE TABLE IF NOT EXISTS plates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    print_time_hrs REAL NOT NULL DEFAULT 0.0,
    file_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create plate_filament_usages table
CREATE TABLE IF NOT EXISTS plate_filament_usages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plate_id INTEGER NOT NULL REFERENCES plates(id) ON DELETE CASCADE,
    filament_id INTEGER NOT NULL REFERENCES filaments(id) ON DELETE CASCADE,
    grams_used REAL NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_plates_product_id ON plates(product_id);
CREATE INDEX IF NOT EXISTS idx_plate_filament_usages_plate_id ON plate_filament_usages(plate_id);
CREATE INDEX IF NOT EXISTS idx_plate_filament_usages_filament_id ON plate_filament_usages(filament_id);

-- Migrate existing products to have default plates
-- For each product with filament_usages, create a default "Main" plate
INSERT INTO plates (product_id, name, quantity, print_time_hrs, file_path)
SELECT 
    p.id,
    'Main' AS name,
    1 AS quantity,
    p.print_time_hrs,
    p.file_path
FROM products p
WHERE EXISTS (
    SELECT 1 FROM filament_usages fu WHERE fu.product_id = p.id
);

-- Migrate existing filament_usages to plate_filament_usages
-- Map each filament usage to the corresponding default plate
INSERT INTO plate_filament_usages (plate_id, filament_id, grams_used)
SELECT 
    pl.id AS plate_id,
    fu.filament_id,
    fu.grams_used
FROM filament_usages fu
JOIN products p ON fu.product_id = p.id
JOIN plates pl ON pl.product_id = p.id AND pl.name = 'Main';

-- DOWN: Revert the migration

-- Remove indexes
DROP INDEX IF EXISTS idx_plate_filament_usages_filament_id;
DROP INDEX IF EXISTS idx_plate_filament_usages_plate_id;
DROP INDEX IF EXISTS idx_plates_product_id;

-- Remove tables (this will cascade and remove all plate data)
-- Note: This will permanently delete all plate data, but legacy filament_usages remain intact
DROP TABLE IF EXISTS plate_filament_usages;
DROP TABLE IF EXISTS plates;