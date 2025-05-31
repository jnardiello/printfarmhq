# Error Handling

## Overview

Comprehensive error handling strategy for the inline filament creation feature, covering all possible error scenarios with appropriate user feedback and recovery mechanisms.

## Error Categories

### 1. Validation Errors

These are client-side errors that can be caught before making API calls.

#### Field-Level Validation Errors

```typescript
interface FieldError {
  field: string
  message: string
  type: 'required' | 'format' | 'range' | 'length'
}

const fieldErrorMessages = {
  color: {
    required: "Color is required",
    length: "Color name must be 50 characters or less",
    format: "Color name contains invalid characters"
  },
  brand: {
    required: "Brand is required",
    length: "Brand name must be 50 characters or less",
    format: "Brand name contains invalid characters"
  },
  quantity_kg: {
    required: "Quantity is required",
    range: "Quantity must be between 0.001 and 9999.999 kg",
    format: "Please enter a valid number"
  },
  price_per_kg: {
    required: "Price is required",
    range: "Price must be between 0.01 and 9999.99 €",
    format: "Please enter a valid price"
  }
}
```

#### Display Strategy

```typescript
// Inline field errors
<div className="form-group">
  <Label htmlFor="color">Color *</Label>
  <Input
    id="color"
    value={formData.color}
    onChange={handleChange}
    className={errors.color ? "border-red-500" : ""}
    aria-invalid={!!errors.color}
    aria-describedby={errors.color ? "color-error" : undefined}
  />
  {errors.color && (
    <p id="color-error" className="text-sm text-red-500 mt-1">
      {errors.color}
    </p>
  )}
</div>
```

### 2. Business Logic Errors

#### Duplicate Filament Error

**Scenario:** User tries to create a filament that already exists

```typescript
interface DuplicateFilamentError {
  type: 'duplicate'
  existingFilament: Filament
}

const handleDuplicateFilament = (error: DuplicateFilamentError) => {
  return (
    <Alert variant="warning">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Filament Already Exists</AlertTitle>
      <AlertDescription>
        {error.existingFilament.color} {error.existingFilament.material} 
        by {error.existingFilament.brand} is already in your inventory.
      </AlertDescription>
      <div className="mt-3 flex gap-2">
        <Button 
          size="sm" 
          onClick={() => onSuccess(error.existingFilament)}
        >
          Use Existing Filament
        </Button>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => setError(null)}
        >
          Try Different Details
        </Button>
      </div>
    </Alert>
  )
}
```

#### Insufficient Permissions

**Scenario:** User doesn't have permission to create filaments

```typescript
const handlePermissionError = () => {
  return (
    <Alert variant="destructive">
      <Shield className="h-4 w-4" />
      <AlertTitle>Permission Denied</AlertTitle>
      <AlertDescription>
        You don't have permission to create filaments. 
        Please contact your administrator.
      </AlertDescription>
    </Alert>
  )
}
```

### 3. Network Errors

#### Connection Errors

```typescript
interface NetworkError {
  type: 'network'
  message: string
  canRetry: boolean
}

const handleNetworkError = (error: NetworkError) => {
  const [retrying, setRetrying] = useState(false)
  
  const retry = async () => {
    setRetrying(true)
    try {
      await submitForm()
    } finally {
      setRetrying(false)
    }
  }
  
  return (
    <Alert variant="destructive">
      <WifiOff className="h-4 w-4" />
      <AlertTitle>Connection Error</AlertTitle>
      <AlertDescription>
        {error.message || "Unable to connect to the server. Please check your internet connection."}
      </AlertDescription>
      {error.canRetry && (
        <Button 
          size="sm" 
          onClick={retry} 
          disabled={retrying}
          className="mt-3"
        >
          {retrying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Retrying...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </>
          )}
        </Button>
      )}
    </Alert>
  )
}
```

#### Timeout Errors

