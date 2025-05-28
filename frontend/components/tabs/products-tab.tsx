"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { useData } from "@/components/data-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Trash2, Plus, Info, Package, UploadCloud, ChevronDown, ChevronUp, Pencil, CreditCard, AlertTriangle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import type { FilamentRowData, ProductFormData, Product as ProductType, Printer, Filament, Subscription, FilamentUsage, PlateFormData, PlateFilamentRowData } from "@/lib/types"
import { motion } from "framer-motion"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { PlateManager } from "@/components/plate-manager"

// Define a type for the edit form, can be similar to ProductFormData or more specific
// For now, let's assume it might have slight differences or could be a partial ProductType
interface ProductEditFormData {
  name: string;
  license_id?: string | number; // Keep as string for form compatibility, convert on submit
  // Filament usages and model file will be handled separately in state for the edit modal
}

interface ProductsTabProps {
  onNavigateToTab?: (tab: string) => void
}

export function ProductsTab({ onNavigateToTab }: ProductsTabProps) {
  const { filaments, products, printers, subscriptions, addProduct, deleteProduct, updateProduct, fetchProducts, addPlate } = useData()

  const [productForm, setProductForm] = useState<ProductFormData>({
    name: "",
    license_id: undefined,
  })

  const [plateRows, setPlateRows] = useState<PlateFormData[]>([{ name: "Main", quantity: 1, print_time_hrs: "", filament_usages: [{ filament_id: "", grams_used: "" }], gcode_file: null }])
  const [selectedProduct, setSelectedProduct] = useState<ProductType | null>(null)
  
  const modelFileRef = useRef<HTMLInputElement>(null)
  const [modelFileName, setModelFileName] = useState<string>("")
  const [isDragging, setIsDragging] = useState(false)
  const [activeAccordionItem, setActiveAccordionItem] = useState<string>("")

  // File upload state for plates - G-code only
  const [plateGcodeFileNames, setPlateGcodeFileNames] = useState<{ [plateIndex: number]: string }>({})
  const [plateGcodeDragStates, setPlateGcodeDragStates] = useState<{ [plateIndex: number]: boolean }>({})

  // State for Edit Modal
  const [editingProduct, setEditingProduct] = useState<ProductType | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editForm, setEditForm] = useState<ProductEditFormData>({
    name: "",
    license_id: undefined,
  })
  const [editFilamentRows, setEditFilamentRows] = useState<FilamentRowData[]>([])
  const editModelFileRef = useRef<HTMLInputElement>(null)
  const [editModelFileName, setEditModelFileName] = useState<string | null>(null)
  const [isEditDragging, setIsEditDragging] = useState(false)

  // State for License Details Modal
  const [selectedLicenseDetails, setSelectedLicenseDetails] = useState<Subscription | null>(null)
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false)

  // Check if filaments are available for creating products
  const hasFilaments = filaments && filaments.length > 0
  const canCreateProduct = hasFilaments
  
  // Check if all plates have valid data
  const allPlatesValid = plateRows.every(plate => 
    plate.name.trim() && 
    plate.print_time_hrs && Number(plate.print_time_hrs) > 0 &&
    plate.filament_usages.length > 0 &&
    plate.filament_usages.every(usage => usage.filament_id && usage.grams_used)
  )

  useEffect(() => {
    if (editingProduct) {
      setEditForm({
        name: editingProduct.name,
        license_id: editingProduct.license_id?.toString() ?? undefined,
      });
      setEditFilamentRows(editingProduct.filament_usages.map((fu: FilamentUsage) => ({
        filament_id: fu.filament_id.toString(),
        grams_used: fu.grams_used.toString(),
      })));
      setEditModelFileName(editingProduct.model_file || null);
    }
  }, [editingProduct]);

  const handleOpenEditModal = (product: ProductType) => {
    setEditingProduct(product);
    setIsEditModalOpen(true);
  };

  const handleEditFormChange = (field: keyof ProductEditFormData, value: string | number | undefined) => {
    setEditForm((prev: ProductEditFormData) => ({ ...prev, [field]: value }));
  };

  const handleEditFilamentRowChange = (index: number, field: keyof FilamentRowData, value: string | number) => {
    const newRows = [...editFilamentRows];
    newRows[index] = { ...newRows[index], [field]: value };
    setEditFilamentRows(newRows);
  };

  const addEditFilamentRow = () => {
    setEditFilamentRows([...editFilamentRows, { filament_id: "", grams_used: "" }]);
  };

  const removeEditFilamentRow = (index: number) => {
    const newRows = [...editFilamentRows];
    newRows.splice(index, 1);
    setEditFilamentRows(newRows);
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    if (editFilamentRows.length === 0) {
      alert("Product must have at least one filament usage.");
      return;
    }

    const formData = new FormData();
    formData.append("name", editForm.name);
    
    const usages = editFilamentRows.map((row: FilamentRowData) => ({
      filament_id: Number(row.filament_id),
      grams_used: Number(row.grams_used),
    }));
    formData.append("filament_usages", JSON.stringify(usages));

    if (editForm.license_id && editForm.license_id !== "none") {
      formData.append("license_id", editForm.license_id.toString());
    } else {
      formData.append("license_id", ""); // Send empty if no license or "none" selected
    }
    
    if (editModelFileRef.current?.files?.[0]) {
      formData.append("model_file", editModelFileRef.current.files[0]);
    } else if (editModelFileName === null) { 
      // If modelFileName is explicitly set to null (e.g. by a "remove file" button, not implemented yet)
      // and backend supports removing a file by sending an empty value or specific flag.
      // For now, if no new file is selected, the old one remains unless backend logic changes it.
    }
    
    // This part depends on whether `printer_profile_id` should be included or is handled differently
    // For now, as per user request, printer_profile is ignored. If it's mandatory or part of ProductType:
    // formData.append("printer_profile_id", editingProduct.printer_profile_id.toString());


    try {
      // @ts-ignore // updateProduct may not be typed yet in useData
      await updateProduct(editingProduct.id, formData);
      setIsEditModalOpen(false);
      setEditingProduct(null);
      // Optionally, refresh products list or optimistically update UI
    } catch (error) {
      console.error("Failed to update product:", error);
      alert("Failed to update product. Check console for details.");
    }
  };

  const handleProductChange = (field: keyof ProductFormData, value: string | number | undefined) => {
    setProductForm((prev: ProductFormData) => ({ ...prev, [field]: value }))
  }

  // Plate management functions
  const addPlateRow = () => {
    setPlateRows([...plateRows, { name: "", quantity: 1, print_time_hrs: "", filament_usages: [{ filament_id: "", grams_used: "" }], gcode_file: null }])
  }

  const removePlateRow = (plateIndex: number) => {
    const newRows = [...plateRows]
    newRows.splice(plateIndex, 1)
    setPlateRows(newRows)
  }

  const handlePlateChange = (plateIndex: number, field: keyof PlateFormData, value: string | number) => {
    const newRows = [...plateRows]
    newRows[plateIndex] = { ...newRows[plateIndex], [field]: value }
    setPlateRows(newRows)
  }

  const addFilamentToPlate = (plateIndex: number) => {
    const newRows = [...plateRows]
    newRows[plateIndex].filament_usages.push({ filament_id: "", grams_used: "" })
    setPlateRows(newRows)
  }

  const removeFilamentFromPlate = (plateIndex: number, usageIndex: number) => {
    const newRows = [...plateRows]
    newRows[plateIndex].filament_usages.splice(usageIndex, 1)
    setPlateRows(newRows)
  }

  const handleFilamentUsageChange = (plateIndex: number, usageIndex: number, field: keyof PlateFilamentRowData, value: string | number) => {
    const newRows = [...plateRows]
    newRows[plateIndex].filament_usages[usageIndex] = { 
      ...newRows[plateIndex].filament_usages[usageIndex], 
      [field]: value 
    }
    setPlateRows(newRows)
  }

  // G-code file upload handlers for plates
  const handlePlateGcodeFileChange = (plateIndex: number, file: File | null) => {
    const newRows = [...plateRows]
    newRows[plateIndex].gcode_file = file
    setPlateRows(newRows)

    // Update file name for display
    setPlateGcodeFileNames(prev => ({
      ...prev,
      [plateIndex]: file?.name || ''
    }))
  }

  const setPlateGcodeDragState = useCallback((plateIndex: number, isDragging: boolean) => {
    setPlateGcodeDragStates(prev => ({
      ...prev,
      [plateIndex]: isDragging
    }))
  }, [])

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate that we have at least one plate
    if (plateRows.length === 0) {
      alert("Add at least one plate to your product")
      return
    }

    // Validate that each plate has at least one filament
    for (let i = 0; i < plateRows.length; i++) {
      const plate = plateRows[i]
      if (!plate.name.trim()) {
        alert(`Please enter a name for plate ${i + 1}`)
        return
      }
      if (!plate.print_time_hrs || Number(plate.print_time_hrs) <= 0) {
        alert(`Please enter a valid print time for plate "${plate.name}"`)
        return
      }
      if (plate.filament_usages.length === 0) {
        alert(`Plate "${plate.name}" must have at least one filament`)
        return
      }
      for (let j = 0; j < plate.filament_usages.length; j++) {
        const usage = plate.filament_usages[j]
        if (!usage.filament_id || !usage.grams_used) {
          alert(`Please complete all filament entries for plate "${plate.name}"`)
          return
        }
      }
    }

    try {
      // Create a temporary product first using the legacy API
      // We'll use the first plate's first filament as a placeholder
      const firstPlateFirstFilament = plateRows[0].filament_usages[0]
      const tempUsage = [{
        filament_id: Number(firstPlateFirstFilament.filament_id),
        grams_used: Number(firstPlateFirstFilament.grams_used)
      }]

      const formData = new FormData()
      formData.append("name", productForm.name)
      formData.append("print_time_hrs", "0")  // Temporary placeholder, will be calculated from plates
      formData.append("filament_usages", JSON.stringify(tempUsage))
      
      if (productForm.license_id) {
        formData.append("license_id", productForm.license_id.toString())
      } else {
        formData.append("license_id", "")
      }

      // Add main product file if selected (will be moved to first plate)
      if (modelFileRef.current?.files?.[0]) {
        formData.append("model_file", modelFileRef.current.files[0])
      }

      // Create the product
      const newProduct = await addProduct(formData)

      // Create plates for this product (this will replace the default plate created by migration)
      for (const plate of plateRows) {
        const plateFormData = new FormData()
        plateFormData.append("name", plate.name)
        plateFormData.append("quantity", plate.quantity.toString())
        plateFormData.append("print_time_hrs", (plate.print_time_hrs || "0").toString())
        
        const plateFilamentUsages = plate.filament_usages.map(usage => ({
          filament_id: Number(usage.filament_id),
          grams_used: Number(usage.grams_used)
        }))
        plateFormData.append("filament_usages", JSON.stringify(plateFilamentUsages))

        // Add G-code file if selected
        if (plate.gcode_file) {
          plateFormData.append("gcode_file", plate.gcode_file)
        }

        await addPlate(newProduct.id, plateFormData)
      }

      // Reset form
      setProductForm({
        name: "",
        license_id: undefined,
      })
      setPlateRows([{ name: "Main", quantity: 1, print_time_hrs: "", filament_usages: [{ filament_id: "", grams_used: "" }], gcode_file: null }])
      if (modelFileRef.current) modelFileRef.current.value = ""
      setModelFileName("")
      
      // Reset plate file state
      setPlateGcodeFileNames({})
      setPlateGcodeDragStates({})
      
      await fetchProducts() // Final refresh to show the product with all plates

    } catch (error) {
      console.error("Error creating product with plates:", error)
      alert("Failed to create product. Please try again.")
    }
  }

  const getPrinterName = (id: number) => {
    const printer = printers.find((p: Printer) => p.id === id)
    return printer ? printer.name : id.toString()
  }

  const getFilamentName = (id: number) => {
    const filament = filaments.find((f: Filament) => f.id === id)
    return filament ? `${filament.color} ${filament.material}` : id.toString()
  }
  
  const getLicenseName = (id: number | null | undefined) => {
    if (id === null || id === undefined) return "No License";
    const license = subscriptions.find((s: Subscription) => s.id === id);
    return license ? license.name : "Unknown License";
  };

  const handleOpenLicenseModal = (license: Subscription) => {
    setSelectedLicenseDetails(license);
    setIsLicenseModalOpen(true);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        {canCreateProduct ? (
          <Accordion type="single" collapsible value={activeAccordionItem} onValueChange={setActiveAccordionItem} className="w-full">
            <AccordionItem value="addProductItem" className="border-none">
              <Card className="card-hover shadow-md">
                <AccordionTrigger className="w-full p-0 hover:no-underline">
                  <CardHeader className="w-full">
                    <CardTitle className="flex items-center justify-between gap-2 text-xl w-full">
                      <div className="flex items-center gap-2">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-primary"
                        >
                          <path d="M16.5 9.4 7.55 4.24"></path>
                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                          <polyline points="3.29 7 12 12 20.71 7"></polyline>
                          <line x1="12" y1="22" x2="12" y2="12"></line>
                        </svg>
                        Add Product
                      </div>
                      {activeAccordionItem === "addProductItem" ? <ChevronUp className="h-5 w-5 text-primary" /> : <ChevronDown className="h-5 w-5 text-primary" />}
                    </CardTitle>
                  </CardHeader>
                </AccordionTrigger>
                <AccordionContent>
                <CardContent className="p-6">
                  <form onSubmit={handleAddProduct} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end p-4 bg-muted/30 rounded-lg border border-muted">
                      <div>
                        <Label htmlFor="prodName" className="text-sm font-medium">
                          Name
                        </Label>
                        <Input
                          id="prodName"
                          value={productForm.name}
                          onChange={(e) => handleProductChange("name", e.target.value)}
                          placeholder="Product Name"
                          required
                          className="bg-white dark:bg-gray-800"
                        />
                      </div>


                      <div className="lg:col-span-2">
                        <Label htmlFor="prodLicense" className="text-sm font-medium">
                          Commercial License (Optional)
                        </Label>
                        <Select
                          value={productForm.license_id ? productForm.license_id.toString() : "none"}
                          onValueChange={(value) => {
                            if (value === "none") handleProductChange("license_id", undefined)
                            else handleProductChange("license_id", value)
                          }}
                        >
                          <SelectTrigger id="prodLicense" className="bg-white dark:bg-gray-800">
                            <SelectValue placeholder="Select License" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No License</SelectItem>
                            {subscriptions.map((sub) => (
                              <SelectItem key={sub.id} value={sub.id.toString()}>
                                {sub.name} ({sub.vendor})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2 p-4 bg-muted/30 rounded-lg border border-muted">
                      <h3 className="text-md font-medium flex items-center gap-2">
                        <UploadCloud className="h-5 w-5 text-primary" /> Model File (.stl, .3mf) (Optional)
                      </h3>
                      <div 
                        className={`flex items-center justify-center w-full p-6 border-2 border-dashed rounded-lg cursor-pointer 
                                    ${isDragging ? 'border-primary bg-primary/10' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'}
                                    transition-colors duration-200 ease-in-out`}
                        onClick={() => modelFileRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                        onDrop={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setIsDragging(false)
                          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                            if (modelFileRef.current) {
                              modelFileRef.current.files = e.dataTransfer.files
                            }
                            setModelFileName(e.dataTransfer.files[0].name)
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
                          <UploadCloud className={`mx-auto h-10 w-10 mb-2 ${isDragging ? 'text-primary' : 'text-gray-400'}`} />
                          <p className={`text-sm ${isDragging ? 'text-primary' : 'text-gray-500 dark:text-gray-400'}`}>
                            <span className="font-semibold">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">STL or 3MF</p>
                          {modelFileName && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                              Selected: {modelFileName}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-muted">
                      <div className="flex items-center justify-between">
                        <h3 className="text-md font-medium flex items-center gap-2">
                          <Package className="h-5 w-5 text-primary" />
                          Product Plates
                        </h3>
                        <Button type="button" variant="outline" onClick={addPlateRow} size="sm" className="gap-1">
                          <Plus className="h-4 w-4" /> Add Plate
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Create plates for your product. Each plate can have multiple filaments and its own quantity.
                      </p>
                      <div className="space-y-4">
                        {plateRows.map((plate, plateIndex) => (
                          <div key={plateIndex} className="border rounded-lg p-4 bg-white dark:bg-gray-800">
                            <div className="flex items-center gap-4 mb-4">
                              <div className="flex-1">
                                <Label htmlFor={`plate-name-${plateIndex}`}>Plate Name</Label>
                                <Input
                                  id={`plate-name-${plateIndex}`}
                                  value={plate.name}
                                  onChange={(e) => handlePlateChange(plateIndex, 'name', e.target.value)}
                                  placeholder="e.g., Base, Top, Handle"
                                  required
                                />
                              </div>
                              <div className="w-24">
                                <Label htmlFor={`plate-quantity-${plateIndex}`}>Quantity</Label>
                                <Input
                                  id={`plate-quantity-${plateIndex}`}
                                  type="number"
                                  min="1"
                                  value={plate.quantity}
                                  onChange={(e) => handlePlateChange(plateIndex, 'quantity', Number(e.target.value))}
                                  required
                                />
                              </div>
                              <div className="w-28">
                                <Label htmlFor={`plate-print-time-${plateIndex}`}>Print Time (hrs)</Label>
                                <Input
                                  id={`plate-print-time-${plateIndex}`}
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  value={plate.print_time_hrs}
                                  onChange={(e) => handlePlateChange(plateIndex, 'print_time_hrs', e.target.value)}
                                  placeholder="e.g., 1.5"
                                  required
                                />
                              </div>
                              {plateRows.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="mt-6 text-red-600 hover:text-red-700"
                                  onClick={() => removePlateRow(plateIndex)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-sm font-medium">Filament Usage</Label>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addFilamentToPlate(plateIndex)}
                                >
                                  <Plus className="h-3 w-3 mr-1" /> Add Filament
                                </Button>
                              </div>
                              
                              <div className="overflow-x-auto rounded border">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-muted/30">
                                      <TableHead className="text-xs">Filament</TableHead>
                                      <TableHead className="text-xs">Grams</TableHead>
                                      <TableHead className="w-12"></TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {plate.filament_usages.length > 0 ? (
                                      plate.filament_usages.map((usage, usageIndex) => (
                                        <TableRow key={usageIndex}>
                                          <TableCell>
                                            <Select
                                              value={usage.filament_id?.toString() || ""}
                                              onValueChange={(value) => handleFilamentUsageChange(plateIndex, usageIndex, 'filament_id', value)}
                                              required
                                            >
                                              <SelectTrigger className="h-8 text-xs">
                                                <SelectValue placeholder="Select" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {filaments.map((filament) => (
                                                  <SelectItem key={filament.id} value={filament.id.toString()}>
                                                    <div className="flex items-center gap-2">
                                                      <div
                                                        className="w-2 h-2 rounded-full border"
                                                        style={{ backgroundColor: filament.color.toLowerCase() }}
                                                      />
                                                      {filament.color} {filament.material}
                                                    </div>
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
                                              value={usage.grams_used}
                                              onChange={(e) => handleFilamentUsageChange(plateIndex, usageIndex, 'grams_used', e.target.value)}
                                              placeholder="grams"
                                              className="h-8 text-xs"
                                              required
                                            />
                                          </TableCell>
                                          <TableCell>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              className="h-6 w-6 text-gray-500 hover:text-red-600"
                                              onClick={() => removeFilamentFromPlate(plateIndex, usageIndex)}
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </TableCell>
                                        </TableRow>
                                      ))
                                    ) : (
                                      <TableRow>
                                        <TableCell colSpan={3} className="text-center text-muted-foreground py-4 text-xs">
                                          No filaments added. Click "Add Filament" above.
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>

                            {/* G-code File Upload for Plate */}
                            <div className="mt-4">
                              <Label className="text-sm font-medium">G-code File (.gcode, .g, .gc) (Optional)</Label>
                              <div 
                                className={`flex items-center justify-center w-full p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-200 ease-in-out
                                            ${plateGcodeDragStates[plateIndex] ? 'border-primary bg-primary/10' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'}`}
                                onClick={() => {
                                  const input = document.querySelector(`#gcode-file-${plateIndex}`) as HTMLInputElement
                                  input?.click()
                                }}
                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setPlateGcodeDragState(plateIndex, true); }}
                                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setPlateGcodeDragState(plateIndex, true); }}
                                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setPlateGcodeDragState(plateIndex, false); }}
                                onDrop={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setPlateGcodeDragState(plateIndex, false)
                                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                    const file = e.dataTransfer.files[0]
                                    const ext = file.name.toLowerCase()
                                    if (ext.endsWith('.gcode') || ext.endsWith('.g') || ext.endsWith('.gc')) {
                                      const input = document.querySelector(`#gcode-file-${plateIndex}`) as HTMLInputElement
                                      if (input) {
                                        input.files = e.dataTransfer.files
                                        handlePlateGcodeFileChange(plateIndex, file)
                                      }
                                    } else {
                                      alert('Please select a valid G-code file (.gcode, .g, .gc)')
                                    }
                                  }
                                }}
                              >
                                <input 
                                  id={`gcode-file-${plateIndex}`}
                                  type="file" 
                                  accept=".gcode,.g,.gc" 
                                  className="hidden"
                                  onChange={(e) => handlePlateGcodeFileChange(plateIndex, e.target.files?.[0] || null)}
                                />
                                <div className="text-center">
                                  <svg xmlns="http://www.w3.org/2000/svg" className={`mx-auto h-8 w-8 mb-2 ${plateGcodeDragStates[plateIndex] ? 'text-primary' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  <p className={`text-xs ${plateGcodeDragStates[plateIndex] ? 'text-primary' : 'text-gray-500 dark:text-gray-400'}`}>
                                    <span className="font-semibold">Click</span> or drag G-code file
                                  </p>
                                  {plateGcodeFileNames[plateIndex] && (
                                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                      {plateGcodeFileNames[plateIndex]}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 text-right">
                      <Button
                        type="submit"
                        className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white px-6"
                      >
                        Save Product
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        </Accordion>
        ) : (
          <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                <AlertTriangle className="h-5 w-5" />
                Filaments Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-orange-600 dark:text-orange-400 mb-4">
                You need to add filaments to your inventory before you can create products. Products require at least one filament to be specified.
              </p>
              <Button 
                onClick={() => onNavigateToTab?.("filaments")}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                Add filament now
              </Button>
            </CardContent>
          </Card>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="card-hover shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-secondary"
              >
                <path d="M16.5 9.4 7.55 4.24"></path>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.29 7 12 12 20.71 7"></polyline>
                <line x1="12" y1="22" x2="12" y2="12"></line>
              </svg>
              Products List
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {products.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>SKU</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Est. COP €</TableHead>
                      <TableHead>License</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product: ProductType) => (
                      <TableRow key={product.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-medium">{product.sku}</TableCell>
                        <TableCell>{product.name}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300"
                          >
                            €{product.cop ? product.cop.toFixed(2) : 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {product.license_id ? (
                            (() => {
                              const license = subscriptions.find(sub => sub.id === product.license_id);
                              if (license) {
                                return (
                                  <Button
                                    variant="link"
                                    className="p-0 h-auto font-normal text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                                    onClick={() => handleOpenLicenseModal(license)}
                                  >
                                    {license.name}
                                  </Button>
                                );
                              }
                              return getLicenseName(product.license_id); // Fallback
                            })()
                          ) : (
                            getLicenseName(null) // "No License"
                          )}
                        </TableCell>
                        <TableCell className="space-x-1 text-right">
                          <Dialog open={selectedProduct?.id === product.id} onOpenChange={(isOpen) => !isOpen && setSelectedProduct(null)}>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-500 hover:text-primary"
                                onClick={() => setSelectedProduct(product)}
                              >
                                <Info className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-xl">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-primary"
                                  >
                                    <path d="M16.5 9.4 7.55 4.24"></path>
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                    <polyline points="3.29 7 12 12 20.71 7"></polyline>
                                    <line x1="12" y1="22" x2="12" y2="12"></line>
                                  </svg>
                                  Product Details
                                </DialogTitle>
                              </DialogHeader>
                              {selectedProduct && (
                                <div className="mt-4">
                                  <h3 className="text-lg font-semibold gradient-heading">
                                    {selectedProduct.name}{" "}
                                    <span className="text-sm text-gray-500">({selectedProduct.sku})</span>
                                  </h3>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                    <div className="bg-muted/30 p-3 rounded-lg border">
                                      <dt className="text-sm font-medium text-muted-foreground">Print time</dt>
                                      <dd className="mt-1 text-lg font-semibold">
                                        {selectedProduct.plates && selectedProduct.plates.length > 0 
                                          ? selectedProduct.plates.reduce((total, plate) => total + (plate.print_time_hrs * plate.quantity), 0).toFixed(2)
                                          : selectedProduct.print_time_hrs} h
                                      </dd>
                                    </div>
                                    <div className="bg-muted/30 p-3 rounded-lg border">
                                      <dt className="text-sm font-medium text-muted-foreground">Est. COP</dt>
                                      <dd className="mt-1">
                                        <Badge
                                          variant="secondary"
                                          className="text-lg font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                                        >
                                          €{selectedProduct.cop ? Number(selectedProduct.cop).toFixed(2) : 'N/A'}
                                        </Badge>
                                      </dd>
                                    </div>
                                    {selectedProduct.license_id && (
                                    <div className="bg-muted/30 p-3 rounded-lg border">
                                      <dt className="text-sm font-medium text-muted-foreground">License</dt>
                                      <dd className="mt-1 text-sm">{getLicenseName(selectedProduct.license_id)}</dd>
                                    </div>
                                    )}
                                    {selectedProduct.model_file && (
                                    <div className="bg-muted/30 p-3 rounded-lg border">
                                      <dt className="text-sm font-medium text-muted-foreground">Model File</dt>
                                      <dd className="mt-1 text-sm">{selectedProduct.model_file} (Download not implemented)</dd>
                                    </div>
                                    )}
                                  </div>
                                  {/* Show plates if available, otherwise show legacy filament usages */}
                                  {selectedProduct.plates && selectedProduct.plates.length > 0 ? (
                                    <>
                                      <h4 className="mt-6 text-md font-medium flex items-center gap-2">
                                        <Package className="h-4 w-4 text-primary" />
                                        Plates ({selectedProduct.plates.length})
                                      </h4>
                                      <div className="mt-2 space-y-3">
                                        {selectedProduct.plates.map((plate: any) => (
                                          <div key={plate.id} className="border rounded-lg p-3 bg-white dark:bg-gray-800">
                                            <div className="flex justify-between items-center mb-2">
                                              <h5 className="font-medium">{plate.name}</h5>
                                              <div className="flex gap-2">
                                                <Badge variant="outline">Qty: {plate.quantity}</Badge>
                                                <Badge variant="secondary">€{plate.cost.toFixed(2)}</Badge>
                                              </div>
                                            </div>
                                            <div className="space-y-1">
                                              {plate.filament_usages.map((usage: any, idx: number) => (
                                                <div key={idx} className="flex justify-between items-center text-sm text-muted-foreground">
                                                  <span>{getFilamentName(usage.filament_id)}</span>
                                                  <span>{usage.grams_used}g</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </>
                                  ) : selectedProduct.filament_usages && selectedProduct.filament_usages.length > 0 ? (
                                    <>
                                      <h4 className="mt-6 text-md font-medium flex items-center gap-2">
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          width="16"
                                          height="16"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          className="text-primary"
                                        >
                                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                          <polyline points="3.29 7 12 12 20.71 7"></polyline>
                                          <line x1="12" y1="22" x2="12" y2="12"></line>
                                        </svg>
                                        Filaments Used (Legacy)
                                      </h4>
                                      <ul className="mt-2 border rounded-lg divide-y overflow-hidden">
                                        {selectedProduct.filament_usages.map((usage: any) => (
                                          <li
                                            key={usage.filament_id}
                                            className="py-3 px-4 flex justify-between items-center text-sm bg-white dark:bg-gray-800 hover:bg-muted/30"
                                          >
                                            <span>{getFilamentName(usage.filament_id)}</span>
                                            <Badge variant="outline" className="font-medium">
                                              {usage.grams_used} g
                                            </Badge>
                                          </li>
                                        ))}
                                      </ul>
                                    </>
                                  ) : (
                                    <div className="mt-6 text-center text-muted-foreground">
                                      <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                      <p>No plates or filament usage data available</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500 hover:text-yellow-600"
                            onClick={() => handleOpenEditModal(product)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500 hover:text-red-600"
                            onClick={() => {
                              if (confirm(`Delete product #${product.id}?`)) {
                                deleteProduct(product.id)
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center text-muted-foreground py-12 bg-muted/30">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p>No products yet.</p>
                  <p className="text-sm mt-1">Add your first product using the form above.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Edit Product Modal */}
      {editingProduct && (
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Pencil className="h-5 w-5 text-primary" />
                Edit Product: {editingProduct.name}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdateProduct} className="space-y-6 py-4 max-h-[80vh] overflow-y-auto pr-2">
              {/* Basic Info Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border border-muted">
                <div>
                  <Label htmlFor="editProdName" className="text-sm font-medium">Name</Label>
                  <Input
                    id="editProdName"
                    value={editForm.name}
                    onChange={(e) => handleEditFormChange("name", e.target.value)}
                    placeholder="Product Name"
                    required
                    className="bg-white dark:bg-gray-800"
                  />
                </div>
                <div>
                  <Label htmlFor="editProdLicense" className="text-sm font-medium">Commercial License (Optional)</Label>
                  <Select
                    value={editForm.license_id ? editForm.license_id.toString() : "none"}
                    onValueChange={(value) => {
                      if (value === "none") handleEditFormChange("license_id", undefined)
                      else handleEditFormChange("license_id", value)
                    }}
                  >
                    <SelectTrigger id="editProdLicense" className="bg-white dark:bg-gray-800">
                      <SelectValue placeholder="Select License" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No License</SelectItem>
                      {subscriptions.map((sub) => (
                        <SelectItem key={sub.id} value={sub.id.toString()}>
                          {sub.name} ({sub.vendor})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Model File Section */}
              <div className="space-y-2 p-4 bg-muted/30 rounded-lg border border-muted">
                <h3 className="text-md font-medium flex items-center gap-2">
                  <UploadCloud className="h-5 w-5 text-primary" /> Model File (.stl, .3mf)
                </h3>
                <div 
                  className={`flex items-center justify-center w-full p-6 border-2 border-dashed rounded-lg cursor-pointer 
                              ${isEditDragging ? 'border-primary bg-primary/10' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'}
                              transition-colors duration-200 ease-in-out`}
                  onClick={() => editModelFileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsEditDragging(true); }}
                  onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsEditDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsEditDragging(false); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsEditDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      if (editModelFileRef.current) {
                        editModelFileRef.current.files = e.dataTransfer.files;
                      }
                      setEditModelFileName(e.dataTransfer.files[0].name);
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
                    <UploadCloud className={`mx-auto h-10 w-10 mb-2 ${isEditDragging ? 'text-primary' : 'text-gray-400'}`} />
                    <p className={`text-sm ${isEditDragging ? 'text-primary' : 'text-gray-500 dark:text-gray-400'}`}>
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">STL or 3MF</p>
                    {editModelFileName && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                        Selected: {editModelFileName}
                      </p>
                    )}
                    {!editModelFileName && editingProduct?.model_file && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Current: {editingProduct.model_file}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {editModelFileName ? "Uploading a new file will replace the current one." : (editingProduct?.model_file ? "Upload a new file to replace the current one. If no new file is chosen, the current file will be kept." : "Upload a model file.")}
                </p>
              </div>

              {/* Filaments Used Section */}
              <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-muted">
                <div className="flex items-center justify-between">
                  <h3 className="text-md font-medium flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.29 7 12 12 20.71 7"></polyline><line x1="12" y1="22" x2="12" y2="12"></line></svg>
                    Filaments Used
                  </h3>
                  <Button type="button" variant="outline" onClick={addEditFilamentRow} size="sm" className="gap-1">
                    <Plus className="h-4 w-4" /> Add Filament
                  </Button>
                </div>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Filament</TableHead>
                        <TableHead>Grams</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editFilamentRows.length > 0 ? (
                        editFilamentRows.map((row, index) => (
                          <TableRow key={index} className="hover:bg-muted/50 transition-colors">
                            <TableCell>
                              <Select
                                value={row.filament_id ? row.filament_id.toString() : undefined}
                                onValueChange={(value) => handleEditFilamentRowChange(index, "filament_id", value)}
                                required
                              >
                                <SelectTrigger className="bg-white dark:bg-gray-800">
                                  <SelectValue placeholder="Select Filament" />
                                </SelectTrigger>
                                <SelectContent>
                                  {filaments.map((filament) => (
                                    <SelectItem key={filament.id} value={filament.id.toString()}>
                                      <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full border border-gray-300" style={{ backgroundColor: filament.color.toLowerCase(), boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)" }}></div>
                                        {filament.color} {filament.material} ({filament.brand})
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number" min="0" step="0.1" value={row.grams_used}
                                onChange={(e) => handleEditFilamentRowChange(index, "grams_used", e.target.value)}
                                placeholder="grams" required className="bg-white dark:bg-gray-800"
                              />
                            </TableCell>
                            <TableCell>
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-red-600" onClick={() => removeEditFilamentRow(index)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                            <Package className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                            <p>No filaments added. Product must have at least one filament.</p>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-700 hover:to-yellow-600 text-white px-6"
                >
                  Update Product
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* License Details Modal */}
      {selectedLicenseDetails && (
        <Dialog open={isLicenseModalOpen} onOpenChange={setIsLicenseModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <CreditCard className="h-5 w-5 text-primary" />
                License: {selectedLicenseDetails.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 px-1">
              <div className="p-3 bg-muted/30 rounded-lg border">
                <Label className="text-xs font-medium text-muted-foreground">Platform</Label>
                <p className="text-sm font-semibold mt-0.5">{selectedLicenseDetails.platform}</p>
              </div>
              
              {selectedLicenseDetails.license_uri && (
                <div className="p-3 bg-muted/30 rounded-lg border">
                  <Label className="text-xs font-medium text-muted-foreground">License Link</Label>
                  <a 
                    href={selectedLicenseDetails.license_uri} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="block text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline break-all mt-0.5"
                  >
                    {selectedLicenseDetails.license_uri}
                  </a>
                </div>
              )}
              
              <div className="p-3 bg-muted/30 rounded-lg border">
                <Label className="text-xs font-medium text-muted-foreground">Price</Label>
                <p className="text-sm font-semibold mt-0.5">
                  {selectedLicenseDetails.price_eur !== null && selectedLicenseDetails.price_eur !== undefined 
                    ? `€${selectedLicenseDetails.price_eur.toFixed(2)}` 
                    : "N/A"}
                </p>
              </div>
              
              {/* Optional: Display Start and End Dates if available and needed */}
              {selectedLicenseDetails.start_date && (
                <div className="p-3 bg-muted/30 rounded-lg border">
                  <Label className="text-xs font-medium text-muted-foreground">Start Date</Label>
                  <p className="text-sm font-semibold mt-0.5">{selectedLicenseDetails.start_date}</p>
                </div>
              )}
              {selectedLicenseDetails.end_date && (
                <div className="p-3 bg-muted/30 rounded-lg border">
                  <Label className="text-xs font-medium text-muted-foreground">End Date</Label>
                  <p className="text-sm font-semibold mt-0.5">{selectedLicenseDetails.end_date}</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </motion.div>
  )
}
