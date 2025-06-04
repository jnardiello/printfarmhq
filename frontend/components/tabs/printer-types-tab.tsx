"use client"

import type React from "react"
import { useState, useMemo } from "react"
import { useData } from "@/components/data-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Trash2, Plus, Printer, AlertCircle, Edit, Info } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"

export function PrinterTypesTab() {
  const { printerTypes, addPrinterType, updatePrinterType, deletePrinterType } = useData()
  const [printerTypeToDelete, setPrinterTypeToDelete] = useState<any>(null)
  const [editingPrinterType, setEditingPrinterType] = useState<any>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  const [newPrinterType, setNewPrinterType] = useState({
    brand: "",
    model: "",
    expected_life_hours: "10000",
  })

  const [editForm, setEditForm] = useState({
    brand: "",
    model: "",
    expected_life_hours: "",
  })

  // Sort printer types by brand and model
  const sortedPrinterTypes = useMemo(() => {
    if (!printerTypes || printerTypes.length === 0) return []
    return [...printerTypes].sort((a, b) => {
      const brandCompare = a.brand.localeCompare(b.brand)
      if (brandCompare !== 0) return brandCompare
      return a.model.localeCompare(b.model)
    })
  }, [printerTypes])

  const handlePrinterTypeChange = (field: string, value: string) => {
    setNewPrinterType((prev) => ({ ...prev, [field]: value }))
  }

  const handleAddPrinterType = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      await addPrinterType({
        brand: newPrinterType.brand.trim(),
        model: newPrinterType.model.trim(),
        expected_life_hours: parseFloat(newPrinterType.expected_life_hours),
      })

      // Reset form
      setNewPrinterType({
        brand: "",
        model: "",
        expected_life_hours: "10000",
      })
      setIsAddModalOpen(false)

      toast({
        title: "Success",
        description: "Printer type created successfully"
      })
    } catch (error: any) {
      console.error('Failed to create printer type:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to create printer type. Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleDeletePrinterType = async () => {
    if (printerTypeToDelete) {
      try {
        await deletePrinterType(printerTypeToDelete.id)
        setPrinterTypeToDelete(null)
        toast({
          title: "Success",
          description: "Printer type deleted successfully"
        })
      } catch (error: any) {
        console.error('Failed to delete printer type:', error)
        toast({
          title: "Error",
          description: error.message || "Failed to delete printer type. Please try again.",
          variant: "destructive"
        })
      }
    }
  }

  const handleEditPrinterType = (printerType: any) => {
    setEditingPrinterType(printerType)
    setEditForm({
      brand: printerType.brand,
      model: printerType.model,
      expected_life_hours: printerType.expected_life_hours.toString(),
    })
    setIsEditModalOpen(true)
  }

  const handleUpdatePrinterType = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPrinterType) return

    try {
      await updatePrinterType(editingPrinterType.id, {
        brand: editForm.brand.trim(),
        model: editForm.model.trim(),
        expected_life_hours: parseFloat(editForm.expected_life_hours),
      })

      setIsEditModalOpen(false)
      setEditingPrinterType(null)
      setEditForm({ brand: "", model: "", expected_life_hours: "" })
      
      toast({
        title: "Success",
        description: "Printer type updated successfully"
      })
    } catch (error: any) {
      console.error('Failed to update printer type:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to update printer type. Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleEditFormChange = (field: string, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-8">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Printer Types</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Define printer specifications for cost calculation</p>
        </div>
        
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-white shadow-md transition-all">
              <Plus className="mr-2 h-5 w-5" />
              Add Printer Type
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-2xl">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
                  <Printer className="h-6 w-6 text-white" />
                </div>
                Add Printer Type
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleAddPrinterType} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="brand" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Brand *
                </Label>
                <Input
                  id="brand"
                  value={newPrinterType.brand}
                  onChange={(e) => handlePrinterTypeChange("brand", e.target.value)}
                  placeholder="e.g., Prusa, Bambu Lab, Creality"
                  required
                  className="h-11"
                />
              </div>

              <div>
                <Label htmlFor="model" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Model *
                </Label>
                <Input
                  id="model"
                  value={newPrinterType.model}
                  onChange={(e) => handlePrinterTypeChange("model", e.target.value)}
                  placeholder="e.g., MK4, X1 Carbon, Ender 3 V3"
                  required
                  className="h-11"
                />
              </div>

              <div>
                <Label htmlFor="expected_life_hours" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Expected Life Hours *
                </Label>
                <Input
                  id="expected_life_hours"
                  type="number"
                  min="100"
                  step="100"
                  value={newPrinterType.expected_life_hours}
                  onChange={(e) => handlePrinterTypeChange("expected_life_hours", e.target.value)}
                  placeholder="10000"
                  required
                  className="h-11"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Estimated operational life before major maintenance
                </p>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button 
                  type="submit" 
                  size="lg" 
                  className="bg-primary hover:bg-primary/90 text-white shadow-md transition-all"
                >
                  <Plus className="mr-2 h-5 w-5" /> 
                  Create Printer Type
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Printer Types List */}
      <Card className="card-hover shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Printer className="h-5 w-5 text-primary" />
            Printer Types ({printerTypes.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {printerTypes.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Brand</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Expected Life (hours)</TableHead>
                    <TableHead>Printer Count</TableHead>
                    <TableHead align="center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPrinterTypes.map((printerType) => (
                    <TableRow key={printerType.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">{printerType.brand}</TableCell>
                      <TableCell>{printerType.model}</TableCell>
                      <TableCell>{printerType.expected_life_hours.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={printerType.printer_count && printerType.printer_count > 0 ? "default" : "secondary"}>
                          {printerType.printer_count || 0} printer{(printerType.printer_count || 0) !== 1 ? 's' : ''}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-amber-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                                  onClick={() => handleEditPrinterType(printerType)}
                                  title="Edit printer type"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edit printer type</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  onClick={() => setPrinterTypeToDelete(printerType)}
                                  title="Delete printer type"
                                  disabled={printerType.printer_count && printerType.printer_count > 0}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {printerType.printer_count && printerType.printer_count > 0 
                                  ? "Cannot delete - printers exist"
                                  : "Delete printer type"
                                }
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center text-muted-foreground py-12 bg-muted/30">
                <Printer className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p>No printer types defined yet.</p>
                <p className="text-sm mt-1">Click "Add Printer Type" to define your first printer type.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Printer Type Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl">
              <div className="p-2 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg">
                <Edit className="h-6 w-6 text-white" />
              </div>
              Edit Printer Type
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleUpdatePrinterType} className="space-y-4 mt-4">
            <div>
              <Label htmlFor="edit-brand" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Brand *
              </Label>
              <Input
                id="edit-brand"
                value={editForm.brand}
                onChange={(e) => handleEditFormChange("brand", e.target.value)}
                placeholder="e.g., Prusa, Bambu Lab, Creality"
                required
                className="h-11"
              />
            </div>

            <div>
              <Label htmlFor="edit-model" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Model *
              </Label>
              <Input
                id="edit-model"
                value={editForm.model}
                onChange={(e) => handleEditFormChange("model", e.target.value)}
                placeholder="e.g., MK4, X1 Carbon, Ender 3 V3"
                required
                className="h-11"
              />
            </div>

            <div>
              <Label htmlFor="edit-expected_life_hours" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Expected Life Hours *
              </Label>
              <Input
                id="edit-expected_life_hours"
                type="number"
                min="100"
                step="100"
                value={editForm.expected_life_hours}
                onChange={(e) => handleEditFormChange("expected_life_hours", e.target.value)}
                placeholder="10000"
                required
                className="h-11"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Estimated operational life before major maintenance
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                size="lg" 
                className="bg-primary hover:bg-primary/90 text-white shadow-md transition-all"
              >
                <Edit className="mr-2 h-5 w-5" /> 
                Update Printer Type
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Printer Type Confirmation Dialog */}
      <Dialog open={!!printerTypeToDelete} onOpenChange={() => setPrinterTypeToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Delete Printer Type
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              Are you sure you want to delete this printer type?
            </p>
            {printerTypeToDelete && (
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg space-y-1 text-sm">
                <p><strong>Brand:</strong> {printerTypeToDelete.brand}</p>
                <p><strong>Model:</strong> {printerTypeToDelete.model}</p>
                <p><strong>Expected Life:</strong> {printerTypeToDelete.expected_life_hours.toLocaleString()} hours</p>
              </div>
            )}
            <p className="text-sm text-red-600">
              This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrinterTypeToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeletePrinterType}>
              Delete Printer Type
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}