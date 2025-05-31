"use client"

import { useState } from "react"
import { useData } from "@/components/data-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "@/components/ui/use-toast"
import { Plus, Pencil, Trash2, Package2, AlertTriangle } from "lucide-react"
import type { Filament } from "@/lib/types"
import { MATERIAL_OPTIONS, getColorHex } from "@/lib/constants/filaments"

export function FilamentTypesTab() {
  const { filaments, addFilament, updateFilament, deleteFilament } = useData()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingFilament, setEditingFilament] = useState<Filament | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  
  // Form state for adding new filament type
  const [newFilament, setNewFilament] = useState({
    color: "",
    brand: "",
    material: "PLA",
    price_per_kg: ""
  })
  
  // Form state for editing
  const [editForm, setEditForm] = useState({
    color: "",
    brand: "",
    material: "",
    price_per_kg: ""
  })
  
  const handleAddFilament = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      await addFilament({
        color: newFilament.color.trim(),
        brand: newFilament.brand.trim(),
        material: newFilament.material,
        price_per_kg: parseFloat(newFilament.price_per_kg),
        total_qty_kg: 0 // Filament types start with no inventory
      })
      
      // Reset form
      setNewFilament({
        color: "",
        brand: "",
        material: "PLA",
        price_per_kg: ""
      })
      setIsAddDialogOpen(false)
      
      toast({
        title: "Success",
        description: "Filament type created successfully"
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create filament type",
        variant: "destructive"
      })
    }
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
  
  const handleDeleteFilament = async (filament: Filament) => {
    // Check if filament has inventory
    if (filament.total_qty_kg > 0) {
      toast({
        title: "Cannot Delete",
        description: "This filament type has inventory. Use up or transfer the inventory first.",
        variant: "destructive"
      })
      return
    }
    
    if (!confirm(`Are you sure you want to delete ${filament.color} ${filament.material} by ${filament.brand}?`)) {
      return
    }
    
    try {
      await deleteFilament(filament.id)
      toast({
        title: "Success",
        description: "Filament type deleted successfully"
      })
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
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Package2 className="h-6 w-6 text-primary" />
            Filament Types Configuration
          </CardTitle>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Filament Type
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Filament Type</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddFilament} className="space-y-4">
                <div>
                  <Label htmlFor="color">Color</Label>
                  <Input
                    id="color"
                    value={newFilament.color}
                    onChange={(e) => setNewFilament({...newFilament, color: e.target.value})}
                    placeholder="e.g., Black, Red, Blue"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="brand">Brand</Label>
                  <Input
                    id="brand"
                    value={newFilament.brand}
                    onChange={(e) => setNewFilament({...newFilament, brand: e.target.value})}
                    placeholder="e.g., Prusament, eSUN"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="material">Material</Label>
                  <Select
                    value={newFilament.material}
                    onValueChange={(value) => setNewFilament({...newFilament, material: value})}
                  >
                    <SelectTrigger id="material">
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
                  <Label htmlFor="price">Average Cost per kg (€)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={newFilament.price_per_kg}
                    onChange={(e) => setNewFilament({...newFilament, price_per_kg: e.target.value})}
                    placeholder="25.00"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Default price used for COGS calculations
                  </p>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Type</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        
        <CardContent>
          <div className="text-sm text-muted-foreground mb-4">
            <p>Manage filament type configurations. These define the available filament options for your inventory.</p>
            <p className="mt-1">Actual inventory quantities are tracked through purchase orders.</p>
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
                  <TableHead className="text-right">Actions</TableHead>
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
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(filament)}
                            className="h-8 w-8"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteFilament(filament)}
                            className="h-8 w-8 hover:text-red-600"
                            disabled={filament.total_qty_kg > 0}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
    </div>
  )
}

// getColorHex function imported from lib/constants/filaments.ts