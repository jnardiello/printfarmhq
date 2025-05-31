# Local State Handling

## Overview

Managing local component state when integrating the inline filament creation feature. This includes tracking modal state, handling selection changes, and coordinating between multiple filament selections within the same form.

## State Structure in Product Form

### Required State Variables

```typescript
// In products-tab.tsx

interface ProductFormLocalState {
  // Modal state
  isAddingFilament: boolean;
  addFilamentContext: {
    plateIndex: number;
    usageIndex: number;
  } | null;
  
  // Temporary selection state
  pendingFilamentSelection: {
    plateIndex: number;
    usageIndex: number;
    previousValue: string;
  } | null;
  
  // Loading states
  filamentCreationLoading: boolean;
  
  // Error states
  filamentCreationError: string | null;
}

// Implementation
const [isAddingFilament, setIsAddingFilament] = useState(false)
const [addFilamentContext, setAddFilamentContext] = useState<{
  plateIndex: number;
  usageIndex: number;
} | null>(null)
const [pendingFilamentSelection, setPendingFilamentSelection] = useState<{
  plateIndex: number;
  usageIndex: number;
  previousValue: string;
} | null>(null)
```

## Handling Select Changes

### Intercepting "Add New" Selection

```typescript
const handleFilamentSelectChange = (
  plateIndex: number, 
  usageIndex: number, 
  value: string
) => {
  if (value === "add-new") {
    // Store context for where the new filament should be applied
    setAddFilamentContext({ plateIndex, usageIndex })
    
    // Store current value in case user cancels
    const currentValue = plateRows[plateIndex].filament_usages[usageIndex].filament_id
    setPendingFilamentSelection({
      plateIndex,
      usageIndex,
      previousValue: currentValue || ""
    })
    
    // Open modal
    setIsAddingFilament(true)
  } else {
    // Normal selection
    handleFilamentUsageChange(plateIndex, usageIndex, 'filament_id', value)
  }
}
```

### Success Handler

```typescript
const handleFilamentCreationSuccess = (newFilament: Filament) => {
  if (addFilamentContext) {
    const { plateIndex, usageIndex } = addFilamentContext
    
    // Update the specific filament selection
    handleFilamentUsageChange(
      plateIndex, 
      usageIndex, 
      'filament_id', 
      newFilament.id.toString()
    )
    
    // Clear context
    setAddFilamentContext(null)
    setPendingFilamentSelection(null)
  }
  
  // Close modal
  setIsAddingFilament(false)
  
  // Show success feedback
  toast({
    title: "Filament Added",
    description: `${newFilament.color} ${newFilament.material} is now available for selection.`
  })
}
```

### Cancel Handler

```typescript
const handleFilamentCreationCancel = () => {
  // Restore previous selection if needed
  if (pendingFilamentSelection) {
    const { plateIndex, usageIndex, previousValue } = pendingFilamentSelection
    
    // This is important to prevent the Select from showing "Add New Filament..."
    // We need to restore the previous valid selection
    if (previousValue) {
      handleFilamentUsageChange(plateIndex, usageIndex, 'filament_id', previousValue)
    }
  }
  
  // Clear all modal-related state
  setIsAddingFilament(false)
  setAddFilamentContext(null)
  setPendingFilamentSelection(null)
}
```

## PlateManager State Handling

Similar pattern for PlateManager component:

```typescript
// In plate-manager.tsx

// For Add Plate dialog
const [isAddingFilamentForNewPlate, setIsAddingFilamentForNewPlate] = useState(false)
const [newPlateFilamentRowIndex, setNewPlateFilamentRowIndex] = useState<number>(-1)

// For Edit Plate dialog
const [isAddingFilamentForEdit, setIsAddingFilamentForEdit] = useState(false)
const [editFilamentRowIndex, setEditFilamentRowIndex] = useState<number>(-1)

// Separate handlers for each context
const handleNewPlateFilamentSelect = (rowIndex: number, value: string) => {
  if (value === "add-new") {
    setNewPlateFilamentRowIndex(rowIndex)
    setIsAddingFilamentForNewPlate(true)
  } else {
    handleFilamentRowChange(rowIndex, 'filament_id', value)
  }
}

const handleEditPlateFilamentSelect = (rowIndex: number, value: string) => {
  if (value === "add-new") {
    setEditFilamentRowIndex(rowIndex)
    setIsAddingFilamentForEdit(true)
  } else {
    handleEditFilamentRowChange(rowIndex, 'filament_id', value)
  }
}
```

