"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Edit, Package, Scale, AlertTriangle } from "lucide-react"
import { getColorHex } from "@/lib/constants/filaments"

interface Filament {
  id: number
  color: string
  brand: string
  material: string
  total_qty_kg: number
  price_per_kg: number
  min_filaments_kg?: number | null
}

interface EditFilamentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filament: Filament | null
  onSave: (filamentId: number, newQuantity: number) => Promise<void>
}

export function EditFilamentModal({
  open,
  onOpenChange,
  filament,
  onSave
}: EditFilamentModalProps) {
  const [quantity, setQuantity] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  // Initialize quantity when modal opens
  const handleModalOpen = () => {
    if (open && filament && !quantity) {
      setQuantity(filament.total_qty_kg.toString())
    }
  }

  // Reset state when modal closes
  const handleClose = () => {
    setQuantity("")
    setIsProcessing(false)
    onOpenChange(false)
  }

  // Handle save
  const handleSave = async () => {
    if (!filament) return
    
    const newQty = parseFloat(quantity)
    if (isNaN(newQty) || newQty < 0) {
      return
    }
    
    try {
      setIsProcessing(true)
      await onSave(filament.id, newQty)
      handleClose()
    } catch (error) {
      // Error handling is done in parent component
      setIsProcessing(false)
    }
  }

  // Call handleModalOpen when open changes
  if (open && filament && !quantity) {
    handleModalOpen()
  }

  if (!filament) return null

  const newQty = parseFloat(quantity)
  const isValidQuantity = !isNaN(newQty) && newQty >= 0
  const quantityChange = isValidQuantity ? newQty - filament.total_qty_kg : 0
  const isLowStock = filament.min_filaments_kg !== null && 
                     filament.min_filaments_kg !== undefined && 
                     isValidQuantity && 
                     newQty < filament.min_filaments_kg

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5 text-blue-600" />
            Edit Filament Quantity
          </DialogTitle>
          <DialogDescription>
            Update the current quantity for this filament in your inventory.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Filament Details */}
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
            <CardContent className="pt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-5 h-5 rounded-full border border-gray-300"
                        style={{
                          backgroundColor: getColorHex(filament.color),
                          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)",
                        }}
                      />
                      <span className="font-medium text-lg">
                        {filament.color} {filament.brand} {filament.material}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Scale className="h-3 w-3" />
                        <span>Current: {filament.total_qty_kg.toFixed(2)} kg</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        <span>€{filament.price_per_kg.toFixed(2)}/kg</span>
                      </div>
                    </div>
                  </div>
                  {filament.min_filaments_kg !== null && (
                    <Badge variant="outline" className="text-xs">
                      Min: {filament.min_filaments_kg.toFixed(2)} kg
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Quantity Input */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quantity" className="flex items-center gap-2">
                New Quantity (kg)
                <Badge variant="outline" className="text-xs">
                  Must be ≥ 0
                </Badge>
              </Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="text-lg font-mono"
                placeholder="0.00"
                autoFocus
              />
              {isValidQuantity && quantityChange !== 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Change:</span>
                  <span className={`font-medium ${
                    quantityChange > 0 
                      ? "text-green-600 dark:text-green-400" 
                      : "text-red-600 dark:text-red-400"
                  }`}>
                    {quantityChange > 0 ? "+" : ""}{quantityChange.toFixed(2)} kg
                  </span>
                </div>
              )}
            </div>

            {/* Low Stock Warning */}
            {isLowStock && (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Low Stock Warning
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      This quantity ({newQty.toFixed(2)} kg) is below your minimum threshold of {filament.min_filaments_kg?.toFixed(2)} kg.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Zero Stock Info */}
            {isValidQuantity && newQty === 0 && (
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Package className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Empty Inventory
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Setting quantity to 0 will mark this filament as out of stock. The filament type will remain available for future purchases.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isProcessing || !isValidQuantity}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Updating...
              </>
            ) : (
              <>
                <Edit className="h-4 w-4 mr-2" />
                Update Quantity
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}