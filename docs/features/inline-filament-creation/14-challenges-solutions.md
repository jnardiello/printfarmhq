# Challenges and Solutions

## Overview

Anticipated challenges in implementing the inline filament creation feature and their corresponding solutions, based on the system architecture and requirements.

## Technical Challenges

### Challenge 1: Race Conditions in Concurrent Filament Creation

**Scenario:**  
Two users simultaneously try to create the same filament (same color, brand, material combination).

**Problem:**
- Both requests pass the duplicate check
- Both try to insert into database
- One succeeds, one fails with constraint violation
- User sees confusing error message

**Solution:**

```python
# Backend implementation with proper race condition handling
@app.post("/filaments/create-with-purchase")
async def create_filament_with_purchase(
    filament_data: schemas.FilamentWithPurchaseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    max_retries = 3
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            # Check for existing filament
            existing = db.query(models.Filament).filter(
                models.Filament.color == filament_data.color,
                models.Filament.brand == filament_data.brand,
                models.Filament.material == filament_data.material
            ).with_for_update().first()  # Lock the row
            
            if existing:
                # Return existing filament instead of error
                return {
                    "filament": existing,
                    "message": "Filament already exists, returning existing",
                    "was_existing": True
                }
            
            # Create new filament
            # ... transaction logic ...
            
        except IntegrityError as e:
            db.rollback()
            retry_count += 1
            if retry_count >= max_retries:
                # Final attempt: try to fetch the existing filament
                existing = db.query(models.Filament).filter(
                    models.Filament.color == filament_data.color,
                    models.Filament.brand == filament_data.brand,
                    models.Filament.material == filament_data.material
                ).first()
                
                if existing:
                    return {
                        "filament": existing,
                        "message": "Filament was created by another process",
                        "was_existing": True
                    }
                raise
            
            # Wait with exponential backoff
            await asyncio.sleep(0.1 * (2 ** retry_count))
```

**Frontend Handling:**

```typescript
const handleFilamentCreation = async (formData: FilamentFormData) => {
  try {
    const result = await createFilamentWithPurchase(formData)
    
    if (result.was_existing) {
      // Still a success - filament exists and can be used
      toast({
        title: "Filament Found",
        description: "This filament already exists. It has been selected for you.",
        variant: "info"
      })
    } else {
      toast({
        title: "Filament Created",
        description: "New filament added to your inventory.",
        variant: "success"
      })
    }
    
    // Both cases: select the filament
    onSuccess(result.filament)
    
  } catch (error) {
    // Only show error for actual failures
    handleError(error)
  }
}
```

### Challenge 2: Complex State Management with Nested Modals

**Scenario:**  
Product creation modal → Filament dropdown → Add new filament modal

**Problem:**
- ESC key closes both modals
- Click outside closes parent modal
- Focus management issues
- Z-index stacking problems

**Solution:**

```typescript
// Modal manager to handle nested modals
class ModalManager {
  private modalStack: string[] = []
  
  register(modalId: string) {
    this.modalStack.push(modalId)
    this.updateBodyScroll()
    this.updateZIndexes()
  }
  
  unregister(modalId: string) {
    this.modalStack = this.modalStack.filter(id => id !== modalId)
    this.updateBodyScroll()
    this.updateZIndexes()
  }
  
  isTopModal(modalId: string): boolean {
    return this.modalStack[this.modalStack.length - 1] === modalId
  }
  
  private updateBodyScroll() {
    // Prevent body scroll only if modals are open
    document.body.style.overflow = this.modalStack.length > 0 ? 'hidden' : ''
  }
  
  private updateZIndexes() {
    // Ensure proper stacking
    this.modalStack.forEach((modalId, index) => {
      const modal = document.getElementById(modalId)
      if (modal) {
        modal.style.zIndex = (1000 + index * 10).toString()
      }
    })
  }
}

// Enhanced modal component
export function EnhancedModal({ id, children, onClose, ...props }) {
  const modalManager = useModalManager()
  
  useEffect(() => {
    modalManager.register(id)
    return () => modalManager.unregister(id)
  }, [id])
  
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && modalManager.isTopModal(id)) {
      onClose()
    }
  }
  
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    // Only close if clicking on the backdrop of THIS modal
    if (target.dataset.modalId === id && modalManager.isTopModal(id)) {
      onClose()
    }
  }
  
  return (
    <Portal>
      <div
        id={id}
        data-modal-id={id}
        className="modal-backdrop"
        onClick={handleClickOutside}
        onKeyDown={handleEscape}
      >
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          {children}
        </div>
      </div>
    </Portal>
  )
}
```

### Challenge 3: Maintaining Form State During Modal Interactions

**Scenario:**  
User has partially filled product form, opens filament modal, cancels, form data is lost.

**Problem:**
- Parent component might re-render
- Form values not persisted
- User frustration from data loss

**Solution:**

