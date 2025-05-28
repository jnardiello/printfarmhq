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
import type { Plate, PlateFormData, PlateFilamentRowData, Filament } from "@/lib/types"

interface PlateManagerProps {
  productId: number
  plates: Plate[]
  filaments: Filament[]
  onPlatesChange?: () => void
}

export function PlateManager({ productId, plates, filaments, onPlatesChange }: PlateManagerProps) {
  const { addPlate, updatePlate, deletePlate } = useData()
  
  // Add plate state
  const [isAddingPlate, setIsAddingPlate] = useState(false)
  const [plateForm, setPlateForm] = useState<PlateFormData>({
    name: "",
    quantity: 1,
    print_time_hrs: "",
    filament_usages: [],
    model_file: null,
    gcode_file: null
  })
  const [filamentRows, setFilamentRows] = useState<PlateFilamentRowData[]>([])
  const modelFileRef = useRef<HTMLInputElement>(null)
  const gcodeFileRef = useRef<HTMLInputElement>(null)
  const [modelFileName, setModelFileName] = useState<string>("")
  const [gcodeFileName, setGcodeFileName] = useState<string>("")
  const [isDragging, setIsDragging] = useState(false)
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
  const editModelFileRef = useRef<HTMLInputElement>(null)
  const editGcodeFileRef = useRef<HTMLInputElement>(null)
  const [editModelFileName, setEditModelFileName] = useState<string | null>(null)
  const [editGcodeFileName, setEditGcodeFileName] = useState<string | null>(null)
  const [isEditDragging, setIsEditDragging] = useState(false)
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
      setEditModelFileName(editingPlate.file_path || null)
      setEditGcodeFileName(editingPlate.gcode_path || null)
    }
  }, [editingPlate])

  const handleAddPlate = async (e: React.FormEvent) => {
    e.preventDefault()

    if (filamentRows.length === 0) {
      alert("Add at least one filament to the plate")
      return
    }

    const formData = new FormData()
    formData.append("name", plateForm.name)
    formData.append("quantity", plateForm.quantity.toString())
    formData.append("print_time_hrs", plateForm.print_time_hrs.toString())
    
    const usages = filamentRows.map(row => ({
      filament_id: Number(row.filament_id),
      grams_used: Number(row.grams_used),
    }))
    formData.append("filament_usages", JSON.stringify(usages))

    if (modelFileRef.current?.files?.[0]) {
      formData.append("file", modelFileRef.current.files[0])
    }
    
    if (gcodeFileRef.current?.files?.[0]) {
      formData.append("gcode_file", gcodeFileRef.current.files[0])
    }

    await addPlate(productId, formData)
    
    // Reset form
    setPlateForm({ name: "", quantity: 1, print_time_hrs: "", filament_usages: [], model_file: null, gcode_file: null })
    setFilamentRows([])
    if (modelFileRef.current) modelFileRef.current.value = ""
    if (gcodeFileRef.current) gcodeFileRef.current.value = ""
    setModelFileName("")
    setGcodeFileName("")
    setIsAddingPlate(false)
    onPlatesChange?.()
  }

  const handleUpdatePlate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPlate) return

    if (editFilamentRows.length === 0) {
      alert("Plate must have at least one filament usage.")
      return
    }

    const formData = new FormData()
    formData.append("name", editForm.name)
    formData.append("quantity", editForm.quantity.toString())
    formData.append("print_time_hrs", editForm.print_time_hrs.toString())
    
    const usages = editFilamentRows.map(row => ({
      filament_id: Number(row.filament_id),
      grams_used: Number(row.grams_used),
    }))
    formData.append("filament_usages", JSON.stringify(usages))
    
    if (editModelFileRef.current?.files?.[0]) {
      formData.append("file", editModelFileRef.current.files[0])
    }
    
    if (editGcodeFileRef.current?.files?.[0]) {
      formData.append("gcode_file", editGcodeFileRef.current.files[0])
    }

    await updatePlate(editingPlate.id, formData)
    setIsEditModalOpen(false)
    setEditingPlate(null)
    onPlatesChange?.()
  }

  const handleDeletePlate = async (plateId: number) => {
    if (plates.length <= 1) {
      alert("Cannot delete the last plate. Products must have at least one plate.")
      return
    }
    
    if (confirm("Delete this plate?")) {
      await deletePlate(plateId)
      onPlatesChange?.()
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

  return (
    <div className="space-y-6">
      {/* Plates List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Plates ({plates.length})
            </span>
            <Button onClick={() => setIsAddingPlate(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Add Plate
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {plates.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Print Time</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Filaments</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plates.map((plate) => (
                  <TableRow key={plate.id}>
                    <TableCell className="font-medium">{plate.name}</TableCell>
                    <TableCell>{plate.quantity}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{plate.print_time_hrs}h</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">€{plate.cost.toFixed(2)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {plate.filament_usages.map((usage, idx) => (
                          <div key={idx} className="text-sm">
                            {getFilamentName(usage.filament_id)}: {usage.grams_used}g
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingPlate(plate)
                            setIsEditModalOpen(true)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600"
                          onClick={() => handleDeletePlate(plate.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No plates yet. Add your first plate above.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Plate Dialog */}
      <Dialog open={isAddingPlate} onOpenChange={setIsAddingPlate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Plate</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddPlate} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="plateName">Plate Name</Label>
                <Input
                  id="plateName"
                  value={plateForm.name}
                  onChange={(e) => setPlateForm({...plateForm, name: e.target.value})}
                  placeholder="e.g., Base, Top, Handle"
                  required
                />
              </div>
              <div>
                <Label htmlFor="plateQuantity">Quantity</Label>
                <Input
                  id="plateQuantity"
                  type="number"
                  min="1"
                  value={plateForm.quantity}
                  onChange={(e) => setPlateForm({...plateForm, quantity: Number(e.target.value)})}
                  required
                />
              </div>
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
            </div>

            {/* File Upload Areas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Model File Upload */}
              <div>
                <Label>3D Model File (.stl, .3mf)</Label>
                <div 
                  className={`flex items-center justify-center w-full p-4 border-2 border-dashed rounded-lg cursor-pointer 
                              ${isDragging ? 'border-primary bg-primary/10' : 'border-gray-300 hover:border-gray-400'}
                              transition-colors`}
                  onClick={() => modelFileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                  onDrop={(e) => {
                    e.preventDefault()
                    setIsDragging(false)
                    if (e.dataTransfer.files?.[0]) {
                      const file = e.dataTransfer.files[0]
                      if (file.name.toLowerCase().endsWith('.stl') || file.name.toLowerCase().endsWith('.3mf')) {
                        if (modelFileRef.current) {
                          modelFileRef.current.files = e.dataTransfer.files
                        }
                        setModelFileName(file.name)
                      } else {
                        alert('Please select a valid STL or 3MF file')
                      }
                    }
                  }}
                >
                  <input 
                    type="file" 
                    accept=".stl,.3mf" 
                    ref={modelFileRef} 
                    className="hidden"
                    onChange={(e) => setModelFileName(e.target.files?.[0]?.name || "")}
                  />
                  <div className="text-center">
                    <UploadCloud className="mx-auto h-8 w-8 mb-2 text-gray-400" />
                    <p className="text-sm text-gray-500">Click or drag STL/3MF</p>
                    {modelFileName && (
                      <p className="text-xs text-green-600 mt-1">{modelFileName}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* G-code File Upload */}
              <div>
                <Label>G-code File (.gcode, .g, .gc)</Label>
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
                            value={row.filament_id.toString()}
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Plate: {editingPlate.name}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdatePlate} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="editPlateName">Plate Name</Label>
                  <Input
                    id="editPlateName"
                    value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="editPlateQuantity">Quantity</Label>
                  <Input
                    id="editPlateQuantity"
                    type="number"
                    min="1"
                    value={editForm.quantity}
                    onChange={(e) => setEditForm({...editForm, quantity: Number(e.target.value)})}
                    required
                  />
                </div>
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
              </div>

              {/* File Upload Areas for Edit */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Model File Upload */}
                <div>
                  <Label>3D Model File (.stl, .3mf)</Label>
                  <div 
                    className={`flex items-center justify-center w-full p-4 border-2 border-dashed rounded-lg cursor-pointer 
                                ${isEditDragging ? 'border-primary bg-primary/10' : 'border-gray-300 hover:border-gray-400'}
                                transition-colors`}
                    onClick={() => editModelFileRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsEditDragging(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsEditDragging(false); }}
                    onDrop={(e) => {
                      e.preventDefault()
                      setIsEditDragging(false)
                      if (e.dataTransfer.files?.[0]) {
                        const file = e.dataTransfer.files[0]
                        if (file.name.toLowerCase().endsWith('.stl') || file.name.toLowerCase().endsWith('.3mf')) {
                          if (editModelFileRef.current) {
                            editModelFileRef.current.files = e.dataTransfer.files
                          }
                          setEditModelFileName(file.name)
                        } else {
                          alert('Please select a valid STL or 3MF file')
                        }
                      }
                    }}
                  >
                    <input 
                      type="file" 
                      accept=".stl,.3mf" 
                      ref={editModelFileRef} 
                      className="hidden"
                      onChange={(e) => setEditModelFileName(e.target.files?.[0]?.name || null)}
                    />
                    <div className="text-center">
                      <UploadCloud className="mx-auto h-8 w-8 mb-2 text-gray-400" />
                      <p className="text-sm text-gray-500">Click or drag STL/3MF</p>
                      {editModelFileName && (
                        <p className="text-xs text-green-600 mt-1">
                          {editModelFileRef.current?.files?.[0] ? `New: ${editModelFileName}` : `Current: ${editModelFileName}`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* G-code File Upload */}
                <div>
                  <Label>G-code File (.gcode, .g, .gc)</Label>
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
                              value={row.filament_id.toString()}
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