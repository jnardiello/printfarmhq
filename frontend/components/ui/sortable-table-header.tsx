import React from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { TableHead } from './table'
import { SortDirection, getSortAriaLabel } from '@/lib/sorting-utils'
import { cn } from '@/lib/utils'

interface SortableTableHeaderProps {
  /** Display label for the column */
  label: string
  /** Field name to sort by */
  sortKey: string
  /** Current sort configuration */
  currentSort: {
    field: string
    direction: SortDirection
  }
  /** Callback when sort is requested */
  onSort: (field: string, direction: SortDirection) => void
  /** Additional CSS classes */
  className?: string
  /** Alignment of content */
  align?: 'left' | 'center' | 'right'
  /** Whether this column is sortable */
  sortable?: boolean
}

/**
 * Reusable sortable table header component with visual indicators
 * Provides consistent sorting UX across all tables
 */
export function SortableTableHeader({
  label,
  sortKey,
  currentSort,
  onSort,
  className,
  align = 'left',
  sortable = true
}: SortableTableHeaderProps) {
  const isCurrentSort = currentSort.field === sortKey
  const isAscending = isCurrentSort && currentSort.direction === 'asc'
  const isDescending = isCurrentSort && currentSort.direction === 'desc'

  const handleClick = () => {
    if (!sortable) return
    
    const newDirection: SortDirection = isCurrentSort 
      ? (currentSort.direction === 'asc' ? 'desc' : 'asc')
      : 'desc' // Default to newest first for new sorts
    
    onSort(sortKey, newDirection)
  }

  const SortIcon = () => {
    if (!sortable) return null
    
    if (isAscending) {
      return <ArrowUp className="h-4 w-4 text-primary" />
    }
    if (isDescending) {
      return <ArrowDown className="h-4 w-4 text-primary" />
    }
    return <ArrowUpDown className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity" />
  }

  const alignmentClass = {
    left: 'justify-start',
    center: 'justify-center', 
    right: 'justify-end'
  }[align]

  if (!sortable) {
    return (
      <TableHead className={cn('select-none', className)}>
        <div className={cn('flex items-center gap-2', alignmentClass)}>
          {label}
        </div>
      </TableHead>
    )
  }

  return (
    <TableHead className={cn('select-none', className)}>
      <button
        onClick={handleClick}
        className={cn(
          'group flex items-center gap-2 w-full h-full py-2',
          'hover:bg-muted/50 rounded-md transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
          'cursor-pointer',
          alignmentClass
        )}
        aria-label={getSortAriaLabel(label, currentSort.direction)}
        type="button"
      >
        <span className={cn(
          'font-medium transition-colors',
          isCurrentSort ? 'text-primary' : 'text-foreground'
        )}>
          {label}
        </span>
        <SortIcon />
      </button>
    </TableHead>
  )
}

// Export additional types for convenience
export type { SortDirection }

/**
 * Non-sortable table header for consistency with sortable headers
 */
export function StaticTableHeader({
  label,
  className,
  align = 'left'
}: {
  label: string
  className?: string
  align?: 'left' | 'center' | 'right'
}) {
  return (
    <SortableTableHeader
      label={label}
      sortKey=""
      currentSort={{ field: '', direction: 'desc' }}
      onSort={() => {}}
      className={className}
      align={align}
      sortable={false}
    />
  )
}