# Product Plates Feature - Deployment Guide

## Overview

This guide covers the deployment of the product plates feature, which transforms the product model from direct filament associations to a plate-based system where products consist of one or more plates, each with their own filament usage.

## Pre-Deployment Checklist

### 1. Backend Requirements
- [ ] All new models are implemented in `backend/app/models.py`
- [ ] All new schemas are implemented in `backend/app/schemas.py`
- [ ] All new API endpoints are implemented in `backend/app/main.py`
- [ ] Migration script is ready at `backend/migrate_to_plates.py`
- [ ] All tests pass

### 2. Frontend Requirements  
- [ ] New types are defined in `frontend/lib/types.ts`
- [ ] Data provider includes plate APIs in `frontend/components/data-provider.tsx`
- [ ] Plate manager component is implemented in `frontend/components/plate-manager.tsx`
- [ ] Products tab is updated to show plates in `frontend/components/tabs/products-tab.tsx`

### 3. Testing Verification
- [ ] Backend tests pass: `pytest backend/tests/test_plates.py`
- [ ] Migration tests pass: `pytest backend/tests/test_migration.py` 
- [ ] Updated business calculation tests pass: `pytest backend/tests/test_unit_business_calculations.py`
- [ ] Frontend builds without errors: `npm run build`

## Deployment Steps

### Step 1: Database Backup
```bash
# Create a full backup of the production database
pg_dump -h localhost -U postgres printfarmhq > backup_pre_plates_$(date +%Y%m%d_%H%M%S).sql
```

### Step 2: Deploy Backend Code
```bash
# Deploy backend changes
cd backend
# Update requirements if needed
pip install -r requirements.txt
# Restart backend service
systemctl restart printfarmhq-backend
```

### Step 3: Migrations Run Automatically
The plates migration will run automatically when the backend starts up. You can verify pending migrations before deployment:

```bash
# Check migration status
cd backend
python3 app/migrate.py list

# Preview what will be migrated (dry run)
python3 app/migrate.py migrate --dry-run
```

**Expected Migration Output (in backend logs):**
```
🔄 Running database migrations...
🔄 Checking for pending database migrations...
📋 Found 1 pending migration(s):
  - 20250528_231946_add_product_plates_structure.sql
Applying migration: 20250528_231946_add_product_plates_structure.sql
✅ Successfully applied migration: 20250528_231946_add_product_plates_structure.sql
🎉 Successfully applied 1 migration(s)!
✅ Database migrations completed successfully
```

### Step 4: Verify Migration
```bash
# Check that all products have plates
psql -d printfarmhq -c "SELECT p.id, p.name, COUNT(pl.id) as plate_count FROM products p LEFT JOIN plates pl ON p.id = pl.product_id GROUP BY p.id, p.name;"

# Verify cost calculations match
psql -d printfarmhq -c "SELECT id, name, cop FROM products LIMIT 5;"
```

### Step 5: Deploy Frontend Code
```bash
# Deploy frontend changes
cd frontend
npm run build
# Deploy to your hosting service (e.g., Vercel, Netlify)
```

### Step 6: Test Deployed Application
1. **Product List**: Verify products display correctly with COP values
2. **Product Details**: Check that product details show plates instead of direct filament usages
3. **Plate Management**: Test creating, editing, and deleting plates
4. **COGS Calculation**: Verify print job COGS calculations work correctly
5. **File Uploads**: Test plate-level file uploads work

## Post-Deployment Monitoring

### Key Metrics to Monitor
1. **API Performance**: Monitor plate-related endpoint response times
2. **Database Performance**: Watch for any query slowdowns
3. **Error Rates**: Monitor for any plate-related errors
4. **User Adoption**: Track usage of the plate management features

### Common Issues and Solutions

#### Issue 1: Migration Fails with Foreign Key Constraints
**Symptom**: Migration script fails with foreign key constraint errors
**Solution**: 
```bash
# Check for orphaned records
psql -d printfarmhq -c "SELECT fu.id FROM filament_usages fu LEFT JOIN products p ON fu.product_id = p.id WHERE p.id IS NULL;"
# Clean up orphaned records before re-running migration
```

#### Issue 2: COP Values Don't Match After Migration
**Symptom**: Product costs change after migration
**Solution**:
```bash
# Re-run migration validation
python migrate_to_plates.py --validate-only
# Check for missing filament price data
```

