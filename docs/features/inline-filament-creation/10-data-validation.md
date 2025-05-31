# Data Validation Rules

## Overview

Comprehensive validation rules for the inline filament creation feature, covering both frontend and backend validation to ensure data integrity and provide clear user feedback.

## Field-Level Validation Rules

### 1. Color Field

**Requirements:**
- Required field
- String type
- Length: 1-50 characters
- No special characters except spaces and hyphens
- Case-insensitive for duplicate checking

**Validation Logic:**
```typescript
// Frontend validation
const validateColor = (color: string): string | null => {
  if (!color || color.trim().length === 0) {
    return "Color is required"
  }
  
  if (color.trim().length > 50) {
    return "Color name must be 50 characters or less"
  }
  
  // Allow letters, numbers, spaces, and hyphens
  const validPattern = /^[a-zA-Z0-9\s-]+$/
  if (!validPattern.test(color.trim())) {
    return "Color name can only contain letters, numbers, spaces, and hyphens"
  }
  
  return null
}
```

```python
# Backend validation
def validate_color(color: str) -> str:
    color = color.strip()
    
    if not color:
        raise ValueError("Color is required")
    
    if len(color) > 50:
        raise ValueError("Color name must be 50 characters or less")
    
    if not re.match(r'^[a-zA-Z0-9\s-]+$', color):
        raise ValueError("Color name can only contain letters, numbers, spaces, and hyphens")
    
    # Normalize: capitalize first letter of each word
    return color.title()
```

**Examples:**
- ✅ Valid: "Black", "Sky Blue", "RAL-7016", "Glow-in-the-dark"
- ❌ Invalid: "", "@Black", "Super-Long-Color-Name-That-Exceeds-The-Maximum-Character-Limit"

### 2. Brand Field

**Requirements:**
- Required field
- String type
- Length: 1-50 characters
- Alphanumeric with common punctuation
- Preserve original casing

**Validation Logic:**
```typescript
// Frontend validation
const validateBrand = (brand: string): string | null => {
  if (!brand || brand.trim().length === 0) {
    return "Brand is required"
  }
  
  if (brand.trim().length > 50) {
    return "Brand name must be 50 characters or less"
  }
  
  // Allow letters, numbers, spaces, and common punctuation
  const validPattern = /^[a-zA-Z0-9\s\-_.&]+$/
  if (!validPattern.test(brand.trim())) {
    return "Brand name contains invalid characters"
  }
  
  return null
}
```

```python
# Backend validation
def validate_brand(brand: str) -> str:
    brand = brand.strip()
    
    if not brand:
        raise ValueError("Brand is required")
    
    if len(brand) > 50:
        raise ValueError("Brand name must be 50 characters or less")
    
    if not re.match(r'^[a-zA-Z0-9\s\-_.&]+$', brand):
        raise ValueError("Brand name contains invalid characters")
    
    return brand  # Preserve original casing
```

**Examples:**
- ✅ Valid: "Prusament", "eSUN", "SUNLU 3D", "Proto-pasta"
- ❌ Invalid: "", "Brand@Email", "Super™ Brand"

### 3. Material Field

**Requirements:**
- Required field
- Must be one of predefined values
- Enum validation

**Valid Values:**
```typescript
const VALID_MATERIALS = ["PLA", "PETG", "ABS", "TPU", "Other"] as const
type Material = typeof VALID_MATERIALS[number]
```

```python
# Backend enum
class FilamentMaterial(str, Enum):
    PLA = "PLA"
    PETG = "PETG"
    ABS = "ABS"
    TPU = "TPU"
    OTHER = "Other"
```

**Validation Logic:**
```typescript
const validateMaterial = (material: string): string | null => {
  if (!material) {
    return "Material is required"
  }
  
  if (!VALID_MATERIALS.includes(material as Material)) {
    return "Please select a valid material type"
  }
  
  return null
}
```

### 4. Quantity Field

