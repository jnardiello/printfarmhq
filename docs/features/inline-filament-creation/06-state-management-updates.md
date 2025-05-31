# State Management Updates

## Overview

Update the DataProvider to support the new filament creation endpoint and ensure proper state synchronization across the application.

## DataProvider Updates

### Location

`frontend/components/data-provider.tsx`

### New API Function

Add the following function to the DataProvider:

```typescript
// In data-provider.tsx

interface FilamentFlexibleData {
  color: string;
  brand: string;
  material: string;
  estimated_cost_per_kg: number;
  create_purchase: boolean;
  purchase_data?: {
    quantity_kg: number;
    price_per_kg: number;
    purchase_date?: string;
    purchase_channel?: string;
    notes?: string;
  };
}

interface FilamentFlexibleResponse {
  filament: Filament;
  purchase?: FilamentPurchase;
  message: string;
  warnings: string[];
}

// Add to the DataContext value
interface DataContextType {
  // ... existing properties
  createFilamentFlexible: (data: FilamentFlexibleData) => Promise<FilamentFlexibleResponse>;
}

// In the DataProvider component
const createFilamentFlexible = async (data: FilamentFlexibleData): Promise<FilamentFlexibleResponse> => {
  try {
    const response = await fetch('/api/filaments/create-flexible', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      },
      body: JSON.stringify(data),
    })
    
    if (response.status === 409) {
      // Handle duplicate filament
      const errorData = await response.json()
      const error = new Error('Filament already exists')
      ;(error as any).response = { status: 409, data: errorData }
      throw error
    }
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.detail || 'Failed to create filament')
    }
    
    const result: FilamentFlexibleResponse = await response.json()
    
    // Update local state
    setFilaments(prev => [...prev, result.filament])
    
    // Only add purchase if one was created
    if (result.purchase) {
      setFilamentPurchases(prev => [...prev, result.purchase])
    }
    
    // Sort filaments alphabetically
    setFilaments(prev => 
      [...prev].sort((a, b) => 
        `${a.color} ${a.material}`.localeCompare(`${b.color} ${b.material}`)
      )
    )
    
    return result
  } catch (error) {
    console.error('Error creating filament with purchase:', error)
    throw error
  }
}
```

### State Synchronization

Ensure proper state updates when a new filament is created:

```typescript
// After successful creation
const handleFilamentCreated = (newFilament: Filament, newPurchase: FilamentPurchase) => {
  // 1. Add to filaments array
  setFilaments(prev => {
    // Check if already exists (in case of race condition)
    if (prev.find(f => f.id === newFilament.id)) {
      return prev
    }
    return [...prev, newFilament].sort((a, b) => 
      `${a.color} ${a.material}`.localeCompare(`${b.color} ${b.material}`)
    )
  })
  
  // 2. Add to purchases array
  setFilamentPurchases(prev => {
    if (prev.find(p => p.id === newPurchase.id)) {
      return prev
    }
    return [...prev, newPurchase]
  })
  
  // 3. Update any derived state
  updateFilamentStats()
}
```

## Optimistic Updates

For better UX, implement optimistic updates:

```typescript
interface OptimisticFilament extends Filament {
  isOptimistic?: boolean;
  tempId?: string;
}

const createFilamentWithPurchaseOptimistic = async (data: FilamentWithPurchaseData) => {
  // Generate temporary IDs
  const tempFilamentId = `temp-${Date.now()}`
  const tempPurchaseId = `temp-${Date.now()}-purchase`
  
  // Create optimistic records
  const optimisticFilament: OptimisticFilament = {
    id: -Math.random(), // Negative ID to distinguish from real IDs
    color: data.color,
    brand: data.brand,
    material: data.material,
    price_per_kg: data.price_per_kg,
    total_qty_kg: data.quantity_kg,
    min_filaments_kg: null,
    isOptimistic: true,
    tempId: tempFilamentId
  }
  
  const optimisticPurchase = {
    id: -Math.random(),
    filament_id: optimisticFilament.id,
    quantity_kg: data.quantity_kg,
    price_per_kg: data.price_per_kg,
    purchase_date: data.purchase_date || new Date().toISOString(),
    purchase_channel: data.purchase_channel || null,
    notes: data.notes || null,
    isOptimistic: true,
    tempId: tempPurchaseId
  }
  
  // Add optimistic records immediately
  setFilaments(prev => [...prev, optimisticFilament])
  setFilamentPurchases(prev => [...prev, optimisticPurchase])
  
  try {
    // Make actual API call
    const result = await createFilamentWithPurchase(data)
    
    // Replace optimistic records with real ones
    setFilaments(prev => 
      prev.map(f => 
        (f as OptimisticFilament).tempId === tempFilamentId 
          ? result.filament 
          : f
      )
    )
    
    setFilamentPurchases(prev =>
      prev.map(p =>
        (p as any).tempId === tempPurchaseId
          ? result.purchase
          : p
      )
    )
    
    return result
  } catch (error) {
    // Remove optimistic records on error
    setFilaments(prev => 
      prev.filter(f => (f as OptimisticFilament).tempId !== tempFilamentId)
    )
    setFilamentPurchases(prev =>
      prev.filter(p => (p as any).tempId !== tempPurchaseId)
    )
    
    throw error
  }
}
```

