/**
 * Simple time format validation utility
 * Supports: "1h30m", "2h", "45m", or decimal "1.5"
 */

export const TIME_FORMAT_PATTERN = /^(\d+h)?(\d+m)?$|^\d+(\.\d+)?$/
export const TIME_FORMAT_PLACEHOLDER = "e.g. 1h30m"

/**
 * Basic validation for time format input
 * @param value - The input value to validate
 * @returns true if format appears valid, false otherwise
 */
export function isValidTimeFormat(value: string): boolean {
  if (!value || typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed) return false
  return TIME_FORMAT_PATTERN.test(trimmed)
}

/**
 * Format decimal hours to human-readable format
 * @param hours - Decimal hours (e.g., 1.75)
 * @returns Formatted string (e.g., "1h45m")
 */
export function formatHoursDisplay(hours: number): string {
  if (hours <= 0) return "0m"
  
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  
  if (m === 60) {  // Handle rounding edge case
    return `${h + 1}h`
  }
  
  if (h > 0 && m > 0) {
    return `${h}h${m}m`
  } else if (h > 0) {
    return `${h}h`
  } else {
    return `${m}m`
  }
}