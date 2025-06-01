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

/**
 * Parse time format string to decimal hours
 * @param value - Time string (e.g., "1h30m", "2h", "45m", or "1.5")
 * @returns Decimal hours or null if invalid
 */
export function parseTimeToHours(value: string): number | null {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  
  // Check if it's already a decimal
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const hours = parseFloat(trimmed)
    return isNaN(hours) ? null : hours
  }
  
  // Parse "1h30m" format
  const match = trimmed.match(/^(?:(\d+)h)?(?:(\d+)m)?$/)
  if (!match || (!match[1] && !match[2])) return null
  
  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  
  return hours + minutes / 60
}