```typescript
// Form state persistence hook
function usePersistedFormState<T>(key: string, initialState: T) {
  // Try to restore from sessionStorage
  const [state, setState] = useState<T>(() => {
    try {
      const saved = sessionStorage.getItem(key)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Only restore if less than 1 hour old
        if (Date.now() - parsed.timestamp < 3600000) {
          return parsed.data
        }
      }
    } catch (e) {
      console.warn('Failed to restore form state:', e)
    }
    return initialState
  })
  
  // Save to sessionStorage on change
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify({
        data: state,
        timestamp: Date.now()
      }))
    } catch (e) {
      console.warn('Failed to persist form state:', e)
    }
  }, [key, state])
  
  // Clear on successful submission
  const clearPersistedState = () => {
    sessionStorage.removeItem(key)
  }
  
  return [state, setState, clearPersistedState] as const
}

// Usage in product form
function ProductForm() {
  const [formData, setFormData, clearFormData] = usePersistedFormState(
    'product-form-draft',
    initialFormState
  )
  
  const handleSubmit = async () => {
    try {
      await createProduct(formData)
      clearFormData() // Only clear on success
    } catch (error) {
      // Form data remains in sessionStorage
    }
  }
}
```

### Challenge 4: Performance with Large Filament Lists

**Scenario:**  
User has 500+ filaments, dropdown becomes slow.

**Problem:**
- Rendering 500+ items in dropdown
- Searching through large list
- Memory usage

**Solution:**

```typescript
// Virtualized select component
import { FixedSizeList } from 'react-window'

function VirtualizedFilamentSelect({ filaments, value, onChange }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  
  // Memoize filtered and sorted filaments
  const filteredFilaments = useMemo(() => {
    const filtered = filaments.filter(f => {
      const searchLower = searchTerm.toLowerCase()
      return (
        f.color.toLowerCase().includes(searchLower) ||
        f.brand.toLowerCase().includes(searchLower) ||
        f.material.toLowerCase().includes(searchLower)
      )
    })
    
    // Sort by relevance
    return filtered.sort((a, b) => {
      // Exact matches first
      const aExact = a.color.toLowerCase() === searchLower
      const bExact = b.color.toLowerCase() === searchLower
      if (aExact && !bExact) return -1
      if (!aExact && bExact) return 1
      
      // Then alphabetical
      return `${a.color} ${a.material}`.localeCompare(`${b.color} ${b.material}`)
    })
  }, [filaments, searchTerm])
  
  // Add "Add New" option at the end
  const itemCount = filteredFilaments.length + 1
  
  const Row = ({ index, style }) => {
    if (index === filteredFilaments.length) {
      return (
        <div style={style} className="add-new-option">
          <Plus className="icon" />
          Add New Filament...
        </div>
      )
    }
    
    const filament = filteredFilaments[index]
    return (
      <div
        style={style}
        className="filament-option"
        onClick={() => handleSelect(filament.id)}
      >
        <div className="color-dot" style={{ backgroundColor: filament.color }} />
        {filament.color} {filament.material} ({filament.brand})
      </div>
    )
  }
  
  return (
    <div className="virtualized-select">
      <input
        type="text"
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        placeholder="Search filaments..."
        className="search-input"
      />
      
      <FixedSizeList
        height={300}
        itemCount={itemCount}
        itemSize={40}
        width="100%"
      >
        {Row}
      </FixedSizeList>
    </div>
  )
}
```

## UX Challenges

### Challenge 5: Unclear Error Messages

**Problem:**  
Generic error messages don't help users understand what went wrong.

**Solution:**

```typescript
// Error message translator
const errorMessageMap: Record<string, (error: any) => string> = {
  'duplicate_filament': (error) => {
    const { color, brand, material } = error.details
    return `A ${color} ${material} filament from ${brand} already exists in your inventory.`
  },
  
  'network_error': (error) => {
    if (!navigator.onLine) {
      return "You appear to be offline. Please check your internet connection and try again."
    }
    return "Unable to connect to the server. Please check your connection and try again."
  },
  
  'validation_error': (error) => {
    const fields = error.fields || []
    if (fields.length === 1) {
      return `Please check the ${fields[0]} field and try again.`
    }
    return `Please check the following fields: ${fields.join(', ')}`
  },
  
  'permission_denied': () => {
    return "You don't have permission to create filaments. Please contact your administrator."
  },
  
  'server_error': () => {
    return "Something went wrong on our end. Our team has been notified. Please try again in a few moments."
  }
}

function getUserFriendlyError(error: any): string {
  const errorType = error.type || 'unknown'
  const translator = errorMessageMap[errorType]
  
  if (translator) {
    return translator(error)
  }
  
  // Fallback to generic message
  return "An unexpected error occurred. Please try again or contact support if the problem persists."
}
```

### Challenge 6: Mobile Experience

**Problem:**  
Modal-in-modal doesn't work well on mobile devices.

**Solution:**

