-- Migration: Fix printer name unique constraint to be case-insensitive
-- SQLite's UNIQUE constraint is case-sensitive, so we need a normalized column

-- First, rename the existing table
ALTER TABLE printers RENAME TO printers_old2;

-- Create new table with normalized name column
CREATE TABLE printers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    printer_type_id INTEGER REFERENCES printer_types(id),
    name TEXT NOT NULL,
    name_normalized TEXT NOT NULL,  -- Lowercase, trimmed version for uniqueness
    purchase_price_eur REAL NOT NULL DEFAULT 0,
    purchase_date DATE,
    working_hours REAL NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'printing', 'maintenance', 'offline')),
    owner_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE(name_normalized, owner_id)  -- Case-insensitive unique constraint
);

-- Copy data from old table with normalized names
INSERT INTO printers (id, printer_type_id, name, name_normalized, purchase_price_eur, purchase_date, working_hours, status, owner_id, created_at, updated_at)
SELECT 
    id, 
    printer_type_id, 
    TRIM(name) as name,  -- Trim the display name
    LOWER(REPLACE(REPLACE(REPLACE(TRIM(name), ' ', ''), '	', ''), '  ', '')) as name_normalized,  -- Remove all spaces
    purchase_price_eur, 
    purchase_date, 
    working_hours, 
    status, 
    owner_id, 
    created_at, 
    updated_at
FROM printers_old2;

-- Drop old table
DROP TABLE printers_old2;

-- Recreate indexes
CREATE INDEX idx_printers_printer_type ON printers(printer_type_id);
CREATE INDEX idx_printers_status ON printers(status);
CREATE INDEX idx_printers_owner ON printers(owner_id);
CREATE INDEX idx_printers_name_normalized ON printers(name_normalized);