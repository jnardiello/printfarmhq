export interface Filament {
  id: number
  color: string
  brand: string
  material: string
  total_qty_kg: number
  price_per_kg: number
  min_filaments_kg?: number | null
}

export interface FilamentPurchase {
  id: number
  filament_id: number
  filament: Filament
  quantity_kg: number
  price_per_kg: number
  purchase_date: string | null
  channel: string | null
  notes: string | null
}

export interface FilamentUsage {
  filament_id: number
  grams_used: number
  filament?: Filament
}

export interface PlateFilamentUsage {
  id?: number
  filament_id: number
  grams_used: number
  filament: Filament
}

export interface Plate {
  id: number
  name: string
  quantity: number
  print_time_hrs: number
  print_time_formatted: string
  cost: number
  file_path?: string | null
  gcode_path?: string | null
  filament_usages: PlateFilamentUsage[]
}

export interface Product {
  id: number
  sku: string
  name: string
  print_time_hrs: number
  cop: number // Cost of Product (updated naming to match backend)
  filament_usages?: FilamentUsage[] // Legacy - will be deprecated
  plates?: Plate[] // New plate-based structure
  license_id?: number | null
  file_path?: string | null // Legacy - moved to plates
}

export interface Printer {
  id: number
  name: string
  price_eur: number
  expected_life_hours: number
}

export interface Subscription {
  id: number
  name: string
  platform: "Thangs" | "Patreon" | "No Platform"
  license_uri?: string | null
  price_eur: number | null
  duration_days: number
}

export interface PurchaseFormData {
  color: string
  brand: string
  material: string
  quantity_kg: string
  price_per_kg: string
  purchase_date: string
  channel: string
  notes: string
  colorCustom: string
  brandCustom: string
  materialCustom: string
}

export interface FilamentRowData {
  filament_id: number | string
  grams_used: number | string
}

export interface PlateFilamentRowData {
  filament_id: number | string
  grams_used: number | string
}

export interface PlateFormData {
  name: string
  quantity: number | string
  print_time_hrs: number | string
  filament_usages: PlateFilamentRowData[]
  gcode_file?: File | null
}

export interface ProductFormData {
  name: string
  license_id?: string | number
  plates?: PlateFormData[] // New plate-based structure
  // Legacy fields (will be deprecated)
  filament_usages?: FilamentRowData[]
}

export interface JobProductItem {
  product_id: number
  items_qty: number
}

export interface JobPrinterItem {
  printer_profile_id: number
  printers_qty: number
  hours_each: number
}

export interface PrintJob {
  id: string
  name?: string
  products: JobProductItem[]
  printers: JobPrinterItem[]
  packaging_cost_eur: number
  calculated_cogs_eur?: number
  status?: string
  created_at: string
  updated_at: string
}

// Alert system types
export enum AlertType {
  SECURITY = "security",
  INVENTORY = "inventory", 
  PRINTER = "printer",
  BUSINESS = "business",
  SYSTEM = "system"
}

export type AlertPriority = 'critical' | 'warning' | 'info'

export interface Alert {
  id: string
  type: AlertType
  priority: AlertPriority
  title: string
  message: string
  actionLabel?: string
  actionLink?: string
  dismissible: boolean
  expiresAt?: string
  metadata?: Record<string, any>
}
