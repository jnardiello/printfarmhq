# Current Product Implementation Analysis

## Database Schema

### Product Model (`backend/app/models.py:91-103`)
```python
class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    print_time_hrs = Column(Float, nullable=False)
    license_id = Column(Integer, ForeignKey("subscriptions.id"), nullable=True)
    file_path = Column(String, nullable=True)
    filament_weight_g = Column(Float, nullable=False, default=0.0)
    
    # Relationships
    filament_usages = relationship("FilamentUsage", back_populates="product", cascade="all, delete-orphan")
    license = relationship("Subscription", back_populates="licensed_products")
```

### FilamentUsage Model (`backend/app/models.py:105-117`)
```python
class FilamentUsage(Base):
    __tablename__ = "filament_usages"
    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    filament_id = Column(Integer, ForeignKey("filaments.id"))
    grams_used = Column(Float, nullable=False)
    
    # Relationships
    product = relationship("Product", back_populates="filament_usages")
    filament = relationship("Filament", back_populates="usages")
```

### Current Relationship Structure
```
Product (1) ←→ (N) FilamentUsage (N) ←→ (1) Filament
```

## API Endpoints

### 1. Create Product (`POST /products`)
- **Location**: `backend/app/main.py:488-546`
- **Parameters**: Form data with `name`, `print_time_hrs`, `license_id`, `filament_usages` (JSON string), optional `file`
- **Process**: 
  1. Validates and saves model file (.stl/.3mf)
  2. Generates unique SKU
  3. Creates Product record
  4. Parses filament_usages JSON and creates FilamentUsage records
  5. Returns ProductRead schema

### 2. List Products (`GET /products`)
- **Location**: `backend/app/main.py:549-552`
- **Returns**: List of ProductRead with joinedload for filament_usages and filaments

### 3. Get Product COP (`GET /products/{product_id}/cop`)
- **Location**: `backend/app/main.py:555-560`
- **Returns**: Product's calculated COP (Cost of Production)

### 4. Update Product (`PATCH /products/{product_id}`)
- **Location**: `backend/app/main.py:563-612`
- **Process**: Updates product fields, handles file replacement, updates filament usages

## COGS Calculation

### Current Implementation (`backend/app/main.py:700-729`)
```python
def _calculate_print_job_cogs(job: models.PrintJob, db: Session) -> float:
    # For each product in the print job:
    for job_product_item in job.products:
        product_model = db.get(models.Product, job_product_item.product_id)
        
        cost_of_filaments_for_one_product_unit = 0.0
        # Calculate filament costs for one product unit
        for filament_usage in product_model.filament_usages:
            if filament_usage.filament:
                individual_filament_cost = (filament_usage.grams_used / 1000.0) * filament_usage.filament.price_per_kg
                cost_of_filaments_for_one_product_unit += individual_filament_cost
        
        # Multiply by quantity ordered
        line_filament_cost = cost_of_filaments_for_one_product_unit * job_product_item.items_qty
        current_filament_cost_total += line_filament_cost
```

**Key Formula**: `(grams_used / 1000) * price_per_kg * items_qty`

## Frontend Product Form

### Component Location
- **File**: `frontend/components/tabs/products-tab.tsx`
- **Form State**: Lines 36-40, 51-57

### Form Structure
```typescript
interface ProductFormData {
  name: string;
  print_time_hrs: string;
  license_id: undefined | string | number;
}

// Separate state for filament rows
const [filamentRows, setFilamentRows] = useState<FilamentRowData[]>([])

interface FilamentRowData {
  filament_id: string;
  grams_used: string;
}
```

### Form Fields
1. **Basic Info** (lines 298-354):
   - Product name (required)
   - Print time in hours (required, step 0.1)
   - Commercial license (optional, dropdown)

2. **Model File Upload** (lines 356-400):
   - Drag & drop or click to upload
   - Accepts .stl/.3mf files
   - Optional field

3. **Filament Usage Table** (lines 402-510):
   - Dynamic rows with Add/Remove functionality
   - Each row: Filament selector + Grams input
   - Minimum 1 filament required

### Form Submission Process (lines 181-238)
1. Validates at least one filament row exists
2. Creates FormData object
3. Appends product fields (name, print_time_hrs, license_id)
4. Serializes filament_usages as JSON string
5. Appends model file if selected
6. Calls `addProduct(formData)`

## Data Flow Summary

1. **Product Creation**: Direct filament-to-product association via FilamentUsage table
2. **Cost Calculation**: Aggregates all filament costs for a product (sum of filament_usage.grams_used * filament.price_per_kg)
3. **Frontend Display**: Shows filament list per product with individual gram usage
4. **File Handling**: Optional 3D model file storage with unique naming

## Key Constraints for Plates Migration

1. **Database**: Current 1:N relationship between Product and FilamentUsage must become Product → Plate → FilamentUsage
2. **API**: Endpoints expect direct filament_usages array, need to restructure for plates
3. **Frontend**: Form currently manages flat filament list, needs plate grouping
4. **COGS**: Calculation loops through product.filament_usages, needs to aggregate across plates
5. **File Storage**: Currently stores one model file per product, may need plate-level files