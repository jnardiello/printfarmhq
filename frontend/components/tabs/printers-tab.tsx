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
import { Trash2, Plus, Box, AlertCircle, Edit, Info, DollarSign, Clock, Copy, Eye, Printer } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { motion } from "framer-motion"
import { toast } from "@/components/ui/use-toast"
import { SortableTableHeader, StaticTableHeader } from "@/components/ui/sortable-table-header"
import { getSortConfig, updateSortConfig, sortByDate, SortDirection, SortConfig } from "@/lib/sorting-utils"
import { PrinterTypeSelect } from "@/components/printer-type-select"
import { Badge } from "@/components/ui/badge"

export function PrintersTab() {
  const { printers, printerTypes, addPrinter, updatePrinter, deletePrinter } = useData()
  const [printerToDelete, setPrinterToDelete] = useState<any>(null)
  const [editingPrinter, setEditingPrinter] = useState<any>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAddPrinterModalOpen, setIsAddPrinterModalOpen] = useState(false)
  const [printerToClone, setPrinterToClone] = useState<any>(null)
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false)
  const [cloneName, setCloneName] = useState("")
  const [selectedPrinter, setSelectedPrinter] = useState<any>(null)
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false)
  const [nameError, setNameError] = useState<string>("")
  const [editNameError, setEditNameError] = useState<string>("")
  const [cloneNameError, setCloneNameError] = useState<string>("")

  // Sorting state for printers table
  const [sortConfig, setSortConfig] = useState<SortConfig>(() => 
    getSortConfig('printers', 'created_at', 'desc')
  )

  const [newPrinter, setNewPrinter] = useState({
    name: "",
    printer_type_id: "",
    purchase_price_eur: "",
    purchase_date: new Date().toISOString().split('T')[0],
    working_hours: "0",
  })

  const [editForm, setEditForm] = useState({
    name: "",
    printer_type_id: "",
    purchase_price_eur: "",
    purchase_date: "",
    working_hours: "",
  })

  // Handle sort changes with persistence
  const handleSort = (field: string, direction: SortDirection) => {
    const newConfig = updateSortConfig('printers', field, sortConfig.direction)
    setSortConfig(newConfig)
  }

  // Sorted printers based on current sort configuration
  const sortedPrinters = useMemo(() => {
    if (!printers || printers.length === 0) return []
    return sortByDate(printers, sortConfig.field, sortConfig.direction)
  }, [printers, sortConfig])

  // Helper function to normalize printer names for comparison
  const normalizePrinterName = (name: string): string => {
    return name.trim().toLowerCase().replace(/\s+/g, '')
  }

  // Check if printer name already exists
  const checkDuplicatePrinterName = (name: string, excludeId?: number): boolean => {
    const normalizedName = normalizePrinterName(name)
    return printers.some(printer => 
      printer.id !== excludeId && 
      normalizePrinterName(printer.name) === normalizedName
    )
  }

  const handlePrinterChange = (field: string, value: string) => {
    setNewPrinter((prev) => ({ ...prev, [field]: value }))
    
    // Check for duplicate name
    if (field === "name" && value.trim()) {
      if (checkDuplicatePrinterName(value)) {
        setNameError(`You already have a printer named '${value}'. Please choose a different name.`)
      } else {
        setNameError("")
      }
    }
  }

  const handleAddPrinter = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newPrinter.printer_type_id) {
      toast({
        title: "Error",
        description: "Please select a printer type",
        variant: "destructive"
      })
      return
    }

    // Check for duplicate name before submitting
    if (checkDuplicatePrinterName(newPrinter.name)) {
      toast({
        title: "Error",
        description: `You already have a printer named '${newPrinter.name}'. Please choose a different name.`,
        variant: "destructive"
      })
      return
    }

    try {
      await addPrinter({
        name: newPrinter.name,
        printer_type_id: parseInt(newPrinter.printer_type_id),
        purchase_price_eur: Number.parseFloat(newPrinter.purchase_price_eur),
        purchase_date: newPrinter.purchase_date || null,
        working_hours: Number.parseFloat(newPrinter.working_hours || "0"),
      })

      // Reset form
      setNewPrinter({
        name: "",
        printer_type_id: "",
        purchase_price_eur: "",
        purchase_date: new Date().toISOString().split('T')[0],
        working_hours: "0",
      })
      setIsAddPrinterModalOpen(false)

      // Success toast is shown by data provider
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
      printer_type_id: printer.printer_type_id?.toString() || "",
      purchase_price_eur: printer.purchase_price_eur.toString(),
      purchase_date: printer.purchase_date || "",
      working_hours: printer.working_hours.toString(),
    })
    setEditNameError("")
    setIsEditModalOpen(true)
  }

  const handleUpdatePrinter = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPrinter) return

    // Check for duplicate name before submitting
    if (checkDuplicatePrinterName(editForm.name, editingPrinter.id)) {
      toast({
        title: "Error",
        description: `You already have a printer named '${editForm.name}'. Please choose a different name.`,
        variant: "destructive"
      })
      return
    }

    await updatePrinter(editingPrinter.id, {
      name: editForm.name,
      printer_type_id: parseInt(editForm.printer_type_id),
      purchase_price_eur: Number.parseFloat(editForm.purchase_price_eur),
      purchase_date: editForm.purchase_date || null,
      working_hours: Number.parseFloat(editForm.working_hours),
    })

    setIsEditModalOpen(false)
    setEditingPrinter(null)
    setEditForm({ name: "", printer_type_id: "", purchase_price_eur: "", purchase_date: "", working_hours: "" })
    setEditNameError("")
  }

  const handleEditFormChange = (field: string, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }))
    
    // Check for duplicate name when editing
    if (field === "name" && value.trim() && editingPrinter) {
      if (checkDuplicatePrinterName(value, editingPrinter.id)) {
        setEditNameError(`You already have a printer named '${value}'. Please choose a different name.`)
      } else {
        setEditNameError("")
      }
    }
  }

  const handleClonePrinter = (printer: any) => {
    setPrinterToClone(printer)
    setCloneName("")
    setCloneNameError("")
    setIsCloneModalOpen(true)
  }

  const handleConfirmClone = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!printerToClone || !cloneName.trim()) return

    // Check for duplicate name before submitting
    if (checkDuplicatePrinterName(cloneName)) {
      toast({
        title: "Error",
        description: `You already have a printer named '${cloneName}'. Please choose a different name.`,
        variant: "destructive"
      })
      return
    }

    try {
      await addPrinter({
        name: cloneName,
        printer_type_id: printerToClone.printer_type_id,
        purchase_price_eur: printerToClone.purchase_price_eur,
        purchase_date: printerToClone.purchase_date,
        working_hours: 0,
      })

      setIsCloneModalOpen(false)
      setPrinterToClone(null)
      setCloneName("")
      setCloneNameError("")

      // Success toast is shown by data provider
    } catch (error) {
      console.error('Failed to clone printer:', error)
      toast({
        title: "Error",
        description: "Failed to clone printer. Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleInfoPrinter = (printer: any) => {
    setSelectedPrinter(printer)
    setIsInfoModalOpen(true)
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-8">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Printers</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your printers for cost calculation</p>
        </div>
        
        <Dialog open={isAddPrinterModalOpen} onOpenChange={(open) => {
          setIsAddPrinterModalOpen(open)
          if (!open) setNameError("")
        }}>
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
                    <Label htmlFor="printerType" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Printer Type *
                    </Label>
                    <PrinterTypeSelect
                      value={newPrinter.printer_type_id}
                      onValueChange={(value) => handlePrinterChange("printer_type_id", value.toString())}
                      printerTypes={printerTypes}
                      required
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Select the printer model and specifications
                    </p>
                  </div>

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
                      className={`h-11 ${nameError ? 'border-red-500' : ''}`}
                    />
                    {nameError ? (
                      <p className="text-xs text-red-500 mt-1">{nameError}</p>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        A descriptive name to identify this specific printer
                      </p>
                    )}
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
                        value={newPrinter.purchase_price_eur}
                        onChange={(e) => handlePrinterChange("purchase_price_eur", e.target.value)}
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

                {/* Purchase Date */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Purchase Date</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">When you acquired this printer</p>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="purchaseDate" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Date (Optional)
                    </Label>
                    <Input
                      id="purchaseDate"
                      type="date"
                      value={newPrinter.purchase_date}
                      onChange={(e) => handlePrinterChange("purchase_date", e.target.value)}
                      className="h-11"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Leave blank if unknown
                    </p>
                  </div>
                </div>

                {/* Working Hours */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                      <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Initial Working Hours</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Already used hours (optional)</p>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="workingHours" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Working Hours
                    </Label>
                    <Input
                      id="workingHours"
                      type="number"
                      min="0"
                      step="0.1"
                      value={newPrinter.working_hours}
                      onChange={(e) => handlePrinterChange("working_hours", e.target.value)}
                      placeholder="0"
                      className="h-11"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Set this if the printer has already been used
                    </p>
                  </div>
                </div>
              </div>

              {/* Printer Type Info */}
              {newPrinter.printer_type_id && (() => {
                const selectedType = printerTypes.find(pt => pt.id.toString() === newPrinter.printer_type_id)
                return selectedType && newPrinter.purchase_price_eur ? (
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg p-6 border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                        <DollarSign className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Cost Preview</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{selectedType.brand} {selectedType.model}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Expected Life</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {selectedType.expected_life_hours.toLocaleString()} hrs
                        </p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Cost per Hour</p>
                        <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                          €{(Number.parseFloat(newPrinter.purchase_price_eur) / selectedType.expected_life_hours).toFixed(3)}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null
              })()}

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
                      <StaticTableHeader label="Name" />
                      <StaticTableHeader label="Type" />
                      <StaticTableHeader label="Life Left" />
                      <StaticTableHeader label="Cost/hr €" />
                      <SortableTableHeader
                        label="Created At"
                        sortKey="created_at"
                        currentSort={sortConfig}
                        onSort={handleSort}
                      />
                      <StaticTableHeader label="Actions" align="center" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPrinters.map((printer) => (
                      <TableRow key={printer.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-medium">{printer.name}</TableCell>
                        <TableCell>
                          {printer.printer_type ? (
                            <div>
                              <div className="font-medium">{printer.printer_type.brand} {printer.printer_type.model}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {printer.status || 'idle'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-500 italic">Unknown</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">
                              {(printer.life_left_hours || (printer.printer_type ? (printer.printer_type.expected_life_hours - (printer.working_hours || 0)) : 0)).toLocaleString()}h
                            </div>
                            <div className="h-2 w-24 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all ${
                                  (printer.life_percentage || (printer.printer_type ? ((printer.printer_type.expected_life_hours - (printer.working_hours || 0)) / printer.printer_type.expected_life_hours * 100) : 0)) > 50 
                                    ? 'bg-green-500' 
                                    : (printer.life_percentage || (printer.printer_type ? ((printer.printer_type.expected_life_hours - (printer.working_hours || 0)) / printer.printer_type.expected_life_hours * 100) : 0)) > 20 
                                    ? 'bg-yellow-500' 
                                    : 'bg-red-500'
                                }`}
                                style={{ 
                                  width: `${printer.life_percentage || (printer.printer_type ? ((printer.printer_type.expected_life_hours - (printer.working_hours || 0)) / printer.printer_type.expected_life_hours * 100) : 0)}%` 
                                }}
                              />
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {(printer.life_percentage || (printer.printer_type ? ((printer.printer_type.expected_life_hours - (printer.working_hours || 0)) / printer.printer_type.expected_life_hours * 100) : 0)).toFixed(1)}% remaining
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            €{printer.printer_type && printer.purchase_price_eur ? 
                              (printer.purchase_price_eur / printer.printer_type.expected_life_hours).toFixed(3) : 
                              '0.000'
                            }
                          </span>
                        </TableCell>
                        <TableCell>{new Date(printer.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                    onClick={() => handleInfoPrinter(printer)}
                                    title="View details"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>View details</p>
                                </TooltipContent>
                              </Tooltip>
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
      <Dialog open={isEditModalOpen} onOpenChange={(open) => {
        setIsEditModalOpen(open)
        if (!open) setEditNameError("")
      }}>
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
                  <Label htmlFor="edit-printer-type" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Printer Type *
                  </Label>
                  <PrinterTypeSelect
                    value={editForm.printer_type_id}
                    onValueChange={(value) => handleEditFormChange("printer_type_id", value.toString())}
                    printerTypes={printerTypes}
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Select the printer model and specifications
                  </p>
                </div>

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
                    className={`h-11 ${editNameError ? 'border-red-500' : ''}`}
                  />
                  {editNameError ? (
                    <p className="text-xs text-red-500 mt-1">{editNameError}</p>
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      A descriptive name to identify this specific printer
                    </p>
                  )}
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
                      value={editForm.purchase_price_eur}
                      onChange={(e) => handleEditFormChange("purchase_price_eur", e.target.value)}
                      placeholder="750.00"
                      required
                      className="h-11 pl-8"
                    />
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">€</div>
                  </div>
                </div>
              </div>

              {/* Purchase Date */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Purchase Date</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">When you acquired this printer</p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="edit-purchase-date" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Date (Optional)
                  </Label>
                  <Input
                    id="edit-purchase-date"
                    type="date"
                    value={editForm.purchase_date}
                    onChange={(e) => handleEditFormChange("purchase_date", e.target.value)}
                    className="h-11"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Leave blank if unknown
                  </p>
                </div>
              </div>

              {/* Working Hours */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                    <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Working Hours</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Track actual usage</p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="edit-working-hours" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Current Working Hours
                  </Label>
                  <Input
                    id="edit-working-hours"
                    type="number"
                    min="0"
                    step="0.1"
                    value={editForm.working_hours}
                    onChange={(e) => handleEditFormChange("working_hours", e.target.value)}
                    placeholder="0"
                    className="h-11"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Total hours this printer has been used
                  </p>
                  {editForm.working_hours && editForm.printer_type_id && (() => {
                    const selectedType = printerTypes.find(pt => pt.id.toString() === editForm.printer_type_id)
                    return selectedType ? (
                      <div className="mt-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Life remaining:</span>
                          <span className="font-medium">
                            {Math.max(0, selectedType.expected_life_hours - Number.parseFloat(editForm.working_hours)).toLocaleString()}h 
                            ({((Math.max(0, selectedType.expected_life_hours - Number.parseFloat(editForm.working_hours)) / selectedType.expected_life_hours) * 100).toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    ) : null
                  })()}
                </div>
              </div>
            </div>

            {/* Cost Preview */}
            {editForm.printer_type_id && editForm.purchase_price_eur && (() => {
              const selectedType = printerTypes.find(pt => pt.id.toString() === editForm.printer_type_id)
              return selectedType ? (
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg p-6 border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <DollarSign className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Cost Preview</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{selectedType.brand} {selectedType.model}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Expected Life</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {selectedType.expected_life_hours.toLocaleString()} hrs
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Cost per Hour</p>
                      <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                        €{(Number.parseFloat(editForm.purchase_price_eur) / selectedType.expected_life_hours).toFixed(3)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null
            })()}

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
                <p><strong>Type:</strong> {printerToDelete.printer_type ? `${printerToDelete.printer_type.brand} ${printerToDelete.printer_type.model}` : "—"}</p>
                <p><strong>Cost:</strong> €{printerToDelete.purchase_price_eur || "—"}</p>
                <p><strong>Working Hours:</strong> {printerToDelete.working_hours || 0} hours</p>
                <p><strong>Status:</strong> {printerToDelete.status || "idle"}</p>
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
          setCloneNameError("")
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
                  <p><strong>Type:</strong> {printerToClone.printer_type ? `${printerToClone.printer_type.brand} ${printerToClone.printer_type.model}` : "—"}</p>
                  <p><strong>Cost:</strong> €{printerToClone.purchase_price_eur?.toFixed(2) || "—"}</p>
                  <p><strong>Expected Life:</strong> {printerToClone.printer_type?.expected_life_hours.toLocaleString() || "—"} hours</p>
                  <p><strong>Cost per Hour:</strong> €{printerToClone.printer_type && printerToClone.purchase_price_eur ? 
                    (printerToClone.purchase_price_eur / printerToClone.printer_type.expected_life_hours).toFixed(3) : 
                    "—"
                  }</p>
                </div>
              </div>

              <div>
                <Label htmlFor="cloneName" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  New Printer Name *
                </Label>
                <Input
                  id="cloneName"
                  value={cloneName}
                  onChange={(e) => {
                    setCloneName(e.target.value)
                    if (e.target.value.trim() && checkDuplicatePrinterName(e.target.value)) {
                      setCloneNameError(`You already have a printer named '${e.target.value}'. Please choose a different name.`)
                    } else {
                      setCloneNameError("")
                    }
                  }}
                  placeholder="e.g., X1 Carbon Copy, MK4 v2"
                  required
                  autoFocus
                  className={`h-11 ${cloneNameError ? 'border-red-500' : ''}`}
                />
                {cloneNameError ? (
                  <p className="text-xs text-red-500 mt-1">{cloneNameError}</p>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Enter a unique name for the cloned printer
                  </p>
                )}
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

      {/* Printer Info Modal */}
      <Dialog open={isInfoModalOpen} onOpenChange={setIsInfoModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                <Box className="h-6 w-6 text-white" />
              </div>
              Printer Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedPrinter && (
            <div className="space-y-6 mt-6">
              {/* Basic Information */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Info className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Basic Information</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Name</p>
                    <p className="font-medium text-gray-900 dark:text-white">{selectedPrinter.name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Type</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedPrinter.printer_type ? 
                        `${selectedPrinter.printer_type.brand} ${selectedPrinter.printer_type.model}` : 
                        "—"
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Status</p>
                    <p className="font-medium text-gray-900 dark:text-white">{selectedPrinter.status || "idle"}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Purchase Date</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedPrinter.purchase_date ? 
                        new Date(selectedPrinter.purchase_date).toLocaleDateString() : 
                        "—"
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Financial Details */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Financial Details</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Purchase Cost</p>
                    <p className="font-medium text-gray-900 dark:text-white">€{selectedPrinter.purchase_price_eur?.toFixed(2) || "—"}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Cost per Hour</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      €{selectedPrinter.printer_type && selectedPrinter.purchase_price_eur ? 
                        (selectedPrinter.purchase_price_eur / selectedPrinter.printer_type.expected_life_hours).toFixed(3) : 
                        "—"
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Usage & Lifetime */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                    <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Usage & Lifetime</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Expected Lifetime</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {selectedPrinter.printer_type?.expected_life_hours.toLocaleString() || "—"} hours
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Working Hours</p>
                      <p className="font-medium text-gray-900 dark:text-white">{(selectedPrinter.working_hours || 0).toLocaleString()} hours</p>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-gray-500 dark:text-gray-400 text-sm">Life Remaining</p>
                      <p className="font-medium text-sm">
                        {(selectedPrinter.life_left_hours || (selectedPrinter.printer_type ? (selectedPrinter.printer_type.expected_life_hours - (selectedPrinter.working_hours || 0)) : 0)).toLocaleString()} hours
                      </p>
                    </div>
                    <Progress 
                      value={selectedPrinter.life_percentage || (selectedPrinter.printer_type ? ((selectedPrinter.printer_type.expected_life_hours - (selectedPrinter.working_hours || 0)) / selectedPrinter.printer_type.expected_life_hours * 100) : 0)} 
                      className="h-3"
                    />
                    <p className="text-center mt-2 text-sm font-medium">
                      {(selectedPrinter.life_percentage || (selectedPrinter.printer_type ? ((selectedPrinter.printer_type.expected_life_hours - (selectedPrinter.working_hours || 0)) / selectedPrinter.printer_type.expected_life_hours * 100) : 0)).toFixed(1)}% remaining
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInfoModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
