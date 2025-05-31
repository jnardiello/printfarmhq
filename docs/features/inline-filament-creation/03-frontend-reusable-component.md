# Frontend Reusable Component Design

## Quick Filament Form Component

### Component Overview

Create a reusable form component that can be used both as a standalone form and within a modal dialog. This component will handle all the logic for creating a new filament with its initial purchase.

### File Location

`frontend/components/quick-filament-form.tsx`

### Component Interface

```typescript
interface QuickFilamentFormProps {
  onSuccess: (filament: Filament) => void;
  onCancel: () => void;
  isModal?: boolean;
  autoSelectAfterCreate?: boolean;
}

interface FilamentFormData {
  color: string;
  brand: string;
  material: string;
  estimated_cost_per_kg: string;
  create_purchase: boolean;
  // Purchase fields (only used if create_purchase is true)
  quantity_kg?: string;
  price_per_kg?: string;
  purchase_date?: string;
  purchase_channel?: string;
  notes?: string;
}
```

### Component Implementation

```typescript
import { useState, useEffect } from "react"
import { useData } from "@/components/data-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { Loader2, Palette } from "lucide-react"
import type { Filament } from "@/lib/types"

// Common color presets for quick selection
const COLOR_PRESETS = [
  { name: "Black", hex: "#000000" },
  { name: "White", hex: "#FFFFFF" },
  { name: "Red", hex: "#FF0000" },
  { name: "Blue", hex: "#0000FF" },
  { name: "Green", hex: "#00FF00" },
  { name: "Yellow", hex: "#FFFF00" },
  { name: "Orange", hex: "#FFA500" },
  { name: "Purple", hex: "#800080" },
  { name: "Gray", hex: "#808080" },
  { name: "Silver", hex: "#C0C0C0" },
]

const MATERIAL_OPTIONS = ["PLA", "PETG", "ABS", "TPU", "Other"]

export function QuickFilamentForm({ 
  onSuccess, 
  onCancel, 
  isModal = false,
  autoSelectAfterCreate = true 
}: QuickFilamentFormProps) {
  const { filaments, createFilamentFlexible } = useData()
  const [isLoading, setIsLoading] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showInventoryWarning, setShowInventoryWarning] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState<FilamentFormData>({
    color: "",
    brand: "",
    material: "PLA",
    estimated_cost_per_kg: "",
    create_purchase: false,
    quantity_kg: "",
    price_per_kg: "",
    purchase_date: new Date().toISOString().split('T')[0],
    purchase_channel: "",
    notes: ""
  })
  
  // Update warning when checkbox changes
  useEffect(() => {
    setShowInventoryWarning(!formData.create_purchase)
  }, [formData.create_purchase])
  
  // Validation state
  const [errors, setErrors] = useState<Partial<FilamentFormData>>({})
  
  // Extract unique brands for autocomplete
  const existingBrands = Array.from(
    new Set(filaments.map(f => f.brand))
  ).sort()
  
  const validateForm = (): boolean => {
    const newErrors: Partial<FilamentFormData> = {}
    
    if (!formData.color.trim()) {
      newErrors.color = "Color is required"
    }
    
    if (!formData.brand.trim()) {
      newErrors.brand = "Brand is required"
    }
    
    if (!formData.material) {
      newErrors.material = "Material is required"
    }
    
    const quantity = parseFloat(formData.quantity_kg)
    if (isNaN(quantity) || quantity <= 0) {
      newErrors.quantity_kg = "Quantity must be greater than 0"
    }
    
    const price = parseFloat(formData.price_per_kg)
    if (isNaN(price) || price <= 0) {
      newErrors.price_per_kg = "Price must be greater than 0"
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }
  
  const checkDuplicate = (): Filament | null => {
    return filaments.find(
      f => f.color.toLowerCase() === formData.color.toLowerCase() &&
           f.brand.toLowerCase() === formData.brand.toLowerCase() &&
           f.material === formData.material
    ) || null
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    // Check for duplicates
    const existingFilament = checkDuplicate()
    if (existingFilament) {
      toast({
        title: "Filament Already Exists",
        description: `${existingFilament.color} ${existingFilament.material} by ${existingFilament.brand} is already in your inventory.`,
        variant: "default"
      })
      
      if (autoSelectAfterCreate) {
        onSuccess(existingFilament)
      }
      return
    }
    
    setIsLoading(true)
    
    try {
      const requestData: any = {
        color: formData.color.trim(),
        brand: formData.brand.trim(),
        material: formData.material,
        estimated_cost_per_kg: parseFloat(formData.estimated_cost_per_kg),
        create_purchase: formData.create_purchase
      }
      
      if (formData.create_purchase) {
        requestData.purchase_data = {
          quantity_kg: parseFloat(formData.quantity_kg || '0'),
          price_per_kg: parseFloat(formData.price_per_kg || formData.estimated_cost_per_kg),
          purchase_date: formData.purchase_date,
          purchase_channel: formData.purchase_channel?.trim(),
          notes: formData.notes?.trim()
        }
      }
      
      const result = await createFilamentFlexible(requestData)
      
      toast({
        title: "Filament Created",
        description: `Successfully added ${result.filament.color} ${result.filament.material} to inventory.`
      })
      
      onSuccess(result.filament)
      
    } catch (error: any) {
      if (error.response?.status === 409) {
        // Filament was created by another process
        const existingFilament = error.response.data.existing_filament
        toast({
          title: "Filament Already Exists",
          description: "This filament was just created. Selecting it for you.",
          variant: "default"
        })
        onSuccess(existingFilament)
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to create filament",
          variant: "destructive"
        })
      }
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Color Selection */}
      <div className="space-y-2">
        <Label htmlFor="color">Color *</Label>
        <div className="flex gap-2">
          <Input
            id="color"
            value={formData.color}
            onChange={(e) => setFormData({...formData, color: e.target.value})}
            placeholder="Enter color name"
            className={errors.color ? "border-red-500" : ""}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setShowColorPicker(!showColorPicker)}
          >
            <Palette className="h-4 w-4" />
          </Button>
        </div>
        {errors.color && <p className="text-sm text-red-500">{errors.color}</p>}
        
        {/* Color Presets */}
        {showColorPicker && (
          <div className="grid grid-cols-5 gap-2 p-2 border rounded-lg">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => {
                  setFormData({...formData, color: preset.name})
                  setShowColorPicker(false)
                }}
                className="flex flex-col items-center gap-1 p-2 hover:bg-gray-100 rounded"
              >
                <div
                  className="w-8 h-8 rounded-full border-2"
                  style={{ backgroundColor: preset.hex }}
                />
                <span className="text-xs">{preset.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Brand Selection */}
      <div className="space-y-2">
        <Label htmlFor="brand">Brand *</Label>
        <Input
          id="brand"
          value={formData.brand}
          onChange={(e) => setFormData({...formData, brand: e.target.value})}
          placeholder="e.g., Prusament, eSUN"
          list="brand-suggestions"
          className={errors.brand ? "border-red-500" : ""}
        />
        <datalist id="brand-suggestions">
          {existingBrands.map(brand => (
            <option key={brand} value={brand} />
          ))}
        </datalist>
        {errors.brand && <p className="text-sm text-red-500">{errors.brand}</p>}
      </div>
      
      {/* Material Selection */}
      <div className="space-y-2">
        <Label htmlFor="material">Material *</Label>
        <Select
          value={formData.material}
          onValueChange={(value) => setFormData({...formData, material: value})}
        >
          <SelectTrigger id="material" className={errors.material ? "border-red-500" : ""}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MATERIAL_OPTIONS.map(material => (
              <SelectItem key={material} value={material}>
                {material}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.material && <p className="text-sm text-red-500">{errors.material}</p>}
      </div>
      
      {/* Estimated Cost (Always Required) */}
      <div className="space-y-2">
        <Label htmlFor="estimated_cost">Average Cost per kg (€) *</Label>
        <Input
          id="estimated_cost"
          type="number"
          step="0.01"
          min="0.01"
          value={formData.estimated_cost_per_kg}
          onChange={(e) => setFormData({...formData, estimated_cost_per_kg: e.target.value})}
          placeholder="25.00"
          className={errors.estimated_cost_per_kg ? "border-red-500" : ""}
        />
        <p className="text-xs text-muted-foreground">Used for cost calculations</p>
        {errors.estimated_cost_per_kg && <p className="text-sm text-red-500">{errors.estimated_cost_per_kg}</p>}
      </div>
      
      {/* Inventory Tracking Checkbox */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="create_purchase"
            checked={formData.create_purchase}
            onCheckedChange={(checked) => setFormData({...formData, create_purchase: checked as boolean})}
          />
          <Label htmlFor="create_purchase" className="font-normal cursor-pointer">
            Add to inventory tracking (optional)
          </Label>
        </div>
        <p className="text-xs text-muted-foreground ml-6">
          Track actual inventory for this filament
        </p>
      </div>
      
      {/* Inventory Warning */}
      {showInventoryWarning && (
        <Alert className="py-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            This filament type will have no tracked inventory. Remember to order before starting production.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Purchase Details (Only shown if create_purchase is checked) */}
      {formData.create_purchase && (
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <h4 className="font-medium text-sm">Initial Inventory Details</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Initial Quantity (kg) *</Label>
              <Input
                id="quantity"
                type="number"
                step="0.001"
                min="0.001"
                value={formData.quantity_kg}
                onChange={(e) => setFormData({...formData, quantity_kg: e.target.value})}
                placeholder="1.0"
                className={errors.quantity_kg ? "border-red-500" : ""}
              />
              {errors.quantity_kg && <p className="text-sm text-red-500">{errors.quantity_kg}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="price">Purchase Price per kg (€) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0.01"
                value={formData.price_per_kg}
                onChange={(e) => setFormData({...formData, price_per_kg: e.target.value})}
                placeholder="25.00"
                className={errors.price_per_kg ? "border-red-500" : ""}
              />
              {errors.price_per_kg && <p className="text-sm text-red-500">{errors.price_per_kg}</p>}
            </div>
          </div>
      
      {/* Optional Fields */}
      <div className="space-y-2">
        <Label htmlFor="purchase_date">Purchase Date</Label>
        <Input
          id="purchase_date"
          type="date"
          value={formData.purchase_date}
          onChange={(e) => setFormData({...formData, purchase_date: e.target.value})}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="channel">Purchase Channel</Label>
        <Input
          id="channel"
          value={formData.purchase_channel}
          onChange={(e) => setFormData({...formData, purchase_channel: e.target.value})}
          placeholder="e.g., Amazon, Local Store"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({...formData, notes: e.target.value})}
          placeholder="Any additional notes..."
          rows={2}
        />
      </div>
      
      {/* Form Actions */}
      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Filament
        </Button>
      </div>
    </form>
  )
}
```

### Key Features

1. **Form Validation**
   - Required field validation
   - Numeric validation for quantity and price
   - Duplicate prevention with helpful messaging

2. **User Experience**
   - Color picker with presets
   - Brand autocomplete from existing brands
   - Material dropdown with common options
   - Loading states
   - Error messages

3. **Flexibility**
   - Works as standalone form or in modal
   - Optional auto-select after creation
   - Handles duplicate filaments gracefully

4. **Integration**
   - Uses existing DataProvider for API calls
   - Follows existing UI component patterns
   - Consistent with app styling

### Usage Example

```typescript
// In a modal
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Add New Filament</DialogTitle>
    </DialogHeader>
    <QuickFilamentForm
      onSuccess={(filament) => {
        // Select the new filament
        handleFilamentSelect(filament.id)
        setIsOpen(false)
      }}
      onCancel={() => setIsOpen(false)}
      isModal={true}
    />
  </DialogContent>
</Dialog>
```