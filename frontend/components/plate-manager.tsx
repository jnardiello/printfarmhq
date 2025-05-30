"use client"

import React, { useState, useRef, useEffect } from "react"
import { useData } from "@/components/data-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Trash2, Plus, UploadCloud, Pencil, Package } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/use-toast"
import type { Plate, PlateFormData, PlateFilamentRowData, Filament } from "@/lib/types"

interface PlateManagerProps {
  productId: number
  plates: Plate[]
  filaments: Filament[]
  isAddingPlate?: boolean
  setIsAddingPlate?: (value: boolean) => void
  onPlatesChange?: (updatedPlates?: Plate[]) => void
}

export function PlateManager({ productId, plates, filaments, isAddingPlate: externalIsAddingPlate, setIsAddingPlate: externalSetIsAddingPlate, onPlatesChange }: PlateManagerProps) {
  const { addPlate, updatePlate, deletePlate } = useData()
  
  
  // Clean up deleted filaments from form state
  useEffect(() => {
    const availableFilamentIds = new Set(filaments.map(f => f.id.toString()))
    
    // Clean up add plate form
    setFilamentRows(prevRows => 
      prevRows.map(row => ({
        ...row,
        filament_id: availableFilamentIds.has(row.filament_id) ? row.filament_id : ""
      }))
    )
    
    // Clean up edit plate form
    setEditFilamentRows(prevRows => 
      prevRows.map(row => ({
        ...row,
        filament_id: availableFilamentIds.has(row.filament_id) ? row.filament_id : ""
      }))
    )
  }, [filaments])
  
  // Add plate state - use external state if provided, otherwise use internal
  const [internalIsAddingPlate, setInternalIsAddingPlate] = useState(false)
  const isAddingPlate = externalIsAddingPlate !== undefined ? externalIsAddingPlate : internalIsAddingPlate
  const setIsAddingPlate = externalSetIsAddingPlate || setInternalIsAddingPlate
  const [plateForm, setPlateForm] = useState<PlateFormData>({
    name: "",
    quantity: 1,
    print_time_hrs: "",
    filament_usages: [],
    model_file: null,
    gcode_file: null
  })
  const [filamentRows, setFilamentRows] = useState<PlateFilamentRowData[]>([])
  const gcodeFileRef = useRef<HTMLInputElement>(null)
  const [gcodeFileName, setGcodeFileName] = useState<string>("")
  const [isGcodeDragging, setIsGcodeDragging] = useState(false)

  // Edit plate state
  const [editingPlate, setEditingPlate] = useState<Plate | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editForm, setEditForm] = useState<PlateFormData>({
    name: "",
    quantity: 1,
    print_time_hrs: "",
    filament_usages: [],
    model_file: null,
    gcode_file: null
  })
  const [editFilamentRows, setEditFilamentRows] = useState<PlateFilamentRowData[]>([])
  const editGcodeFileRef = useRef<HTMLInputElement>(null)
  const [editGcodeFileName, setEditGcodeFileName] = useState<string | null>(null)
  const [isEditGcodeDragging, setIsEditGcodeDragging] = useState(false)

  useEffect(() => {
    if (editingPlate) {
      setEditForm({
        name: editingPlate.name,
        quantity: editingPlate.quantity,
        print_time_hrs: editingPlate.print_time_hrs,
        filament_usages: editingPlate.filament_usages.map(fu => ({
          filament_id: fu.filament_id,
          grams_used: fu.grams_used
        })),
        model_file: null,
        gcode_file: null
      })
      setEditFilamentRows(editingPlate.filament_usages.map(fu => ({
        filament_id: fu.filament_id.toString(),
        grams_used: fu.grams_used.toString()
      })))
      setEditGcodeFileName(editingPlate.gcode_path || null)
    }
  }, [editingPlate])

  const handleAddPlate = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation() // Prevent event from bubbling up to parent form

    if (filamentRows.length === 0) {
      alert("Add at least one filament to the plate")
      return
    }

    try {
      const plateName = getNextPlateName()
      const formData = new FormData()
      formData.append("name", plateName)
      formData.append("quantity", "1") // Plates are always quantity 1
      formData.append("print_time_hrs", plateForm.print_time_hrs.toString())
      
      const usages = filamentRows.map(row => ({
        filament_id: Number(row.filament_id),
        grams_used: Number(row.grams_used),
      }))
      formData.append("filament_usages", JSON.stringify(usages))

      if (gcodeFileRef.current?.files?.[0]) {
        formData.append("gcode_file", gcodeFileRef.current.files[0])
      }

      const newPlate = await addPlate(productId, formData)
      
      // Update the plates array with the new plate immediately
      if (newPlate && onPlatesChange) {
        const updatedPlates = [...plates, newPlate]
        onPlatesChange(updatedPlates)
      }
      
      // Reset form
      setPlateForm({ name: "", quantity: 1, print_time_hrs: "", filament_usages: [], model_file: null, gcode_file: null })
      setFilamentRows([])
      if (gcodeFileRef.current) gcodeFileRef.current.value = ""
      setGcodeFileName("")
      setIsAddingPlate(false)
      
      // Show success toast
      toast({
        title: "Success",
        description: "Plate added successfully",
      })
    } catch (error) {
      // Error is already handled by addPlate function which shows a toast
      // Just log it here and keep the dialog open
      console.error("Error in handleAddPlate:", error)
      // Don't close the dialog on error
    }
  }

  const handleUpdatePlate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPlate) return

    if (editFilamentRows.length === 0) {
      alert("Plate must have at least one filament usage.")
      return
    }

    const formData = new FormData()
    formData.append("name", editingPlate.name) // Keep the original name
    formData.append("quantity", "1") // Plates are always quantity 1
    formData.append("print_time_hrs", editForm.print_time_hrs.toString())
    
    const usages = editFilamentRows.map(row => ({
      filament_id: Number(row.filament_id),
      grams_used: Number(row.grams_used),
    }))
    formData.append("filament_usages", JSON.stringify(usages))
    
    if (editGcodeFileRef.current?.files?.[0]) {
      formData.append("gcode_file", editGcodeFileRef.current.files[0])
    }

    const updatedPlate = await updatePlate(editingPlate.id, formData)
    setIsEditModalOpen(false)
    setEditingPlate(null)
    
    // Update the plates array with the updated plate
    if (updatedPlate && onPlatesChange) {
      const updatedPlates = plates.map(p => 
        p.id === updatedPlate.id ? updatedPlate : p
      )
      onPlatesChange(updatedPlates)
    }
    
    // Show success toast
    toast({
      title: "Success",
      description: "Plate updated successfully",
    })
  }

  const handleDeletePlate = async (plateId: number) => {
    if (plates.length <= 1) {
      alert("Cannot delete the last plate. Products must have at least one plate.")
      return
    }
    
    if (confirm("Delete this plate?")) {
      try {
        // First update the UI optimistically
        if (onPlatesChange) {
          const updatedPlates = plates.filter(p => p.id !== plateId)
          onPlatesChange(updatedPlates)
        }
        
        // Then delete from the database
        await deletePlate(plateId)
        
        // Show success toast
        toast({
          title: "Success",
          description: "Plate deleted successfully",
        })
      } catch (error) {
        // If deletion fails, we might want to revert the UI change
        // For now, the error toast from deletePlate will show
        console.error("Failed to delete plate:", error)
      }
    }
  }

  const addFilamentRow = () => {
    setFilamentRows([...filamentRows, { filament_id: "", grams_used: "" }])
  }

  const removeFilamentRow = (index: number) => {
    const newRows = [...filamentRows]
    newRows.splice(index, 1)
    setFilamentRows(newRows)
  }

  const handleFilamentRowChange = (index: number, field: keyof PlateFilamentRowData, value: string | number) => {
    const newRows = [...filamentRows]
    newRows[index] = { ...newRows[index], [field]: value }
    setFilamentRows(newRows)
  }

  const addEditFilamentRow = () => {
    setEditFilamentRows([...editFilamentRows, { filament_id: "", grams_used: "" }])
  }

  const removeEditFilamentRow = (index: number) => {
    const newRows = [...editFilamentRows]
    newRows.splice(index, 1)
    setEditFilamentRows(newRows)
  }

  const handleEditFilamentRowChange = (index: number, field: keyof PlateFilamentRowData, value: string | number) => {
    const newRows = [...editFilamentRows]
    newRows[index] = { ...newRows[index], [field]: value }
    setEditFilamentRows(newRows)
  }

  const getFilamentName = (id: number) => {
    const filament = filaments.find(f => f.id === id)
    return filament ? `${filament.color} ${filament.material}` : id.toString()
  }

  // Generate the next plate name based on existing plates
  const getNextPlateName = () => {
    const plateNumbers = plates
      .map(plate => {
        const match = plate.name.match(/^Plate (\d+)$/)
        return match ? parseInt(match[1]) : 0
      })
      .filter(num => num > 0)
    
    const nextNumber = plateNumbers.length > 0 ? Math.max(...plateNumbers) + 1 : 1
    return `Plate ${nextNumber}`
  }

  // Group filament usages by filament_id and sum the grams
  const groupFilamentUsages = (usages: { filament_id: number; grams_used: number }[]) => {
    const grouped = usages.reduce((acc, usage) => {
      const existing = acc.find(item => item.filament_id === usage.filament_id)
      if (existing) {
        existing.grams_used += usage.grams_used
        existing.count = (existing.count || 1) + 1
      } else {
        acc.push({ ...usage, count: 1 })
      }
      return acc
    }, [] as Array<{ filament_id: number; grams_used: number; count: number }>)
    
    return grouped
  }

  return (
    <div className="space-y-6">
      {/* Plates List */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Package className="h-5 w-5 text-primary" />
            Product Plates ({plates.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {plates.length > 0 ? (
            <div className="space-y-4">
              {plates.map((plate) => (
                <Card key={plate.id} className="border border-gray-200 dark:border-gray-700">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-semibold">
                        {plate.name}
                      </h4>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-blue-100 dark:hover:bg-blue-900"
                          onClick={() => {
                            setEditingPlate(plate)
                            setIsEditModalOpen(true)
                          }}
                          title="Edit plate"
                        >
                          <Pencil className="h-4 w-4 text-gray-600 hover:text-blue-600" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-red-100 dark:hover:bg-red-900"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeletePlate(plate.id);
                          }}
                          title="Delete plate"
                        >
                          <Trash2 className="h-4 w-4 text-gray-600 hover:text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <span className="text-sm text-gray-500">Quantity</span>
                        <p className="font-semibold">{plate.quantity}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Print Time</span>
                        <p className="font-semibold">{plate.print_time_hrs}h</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Cost</span>
                        <p className="font-semibold">€{plate.cost.toFixed(2)}</p>
                      </div>
                    </div>
                    {plate.filament_usages.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Filaments</h5>
                        <div className="space-y-1">
                          {groupFilamentUsages(plate.filament_usages).map((usage, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                              <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                              <span>
                                {getFilamentName(usage.filament_id)}: {usage.grams_used}g
                                {usage.count > 1 && (
                                  <span className="text-xs text-gray-500 ml-1">
                                    ({usage.count} entries)
                                  </span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No plates yet. Add your first plate.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Plate Dialog */}
      <Dialog 
        open={isAddingPlate} 
        onOpenChange={setIsAddingPlate}
        modal={true}
      >
        <DialogContent 
          className="max-w-2xl"
          onCloseAutoFocus={(e) => {
            // Prevent auto-focus behavior that might close parent dialog
            e.preventDefault()
          }}
          onEscapeKeyDown={(e) => {
            // Prevent escape key from closing parent dialog
            e.stopPropagation()
          }}
          onPointerDownOutside={(e) => {
            // Prevent clicking outside from closing parent dialog
            e.preventDefault()
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Add New Plate
            </DialogTitle>
          </DialogHeader>
          <form 
            onSubmit={handleAddPlate} 
            className="space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <Label htmlFor="platePrintTime">Print Time (hrs)</Label>
              <Input
                id="platePrintTime"
                type="number"
                min="0"
                step="0.1"
                value={plateForm.print_time_hrs}
                onChange={(e) => setPlateForm({...plateForm, print_time_hrs: e.target.value})}
                placeholder="e.g., 2.5"
                required
              />
            </div>

            {/* G-code File Upload */}
            <div>
              <Label>G-code File (.gcode, .g, .gc) (Optional)</Label>
              <div 
                  className={`flex items-center justify-center w-full p-4 border-2 border-dashed rounded-lg cursor-pointer 
                              ${isGcodeDragging ? 'border-primary bg-primary/10' : 'border-gray-300 hover:border-gray-400'}
                              transition-colors`}
                  onClick={() => gcodeFileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsGcodeDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsGcodeDragging(false); }}
                  onDrop={(e) => {
                    e.preventDefault()
                    setIsGcodeDragging(false)
                    if (e.dataTransfer.files?.[0]) {
                      const file = e.dataTransfer.files[0]
                      const ext = file.name.toLowerCase()
                      if (ext.endsWith('.gcode') || ext.endsWith('.g') || ext.endsWith('.gc')) {
                        if (gcodeFileRef.current) {
                          gcodeFileRef.current.files = e.dataTransfer.files
                        }
                        setGcodeFileName(file.name)
                      } else {
                        alert('Please select a valid G-code file (.gcode, .g, .gc)')
                      }
                    }
                  }}
                >
                  <input 
                    type="file" 
                    accept=".gcode,.g,.gc" 
                    ref={gcodeFileRef} 
                    className="hidden"
                    onChange={(e) => setGcodeFileName(e.target.files?.[0]?.name || "")}
                  />
                  <div className="text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-8 w-8 mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm text-gray-500">Click or drag G-code</p>
                    {gcodeFileName && (
                      <p className="text-xs text-green-600 mt-1">{gcodeFileName}</p>
                    )}
                  </div>
                </div>
              </div>

            {/* Filament Usage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Filament Usage</Label>
                <Button type="button" onClick={addFilamentRow} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" /> Add Filament
                </Button>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filament</TableHead>
                    <TableHead>Grams</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filamentRows.length > 0 ? (
                    filamentRows.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Select
                            key={`add-filament-${index}-${filaments.length}`}
                            value={filaments.find(f => f.id.toString() === row.filament_id.toString()) ? row.filament_id.toString() : ""}
                            onValueChange={(value) => handleFilamentRowChange(index, "filament_id", value)}
                            required
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select Filament" />
                            </SelectTrigger>
                            <SelectContent>
                              {filaments.map((filament) => (
                                <SelectItem key={filament.id} value={filament.id.toString()}>
                                  {filament.color} {filament.material} ({filament.brand})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            value={row.grams_used}
                            onChange={(e) => handleFilamentRowChange(index, "grams_used", e.target.value)}
                            placeholder="grams"
                            required
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFilamentRow(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                        No filaments added. Click "Add Filament" to add materials.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Show summary if there are duplicate filaments */}
              {filamentRows.length > 0 && (() => {
                const grouped = filamentRows
                  .filter(row => row.filament_id && row.grams_used)
                  .reduce((acc, row) => {
                    const existing = acc.find(item => item.filament_id === row.filament_id)
                    if (existing) {
                      existing.grams_used = (parseFloat(existing.grams_used) + parseFloat(row.grams_used)).toString()
                      existing.count++
                    } else {
                      acc.push({ ...row, count: 1 })
                    }
                    return acc
                  }, [] as Array<{ filament_id: string; grams_used: string; count: number }>)
                
                const hasDuplicates = grouped.some(item => item.count > 1)
                
                if (hasDuplicates) {
                  return (
                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">Filament Summary</h4>
                      <div className="space-y-1">
                        {grouped.filter(item => item.count > 1).map((item, idx) => (
                          <div key={idx} className="text-sm text-blue-700 dark:text-blue-300">
                            {getFilamentName(parseInt(item.filament_id))}: {item.grams_used}g total ({item.count} entries)
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                }
                return null
              })()}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsAddingPlate(false)}>
                Cancel
              </Button>
              <Button type="submit">Add Plate</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Plate Dialog */}
      {editingPlate && (
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent 
            className="max-w-2xl"
            onCloseAutoFocus={(e) => {
              // Prevent auto-focus behavior that might close parent dialog
              e.preventDefault()
            }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Edit Plate: {editingPlate.name}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdatePlate} className="space-y-4">
              <div>
                <Label htmlFor="editPlatePrintTime">Print Time (hrs)</Label>
                <Input
                  id="editPlatePrintTime"
                  type="number"
                  min="0"
                  step="0.1"
                  value={editForm.print_time_hrs}
                  onChange={(e) => setEditForm({...editForm, print_time_hrs: e.target.value})}
                  required
                />
              </div>

              {/* G-code File Upload for Edit */}
              <div>
                <Label>G-code File (.gcode, .g, .gc) (Optional)</Label>
                <div 
                    className={`flex items-center justify-center w-full p-4 border-2 border-dashed rounded-lg cursor-pointer 
                                ${isEditGcodeDragging ? 'border-primary bg-primary/10' : 'border-gray-300 hover:border-gray-400'}
                                transition-colors`}
                    onClick={() => editGcodeFileRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsEditGcodeDragging(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsEditGcodeDragging(false); }}
                    onDrop={(e) => {
                      e.preventDefault()
                      setIsEditGcodeDragging(false)
                      if (e.dataTransfer.files?.[0]) {
                        const file = e.dataTransfer.files[0]
                        const ext = file.name.toLowerCase()
                        if (ext.endsWith('.gcode') || ext.endsWith('.g') || ext.endsWith('.gc')) {
                          if (editGcodeFileRef.current) {
                            editGcodeFileRef.current.files = e.dataTransfer.files
                          }
                          setEditGcodeFileName(file.name)
                        } else {
                          alert('Please select a valid G-code file (.gcode, .g, .gc)')
                        }
                      }
                    }}
                  >
                    <input 
                      type="file" 
                      accept=".gcode,.g,.gc" 
                      ref={editGcodeFileRef} 
                      className="hidden"
                      onChange={(e) => setEditGcodeFileName(e.target.files?.[0]?.name || null)}
                    />
                    <div className="text-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-8 w-8 mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-sm text-gray-500">Click or drag G-code</p>
                      {editGcodeFileName && (
                        <p className="text-xs text-green-600 mt-1">
                          {editGcodeFileRef.current?.files?.[0] ? `New: ${editGcodeFileName}` : `Current: ${editGcodeFileName}`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

              {/* Edit Filament Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Filament Usage</Label>
                  <Button type="button" onClick={addEditFilamentRow} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" /> Add Filament
                  </Button>
                </div>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Filament</TableHead>
                      <TableHead>Grams</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editFilamentRows.length > 0 ? (
                      editFilamentRows.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Select
                              key={`edit-filament-${index}-${filaments.length}`}
                              value={filaments.find(f => f.id.toString() === row.filament_id.toString()) ? row.filament_id.toString() : ""}
                              onValueChange={(value) => handleEditFilamentRowChange(index, "filament_id", value)}
                              required
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select Filament" />
                              </SelectTrigger>
                              <SelectContent>
                                {filaments.map((filament) => (
                                  <SelectItem key={filament.id} value={filament.id.toString()}>
                                    {filament.color} {filament.material} ({filament.brand})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.1"
                              value={row.grams_used}
                              onChange={(e) => handleEditFilamentRowChange(index, "grams_used", e.target.value)}
                              required
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeEditFilamentRow(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                          No filaments. Must have at least one filament.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {/* Show summary if there are duplicate filaments */}
                {editFilamentRows.length > 0 && (() => {
                  const grouped = editFilamentRows
                    .filter(row => row.filament_id && row.grams_used)
                    .reduce((acc, row) => {
                      const existing = acc.find(item => item.filament_id === row.filament_id)
                      if (existing) {
                        existing.grams_used = (parseFloat(existing.grams_used) + parseFloat(row.grams_used)).toString()
                        existing.count++
                      } else {
                        acc.push({ ...row, count: 1 })
                      }
                      return acc
                    }, [] as Array<{ filament_id: string; grams_used: string; count: number }>)
                  
                  const hasDuplicates = grouped.some(item => item.count > 1)
                  
                  if (hasDuplicates) {
                    return (
                      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">Filament Summary</h4>
                        <div className="space-y-1">
                          {grouped.filter(item => item.count > 1).map((item, idx) => (
                            <div key={idx} className="text-sm text-blue-700 dark:text-blue-300">
                              {getFilamentName(parseInt(item.filament_id))}: {item.grams_used}g total ({item.count} entries)
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  }
                  return null
                })()}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Update Plate</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}