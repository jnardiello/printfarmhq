# Backend Transaction Management

## Overview

The creation of a filament with its initial purchase must be atomic - either both are created successfully, or neither is created. This prevents data inconsistencies and orphaned records.

## Implementation Details

### Transaction Wrapper

```python
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

@app.post("/filaments/create-flexible", response_model=schemas.FilamentFlexibleResponse)
async def create_filament_flexible(
    filament_data: schemas.FilamentFlexibleCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Create a new filament type with optional initial inventory.
    """
    try:
        # Check for existing filament first (outside transaction for better performance)
        existing_filament = db.query(models.Filament).filter(
            models.Filament.color == filament_data.color,
            models.Filament.brand == filament_data.brand,
            models.Filament.material == filament_data.material
        ).first()
        
        if existing_filament:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "Filament already exists",
                    "existing_filament": schemas.FilamentRead.model_validate(existing_filament)
                }
            )
        
        # Start transaction - SQLAlchemy session is transactional by default
        # Create filament
        db_filament = models.Filament(
            color=filament_data.color,
            brand=filament_data.brand,
            material=filament_data.material,
            price_per_kg=filament_data.estimated_cost_per_kg,  # Use estimated cost initially
            total_qty_kg=0.0,  # No inventory by default
            min_filaments_kg=None  # User can set this later
        )
        
        warnings = []
        db_purchase = None
        
        # Optionally create purchase
        if filament_data.create_purchase and filament_data.purchase_data:
            # Update filament with actual purchase data
            db_filament.price_per_kg = filament_data.purchase_data.price_per_kg
            db_filament.total_qty_kg = filament_data.purchase_data.quantity_kg
            
            db.add(db_filament)
            db.flush()  # Flush to get the ID without committing
            
            # Create purchase record
            db_purchase = models.FilamentPurchase(
                filament_id=db_filament.id,
                quantity_kg=filament_data.purchase_data.quantity_kg,
                price_per_kg=filament_data.purchase_data.price_per_kg,
                purchase_date=filament_data.purchase_data.purchase_date or date.today(),
                purchase_channel=filament_data.purchase_data.purchase_channel,
                notes=filament_data.purchase_data.notes
            )
            db.add(db_purchase)
        else:
            # No purchase - just create the filament type
            db.add(db_filament)
            warnings.append("No inventory tracked for this filament")
        
        # Commit transaction
        db.commit()
        
        # Refresh to get all fields
        db.refresh(db_filament)
        if db_purchase:
            db.refresh(db_purchase)
        
        return schemas.FilamentFlexibleResponse(
            filament=schemas.FilamentRead.model_validate(db_filament),
            purchase=schemas.FilamentPurchaseRead.model_validate(db_purchase) if db_purchase else None,
            message="Filament created successfully" + (" with initial inventory" if db_purchase else ""),
            warnings=warnings
        )
        
    except IntegrityError as e:
        db.rollback()
        # This could happen if another request created the same filament concurrently
        # Try to fetch the existing filament
        existing_filament = db.query(models.Filament).filter(
            models.Filament.color == filament_data.color,
            models.Filament.brand == filament_data.brand,
            models.Filament.material == filament_data.material
        ).first()
        
        if existing_filament:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "Filament was created by another process",
                    "existing_filament": schemas.FilamentRead.model_validate(existing_filament)
                }
            )
        else:
            # Some other integrity error
            logger.error(f"Integrity error creating filament: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail="Failed to create filament due to data integrity error"
            )
            
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error creating filament with purchase: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to create filament with purchase. Transaction rolled back."
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error creating filament with purchase: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred"
        )
```

### Transaction Boundaries

1. **Begin**: Transaction starts automatically with the SQLAlchemy session
2. **Operations**:
   - Check for existing filament (read operation)
   - Create filament record
   - Flush to get filament ID
   - Create purchase record
3. **Commit**: Both records are committed together
4. **Rollback**: On any error, both operations are rolled back

### Concurrency Handling

The unique constraint on (color, brand, material) prevents duplicate filaments even under concurrent requests:

```python
# In models.py
class Filament(Base):
    __tablename__ = "filament"
    
    # ... other fields ...
    
    __table_args__ = (
        UniqueConstraint('color', 'brand', 'material', name='_color_brand_material_uc'),
    )
```

### Error Recovery Strategies

1. **Duplicate Filament (409)**
   - Return existing filament info
   - Frontend can auto-select it
   - User continues without interruption

2. **Validation Error (422)**
   - Return specific field errors
   - Frontend shows inline validation
   - User corrects and retries

3. **Database Error (500)**
   - Log full error for debugging
   - Return generic message to user
   - Frontend shows retry option

### Performance Considerations

1. **Indexes**: Ensure composite index on (color, brand, material) for fast lookups
2. **Connection Pooling**: Use SQLAlchemy's connection pool for better performance
3. **Flush vs Commit**: Use flush() to get IDs before final commit
4. **Read Committed Isolation**: Default level is sufficient for this use case

### Testing the Transaction

```python
# Test case for transaction rollback
def test_create_filament_with_purchase_rollback(client, db_session):
    # Mock a database error after filament creation
    with patch.object(db_session, 'add', side_effect=[None, SQLAlchemyError("DB Error")]):
        response = client.post(
            "/filaments/create-with-purchase",
            json={
                "color": "Red",
                "brand": "Test",
                "material": "PLA",
                "quantity_kg": 1.0,
                "price_per_kg": 25.0
            }
        )
        
        assert response.status_code == 500
        
        # Verify no filament was created
        filament = db_session.query(models.Filament).filter_by(
            color="Red", brand="Test", material="PLA"
        ).first()
        assert filament is None
        
        # Verify no purchase was created
        purchases = db_session.query(models.FilamentPurchase).all()
        assert len(purchases) == 0
```

### Monitoring and Logging

Add appropriate logging for debugging:

```python
logger.info(f"Creating filament with purchase: {filament_data.color} {filament_data.brand} {filament_data.material}")
logger.info(f"Filament created with ID: {db_filament.id}")
logger.info(f"Purchase created with ID: {db_purchase.id}")
```

### Migration Considerations

If adding the unique constraint to existing database:

```sql
-- Check for duplicates first
SELECT color, brand, material, COUNT(*) 
FROM filament 
GROUP BY color, brand, material 
HAVING COUNT(*) > 1;

-- Add constraint if no duplicates
ALTER TABLE filament 
ADD CONSTRAINT _color_brand_material_uc 
UNIQUE (color, brand, material);
```