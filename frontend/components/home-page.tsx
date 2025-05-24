"use client"

import { useData } from "@/components/data-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Package, CreditCard, Boxes, ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export function HomePage() {
  const { products, subscriptions, filaments } = useData()
  const router = useRouter()

  // Calculate total monthly subscription cost
  const totalMonthlySubscriptionCost = subscriptions.reduce((total, sub) => {
    return total + (sub.price_eur || 0)
  }, 0)

  // Get low stock filaments (less than their min threshold, or less than 1kg if no threshold is set)
  const lowStockFilaments = filaments.filter((f) => 
    f.min_filaments_kg !== null && f.min_filaments_kg !== undefined
      ? f.total_qty_kg < f.min_filaments_kg
      : f.total_qty_kg < 1
  )

  // Get filament stats
  const totalFilamentWeight = filaments.reduce((sum, f) => sum + f.total_qty_kg, 0)
  const uniqueMaterials = new Set(filaments.map((f) => f.material)).size
  const uniqueColors = new Set(filaments.map((f) => f.color)).size

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 sm:gap-4 mb-1 sm:mb-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Dashboard Overview</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Welcome to your 3D printing inventory management system</p>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl sm:text-3xl font-semibold">{products.length}</p>
                <p className="text-sm text-muted-foreground mt-1">Total products</p>
              </div>
              <div className="p-2 bg-muted rounded-md">
                <Package className="h-5 w-5 sm:h-6 sm:w-6 text-foreground" />
              </div>
            </div>
            <div className="mt-4">
              <Button variant="ghost" size="sm" asChild className="p-0 h-auto text-sm font-normal">
                <Link href="?tab=products" className="flex items-center gap-1">
                  View all products <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Commercial Licenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl sm:text-3xl font-semibold">{subscriptions.length}</p>
                <p className="text-sm text-muted-foreground mt-1">Active licenses</p>
              </div>
              <div className="p-2 bg-muted rounded-md">
                <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-foreground" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Monthly cost:</p>
              <p className="font-medium">€{totalMonthlySubscriptionCost.toFixed(2)}</p>
            </div>
            <div className="mt-2">
              <Button variant="ghost" size="sm" asChild className="p-0 h-auto text-sm font-normal">
                <Link href="?tab=subscriptions" className="flex items-center gap-1">
                  Manage licenses <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Filament Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl sm:text-3xl font-semibold">{totalFilamentWeight.toFixed(1)} kg</p>
                <p className="text-sm text-muted-foreground mt-1">Total filament</p>
              </div>
              <div className="p-2 bg-muted rounded-md">
                <Boxes className="h-5 w-5 sm:h-6 sm:w-6 text-foreground" />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Materials:</p>
                <p className="font-medium">{uniqueMaterials}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Colors:</p>
                <p className="font-medium">{uniqueColors}</p>
              </div>
            </div>
            <div className="mt-2">
              <Button variant="ghost" size="sm" asChild className="p-0 h-auto text-sm font-normal">
                <Link href="?tab=filaments" className="flex items-center gap-1">
                  View inventory <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alert */}
      {lowStockFilaments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600" />
              Low Stock Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm sm:text-base text-muted-foreground mb-4">
              {lowStockFilaments.length} filament{lowStockFilaments.length > 1 ? "s" : ""} running low on stock
              (below minimum threshold)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
              {lowStockFilaments.map((filament) => (
                <div key={filament.id} className="flex items-start gap-3 p-2 sm:p-3 rounded-md border bg-muted/30">
                  <div
                    className="w-4 h-4 mt-1 rounded-full border border-border flex-shrink-0"
                    style={{
                      backgroundColor: filament.color.toLowerCase(),
                      boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)",
                    }}
                  ></div>
                  <div>
                    <p className="font-medium text-sm sm:text-base">
                      {filament.color} {filament.material}
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {filament.brand} • {filament.total_qty_kg.toFixed(2)} kg remaining 
                      {filament.min_filaments_kg !== null && filament.min_filaments_kg !== undefined && 
                        ` / Min: ${filament.min_filaments_kg.toFixed(2)} kg`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Button variant="outline" asChild className="w-full sm:w-auto">
                <Link href="?tab=filaments">Manage Inventory</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity - Placeholder for future enhancement */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 sm:py-8 text-muted-foreground">
            <p>Activity tracking will be available in a future update.</p>
            <p className="text-xs sm:text-sm mt-1">
              This section will show recent purchases, product additions, and inventory changes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