## Cache Management

### Invalidation Strategy

When a new filament is created, ensure related caches are updated:

```typescript
const invalidateRelatedCaches = () => {
  // Clear any cached filament statistics
  filamentStatsCache.clear()
  
  // Clear any cached autocomplete data
  brandAutocompleteCache.clear()
  colorAutocompleteCache.clear()
  
  // Trigger re-fetch of any dependent data
  if (shouldRefreshProducts) {
    fetchProducts()
  }
}
```

### Deduplication

Prevent duplicate filaments in state:

```typescript
const addFilamentToState = (filament: Filament) => {
  setFilaments(prev => {
    // Check for duplicates by ID
    const existingIndex = prev.findIndex(f => f.id === filament.id)
    if (existingIndex >= 0) {
      // Update existing
      const updated = [...prev]
      updated[existingIndex] = filament
      return updated
    }
    
    // Check for duplicates by unique combination
    const duplicateIndex = prev.findIndex(f => 
      f.color === filament.color &&
      f.brand === filament.brand &&
      f.material === filament.material
    )
    
    if (duplicateIndex >= 0) {
      // Replace with new data (shouldn't happen with proper backend validation)
      console.warn('Duplicate filament detected, replacing:', prev[duplicateIndex])
      const updated = [...prev]
      updated[duplicateIndex] = filament
      return updated
    }
    
    // Add new
    return [...prev, filament]
  })
}
```

## Error State Management

### Global Error Handling

```typescript
const [filamentErrors, setFilamentErrors] = useState<Map<string, string>>(new Map())

const handleFilamentError = (error: any, context: string) => {
  const errorKey = `filament-${context}-${Date.now()}`
  
  if (error.response?.status === 409) {
    // Duplicate filament - not really an error
    setFilamentErrors(prev => {
      const next = new Map(prev)
      next.set(errorKey, 'This filament already exists')
      // Auto-clear after 3 seconds
      setTimeout(() => {
        setFilamentErrors(p => {
          const n = new Map(p)
          n.delete(errorKey)
          return n
        })
      }, 3000)
      return next
    })
  } else {
    // Real error
    setFilamentErrors(prev => {
      const next = new Map(prev)
      next.set(errorKey, error.message || 'Unknown error')
      return next
    })
  }
}
```

## Subscription to State Changes

For components that need to react to filament changes:

```typescript
// Custom hook for filament state
export const useFilaments = () => {
  const context = useContext(DataContext)
  if (!context) {
    throw new Error('useFilaments must be used within DataProvider')
  }
  
  return {
    filaments: context.filaments,
    loading: context.loading,
    error: context.error,
    createFilamentWithPurchase: context.createFilamentWithPurchase,
    // Computed values
    filamentCount: context.filaments.length,
    totalInventoryValue: context.filaments.reduce(
      (sum, f) => sum + (f.total_qty_kg * f.price_per_kg),
      0
    )
  }
}
```

## Performance Optimization

### Memoization

```typescript
// Memoize expensive computations
const filamentsByMaterial = useMemo(() => {
  const grouped = new Map<string, Filament[]>()
  filaments.forEach(f => {
    const material = f.material
    if (!grouped.has(material)) {
      grouped.set(material, [])
    }
    grouped.get(material)!.push(f)
  })
  return grouped
}, [filaments])

// Memoize the context value to prevent unnecessary re-renders
const contextValue = useMemo(() => ({
  filaments,
  filamentPurchases,
  loading,
  error,
  createFilamentWithPurchase,
  // ... other values
}), [filaments, filamentPurchases, loading, error])
```

### Batch Updates

When multiple state updates occur:

```typescript
const batchedStateUpdate = unstable_batchedUpdates || ((fn: Function) => fn())

const handleMultipleFilamentCreations = (newFilaments: Filament[]) => {
  batchedStateUpdate(() => {
    setFilaments(prev => [...prev, ...newFilaments])
    setFilamentPurchases(prev => [...prev, ...newPurchases])
    updateFilamentStats()
    clearRelatedCaches()
  })
}
```

## Testing State Management

### Mock DataProvider for Tests

```typescript
// test-utils/mock-data-provider.tsx
export const MockDataProvider: React.FC<{ children: React.ReactNode; mockData?: any }> = ({ 
  children, 
  mockData = {} 
}) => {
  const defaultMockData = {
    filaments: [],
    filamentPurchases: [],
    loading: false,
    error: null,
    createFilamentWithPurchase: jest.fn().mockResolvedValue({
      filament: { id: 1, color: 'Black', brand: 'Test', material: 'PLA' },
      purchase: { id: 1, filament_id: 1, quantity_kg: 1, price_per_kg: 25 }
    }),
    ...mockData
  }
  
  return (
    <DataContext.Provider value={defaultMockData}>
      {children}
    </DataContext.Provider>
  )
}
```