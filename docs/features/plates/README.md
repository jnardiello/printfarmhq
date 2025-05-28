# Product Plates Feature

## Overview

The Product Plates feature transforms the product model from direct filament associations to a flexible plate-based system. This allows products to consist of multiple components (plates), each with their own filament usage and quantity specifications.

## Key Benefits

- **Multi-Component Products**: Products can now be composed of multiple plates (e.g., base, top, handle)
- **Flexible Quantity Management**: Each plate can have its own quantity multiplier
- **Individual File Management**: Each plate can have its own 3D model file
- **Improved Cost Calculation**: More accurate COGS calculations based on actual component structure
- **Better Organization**: Cleaner product structure for complex multi-part items

## Architecture

### Database Schema

```
Product (1) ←→ (N) Plate (1) ←→ (N) PlateFilamentUsage (N) ←→ (1) Filament
```

**New Tables:**
- `plates`: Individual components of a product
- `plate_filament_usages`: Filament usage per plate

### API Endpoints

**Plate Management:**
- `POST /products/{product_id}/plates` - Create a new plate
- `GET /products/{product_id}/plates` - List plates for a product
- `GET /plates/{plate_id}` - Get plate details
- `PATCH /plates/{plate_id}` - Update a plate
- `DELETE /plates/{plate_id}` - Delete a plate

**Enhanced Product Endpoints:**
- `GET /products` - Now includes plates in response
- Product COP calculation automatically uses plate-based costs

### Frontend Components

**New Components:**
- `PlateManager`: Full-featured plate management interface
- Updated `ProductsTab`: Shows plates instead of direct filament usage

**Enhanced Features:**
- Plate creation and editing with file upload
- Drag-and-drop file support
- Filament usage management per plate
- Cost visualization per plate

## Cost Calculation

### New Calculation Method (Plates)
```
Product COP = Σ (Plate Cost × Plate Quantity)
Plate Cost = Σ ((Filament Usage ÷ 1000) × Filament Price)
```

### Legacy Fallback
Products without plates automatically fall back to the original calculation method for backward compatibility.

## Migration Strategy

### Automatic Migration
- All existing products are automatically migrated to have a default "Main" plate
- Original filament usages are transferred to the default plate
- Product-level model files are moved to plate level
- Cost calculations remain identical after migration

### Backward Compatibility
- Legacy `filament_usages` relationship is preserved during transition
- API responses include both legacy and plate data
- COGS calculation handles both structures seamlessly

## Implementation Files

### Backend
- `backend/app/models.py` - New Plate and PlateFilamentUsage models
- `backend/app/schemas.py` - Plate-related Pydantic schemas
- `backend/app/main.py` - Plate API endpoints and updated COGS calculation
- `backend/migrate_to_plates.py` - Database migration script

### Frontend
- `frontend/lib/types.ts` - TypeScript interfaces for plates
- `frontend/components/data-provider.tsx` - Plate API integration
- `frontend/components/plate-manager.tsx` - Plate management UI
- `frontend/components/tabs/products-tab.tsx` - Updated product display

### Tests
- `backend/tests/test_plates.py` - Comprehensive plate functionality tests
- `backend/tests/test_migration.py` - Migration validation tests
- `backend/tests/test_unit_business_calculations.py` - Updated COGS tests

### Documentation
- `docs/features/plates/current-implementation-analysis.md` - Pre-implementation analysis
- `docs/features/plates/deployment-guide.md` - Complete deployment instructions
- `docs/features/plates/README.md` - This overview document

## Development Workflow

### Getting Started
```bash
# Start development environment (migrations run automatically)
make dev
```

When you run `make dev`, the following happens automatically:
1. **Docker containers start** with hot reload
2. **Database migrations run** automatically via `backend/start.sh`
3. **Plates migration applies** - converts existing products to plate structure
4. **Application is ready** with full plate functionality at `http://localhost:3000`

### Migration Commands
```bash
# Check migration status
make migrate-list

# Preview pending migrations
make migrate-dry-run

# Manual migration (if needed)
make migrate

# Rollback last migration
make migrate-revert

# Rollback to specific version
make migrate-revert-to VERSION=20250528_000000
```

### Development Environment Reset
To start completely fresh:
```bash
# Stop development environment
make down

# Remove database to start clean
rm backend/hq.db

# Start fresh (all migrations will run)
make dev
```

### Working with Plates During Development
After migration runs automatically, you'll have:
- **Existing products**: Automatically converted to have a "Main" plate
- **New products**: Can be created with traditional form or plate management
- **Plate management**: Available via "Manage Plates" button (Package icon)
- **Backward compatibility**: Legacy products continue to work seamlessly

## Usage Examples

### Creating a Multi-Plate Product

1. **Create the base product** using the standard product form
2. **Access plate management** via the "Manage Plates" button (Package icon)
3. **Add additional plates** with specific filament usage and quantities
4. **Upload individual STL/3MF files** for each plate if needed

### Example: Phone Case Product

```
Product: "iPhone 15 Case"
├── Plate: "Base" (Qty: 1)
│   ├── TPU Filament: 15g
│   └── File: base.stl
└── Plate: "Insert" (Qty: 2)
    ├── PLA Filament: 5g
    └── File: insert.stl

Total Cost = (15g/1000 × €30/kg × 1) + (5g/1000 × €25/kg × 2)
           = €0.45 + €0.25 = €0.70
```

## Testing

### Running Tests
```bash
# Backend tests
cd backend
pytest tests/test_plates.py -v
pytest tests/test_migration.py -v
pytest tests/test_unit_business_calculations.py -v

# Frontend build verification
cd frontend
npm run build
```

### Test Coverage
- ✅ Plate CRUD operations
- ✅ File upload/management
- ✅ Cost calculations
- ✅ Migration validation
- ✅ Backward compatibility
- ✅ Error handling
- ✅ API validation

## Deployment

See [Deployment Guide](./deployment-guide.md) for complete deployment instructions.

### Quick Deployment Steps
1. **Backup database**
2. **Deploy backend code** (migrations run automatically on startup)
3. **Deploy frontend code**
4. **Verify functionality**

### Migration Commands
```bash
# Check migration status
make migrate-list

# Preview pending migrations
make migrate-dry-run

# Manual migration (if needed)
make migrate

# Rollback last migration
make migrate-revert

# Rollback to specific version
make migrate-revert-to VERSION=20250528_000000
```

## Future Enhancements

### Planned Features
- **Plate Templates**: Reusable plate configurations
- **Bulk Operations**: Edit multiple plates simultaneously
- **Cost History**: Track plate cost changes over time
- **Material Combinations**: Advanced multi-material plates
- **Assembly Instructions**: Step-by-step assembly guides

### Performance Optimizations
- Query optimization for complex product structures
- Caching for frequently accessed plate data
- Batch operations for large product catalogs

## Support

### Common Issues
- **Migration Problems**: See deployment guide rollback procedures
- **Cost Discrepancies**: Use migration validation tools
- **UI Issues**: Clear browser cache and verify API responses

### Monitoring
- API performance metrics
- Database query performance
- User adoption rates
- Error rates and patterns

## Contributing

When working with the plate system:

1. **Database Changes**: Always include migration scripts
2. **API Changes**: Update both schemas and tests
3. **Frontend Changes**: Maintain backward compatibility
4. **Testing**: Include comprehensive test coverage
5. **Documentation**: Update relevant documentation files

## Version History

- **v1.0.0**: Initial plate system implementation
- **v1.0.1**: Migration script improvements
- **v1.1.0**: Enhanced plate management UI (planned)

---

For detailed technical implementation, see the analysis and deployment documentation in this directory.