#### Issue 3: Frontend Shows Empty Plates
**Symptom**: Products show "No plates" even after migration
**Solution**:
- Verify API endpoints return plates data
- Check frontend data provider includes plates in product queries
- Clear browser cache

## Rollback Plan

If issues arise, you have two rollback options:

### Option 1: Migration Rollback (Recommended)
Use the built-in migration system to rollback just the plates changes:

```bash
# Stop services
systemctl stop printfarmhq-backend

# Rollback the plates migration
cd backend
python3 app/migrate.py revert --count 1

# Or rollback to a specific version
python3 app/migrate.py revert-to --version 20250528_000000

# Restart services
systemctl start printfarmhq-backend
```

### Option 2: Full Database Restore
If migration rollback fails, restore from backup:

```bash
# Stop services
systemctl stop printfarmhq-backend
systemctl stop printfarmhq-frontend

# Restore database from backup
sqlite3 backend/hq.db ".read backup_pre_plates_YYYYMMDD_HHMMSS.sql"

# Deploy previous code version
git checkout [previous-commit-hash]
# Redeploy backend and frontend

# Restart services
systemctl start printfarmhq-backend
systemctl start printfarmhq-frontend
```

### Rollback Verification
After rollback, verify:
- Products show legacy filament_usages instead of plates
- COGS calculations work correctly
- No plate-related API endpoints are accessible

## Feature Flags (Optional)

Consider implementing feature flags to gradually roll out the plate functionality:

```python
# In backend/app/main.py
PLATES_FEATURE_ENABLED = os.getenv("PLATES_FEATURE_ENABLED", "false").lower() == "true"

@app.get("/products", response_model=list[schemas.ProductRead])
def list_products(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if PLATES_FEATURE_ENABLED:
        # Include plates in response
        products_db = db.query(models.Product).options(
            joinedload(models.Product.plates).joinedload(models.Plate.filament_usages)
        ).all()
    else:
        # Legacy response without plates
        products_db = db.query(models.Product).options(
            joinedload(models.Product.filament_usages)
        ).all()
    return [schemas.ProductRead.model_validate(p) for p in products_db]
```

## Success Criteria

The deployment is considered successful when:

- [ ] All existing products have been migrated to have at least one plate
- [ ] Product COP calculations match pre-migration values
- [ ] Users can create, edit, and delete plates through the UI
- [ ] Print job COGS calculations work correctly with plate-based products
- [ ] No critical errors in application logs
- [ ] All automated tests pass in production environment

## Support and Troubleshooting

### Log Locations
- Backend logs: `/var/log/printfarmhq/backend.log`
- Migration logs: Console output during migration
- Frontend logs: Browser developer console

### Database Queries for Debugging
```sql
-- Check plate distribution
SELECT 
    COUNT(*) as total_products,
    AVG(plate_count) as avg_plates_per_product,
    MIN(plate_count) as min_plates,
    MAX(plate_count) as max_plates
FROM (
    SELECT p.id, COUNT(pl.id) as plate_count 
    FROM products p 
    LEFT JOIN plates pl ON p.id = pl.product_id 
    GROUP BY p.id
) subq;

-- Check cost calculation differences
SELECT 
    p.id,
    p.name,
    p.cop as current_cop,
    SUM(pl.cost) as calculated_plate_cost
FROM products p
JOIN plates pl ON p.id = pl.product_id
GROUP BY p.id, p.name, p.cop
HAVING ABS(p.cop - SUM(pl.cost)) > 0.01;
```

## Next Steps

After successful deployment:

1. **Monitor Usage**: Track how users interact with the plate management features
2. **Gather Feedback**: Collect user feedback on the new interface
3. **Performance Optimization**: Optimize queries if needed based on usage patterns
4. **Legacy Cleanup**: Plan removal of legacy filament_usages relationship after validation period
5. **Enhanced Features**: Consider implementing advanced plate features like:
   - Plate templates
   - Bulk plate operations
   - Plate cost history
   - Multi-material plates

## Documentation Updates

Update the following documentation after deployment:
- [ ] API documentation with new plate endpoints
- [ ] User guide with plate management instructions
- [ ] Developer documentation with new data models
- [ ] Backup and recovery procedures