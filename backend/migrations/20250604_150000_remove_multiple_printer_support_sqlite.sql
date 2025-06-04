-- Migration: Remove multiple printer support (SQLite version)
-- Description: Simplify print jobs to only support single printer assignment
-- Author: AI Assistant
-- Date: 2025-06-04

-- SQLite doesn't support DROP COLUMN, so we need to recreate the tables

-- 1. Recreate print_job_printers table without printers_qty
CREATE TABLE print_job_printers_new (
    id INTEGER PRIMARY KEY,
    print_job_id CHAR(36) NOT NULL,
    printer_profile_id INTEGER,
    printer_type_id INTEGER,
    assigned_printer_id INTEGER,
    hours_each REAL NOT NULL DEFAULT 0.0,
    printer_name TEXT,
    printer_manufacturer TEXT,
    printer_model TEXT,
    printer_price_eur REAL,
    printer_expected_life_hours REAL,
    owner_id INTEGER,
    FOREIGN KEY (print_job_id) REFERENCES print_jobs(id),
    FOREIGN KEY (printer_type_id) REFERENCES printer_types(id),
    FOREIGN KEY (assigned_printer_id) REFERENCES printers(id),
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- Copy data from old table
INSERT INTO print_job_printers_new 
SELECT id, print_job_id, printer_profile_id, printer_type_id, assigned_printer_id, 
       hours_each, printer_name, printer_manufacturer, printer_model, 
       printer_price_eur, printer_expected_life_hours, owner_id
FROM print_job_printers;

-- Drop old table and rename new one
DROP TABLE print_job_printers;
ALTER TABLE print_job_printers_new RENAME TO print_job_printers;

-- Create indices
CREATE INDEX ix_print_job_printers_owner_id ON print_job_printers(owner_id);

-- 2. Recreate printer_usage_history table without printers_qty
CREATE TABLE printer_usage_history_new (
    id INTEGER PRIMARY KEY,
    printer_id INTEGER NOT NULL,
    print_job_id CHAR(36) NOT NULL,
    hours_used REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    week_year INTEGER NOT NULL,
    month_year INTEGER NOT NULL,
    quarter_year INTEGER NOT NULL,
    FOREIGN KEY (printer_id) REFERENCES printers(id) ON DELETE CASCADE,
    FOREIGN KEY (print_job_id) REFERENCES print_jobs(id) ON DELETE CASCADE
);

-- Copy data from old table
INSERT INTO printer_usage_history_new 
SELECT id, printer_id, print_job_id, hours_used, created_at, 
       week_year, month_year, quarter_year
FROM printer_usage_history;

-- Drop old table and rename new one
DROP TABLE printer_usage_history;
ALTER TABLE printer_usage_history_new RENAME TO printer_usage_history;