```typescript
const TIMEOUT_DURATION = 30000 // 30 seconds

const createFilamentWithTimeout = async (data: FilamentFormData) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_DURATION)
  
  try {
    const response = await fetch('/api/filaments/create-with-purchase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data),
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    return response
  } catch (error: any) {
    clearTimeout(timeoutId)
    
    if (error.name === 'AbortError') {
      throw {
        type: 'timeout',
        message: 'Request timed out. The server is taking too long to respond.',
        canRetry: true
      }
    }
    
    throw error
  }
}
```

### 4. Server Errors

#### 500 Internal Server Error

```typescript
const handleServerError = (status: number) => {
  const errorMessages: Record<number, string> = {
    500: "An unexpected server error occurred. Our team has been notified.",
    502: "The server is temporarily unavailable. Please try again in a few moments.",
    503: "The service is currently undergoing maintenance. Please try again later.",
    504: "The server is not responding. Please check your connection and try again."
  }
  
  return (
    <Alert variant="destructive">
      <ServerCrash className="h-4 w-4" />
      <AlertTitle>Server Error</AlertTitle>
      <AlertDescription>
        {errorMessages[status] || `Server error (${status}). Please try again later.`}
      </AlertDescription>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => window.location.reload()}>
          Refresh Page
        </Button>
      </div>
    </Alert>
  )
}
```

#### Database Errors

```typescript
const handleDatabaseError = (error: any) => {
  // Don't expose internal database errors to users
  console.error('Database error:', error)
  
  return (
    <Alert variant="destructive">
      <Database className="h-4 w-4" />
      <AlertTitle>Unable to Save</AlertTitle>
      <AlertDescription>
        We couldn't save your filament due to a technical issue. 
        Please try again or contact support if the problem persists.
      </AlertDescription>
    </Alert>
  )
}
```

## Error Recovery Strategies

### 1. Automatic Retry with Exponential Backoff

```typescript
const retryWithBackoff = async (
  fn: () => Promise<any>,
  maxRetries: number = 3,
  baseDelay: number = 1000
) => {
  let lastError: any
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      
      // Don't retry on client errors (4xx)
      if (error.response?.status >= 400 && error.response?.status < 500) {
        throw error
      }
      
      // Wait before retrying
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i) // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError
}
```

### 2. Form State Preservation

```typescript
// Save form state to localStorage on error
const saveFormState = (formData: FilamentFormData) => {
  try {
    localStorage.setItem('filament-form-draft', JSON.stringify({
      data: formData,
      timestamp: Date.now()
    }))
  } catch (e) {
    console.warn('Could not save form draft:', e)
  }
}

// Restore form state on component mount
const restoreFormState = (): FilamentFormData | null => {
  try {
    const saved = localStorage.getItem('filament-form-draft')
    if (!saved) return null
    
    const { data, timestamp } = JSON.parse(saved)
    
    // Only restore if less than 1 hour old
    if (Date.now() - timestamp < 3600000) {
      return data
    }
    
    localStorage.removeItem('filament-form-draft')
  } catch (e) {
    console.warn('Could not restore form draft:', e)
  }
  
  return null
}
```

### 3. Optimistic UI Updates with Rollback

```typescript
const createFilamentOptimistic = async (formData: FilamentFormData) => {
  // Create optimistic filament
  const optimisticFilament: Filament = {
    id: -Date.now(), // Temporary negative ID
    ...formData,
    isOptimistic: true
  }
  
  // Add to UI immediately
  addFilamentToUI(optimisticFilament)
  
  try {
    const realFilament = await api.createFilament(formData)
    // Replace optimistic with real
    replaceFilament(optimisticFilament.id, realFilament)
    return realFilament
  } catch (error) {
    // Rollback on error
    removeFilament(optimisticFilament.id)
    
    // Show error with option to retry
    showError({
      message: "Failed to create filament",
      action: {
        label: "Retry",
        handler: () => createFilamentOptimistic(formData)
      }
    })
    
    throw error
  }
}
```