## Complex State Scenarios

### Multiple Plates with Multiple Filaments

When dealing with nested arrays:

```typescript
// Track which specific filament selection triggered the modal
interface FilamentSelectionContext {
  source: 'product' | 'plate';
  plateId?: number;
  plateIndex: number;
  filamentIndex: number;
  callback: (filamentId: string) => void;
}

const [selectionContext, setSelectionContext] = useState<FilamentSelectionContext | null>(null)

// Generic handler
const openFilamentModal = (context: FilamentSelectionContext) => {
  setSelectionContext(context)
  setIsAddingFilament(true)
}

// Usage
openFilamentModal({
  source: 'plate',
  plateIndex: 0,
  filamentIndex: 1,
  callback: (filamentId) => {
    updatePlateFilament(0, 1, filamentId)
  }
})
```

### Preventing State Conflicts

```typescript
// Use refs to track modal state and prevent conflicts
const modalStateRef = useRef({
  isOpen: false,
  context: null as any
})

const openModal = (context: any) => {
  if (modalStateRef.current.isOpen) {
    console.warn('Modal already open, ignoring request')
    return
  }
  
  modalStateRef.current = {
    isOpen: true,
    context
  }
  
  setIsAddingFilament(true)
  setAddFilamentContext(context)
}
```

## Form State Preservation

### Maintaining Form State During Modal Interaction

```typescript
// Save form state before opening modal
const formStateRef = useRef<ProductFormData | null>(null)

const handleOpenFilamentModal = () => {
  // Snapshot current form state
  formStateRef.current = {
    name: productName,
    plateRows: [...plateRows], // Deep copy
    // ... other form fields
  }
  
  setIsAddingFilament(true)
}

// Restore if needed (e.g., on error)
const restoreFormState = () => {
  if (formStateRef.current) {
    setProductName(formStateRef.current.name)
    setPlateRows(formStateRef.current.plateRows)
    // ... restore other fields
  }
}
```

## State Cleanup

### Component Unmount Cleanup

```typescript
useEffect(() => {
  return () => {
    // Clean up any pending operations
    if (isAddingFilament) {
      setIsAddingFilament(false)
      setAddFilamentContext(null)
      setPendingFilamentSelection(null)
    }
  }
}, [isAddingFilament])
```

### Modal Close Cleanup

```typescript
const handleModalClose = (open: boolean) => {
  if (!open) {
    // Modal is closing
    setTimeout(() => {
      // Clean up state after animation
      setAddFilamentContext(null)
      setPendingFilamentSelection(null)
      setFilamentCreationError(null)
    }, 200) // Match modal animation duration
  }
  
  setIsAddingFilament(open)
}
```

## Debugging State

### Development Tools

```typescript
// Add debug logging in development
if (process.env.NODE_ENV === 'development') {
  useEffect(() => {
    console.log('Filament Modal State:', {
      isOpen: isAddingFilament,
      context: addFilamentContext,
      pending: pendingFilamentSelection
    })
  }, [isAddingFilament, addFilamentContext, pendingFilamentSelection])
}
```

### State Inspection Component

```typescript
// Development-only component for state inspection
const StateDebugger = () => {
  if (process.env.NODE_ENV !== 'development') return null
  
  return (
    <div className="fixed bottom-0 right-0 p-4 bg-black/80 text-white text-xs max-w-sm">
      <h4 className="font-bold mb-2">Filament State</h4>
      <pre>{JSON.stringify({
        modalOpen: isAddingFilament,
        context: addFilamentContext,
        pending: pendingFilamentSelection
      }, null, 2)}</pre>
    </div>
  )
}
```

## Best Practices

1. **Single Source of Truth**: Keep modal state at the component level that renders the modal
2. **Context Preservation**: Always store enough context to know where to apply the new filament
3. **Cleanup**: Always clean up state when modal closes or component unmounts
4. **Error Recovery**: Have a strategy to restore previous state on errors
5. **Type Safety**: Use TypeScript interfaces for all state objects
6. **Debugging**: Add development-only debugging tools for complex state