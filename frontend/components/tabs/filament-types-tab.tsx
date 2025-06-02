"use client"

import { useState } from "react"
import { useData } from "@/components/data-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "@/components/ui/use-toast"
import { Plus, Pencil, Trash2, Package2, AlertTriangle, AlertCircle } from "lucide-react"
import type { Filament } from "@/lib/types"
import { MATERIAL_OPTIONS, getColorHex } from "@/lib/constants/filaments"
import { QuickFilamentForm } from "@/components/quick-filament-form"

export function FilamentTypesTab() {
  const { filaments, updateFilament, deleteFilament } = useData()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingFilament, setEditingFilament] = useState<Filament | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [filamentToDelete, setFilamentToDelete] = useState<Filament | null>(null)
  
  // Form state for editing (keeping the edit functionality as-is since it's simpler for updates)
  const [editForm, setEditForm] = useState({
    color: "",
    brand: "",
    material: "",
    price_per_kg: ""
  })
  
  const handleFilamentCreated = (filament: Filament) => {
    setIsAddDialogOpen(false)
    toast({
      title: "Success",
      description: `Successfully created ${filament.color} ${filament.material} filament type`
    })
  }
  
  const handleFilamentCreationCancelled = () => {
    setIsAddDialogOpen(false)
  }
  
  const handleEditFilament = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!editingFilament) return
    
    try {
      await updateFilament(editingFilament.id, {
        color: editForm.color.trim(),
        brand: editForm.brand.trim(),
        material: editForm.material,
        price_per_kg: parseFloat(editForm.price_per_kg)
      })
      
      setIsEditDialogOpen(false)
      setEditingFilament(null)
      
      toast({
        title: "Success",
        description: "Filament type updated successfully"
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update filament type",
        variant: "destructive"
      })
    }
  }
  
  const handleDeleteFilament = async () => {
    if (!filamentToDelete) return
    
    // Check if filament has inventory
    if (filamentToDelete.total_qty_kg > 0) {
      toast({
        title: "Cannot Delete",
        description: "This filament type has inventory. Use up or transfer the inventory first.",
        variant: "destructive"
      })
      setFilamentToDelete(null)
      return
    }
    
    try {
      await deleteFilament(filamentToDelete.id)
      toast({
        title: "Success",
        description: "Filament type deleted successfully"
      })
      setFilamentToDelete(null)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete filament type. It may be in use by products.",
        variant: "destructive"
      })
    }
  }
  
  const openEditDialog = (filament: Filament) => {
    setEditingFilament(filament)
    setEditForm({
      color: filament.color,
      brand: filament.brand,
      material: filament.material,
      price_per_kg: filament.price_per_kg.toString()
    })
    setIsEditDialogOpen(true)
  }
  
  // Sort filaments by brand, then color
  const sortedFilaments = [...filaments].sort((a, b) => {
    const brandCompare = a.brand.localeCompare(b.brand)
    if (brandCompare !== 0) return brandCompare
    return a.color.localeCompare(b.color)
  })
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Package2 className="h-5 w-5 text-primary" />
            Filament Types Configuration
          </CardTitle>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Filament Type
              </Button>
            </DialogTrigger>
            <DialogContent 
              className="max-w-2xl"
              onPointerDownOutside={(e) => e.preventDefault()}
              onInteractOutside={(e) => e.preventDefault()}
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <DialogHeader>
                <DialogTitle>Add New Filament Type</DialogTitle>
                <DialogDescription>
                  Create a new filament type for your inventory. You can optionally add it to inventory tracking with an initial purchase.
                </DialogDescription>
              </DialogHeader>
              <QuickFilamentForm
                onSuccess={handleFilamentCreated}
                onCancel={handleFilamentCreationCancelled}
                isModal={true}
                autoSelectAfterCreate={false}
              />
            </DialogContent>
          </Dialog>
        </CardHeader>
        
        <CardContent>
          <div className="text-sm text-muted-foreground mb-4">
            <p>Manage filament type configurations. These define the available filament options for your inventory.</p>
            <p className="mt-1">Create filament types with optional initial inventory tracking and automatic duplicate detection.</p>
          </div>
          
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Color</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Avg Cost/kg</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedFilaments.length > 0 ? (
                  sortedFilaments.map((filament) => (
                    <TableRow key={filament.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full border border-gray-300"
                            style={{ backgroundColor: getColorHex(filament.color) }}
                          />
                          {filament.color}
                        </div>
                      </TableCell>
                      <TableCell>{filament.brand}</TableCell>
                      <TableCell>{filament.material}</TableCell>
                      <TableCell className="text-right">€{filament.price_per_kg.toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        {filament.total_qty_kg > 0 ? (
                          <span className="text-green-600 text-sm">In Stock</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">No Inventory</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditDialog(filament)}
                                  className="h-8 w-8 text-amber-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                                  title="Edit filament type"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edit filament type</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setFilamentToDelete(filament)}
                                  className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  disabled={filament.total_qty_kg > 0}
                                  title={filament.total_qty_kg > 0 ? "Cannot delete - inventory exists" : "Delete filament type"}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{filament.total_qty_kg > 0 ? "Cannot delete - inventory exists" : "Delete filament type"}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No filament types configured. Click "Add Filament Type" to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Filament Type</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditFilament} className="space-y-4">
            <div>
              <Label htmlFor="edit-color">Color</Label>
              <Input
                id="edit-color"
                value={editForm.color}
                onChange={(e) => setEditForm({...editForm, color: e.target.value})}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="edit-brand">Brand</Label>
              <Input
                id="edit-brand"
                value={editForm.brand}
                onChange={(e) => setEditForm({...editForm, brand: e.target.value})}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="edit-material">Material</Label>
              <Select
                value={editForm.material}
                onValueChange={(value) => setEditForm({...editForm, material: value})}
              >
                <SelectTrigger id="edit-material">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MATERIAL_OPTIONS.map(material => (
                    <SelectItem key={material} value={material}>
                      {material}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="edit-price">Average Cost per kg (€)</Label>
              <Input
                id="edit-price"
                type="number"
                step="0.01"
                min="0.01"
                value={editForm.price_per_kg}
                onChange={(e) => setEditForm({...editForm, price_per_kg: e.target.value})}
                required
              />
            </div>
            
            {editingFilament?.total_qty_kg! > 0 && (
              <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  This filament type has {editingFilament.total_qty_kg} kg in inventory
                </p>
              </div>
            )}
            
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Update Type</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Filament Type Confirmation Dialog */}
      <Dialog open={!!filamentToDelete} onOpenChange={() => setFilamentToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Delete Filament Type
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              Are you sure you want to delete this filament type?
            </p>
            {filamentToDelete && (
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg space-y-1 text-sm">
                <p><strong>Type:</strong> {filamentToDelete.color} {filamentToDelete.brand} {filamentToDelete.material}</p>
                <p><strong>Average Cost:</strong> €{filamentToDelete.price_per_kg.toFixed(2)}/kg</p>
                {filamentToDelete.total_qty_kg > 0 && (
                  <p className="text-orange-600 font-medium">
                    <AlertTriangle className="h-4 w-4 inline mr-1" />
                    Cannot delete - {filamentToDelete.total_qty_kg.toFixed(2)} kg in inventory
                  </p>
                )}
              </div>
            )}
            <p className="text-sm text-red-600">
              This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFilamentToDelete(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteFilament}
              disabled={filamentToDelete?.total_qty_kg > 0}
            >
              Delete Filament Type
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// getColorHex function imported from lib/constants/filaments.ts