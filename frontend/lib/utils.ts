import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return "—"

  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString

  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`
}

export function calculateTotalSpent(purchases: any[]): number {
  return purchases.reduce((acc, p) => acc + p.quantity_kg * p.price_per_kg, 0)
}

export function formatTimeToHHMM(hours: number): string {
  if (!hours || hours === 0) return "0h00m"
  
  const wholeHours = Math.floor(hours)
  const minutes = Math.round((hours - wholeHours) * 60)
  
  if (minutes === 0) {
    return `${wholeHours}h`
  }
  
  return `${wholeHours}h${minutes.toString().padStart(2, '0')}m`
}