**Requirements:**
- Required field
- Numeric (float)
- Minimum: 0.001 kg (1 gram)
- Maximum: 9999.999 kg
- Up to 3 decimal places

**Validation Logic:**
```typescript
const validateQuantity = (quantity: string): string | null => {
  if (!quantity) {
    return "Quantity is required"
  }
  
  const numValue = parseFloat(quantity)
  
  if (isNaN(numValue)) {
    return "Quantity must be a number"
  }
  
  if (numValue < 0.001) {
    return "Quantity must be at least 0.001 kg (1 gram)"
  }
  
  if (numValue > 9999.999) {
    return "Quantity cannot exceed 9999.999 kg"
  }
  
  // Check decimal places
  const decimalPlaces = (quantity.split('.')[1] || '').length
  if (decimalPlaces > 3) {
    return "Quantity can have maximum 3 decimal places"
  }
  
  return null
}
```

### 5. Price per kg Field

**Requirements:**
- Required field
- Numeric (float)
- Minimum: 0.01 €
- Maximum: 9999.99 €
- Up to 2 decimal places

**Validation Logic:**
```typescript
const validatePrice = (price: string): string | null => {
  if (!price) {
    return "Price is required"
  }
  
  const numValue = parseFloat(price)
  
  if (isNaN(numValue)) {
    return "Price must be a number"
  }
  
  if (numValue < 0.01) {
    return "Price must be at least 0.01 €"
  }
  
  if (numValue > 9999.99) {
    return "Price cannot exceed 9999.99 €"
  }
  
  // Check decimal places
  const decimalPlaces = (price.split('.')[1] || '').length
  if (decimalPlaces > 2) {
    return "Price can have maximum 2 decimal places"
  }
  
  return null
}
```

### 6. Purchase Date Field

**Requirements:**
- Optional field
- Valid date format (YYYY-MM-DD)
- Cannot be in the future
- Default: today's date

**Validation Logic:**
```typescript
const validatePurchaseDate = (dateString: string): string | null => {
  if (!dateString) {
    return null // Optional field
  }
  
  const date = new Date(dateString)
  
  if (isNaN(date.getTime())) {
    return "Invalid date format"
  }
  
  const today = new Date()
  today.setHours(23, 59, 59, 999) // End of today
  
  if (date > today) {
    return "Purchase date cannot be in the future"
  }
  
  // Reasonable past date check (e.g., not before 2000)
  const minDate = new Date('2000-01-01')
  if (date < minDate) {
    return "Purchase date seems incorrect"
  }
  
  return null
}
```

### 7. Purchase Channel Field

**Requirements:**
- Optional field
- String type
- Maximum: 50 characters
- Alphanumeric with common punctuation

**Common Values for Autocomplete:**
```typescript
const COMMON_CHANNELS = [
  "Amazon",
  "Official Website",
  "Local Store",
  "eBay",
  "AliExpress",
  "Direct from Manufacturer",
  "3D Printing Store",
  "Other"
]
```

### 8. Notes Field

**Requirements:**
- Optional field
- String type
- Maximum: 500 characters
- Free text, but sanitized

**Validation Logic:**
```typescript
const validateNotes = (notes: string): string | null => {
  if (!notes) {
    return null // Optional field
  }
  
  if (notes.length > 500) {
    return "Notes must be 500 characters or less"
  }
  
  // Basic XSS prevention
  const dangerousPattern = /<script|<iframe|javascript:|onerror=/i
  if (dangerousPattern.test(notes)) {
    return "Notes contain invalid content"
  }
  
  return null
}
```

## Composite Validation Rules

### 1. Duplicate Filament Check

**Rule:** No two filaments can have the same combination of (color + brand + material)

```typescript
const checkDuplicateFilament = (
  color: string,
  brand: string,
  material: string,
  existingFilaments: Filament[]
): Filament | null => {
  const normalizedColor = color.trim().toLowerCase()
  const normalizedBrand = brand.trim().toLowerCase()
  
  return existingFilaments.find(f => 
    f.color.toLowerCase() === normalizedColor &&
    f.brand.toLowerCase() === normalizedBrand &&
    f.material === material
  ) || null
}
```

