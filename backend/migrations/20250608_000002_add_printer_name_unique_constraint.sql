-- Migration: Add unique constraint for printer names
-- This ensures each owner can only have one printer with the same name

-- SQLite doesn't support adding constraints to existing tables
-- So we need to recreate the table with the constraint

-- First, rename the existing table
ALTER TABLE printers RENAME TO printers_old;

-- Create new table with unique constraint
CREATE TABLE printers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    printer_type_id INTEGER REFERENCES printer_types(id),
    name TEXT NOT NULL,
    purchase_price_eur REAL NOT NULL DEFAULT 0,
    purchase_date DATE,
    working_hours REAL NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'printing', 'maintenance', 'offline')),
    owner_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE(name, owner_id)  -- Add unique constraint
);

-- Copy data from old table
INSERT INTO printers (id, printer_type_id, name, purchase_price_eur, purchase_date, working_hours, status, owner_id, created_at, updated_at)
SELECT id, printer_type_id, name, purchase_price_eur, purchase_date, working_hours, status, owner_id, created_at, updated_at
FROM printers_old;

-- Drop old table
DROP TABLE printers_old;

-- Recreate indexes
CREATE INDEX idx_printers_printer_type ON printers(printer_type_id);
CREATE INDEX idx_printers_status ON printers(status);
CREATE INDEX idx_printers_owner ON printers(owner_id);