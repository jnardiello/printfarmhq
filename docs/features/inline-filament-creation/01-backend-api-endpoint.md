# Backend API Endpoint Design

## New Endpoint: Create Filament with Optional Purchase

### Endpoint Details

```
POST /api/filaments/create-flexible
```

### Purpose

Create a new filament type with an optional initial purchase. This allows users to:
1. Define filament types for product planning without requiring inventory
2. Optionally add initial stock in the same operation
3. Set estimated costs for COGS calculation even without tracked inventory

### Request Schema

```python
class FilamentFlexibleCreate(BaseModel):
    # Required filament type fields
    color: str = Field(..., min_length=1, max_length=50)
    brand: str = Field(..., min_length=1, max_length=50)
    material: str = Field(..., min_length=1, max_length=20)
    
    # Estimated cost for COGS calculation (required)
    estimated_cost_per_kg: float = Field(..., gt=0, description="Average cost per kg for COGS calculation")
    
    # Optional inventory tracking
    create_purchase: bool = Field(False, description="Whether to add initial inventory")
    
    # Purchase fields (required only if create_purchase is True)
    purchase_data: Optional[PurchaseData] = None

class PurchaseData(BaseModel):
    quantity_kg: float = Field(..., gt=0)
    price_per_kg: float = Field(..., gt=0)
    purchase_date: Optional[date] = Field(default_factory=date.today)
    purchase_channel: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = Field(None, max_length=500)

# Validation
@validator('purchase_data')
def validate_purchase_data(cls, v, values):
    if values.get('create_purchase') and not v:
        raise ValueError('purchase_data is required when create_purchase is True')
    return v
```

### Response Schema

```python
class FilamentFlexibleResponse(BaseModel):
    filament: FilamentRead
    purchase: Optional[FilamentPurchaseRead] = None
    message: str
    warnings: List[str] = []  # e.g., ["No inventory tracked for this filament"]
```

### Implementation Location

Add to `backend/app/main.py` after the existing filament endpoints (around line 230):

```python
@app.post("/filaments/create-flexible", response_model=schemas.FilamentFlexibleResponse)
async def create_filament_flexible(
    filament_data: schemas.FilamentFlexibleCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Create a new filament type with optional initial inventory.
    
    This endpoint allows users to:
    1. Define filament types for cost calculation without requiring inventory
    2. Optionally add initial stock with a purchase record
    3. Get warnings about inventory status
    """
    # Implementation details in transaction management doc
    pass
```

### Business Logic

1. **Duplicate Prevention**
   - Check if filament with same color+brand+material exists
   - If exists, return 409 Conflict with existing filament details
   - Client can then select the existing filament

2. **Filament Creation Logic**
   - **Without Purchase** (create_purchase = false):
     - `total_qty_kg` = 0.0
     - `price_per_kg` = estimated_cost_per_kg
     - `min_filaments_kg` = null
     - Add warning: "No inventory tracked for this filament"
   
   - **With Purchase** (create_purchase = true):
     - `total_qty_kg` = purchase_data.quantity_kg
     - `price_per_kg` = purchase_data.price_per_kg
     - `min_filaments_kg` = null
     - Create associated purchase record

3. **Validation**
   - Color, brand, material are required and non-empty
   - Estimated cost must be positive
   - If creating purchase: quantity >= 0.001 kg, price > 0
   - Material must be one of: PLA, PETG, ABS, TPU, Other

### Error Responses

```python
# 409 Conflict - Filament already exists
{
    "detail": {
        "message": "Filament already exists",
        "existing_filament": {
            "id": 123,
            "color": "Black",
            "brand": "Prusament",
            "material": "PETG"
        }
    }
}

# 422 Validation Error
{
    "detail": [
        {
            "loc": ["body", "quantity_kg"],
            "msg": "ensure this value is greater than 0",
            "type": "value_error.number.not_gt"
        }
    ]
}

# 500 Internal Server Error - Transaction failed
{
    "detail": "Failed to create filament with purchase. Transaction rolled back."
}
```

### Security Considerations

1. **Authentication**: Requires valid user token (existing auth middleware)
2. **Authorization**: Any authenticated user can create filaments (no special role required)
3. **Rate Limiting**: Consider adding rate limits to prevent spam (e.g., 10 creates per minute)
4. **Input Sanitization**: All string inputs are sanitized by Pydantic

### Database Schema Reference

```sql
-- Filament table
CREATE TABLE filament (
    id SERIAL PRIMARY KEY,
    color VARCHAR(50) NOT NULL,
    brand VARCHAR(50) NOT NULL,
    material VARCHAR(20) NOT NULL,
    price_per_kg DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_qty_kg DECIMAL(10,3) NOT NULL DEFAULT 0,
    min_filaments_kg DECIMAL(10,3),
    UNIQUE(color, brand, material)
);

-- FilamentPurchase table
CREATE TABLE filament_purchase (
    id SERIAL PRIMARY KEY,
    filament_id INTEGER NOT NULL REFERENCES filament(id) ON DELETE CASCADE,
    quantity_kg DECIMAL(10,3) NOT NULL,
    price_per_kg DECIMAL(10,2) NOT NULL,
    purchase_date DATE NOT NULL,
    purchase_channel VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Integration with Existing Code

This endpoint complements the existing endpoints:
- `POST /filaments` - Creates only filament (without purchase)
- `POST /filament_purchases` - Creates purchase for existing filament

The new endpoint combines both operations atomically, which is the preferred approach for the inline creation feature.

### Future Considerations

1. **Bulk Creation**: Could extend to accept array of filaments with purchases
2. **Default Values**: Could add user preferences for default brand/material
3. **Auto-complete Data**: Could return lists of existing brands/colors for UI hints
4. **Webhooks**: Could trigger inventory alerts if this is the first filament