### 2. Total Cost Validation

**Rule:** Total purchase cost (quantity × price) should be reasonable

```typescript
const validateTotalCost = (quantity: number, pricePerKg: number): string | null => {
  const totalCost = quantity * pricePerKg
  
  if (totalCost > 10000) {
    return `Total cost (€${totalCost.toFixed(2)}) seems unusually high. Please verify.`
  }
  
  return null
}
```

## Form-Level Validation

### Validation Flow

```typescript
interface ValidationResult {
  isValid: boolean
  errors: Record<string, string>
  warnings: Record<string, string>
}

const validateFilamentForm = (data: FilamentFormData): ValidationResult => {
  const errors: Record<string, string> = {}
  const warnings: Record<string, string> = {}
  
  // Field validations
  const colorError = validateColor(data.color)
  if (colorError) errors.color = colorError
  
  const brandError = validateBrand(data.brand)
  if (brandError) errors.brand = brandError
  
  const materialError = validateMaterial(data.material)
  if (materialError) errors.material = materialError
  
  const quantityError = validateQuantity(data.quantity_kg)
  if (quantityError) errors.quantity_kg = quantityError
  
  const priceError = validatePrice(data.price_per_kg)
  if (priceError) errors.price_per_kg = priceError
  
  const dateError = validatePurchaseDate(data.purchase_date || '')
  if (dateError) errors.purchase_date = dateError
  
  const notesError = validateNotes(data.notes || '')
  if (notesError) errors.notes = notesError
  
  // Composite validations (only if individual fields are valid)
  if (!errors.quantity_kg && !errors.price_per_kg) {
    const totalCostWarning = validateTotalCost(
      parseFloat(data.quantity_kg),
      parseFloat(data.price_per_kg)
    )
    if (totalCostWarning) warnings.total = totalCostWarning
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings
  }
}
```

## Real-time Validation UX

### Validation Timing

1. **On Blur**: Validate when user leaves field
2. **On Change**: Clear error if field becomes valid
3. **On Submit**: Validate all fields

```typescript
const useFieldValidation = (validateFn: (value: string) => string | null) => {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  
  const handleChange = (newValue: string) => {
    setValue(newValue)
    
    // Clear error if field becomes valid
    if (error && validateFn(newValue) === null) {
      setError(null)
    }
  }
  
  const handleBlur = () => {
    setTouched(true)
    setError(validateFn(value))
  }
  
  return {
    value,
    error: touched ? error : null,
    onChange: handleChange,
    onBlur: handleBlur
  }
}
```

## Backend Validation Response Format

### Success Response

```json
{
  "filament": {
    "id": 123,
    "color": "Black",
    "brand": "Prusament",
    "material": "PETG",
    "price_per_kg": 25.99,
    "total_qty_kg": 1.0
  },
  "purchase": {
    "id": 456,
    "filament_id": 123,
    "quantity_kg": 1.0,
    "price_per_kg": 25.99,
    "purchase_date": "2024-01-15"
  },
  "message": "Filament and purchase created successfully"
}
```

### Validation Error Response

```json
{
  "detail": [
    {
      "loc": ["body", "color"],
      "msg": "Color is required",
      "type": "value_error"
    },
    {
      "loc": ["body", "quantity_kg"],
      "msg": "ensure this value is greater than 0",
      "type": "value_error.number.not_gt"
    }
  ]
}
```

### Business Logic Error Response

```json
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
```

## Security Validation

### XSS Prevention

```typescript
const sanitizeInput = (input: string): string => {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
}
```

### SQL Injection Prevention

- Use parameterized queries (SQLAlchemy ORM)
- Never concatenate user input into queries
- Validate all inputs before database operations

### Rate Limiting

```python
# Backend rate limiting
@app.post("/filaments/create-with-purchase")
@limiter.limit("10 per minute")
async def create_filament_with_purchase(...):
    pass
```