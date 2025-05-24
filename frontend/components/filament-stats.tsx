"use client"

import { useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Package, DollarSign, Scale, Layers } from "lucide-react"
import type { Filament, FilamentPurchase } from "@/lib/types"

interface FilamentStatsProps {
  filaments: Filament[]
  purchases: FilamentPurchase[]
}

export function FilamentStats({ filaments, purchases }: FilamentStatsProps) {
  const stats = useMemo(() => {
    // Total filament weight
    const totalWeight = filaments.reduce((sum, f) => sum + f.total_qty_kg, 0)

    // Total spent
    const totalSpent = purchases.reduce((sum, p) => sum + p.quantity_kg * p.price_per_kg, 0)

    // Average price per kg
    const avgPrice =
      totalWeight > 0 ? filaments.reduce((sum, f) => sum + f.price_per_kg * f.total_qty_kg, 0) / totalWeight : 0

    // Unique materials count
    const uniqueMaterials = new Set(filaments.map((f) => f.material)).size

    return {
      totalWeight: totalWeight.toFixed(2),
      totalSpent: totalSpent.toFixed(2),
      avgPrice: avgPrice.toFixed(2),
      uniqueMaterials,
    }
  }, [filaments, purchases])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Filament</p>
              <p className="text-2xl font-semibold mt-1">{stats.totalWeight} kg</p>
            </div>
            <div className="p-2 bg-muted rounded-md">
              <Package className="h-5 w-5 text-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Spent</p>
              <p className="text-2xl font-semibold mt-1">€{stats.totalSpent}</p>
            </div>
            <div className="p-2 bg-muted rounded-md">
              <DollarSign className="h-5 w-5 text-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Avg. Price</p>
              <p className="text-2xl font-semibold mt-1">€{stats.avgPrice}/kg</p>
            </div>
            <div className="p-2 bg-muted rounded-md">
              <Scale className="h-5 w-5 text-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Materials</p>
              <p className="text-2xl font-semibold mt-1">{stats.uniqueMaterials}</p>
            </div>
            <div className="p-2 bg-muted rounded-md">
              <Layers className="h-5 w-5 text-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
