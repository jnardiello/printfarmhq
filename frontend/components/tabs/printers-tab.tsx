"use client"

import type React from "react"

import { useState } from "react"
import { useData } from "@/components/data-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Trash2, Plus, Box, AlertCircle, Edit, Info, DollarSign, Clock, Copy } from "lucide-react"
import { motion } from "framer-motion"
import { toast } from "@/components/ui/use-toast"

export function PrintersTab() {
  const { printers, addPrinter, updatePrinter, deletePrinter } = useData()
  const [printerToDelete, setPrinterToDelete] = useState<any>(null)
  const [editingPrinter, setEditingPrinter] = useState<any>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAddPrinterModalOpen, setIsAddPrinterModalOpen] = useState(false)
  const [printerToClone, setPrinterToClone] = useState<any>(null)
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false)
  const [cloneName, setCloneName] = useState("")

  const [newPrinter, setNewPrinter] = useState({
    name: "",
    manufacturer: "",
    model: "",
    price_eur: "",
    expected_life_hours: "",
  })

  const [editForm, setEditForm] = useState({
    name: "",
    manufacturer: "",
    model: "",
    price_eur: "",
    expected_life_hours: "",
  })

  const handlePrinterChange = (field: string, value: string) => {
    setNewPrinter((prev) => ({ ...prev, [field]: value }))
  }

  const handleAddPrinter = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      await addPrinter({
        name: newPrinter.name,
        manufacturer: newPrinter.manufacturer || null,
        model: newPrinter.model || null,
        price_eur: Number.parseFloat(newPrinter.price_eur),
        expected_life_hours: Number.parseInt(newPrinter.expected_life_hours),
      })

      // Reset form
      setNewPrinter({
        name: "",
        manufacturer: "",
        model: "",
        price_eur: "",
        expected_life_hours: "",
      })
      setIsAddPrinterModalOpen(false)

      toast({
        title: "Success",
        description: "Printer created successfully"
      })
    } catch (error) {
      console.error('Failed to create printer:', error)
      toast({
        title: "Error",
        description: "Failed to create printer. Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleDeletePrinter = async () => {
    if (printerToDelete) {
      await deletePrinter(printerToDelete.id)
      setPrinterToDelete(null)
    }
  }

  const handleEditPrinter = (printer: any) => {
    setEditingPrinter(printer)
    setEditForm({
      name: printer.name,
      manufacturer: printer.manufacturer || "",
      model: printer.model || "",
      price_eur: printer.price_eur.toString(),
      expected_life_hours: printer.expected_life_hours.toString(),
    })
    setIsEditModalOpen(true)
  }

  const handleUpdatePrinter = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPrinter) return

    await updatePrinter(editingPrinter.id, {
      name: editForm.name,
      manufacturer: editForm.manufacturer || null,
      model: editForm.model || null,
      price_eur: Number.parseFloat(editForm.price_eur),
      expected_life_hours: Number.parseInt(editForm.expected_life_hours),
    })

    setIsEditModalOpen(false)
    setEditingPrinter(null)
    setEditForm({ name: "", manufacturer: "", model: "", price_eur: "", expected_life_hours: "" })
  }

  const handleEditFormChange = (field: string, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleClonePrinter = (printer: any) => {
    setPrinterToClone(printer)
    setCloneName("")
    setIsCloneModalOpen(true)
  }

  const handleConfirmClone = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!printerToClone || !cloneName.trim()) return

    try {
      await addPrinter({
        name: cloneName,
        manufacturer: printerToClone.manufacturer,
        model: printerToClone.model,
        price_eur: printerToClone.price_eur,
        expected_life_hours: printerToClone.expected_life_hours,
      })

      setIsCloneModalOpen(false)
      setPrinterToClone(null)
      setCloneName("")

      toast({
        title: "Success",
        description: "Printer cloned successfully"
      })
    } catch (error) {
      console.error('Failed to clone printer:', error)
      toast({
        title: "Error",
        description: "Failed to clone printer. Please try again.",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-8">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Printers</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your printers for cost calculation</p>
        </div>
        
        <Dialog open={isAddPrinterModalOpen} onOpenChange={setIsAddPrinterModalOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-white shadow-md transition-all">
              <Plus className="mr-2 h-5 w-5" />
              Add Printer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-2xl">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
                  <Box className="h-6 w-6 text-white" />
                </div>
                Add Printer
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleAddPrinter} className="space-y-6 mt-6">
              {/* Basic Information Section */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Info className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Printer Information</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Basic printer profile details</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="printerName" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Printer Name *
                    </Label>
                    <Input
                      id="printerName"
                      value={newPrinter.name}
                      onChange={(e) => handlePrinterChange("name", e.target.value)}
                      placeholder="e.g., Office Printer 1, Bedroom Printer"
                      required
                      className="h-11"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      A descriptive name to identify this printer
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="manufacturer" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Manufacturer
                    </Label>
                    <Input
                      id="manufacturer"
                      value={newPrinter.manufacturer}
                      onChange={(e) => handlePrinterChange("manufacturer", e.target.value)}
                      placeholder="e.g., Bambu Lab, Prusa, Creality"
                      className="h-11"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Brand or company that makes this printer
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="model" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Model
                    </Label>
                    <Input
                      id="model"
                      value={newPrinter.model}
                      onChange={(e) => handlePrinterChange("model", e.target.value)}
                      placeholder="e.g., X1 Carbon, MK4, Ender 3 V2"
                      className="h-11"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Specific model name or number
                    </p>
                  </div>
                </div>
              </div>

              {/* Financial Details Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Purchase Cost */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Purchase Cost</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Initial investment</p>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="printerCost" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Cost (€) *
                    </Label>
                    <div className="relative">
                      <Input
                        id="printerCost"
                        type="number"
                        min="0"
                        step="0.01"
                        value={newPrinter.price_eur}
                        onChange={(e) => handlePrinterChange("price_eur", e.target.value)}
                        placeholder="299.90"
                        required
                        className="h-11 pl-8"
                      />
                      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">€</div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Total purchase price including accessories
                    </p>
                  </div>
                </div>

                {/* Expected Lifetime */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Expected Lifetime</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Depreciation period</p>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="printerLifeHours" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Life Hours *
                    </Label>
                    <Input
                      id="printerLifeHours"
                      type="number"
                      min="1"
                      step="1"
                      value={newPrinter.expected_life_hours}
                      onChange={(e) => handlePrinterChange("expected_life_hours", e.target.value)}
                      placeholder="26280"
                      required
                      className="h-11"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      3 years = 26,280 hours (3 × 365 × 24)
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      5 years = 43,800 hours (5 × 365 × 24)
                    </p>
                  </div>
                </div>
              </div>

              {/* Cost Preview */}
              {newPrinter.price_eur && newPrinter.expected_life_hours && (
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg p-6 border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <DollarSign className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Cost Preview</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Hourly depreciation rate</p>
                    </div>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-medium text-gray-700 dark:text-gray-300">Cost per Hour</span>
                      <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        €{(Number.parseFloat(newPrinter.price_eur) / Number.parseInt(newPrinter.expected_life_hours)).toFixed(3)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button 
                  type="submit" 
                  size="lg" 
                  className="bg-primary hover:bg-primary/90 text-white shadow-md transition-all"
                >
                  <Plus className="mr-2 h-5 w-5" /> 
                  Create Printer
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Printers List */}
      <Card className="card-hover shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Box className="h-5 w-5 text-primary" />
            Your Printers ({printers.length})
          </CardTitle>
        </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {printers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Name</TableHead>
                      <TableHead>Manufacturer</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Cost €</TableHead>
                      <TableHead>Life hrs</TableHead>
                      <TableHead>Cost/hr €</TableHead>
                      <TableHead className="text-center w-[150px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {printers.map((printer) => (
                      <TableRow key={printer.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-medium">{printer.name}</TableCell>
                        <TableCell className="text-gray-600 dark:text-gray-400">{printer.manufacturer || "—"}</TableCell>
                        <TableCell className="text-gray-600 dark:text-gray-400">{printer.model || "—"}</TableCell>
                        <TableCell>€{printer.price_eur.toFixed(2)}</TableCell>
                        <TableCell>{printer.expected_life_hours}</TableCell>
                        <TableCell>
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            €{(printer.price_eur / printer.expected_life_hours).toFixed(3)}
                          </span>
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
                                    onClick={() => handleEditPrinter(printer)}
                                    title="Edit printer"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Edit printer</p>
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                    onClick={() => handleClonePrinter(printer)}
                                    title="Clone printer"
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Clone printer</p>
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    onClick={() => setPrinterToDelete(printer)}
                                    title="Delete printer"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Delete printer</p>
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
                  <Box className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p>No printers added yet.</p>
                  <p className="text-sm mt-1">Click "Add Printer" to create your first printer.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      {/* Edit Printer Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl">
              <div className="p-2 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg">
                <Edit className="h-6 w-6 text-white" />
              </div>
              Edit Printer
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleUpdatePrinter} className="space-y-6 mt-6">
            {/* Basic Information Section */}
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Info className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Printer Information</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Update printer details</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-printer-name" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Printer Name *
                  </Label>
                  <Input
                    id="edit-printer-name"
                    value={editForm.name}
                    onChange={(e) => handleEditFormChange("name", e.target.value)}
                    placeholder="e.g., Office Printer 1, Bedroom Printer"
                    required
                    className="h-11"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    A descriptive name to identify this printer
                  </p>
                </div>

                <div>
                  <Label htmlFor="edit-manufacturer" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Manufacturer
                  </Label>
                  <Input
                    id="edit-manufacturer"
                    value={editForm.manufacturer}
                    onChange={(e) => handleEditFormChange("manufacturer", e.target.value)}
                    placeholder="e.g., Bambu Lab, Prusa, Creality"
                    className="h-11"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Brand or company that makes this printer
                  </p>
                </div>

                <div>
                  <Label htmlFor="edit-model" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Model
                  </Label>
                  <Input
                    id="edit-model"
                    value={editForm.model}
                    onChange={(e) => handleEditFormChange("model", e.target.value)}
                    placeholder="e.g., X1 Carbon, MK4, Ender 3 V2"
                    className="h-11"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Specific model name or number
                  </p>
                </div>
              </div>
            </div>

            {/* Financial Details Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Purchase Cost */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Purchase Cost</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Initial investment</p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="edit-printer-price" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Cost (€) *
                  </Label>
                  <div className="relative">
                    <Input
                      id="edit-printer-price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm.price_eur}
                      onChange={(e) => handleEditFormChange("price_eur", e.target.value)}
                      placeholder="750.00"
                      required
                      className="h-11 pl-8"
                    />
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">€</div>
                  </div>
                </div>
              </div>

              {/* Expected Lifetime */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Expected Lifetime</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Depreciation period</p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="edit-printer-life" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Life Hours *
                  </Label>
                  <Input
                    id="edit-printer-life"
                    type="number"
                    min="1"
                    value={editForm.expected_life_hours}
                    onChange={(e) => handleEditFormChange("expected_life_hours", e.target.value)}
                    placeholder="26280"
                    required
                    className="h-11"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    3 years = 26,280 hours (3 × 365 × 24)
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    5 years = 43,800 hours (5 × 365 × 24)
                  </p>
                </div>
              </div>
            </div>

            {/* Cost Preview */}
            {editForm.price_eur && editForm.expected_life_hours && (
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg p-6 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <DollarSign className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Cost Preview</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Hourly depreciation rate</p>
                  </div>
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-medium text-gray-700 dark:text-gray-300">Cost per Hour</span>
                    <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      €{(Number.parseFloat(editForm.price_eur) / Number.parseInt(editForm.expected_life_hours)).toFixed(3)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Buttons */}
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
                Update Printer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Printer Confirmation Dialog */}
      <Dialog open={!!printerToDelete} onOpenChange={() => setPrinterToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Delete Printer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              Are you sure you want to delete this printer?
            </p>
            {printerToDelete && (
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg space-y-1 text-sm">
                <p><strong>Name:</strong> {printerToDelete.name}</p>
                <p><strong>Manufacturer:</strong> {printerToDelete.manufacturer || "—"}</p>
                <p><strong>Model:</strong> {printerToDelete.model || "—"}</p>
                <p><strong>Cost:</strong> €{printerToDelete.price_eur}</p>
                <p><strong>Expected Life:</strong> {printerToDelete.expected_life_hours} hours</p>
              </div>
            )}
            <p className="text-sm text-red-600">
              This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrinterToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeletePrinter}>
              Delete Printer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clone Printer Dialog */}
      <Dialog open={isCloneModalOpen} onOpenChange={(open) => {
        setIsCloneModalOpen(open)
        if (!open) {
          setPrinterToClone(null)
          setCloneName("")
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                <Copy className="h-6 w-6 text-white" />
              </div>
              Clone Printer
            </DialogTitle>
          </DialogHeader>
          
          {printerToClone && (
            <form onSubmit={handleConfirmClone} className="space-y-4 mt-4">
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Creating a copy of <strong>{printerToClone.name}</strong>
                </p>
                <div className="space-y-2 text-sm">
                  <p><strong>Manufacturer:</strong> {printerToClone.manufacturer || "—"}</p>
                  <p><strong>Model:</strong> {printerToClone.model || "—"}</p>
                  <p><strong>Cost:</strong> €{printerToClone.price_eur.toFixed(2)}</p>
                  <p><strong>Expected Life:</strong> {printerToClone.expected_life_hours} hours</p>
                  <p><strong>Cost per Hour:</strong> €{(printerToClone.price_eur / printerToClone.expected_life_hours).toFixed(3)}</p>
                </div>
              </div>

              <div>
                <Label htmlFor="cloneName" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  New Printer Name *
                </Label>
                <Input
                  id="cloneName"
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  placeholder="e.g., X1 Carbon Copy, MK4 v2"
                  required
                  autoFocus
                  className="h-11"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Enter a unique name for the cloned printer
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button type="button" variant="outline" onClick={() => setIsCloneModalOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-primary hover:bg-primary/90 text-white"
                >
                  <Copy className="mr-2 h-4 w-4" /> 
                  Clone Printer
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