## Error Logging and Monitoring

### Client-Side Error Logging

```typescript
interface ErrorLog {
  timestamp: string
  errorType: string
  message: string
  stack?: string
  context: {
    userId?: string
    formData?: Partial<FilamentFormData>
    apiEndpoint?: string
    httpStatus?: number
  }
}

const logError = (error: any, context: any) => {
  const errorLog: ErrorLog = {
    timestamp: new Date().toISOString(),
    errorType: error.name || 'UnknownError',
    message: error.message || 'An unknown error occurred',
    stack: error.stack,
    context: {
      ...context,
      // Sanitize sensitive data
      formData: context.formData ? {
        color: context.formData.color,
        brand: context.formData.brand,
        material: context.formData.material
        // Don't log notes or other potentially sensitive fields
      } : undefined
    }
  }
  
  // Send to logging service
  if (window.analytics?.track) {
    window.analytics.track('Error', errorLog)
  }
  
  // Also log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Filament Creation Error:', errorLog)
  }
}
```

### Server-Side Error Logging

```python
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

def log_filament_error(error: Exception, user_id: int, request_data: dict):
    """Log filament creation errors with context"""
    
    error_context = {
        "timestamp": datetime.utcnow().isoformat(),
        "user_id": user_id,
        "error_type": type(error).__name__,
        "error_message": str(error),
        "filament_data": {
            "color": request_data.get("color"),
            "brand": request_data.get("brand"),
            "material": request_data.get("material"),
            # Don't log sensitive data
        }
    }
    
    if isinstance(error, IntegrityError):
        logger.warning("Duplicate filament attempt", extra=error_context)
    elif isinstance(error, ValidationError):
        logger.info("Filament validation error", extra=error_context)
    else:
        logger.error("Unexpected filament creation error", 
                    extra=error_context, 
                    exc_info=True)
```

## User-Friendly Error Messages

### Error Message Mapping

```typescript
const getUserFriendlyMessage = (error: any): string => {
  // Network errors
  if (!navigator.onLine) {
    return "You appear to be offline. Please check your internet connection."
  }
  
  // HTTP status codes
  if (error.response) {
    switch (error.response.status) {
      case 400:
        return "The information provided is invalid. Please check and try again."
      case 401:
        return "Your session has expired. Please log in again."
      case 403:
        return "You don't have permission to perform this action."
      case 404:
        return "The requested resource was not found."
      case 409:
        return "This filament already exists in your inventory."
      case 422:
        return "Please check the highlighted fields and try again."
      case 429:
        return "Too many requests. Please wait a moment and try again."
      case 500:
        return "Something went wrong on our end. Please try again."
      case 502:
      case 503:
        return "The service is temporarily unavailable. Please try again later."
      default:
        return "An unexpected error occurred. Please try again."
    }
  }
  
  // Timeout
  if (error.code === 'ECONNABORTED') {
    return "The request took too long. Please try again."
  }
  
  // Default
  return "An error occurred. Please try again or contact support if the problem persists."
}
```

## Testing Error Scenarios

### Unit Tests

```typescript
describe('Error Handling', () => {
  it('should display validation errors inline', async () => {
    const { getByLabelText, getByText } = render(<QuickFilamentForm />)
    
    const submitButton = getByText('Create Filament')
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(getByText('Color is required')).toBeInTheDocument()
      expect(getByText('Brand is required')).toBeInTheDocument()
    })
  })
  
  it('should handle duplicate filament error', async () => {
    mockApi.createFilament.mockRejectedValue({
      response: {
        status: 409,
        data: {
          existing_filament: mockFilament
        }
      }
    })
    
    // ... test duplicate handling
  })
  
  it('should retry on network error', async () => {
    mockApi.createFilament
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockFilament)
    
    // ... test retry logic
  })
})
```