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
}

export interface Product {
  id: number
  sku: string
  name: string
  packaging_cost: number
  print_time_hrs: number
  printer_profile_id: number
  cogs: number
  filament_usages: FilamentUsage[]
  license_id?: number | null
  model_file?: string | null
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

export interface ProductFormData {
  name: string
  packaging_cost: string | number
  print_time_hrs: string | number
  printer_profile_id: string | number
  license_id?: string
  model_file_url?: string
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
