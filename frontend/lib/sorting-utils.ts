/**
 * Utilities for user-controlled table sorting with localStorage persistence
 */

export type SortDirection = 'asc' | 'desc'

export interface SortConfig {
  field: string
  direction: SortDirection
}

/**
 * Get saved sort direction from localStorage for a specific table
 * @param tableKey - Unique identifier for the table (e.g., 'print-queue', 'products')
 * @param defaultDirection - Default direction if none saved
 * @returns The saved or default sort direction
 */
export function getSortDirection(tableKey: string, defaultDirection: SortDirection = 'desc'): SortDirection {
  try {
    const saved = localStorage.getItem(`table-sort-${tableKey}`)
    if (saved === 'asc' || saved === 'desc') {
      return saved
    }
  } catch (error) {
    console.warn('Failed to read sort direction from localStorage:', error)
  }
  return defaultDirection
}

/**
 * Save sort direction to localStorage for a specific table
 * @param tableKey - Unique identifier for the table
 * @param direction - Sort direction to save
 */
export function setSortDirection(tableKey: string, direction: SortDirection): void {
  try {
    localStorage.setItem(`table-sort-${tableKey}`, direction)
  } catch (error) {
    console.warn('Failed to save sort direction to localStorage:', error)
  }
}

/**
 * Sort an array of objects by a date field
 * @param items - Array of objects to sort
 * @param dateField - Name of the date field to sort by
 * @param direction - Sort direction ('asc' = oldest first, 'desc' = newest first)
 * @returns New sorted array
 */
export function sortByDate<T extends Record<string, any>>(
  items: T[], 
  dateField: string, 
  direction: SortDirection
): T[] {
  return [...items].sort((a, b) => {
    const dateA = new Date(a[dateField])
    const dateB = new Date(b[dateField])
    
    // Handle invalid dates
    if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0
    if (isNaN(dateA.getTime())) return 1
    if (isNaN(dateB.getTime())) return -1
    
    const comparison = dateA.getTime() - dateB.getTime()
    return direction === 'asc' ? comparison : -comparison
  })
}

/**
 * Toggle sort direction
 * @param current - Current sort direction
 * @returns Opposite direction
 */
export function toggleSortDirection(current: SortDirection): SortDirection {
  return current === 'asc' ? 'desc' : 'asc'
}

/**
 * Get complete sort configuration for a table with persistence
 * @param tableKey - Unique identifier for the table
 * @param defaultField - Default field to sort by
 * @param defaultDirection - Default direction if none saved
 * @returns Complete sort configuration
 */
export function getSortConfig(
  tableKey: string, 
  defaultField: string, 
  defaultDirection: SortDirection = 'desc'
): SortConfig {
  return {
    field: defaultField,
    direction: getSortDirection(tableKey, defaultDirection)
  }
}

/**
 * Update sort configuration and persist to localStorage
 * @param tableKey - Unique identifier for the table
 * @param field - Field being sorted
 * @param currentDirection - Current sort direction
 * @returns New sort configuration
 */
export function updateSortConfig(
  tableKey: string,
  field: string,
  currentDirection: SortDirection
): SortConfig {
  const newDirection = toggleSortDirection(currentDirection)
  setSortDirection(tableKey, newDirection)
  
  return {
    field,
    direction: newDirection
  }
}

/**
 * Helper to format sort direction for display
 * @param direction - Sort direction
 * @returns Human-readable description
 */
export function formatSortDirection(direction: SortDirection): string {
  return direction === 'asc' ? 'Oldest First' : 'Newest First'
}

/**
 * Helper to get aria-label for sort button accessibility
 * @param field - Field name
 * @param direction - Current sort direction
 * @returns Accessible label for screen readers
 */
export function getSortAriaLabel(field: string, direction: SortDirection): string {
  const nextDirection = toggleSortDirection(direction)
  const nextLabel = formatSortDirection(nextDirection)
  return `Sort ${field} - currently ${formatSortDirection(direction)}, click to sort ${nextLabel.toLowerCase()}`
}