```typescript
// Responsive modal behavior
function ResponsiveFilamentCreation({ isMobile, onSuccess }) {
  if (isMobile) {
    // Full page experience on mobile
    return (
      <MobileFilamentPage
        onSuccess={onSuccess}
        onBack={() => history.back()}
      />
    )
  }
  
  // Modal experience on desktop
  return (
    <QuickFilamentModal
      onSuccess={onSuccess}
    />
  )
}

// Mobile-optimized page
function MobileFilamentPage({ onSuccess, onBack }) {
  return (
    <div className="mobile-page">
      <header className="mobile-header">
        <button onClick={onBack} className="back-button">
          <ChevronLeft />
        </button>
        <h1>Add New Filament</h1>
      </header>
      
      <main className="mobile-content">
        <QuickFilamentForm
          onSuccess={(filament) => {
            onSuccess(filament)
            onBack()
          }}
          onCancel={onBack}
          isMobile={true}
        />
      </main>
    </div>
  )
}
```

## Data Integrity Challenges

### Challenge 7: Orphaned Purchases

**Problem:**  
If filament creation succeeds but purchase creation fails, we have an orphaned filament.

**Solution:**

```python
# Implement saga pattern for distributed transactions
class FilamentCreationSaga:
    def __init__(self, db: Session):
        self.db = db
        self.created_entities = []
    
    async def execute(self, data: FilamentWithPurchaseCreate):
        try:
            # Step 1: Create filament
            filament = await self.create_filament(data)
            self.created_entities.append(('filament', filament.id))
            
            # Step 2: Create purchase
            purchase = await self.create_purchase(filament.id, data)
            self.created_entities.append(('purchase', purchase.id))
            
            # Step 3: Update inventory
            await self.update_inventory(filament.id, data.quantity_kg)
            
            # Commit all changes
            self.db.commit()
            return filament, purchase
            
        except Exception as e:
            # Compensate by removing created entities
            await self.compensate()
            raise
    
    async def compensate(self):
        """Undo all completed steps"""
        for entity_type, entity_id in reversed(self.created_entities):
            try:
                if entity_type == 'filament':
                    self.db.query(Filament).filter_by(id=entity_id).delete()
                elif entity_type == 'purchase':
                    self.db.query(FilamentPurchase).filter_by(id=entity_id).delete()
            except:
                # Log compensation failure
                logger.error(f"Failed to compensate {entity_type} {entity_id}")
        
        self.db.rollback()
```

### Challenge 8: Cache Invalidation

**Problem:**  
New filament doesn't appear immediately in other browser tabs/windows.

**Solution:**

```typescript
// Broadcast channel for cross-tab communication
class FilamentCacheManager {
  private channel: BroadcastChannel
  private cache: Map<string, Filament[]> = new Map()
  
  constructor() {
    this.channel = new BroadcastChannel('filament-updates')
    this.channel.onmessage = this.handleMessage.bind(this)
  }
  
  async createFilament(data: FilamentFormData): Promise<Filament> {
    const filament = await api.createFilament(data)
    
    // Update local cache
    this.invalidateCache()
    
    // Notify other tabs
    this.channel.postMessage({
      type: 'filament-created',
      filament
    })
    
    return filament
  }
  
  private handleMessage(event: MessageEvent) {
    if (event.data.type === 'filament-created') {
      // Another tab created a filament
      this.invalidateCache()
      this.notifyComponents()
    }
  }
  
  private invalidateCache() {
    this.cache.clear()
  }
  
  private notifyComponents() {
    // Trigger re-fetch in all listening components
    window.dispatchEvent(new CustomEvent('filament-cache-invalidated'))
  }
}

// Usage in components
function useFilaments() {
  const [filaments, setFilaments] = useState<Filament[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  
  useEffect(() => {
    const handleCacheInvalidation = () => {
      setRefreshKey(k => k + 1) // Force re-fetch
    }
    
    window.addEventListener('filament-cache-invalidated', handleCacheInvalidation)
    return () => {
      window.removeEventListener('filament-cache-invalidated', handleCacheInvalidation)
    }
  }, [])
  
  useEffect(() => {
    fetchFilaments().then(setFilaments)
  }, [refreshKey])
  
  return filaments
}
```

## Security Challenges

### Challenge 9: XSS in User Input

**Problem:**  
User enters malicious scripts in filament fields.

**Solution:**

```typescript
// Input sanitization utility
const sanitizeFilamentInput = (input: string): string => {
  // Remove any HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '')
  
  // Escape special characters
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
  
  // Remove any potential script injections
  sanitized = sanitized.replace(/javascript:/gi, '')
  sanitized = sanitized.replace(/on\w+\s*=/gi, '')
  
  return sanitized.trim()
}

// Apply to all text inputs
const handleInputChange = (field: string, value: string) => {
  const sanitizedValue = sanitizeFilamentInput(value)
  setFormData(prev => ({
    ...prev,
    [field]: sanitizedValue
  }))
}

// Backend validation
def sanitize_input(value: str) -> str:
    """Sanitize user input to prevent XSS"""
    # Use bleach library for comprehensive sanitization
    import bleach
    
    # Allow only alphanumeric, spaces, and specific punctuation
    cleaned = bleach.clean(value, tags=[], strip=True)
    
    # Additional validation for specific fields
    if len(cleaned) != len(value):
        logger.warning(f"Potentially malicious input detected and sanitized")
    
    return cleaned
```