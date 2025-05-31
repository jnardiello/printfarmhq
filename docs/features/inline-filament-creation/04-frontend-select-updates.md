# Frontend Select Component Updates

## Overview

Update the filament selection dropdowns to include an "Add New Filament..." option that triggers the inline creation modal.

## Affected Components

1. `frontend/components/tabs/products-tab.tsx`
   - Lines 559-581: Filament selection in "Add Product" form
   - Lines 725-741: Filament selection in "Edit Plate" modal

2. `frontend/components/plate-manager.tsx`
   - Lines 520-536: Filament selection in "Add Plate" dialog
   - Lines 725-741: Filament selection in "Edit Plate" dialog

## Implementation Pattern

### Enhanced Select Component

Create a wrapper component that adds the "Add New" functionality:

```typescript
// frontend/components/filament-select.tsx

import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Plus } from "lucide-react"
import { QuickFilamentForm } from "@/components/quick-filament-form"
import type { Filament } from "@/lib/types"

interface FilamentSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  filaments: Filament[];
  required?: boolean;
  className?: string;
  placeholder?: string;
  showBrand?: boolean;
}

export function FilamentSelect({
  value,
  onValueChange,
  filaments,
  required = false,
  className = "",
  placeholder = "Select filament",
  showBrand = false
}: FilamentSelectProps) {
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [tempValue, setTempValue] = useState(value)
  
  const handleSelectChange = (newValue: string) => {
    if (newValue === "add-new") {
      // Store current value in case user cancels
      setTempValue(value)
      setIsAddingNew(true)
    } else {
      onValueChange(newValue)
    }
  }
  
  const handleNewFilamentSuccess = (filament: Filament) => {
    // Close modal
    setIsAddingNew(false)
    // Select the new filament
    onValueChange(filament.id.toString())
  }
  
  const handleCancel = () => {
    setIsAddingNew(false)
    // Restore previous value if user cancels
    // This is important to prevent the Select from showing "Add New Filament..."
  }
  
  return (
    <>
      <Select
        value={value}
        onValueChange={handleSelectChange}
        required={required}
      >
        <SelectTrigger className={className}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {/* Existing filaments */}
          {filaments.map((filament) => (
            <SelectItem key={filament.id} value={filament.id.toString()}>
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full border border-gray-300"
                  style={{ 
                    backgroundColor: filament.color.toLowerCase() === 'white' 
                      ? '#f5f5f5' 
                      : filament.color.toLowerCase() 
                  }}
                />
                <span>
                  {filament.color} {filament.material}
                  {showBrand && ` (${filament.brand})`}
                </span>
              </div>
            </SelectItem>
          ))}
          
          {/* Separator */}
          <Separator className="my-1" />
          
          {/* Add new option */}
          <SelectItem value="add-new" className="text-primary font-medium">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>Add New Filament...</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
      
      {/* Add New Filament Modal */}
      <Dialog open={isAddingNew} onOpenChange={setIsAddingNew}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Filament</DialogTitle>
          </DialogHeader>
          <QuickFilamentForm
            onSuccess={handleNewFilamentSuccess}
            onCancel={handleCancel}
            isModal={true}
            autoSelectAfterCreate={true}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
```

### Integration in Products Tab

Replace the existing Select components with the new FilamentSelect:

```typescript
// In products-tab.tsx, update the filament selection:

// Old code:
<Select
  value={usage.filament_id?.toString() || ""}
  onValueChange={(value) => handleFilamentUsageChange(plateIndex, usageIndex, 'filament_id', value)}
  required
>
  {/* ... */}
</Select>

// New code:
<FilamentSelect
  value={usage.filament_id?.toString() || ""}
  onValueChange={(value) => handleFilamentUsageChange(plateIndex, usageIndex, 'filament_id', value)}
  filaments={filaments}
  required
  className="h-8 text-xs"
  showBrand={false}
/>
```

### Integration in PlateManager

Similar update for PlateManager component:

```typescript
// In plate-manager.tsx:

// Import at the top
import { FilamentSelect } from "@/components/filament-select"

// Replace Select with FilamentSelect:
<FilamentSelect
  value={row.filament_id}
  onValueChange={(value) => handleFilamentRowChange(index, 'filament_id', value)}
  filaments={filaments}
  required
  showBrand={true}
/>
```

## Handling Edge Cases

### 1. Empty Filament List

When there are no filaments, show a helpful message:

```typescript
if (filaments.length === 0) {
  return (
    <div className="text-sm text-muted-foreground p-2 border rounded">
      No filaments available. 
      <button
        onClick={() => setIsAddingNew(true)}
        className="text-primary underline ml-1"
      >
        Add your first filament
      </button>
    </div>
  )
}
```

### 2. Loading State

While filaments are being fetched:

```typescript
interface FilamentSelectProps {
  // ... other props
  isLoading?: boolean;
}

if (isLoading) {
  return (
    <div className="h-9 px-3 border rounded-md flex items-center text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin mr-2" />
      Loading filaments...
    </div>
  )
}
```

### 3. Validation Feedback

Show validation state on the Select:

```typescript
<SelectTrigger 
  className={`${className} ${error ? 'border-red-500' : ''}`}
  aria-invalid={!!error}
>
```

## Accessibility Considerations

1. **Keyboard Navigation**
   - Ensure Tab key moves through form fields properly
   - ESC key should close the modal
   - Enter key should submit when form is valid

2. **Screen Readers**
   - Add aria-label to the Select
   - Announce when modal opens/closes
   - Provide helpful error messages

3. **Focus Management**
   - Return focus to Select after modal closes
   - Focus first input in modal when it opens

```typescript
const handleNewFilamentSuccess = (filament: Filament) => {
  setIsAddingNew(false)
  onValueChange(filament.id.toString())
  
  // Return focus to the select trigger
  setTimeout(() => {
    document.querySelector(`[aria-controls="${selectId}"]`)?.focus()
  }, 0)
}
```

## Performance Optimization

1. **Memoization**
   ```typescript
   const sortedFilaments = useMemo(
     () => filaments.sort((a, b) => 
       `${a.color} ${a.material}`.localeCompare(`${b.color} ${b.material}`)
     ),
     [filaments]
   )
   ```

2. **Lazy Loading**
   - Only load QuickFilamentForm when modal opens
   ```typescript
   const QuickFilamentForm = lazy(() => import('./quick-filament-form'))
   ```

3. **Debouncing**
   - If implementing search within the select
   ```typescript
   const debouncedSearch = useDebouncedCallback(
     (searchTerm: string) => {
       // Filter filaments
     },
     300
   )
   ```

## Testing Considerations

1. **Unit Tests**
   - Test that "add-new" value triggers modal
   - Test cancel restores previous value
   - Test successful creation selects new filament

2. **Integration Tests**
   - Test full flow from select → modal → API → selection
   - Test error handling
   - Test duplicate prevention

3. **E2E Tests**
   - Test creating product with new filament
   - Test keyboard navigation
   - Test multiple filament additions