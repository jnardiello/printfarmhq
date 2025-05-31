# Frontend Modal Integration

## Overview

Design and implement the modal dialog that contains the quick filament creation form. This modal should provide a seamless experience that doesn't interrupt the product creation workflow.

## Modal Component Design

### Modal Wrapper Component

```typescript
// frontend/components/quick-filament-modal.tsx

import { useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { QuickFilamentForm } from "@/components/quick-filament-form"
import type { Filament } from "@/lib/types"

interface QuickFilamentModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (filament: Filament) => void;
  context?: "product" | "plate" | "standalone";
}

export function QuickFilamentModal({
  isOpen,
  onOpenChange,
  onSuccess,
  context = "product"
}: QuickFilamentModalProps) {
  const previousFocusRef = useRef<HTMLElement | null>(null)
  
  // Store the element that had focus before modal opened
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement
    }
  }, [isOpen])
  
  const handleSuccess = (filament: Filament) => {
    onSuccess(filament)
    onOpenChange(false)
    
    // Restore focus to previous element
    setTimeout(() => {
      previousFocusRef.current?.focus()
    }, 0)
  }
  
  const handleCancel = () => {
    onOpenChange(false)
    
    // Restore focus
    setTimeout(() => {
      previousFocusRef.current?.focus()
    }, 0)
  }
  
  const getContextMessage = () => {
    switch (context) {
      case "product":
        return "Create a new filament and it will be automatically selected for your product."
      case "plate":
        return "Create a new filament and it will be automatically selected for this plate."
      default:
        return "Create a new filament to add to your inventory."
    }
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[500px]"
        onOpenAutoFocus={(e) => {
          // Focus the first input instead of the close button
          e.preventDefault()
          const firstInput = e.currentTarget.querySelector('input')
          firstInput?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>Add New Filament</DialogTitle>
          <DialogDescription>
            {getContextMessage()}
          </DialogDescription>
        </DialogHeader>
        
        <QuickFilamentForm
          onSuccess={handleSuccess}
          onCancel={handleCancel}
          isModal={true}
          autoSelectAfterCreate={true}
        />
      </DialogContent>
    </Dialog>
  )
}
```

## Modal Behavior Specifications

### 1. Opening Behavior

- **Trigger**: User selects "Add New Filament..." from dropdown
- **Animation**: Fade in with scale animation (using Radix UI Dialog)
- **Focus**: First input field (color) receives focus
- **Backdrop**: Semi-transparent overlay prevents interaction with background

### 2. Closing Behavior

- **Success**: Modal closes automatically after successful creation
- **Cancel**: User clicks Cancel button or ESC key
- **Click Outside**: Modal closes (configurable via `modal` prop)
- **Focus Return**: Focus returns to the select that triggered the modal

### 3. Nested Modal Handling

Since this modal can be opened from within the Product modal:

```typescript
// Prevent closing parent modal when child modal closes
<DialogContent
  onPointerDownOutside={(e) => {
    // If clicking on parent modal, don't close
    const target = e.target as HTMLElement
    if (target.closest('[role="dialog"]') !== e.currentTarget) {
      e.preventDefault()
    }
  }}
  onEscapeKeyDown={(e) => {
    // Only close the topmost modal
    const modals = document.querySelectorAll('[role="dialog"]')
    const isTopModal = modals[modals.length - 1] === e.currentTarget
    if (!isTopModal) {
      e.preventDefault()
    }
  }}
>
```

## Integration Examples

### In Product Form

```typescript
// In products-tab.tsx

const [addFilamentModalOpen, setAddFilamentModalOpen] = useState(false)
const [currentPlateIndex, setCurrentPlateIndex] = useState<number>(0)
const [currentUsageIndex, setCurrentUsageIndex] = useState<number>(0)

const handleFilamentSelectChange = (plateIndex: number, usageIndex: number, value: string) => {
  if (value === "add-new") {
    setCurrentPlateIndex(plateIndex)
    setCurrentUsageIndex(usageIndex)
    setAddFilamentModalOpen(true)
  } else {
    handleFilamentUsageChange(plateIndex, usageIndex, 'filament_id', value)
  }
}

const handleNewFilamentCreated = (filament: Filament) => {
  // Update the specific plate's filament usage
  handleFilamentUsageChange(currentPlateIndex, currentUsageIndex, 'filament_id', filament.id.toString())
  
  // Show success message
  toast({
    title: "Filament Added",
    description: `${filament.color} ${filament.material} has been selected for your product.`
  })
}

// In the JSX:
<>
  <FilamentSelect
    value={usage.filament_id?.toString() || ""}
    onValueChange={(value) => handleFilamentSelectChange(plateIndex, usageIndex, value)}
    filaments={filaments}
    required
  />
  
  <QuickFilamentModal
    isOpen={addFilamentModalOpen}
    onOpenChange={setAddFilamentModalOpen}
    onSuccess={handleNewFilamentCreated}
    context="product"
  />
</>
```

