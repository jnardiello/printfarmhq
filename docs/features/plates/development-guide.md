# Product Plates - Development Guide

## What Happens When You Run `make dev`

When you run `make dev`, the following automatic processes occur:

### 1. Docker Containers Start
- Backend container starts with hot reload
- Frontend container starts with hot reload
- Database file is created if it doesn't exist

### 2. Automatic Database Migrations
The backend automatically runs pending migrations on startup via `backend/start.sh`:

```bash
🚀 Starting PrintFarmHQ Backend...
🔄 Running database migrations...
🔄 Checking for pending database migrations...
📋 Found 1 pending migration(s):
  - 20250528_231946_add_product_plates_structure.sql
Applying migration: 20250528_231946_add_product_plates_structure.sql
✅ Successfully applied migration: 20250528_231946_add_product_plates_structure.sql
🎉 Successfully applied 1 migration(s)!
✅ Database migrations completed successfully
🌟 Starting application server...
```

### 3. Plates Migration Automatically Applied
The plates migration (`20250528_231946_add_product_plates_structure.sql`) will:

- **Create new tables**: `plates` and `plate_filament_usages`
- **Migrate existing data**: Convert existing products with filament_usages to have default "Main" plates
- **Preserve legacy data**: Keep original `filament_usages` table for backward compatibility
- **Transfer files**: Move product-level model files to plate level

### 4. Application Ready
After migration completes:
- Backend API available at `http://localhost:8000` 
- Frontend UI available at `http://localhost:3000`
- All plate management features are immediately available

## Development Workflow

### Starting Development
```bash
# Start development environment (migrations run automatically)
make dev

# In another terminal, check migration status
make migrate-list
```

### Working with Plates
1. **Existing Products**: Automatically have a "Main" plate with all their filament usage
2. **New Products**: Can be created with the traditional form (creates legacy structure)
3. **Plate Management**: Use the "Manage Plates" button (Package icon) to add/edit plates
4. **Cost Calculation**: Works seamlessly with both plate-based and legacy products

### Testing Rollback During Development
```bash
# Rollback the plates migration
make migrate-revert

# Restart development environment
make dev
# (Migration will re-apply automatically)
```

### Checking Migration Status
```bash
# List all migrations and their status
make migrate-list

# Preview pending migrations without applying
make migrate-dry-run

# Manual migration (usually not needed)
make migrate
```

## Database State After Migration

### New Tables Created
```sql
-- Plates table
CREATE TABLE plates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    file_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Plate filament usages table  
CREATE TABLE plate_filament_usages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plate_id INTEGER NOT NULL REFERENCES plates(id) ON DELETE CASCADE,
    filament_id INTEGER NOT NULL REFERENCES filaments(id) ON DELETE CASCADE,
    grams_used REAL NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Data Migration Example
**Before Migration:**
```
Product: "Phone Case" (id: 1, file_path: "case.stl")
├── FilamentUsage: TPU, 15g
└── FilamentUsage: PLA, 5g
```

**After Migration:**
```
Product: "Phone Case" (id: 1, file_path: "case.stl") [unchanged]
├── FilamentUsage: TPU, 15g [preserved for compatibility]
├── FilamentUsage: PLA, 5g [preserved for compatibility]
└── Plate: "Main" (id: 1, quantity: 1, file_path: "case.stl")
    ├── PlateFilamentUsage: TPU, 15g
    └── PlateFilamentUsage: PLA, 5g
```

## Development Best Practices

### 1. Test Both Structures
During development, test that the application works with:
- **Legacy products**: Products created before migration (direct filament_usages)
- **Migrated products**: Products converted by migration (have default "Main" plate)
- **New plate products**: Products with multiple custom plates

### 2. Cost Calculation Verification
Verify that COP calculations work correctly:
```python
# Legacy calculation (fallback)
product.cop  # Uses filament_usages if no plates

# New calculation (preferred)
product.cop  # Uses sum of plate costs if plates exist
```

### 3. API Testing
Test both legacy and new API responses:
- `GET /products` - Should include both `filament_usages` and `plates` data
- `GET /products/{id}/plates` - New plate management endpoints
- COGS calculations in print jobs work with both structures

### 4. UI Testing
- Product details modal shows plates instead of filament_usages
- "Manage Plates" button opens plate management interface
- Creating/editing plates works correctly
- File uploads work at plate level

## Troubleshooting

### Migration Doesn't Run
If migration doesn't run automatically:
```bash
# Check if RUN_MIGRATIONS is disabled
echo $RUN_MIGRATIONS

# Run migration manually
make migrate
```

### Cost Calculations Don't Match
If costs change after migration:
```bash
# Check migration status
make migrate-list

# Rollback and re-apply
make migrate-revert
make dev  # Re-applies migration
```

### Frontend Shows "No Plates"
If products don't show plates in the UI:
- Check browser console for API errors
- Verify `/products` endpoint returns plates data
- Clear browser cache
- Check that products actually have plates in database

### Database Issues
```bash
# Check database state
sqlite3 backend/hq.db "SELECT COUNT(*) FROM plates;"
sqlite3 backend/hq.db "SELECT COUNT(*) FROM plate_filament_usages;"

# Verify product-plate relationships
sqlite3 backend/hq.db "
SELECT p.name, COUNT(pl.id) as plate_count 
FROM products p 
LEFT JOIN plates pl ON p.id = pl.product_id 
GROUP BY p.id, p.name;
"
```

## Development Environment Reset

To start completely fresh:
```bash
# Stop development environment
make down

# Remove database
rm backend/hq.db

# Start fresh (all migrations will run)
make dev
```

This creates a clean environment where all new products will use the plate structure from the beginning.