### In PlateManager

```typescript
// Similar pattern but with plate context
const [selectedFilamentRow, setSelectedFilamentRow] = useState<number>(-1)

const handlePlateFilamentSelect = (rowIndex: number, value: string) => {
  if (value === "add-new") {
    setSelectedFilamentRow(rowIndex)
    setAddFilamentModalOpen(true)
  } else {
    handleFilamentRowChange(rowIndex, 'filament_id', value)
  }
}
```

## Animation and Transitions

### Modal Animation

```css
/* In globals.css or component styles */
@keyframes dialog-fade-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes dialog-fade-out {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.95);
  }
}

[data-state="open"] .dialog-content {
  animation: dialog-fade-in 200ms ease-out;
}

[data-state="closed"] .dialog-content {
  animation: dialog-fade-out 150ms ease-in;
}
```

## Error State Handling

### Network Errors

```typescript
const [error, setError] = useState<string | null>(null)

// In QuickFilamentForm
catch (error: any) {
  if (error.code === 'NETWORK_ERROR') {
    setError("Unable to connect to server. Please check your connection and try again.")
  } else {
    setError(error.message || "An unexpected error occurred")
  }
}

// Display error in modal
{error && (
  <Alert variant="destructive" className="mb-4">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Error</AlertTitle>
    <AlertDescription>{error}</AlertDescription>
  </Alert>
)}
```

### Validation Errors

Show inline validation errors as the user types:

```typescript
const validateField = (field: keyof FilamentFormData, value: string) => {
  const newErrors = { ...errors }
  
  switch (field) {
    case 'color':
      if (!value.trim()) {
        newErrors.color = "Color is required"
      } else {
        delete newErrors.color
      }
      break
    // ... other fields
  }
  
  setErrors(newErrors)
}
```

## Loading States

### Submission Loading

```typescript
// In the modal footer
<div className="flex justify-between items-center">
  <div className="text-sm text-muted-foreground">
    {isLoading && "Creating filament..."}
  </div>
  <div className="flex gap-2">
    <Button variant="outline" onClick={onCancel} disabled={isLoading}>
      Cancel
    </Button>
    <Button type="submit" disabled={isLoading}>
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Creating...
        </>
      ) : (
        "Create Filament"
      )}
    </Button>
  </div>
</div>
```

### Optimistic Updates

For better UX, show the new filament immediately:

```typescript
const handleOptimisticCreate = async (formData: FilamentFormData) => {
  // Create optimistic filament
  const optimisticFilament: Filament = {
    id: -1, // Temporary ID
    color: formData.color,
    brand: formData.brand,
    material: formData.material,
    price_per_kg: parseFloat(formData.price_per_kg),
    total_qty_kg: parseFloat(formData.quantity_kg),
    isOptimistic: true
  }
  
  // Add to local state immediately
  addOptimisticFilament(optimisticFilament)
  onSuccess(optimisticFilament)
  
  try {
    const realFilament = await createFilamentWithPurchase(formData)
    replaceOptimisticFilament(optimisticFilament.id, realFilament)
  } catch (error) {
    removeOptimisticFilament(optimisticFilament.id)
    throw error
  }
}
```

## Accessibility Features

1. **ARIA Labels**
   ```typescript
   <Dialog aria-label="Add new filament to inventory">
   ```

2. **Keyboard Navigation**
   - Tab: Move between form fields
   - Shift+Tab: Move backwards
   - Enter: Submit form (when valid)
   - Escape: Close modal

3. **Screen Reader Announcements**
   ```typescript
   // Announce success
   <div role="status" aria-live="polite" className="sr-only">
     {successMessage && successMessage}
   </div>
   ```

4. **Focus Trap**
   - Built into Radix UI Dialog
   - Ensures focus stays within modal while open