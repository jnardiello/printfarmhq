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
import { Trash2, Plus, Info, Package, UploadCloud, ChevronDown, ChevronUp, Pencil, CreditCard, AlertTriangle, DollarSign } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { ProductFormData, Product as ProductType, Printer, Filament, Subscription, FilamentUsage } from "@/lib/types"
import { motion } from "framer-motion"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { FilamentSelect } from "@/components/filament-select"
import { TIME_FORMAT_PLACEHOLDER, isValidTimeFormat, formatHoursDisplay, parseTimeToHours } from "@/lib/time-format"

// Edit form data for product-level fields only
interface ProductEditFormData {
  name: string;
  print_time_hrs: string;
  license_id?: string | number;
}

interface FilamentUsageRowData {
  filament_id: string;
  grams_used: string;
}

interface ProductsTabProps {
  onNavigateToTab?: (tab: string) => void
}

export function ProductsTab({ onNavigateToTab }: ProductsTabProps) {
  const { filaments, products, printers, subscriptions, addProduct, deleteProduct, updateProduct, fetchProducts } = useData()
  
  // Clean up deleted filaments from form state
  useEffect(() => {
    const availableFilamentIds = new Set(filaments.map(f => f.id.toString()))
    
    setFilamentUsageRows(prevRows => 
      prevRows.map(usage => ({
        ...usage,
        filament_id: availableFilamentIds.has(usage.filament_id) ? usage.filament_id : ""
      }))
    )
  }, [filaments])

  const [productForm, setProductForm] = useState<ProductFormData>({
    name: "",
    license_id: undefined,
  })

  const [printTime, setPrintTime] = useState<string>("")
  const [filamentUsageRows, setFilamentUsageRows] = useState<FilamentUsageRowData[]>([{ filament_id: "", grams_used: "" }])
  const [additionalPartsCost, setAdditionalPartsCost] = useState<string>("")
  const [selectedProduct, setSelectedProduct] = useState<ProductType | null>(null)
  
  const modelFileRef = useRef<HTMLInputElement>(null)
  const [modelFileName, setModelFileName] = useState<string>("")
  const [isDragging, setIsDragging] = useState(false)
  const [activeAccordionItem, setActiveAccordionItem] = useState<string>("")

  // State for Edit Modal
  const [editingProduct, setEditingProduct] = useState<ProductType | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editForm, setEditForm] = useState<ProductEditFormData>({
    name: "",
    print_time_hrs: "",
    license_id: undefined,
  })
  const editModelFileRef = useRef<HTMLInputElement>(null)
  const [editModelFileName, setEditModelFileName] = useState<string | null>(null)
  const [isEditDragging, setIsEditDragging] = useState(false)

  const handleProductChange = (key: string, value: any) => {
    setProductForm(prev => ({ ...prev, [key]: value }))
  }

  const handleEditFormChange = (key: keyof ProductEditFormData, value: any) => {
    setEditForm(prev => ({ ...prev, [key]: value }))
  }

  const handleEditProduct = (product: ProductType) => {
    setEditingProduct(product)
    setEditForm({
      name: product.name,
      print_time_hrs: product.print_time_formatted || formatHoursDisplay(product.print_time_hrs),
      license_id: product.license_id || undefined
    })
    setIsEditModalOpen(true)
  }

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProduct) return

    try {
      // Parse time format
      const printTimeHours = parseTimeToHours(editForm.print_time_hrs)
      if (printTimeHours === null) {
        alert("Invalid time format. Use format like 1h30m, 2h, 45m, or 1.5")
        return
      }

      await updateProduct(editingProduct.id, {
        name: editForm.name,
        print_time_hrs: printTimeHours,
        license_id: editForm.license_id
      })

      setIsEditModalOpen(false)
      await fetchProducts()
    } catch (error) {
      console.error('Failed to update product:', error)
      alert('Failed to update product')
    }
  }

  const addFilamentUsageRow = () => {
    setFilamentUsageRows([...filamentUsageRows, { filament_id: "", grams_used: "" }])
  }

  const removeFilamentUsageRow = (index: number) => {
    if (filamentUsageRows.length > 1) {
      const newRows = filamentUsageRows.filter((_, i) => i !== index)
      setFilamentUsageRows(newRows)
    }
  }

  const handleFilamentUsageChange = (index: number, field: keyof FilamentUsageRowData, value: string) => {
    const newRows = [...filamentUsageRows]
    newRows[index][field] = value
    setFilamentUsageRows(newRows)
  }

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate print time
    if (!printTime || !isValidTimeFormat(printTime)) {
      alert("Please enter a valid print time (e.g., 1h30m, 2h, 45m, or 1.5)")
      return
    }

    // Validate filament usages
    const noInventoryFilaments = new Set<string>()
    
    for (let i = 0; i < filamentUsageRows.length; i++) {
      const usage = filamentUsageRows[i]
      if (!usage.filament_id || !usage.grams_used) {
        alert(`Please complete all filament entries`)
        return
      }
      
      // Check for no-inventory filaments
      const filament = filaments.find(f => f.id.toString() === usage.filament_id.toString())
      if (filament && filament.total_qty_kg === 0) {
        noInventoryFilaments.add(`${filament.color} ${filament.material} (${filament.brand})`)
      }
    }
    
    // Show inventory warning if there are no-inventory filaments
    if (noInventoryFilaments.size > 0) {
      const filamentList = Array.from(noInventoryFilaments).join('\n• ')
      const confirmMessage = `⚠️ Inventory Warning\n\nThis product uses filaments with no tracked inventory:\n\n• ${filamentList}\n\nMake sure to order these filaments before starting production.\n\nDo you want to save anyway?`
      
      if (!confirm(confirmMessage)) {
        return
      }
    }

    try {
      // Prepare filament usages data
      const filamentUsages = filamentUsageRows.map(row => ({
        filament_id: Number(row.filament_id),
        grams_used: Number(row.grams_used)
      }))

      const formData = new FormData()
      formData.append("name", productForm.name)
      formData.append("print_time", printTime)  // Send in flexible format
      formData.append("filament_usages", JSON.stringify(filamentUsages))
      formData.append("additional_parts_cost", additionalPartsCost || "0")
      
      if (productForm.license_id) {
        formData.append("license_id", productForm.license_id.toString())
      } else {
        formData.append("license_id", "")
      }

      // Add model file if selected
      if (modelFileRef.current?.files?.[0]) {
        formData.append("file", modelFileRef.current.files[0])
      }

      // Create the product
      await addProduct(formData)

      // Reset form
      setProductForm({ name: "", license_id: undefined })
      setPrintTime("")
      setFilamentUsageRows([{ filament_id: "", grams_used: "" }])
      setAdditionalPartsCost("")
      setModelFileName("")
      if (modelFileRef.current) modelFileRef.current.value = ""
      setActiveAccordionItem("")
    } catch (error) {
      console.error('Failed to create product:', error)
      alert('Failed to create product. Please check your inputs and try again.')
    }
  }

  const handleDeleteProduct = async (productId: number) => {
    if (confirm("Are you sure you want to delete this product?")) {
      try {
        await deleteProduct(productId)
      } catch (error) {
        console.error('Failed to delete product:', error)
        alert('Failed to delete product')
      }
    }
  }

  const getFilamentName = (filamentId: number | string) => {
    if (!filamentId) return "No filament selected"
    const filament = filaments.find(f => f.id.toString() === filamentId.toString())
    return filament ? `${filament.color} ${filament.material} (${filament.brand})` : "Unknown filament"
  }

  const getLicenseName = (licenseId: number | string) => {
    const license = subscriptions.find(s => s.id.toString() === licenseId.toString())
    return license ? `${license.name} (${license.platform})` : "No license"
  }

  const filteredProducts = [...products].reverse()

  return (
    <div className="max-w-[1400px] mx-auto space-y-8">

      <Accordion type="single" collapsible value={activeAccordionItem} onValueChange={setActiveAccordionItem}>
        <AccordionItem value="addProductItem" className="border rounded-lg bg-white dark:bg-gray-800 shadow-md overflow-hidden">
          <AccordionTrigger className="hover:no-underline px-6 py-4">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                <span className="text-xl font-semibold">Add Product</span>
              </div>
              {activeAccordionItem === "addProductItem" ? <ChevronUp className="h-5 w-5 text-primary" /> : <ChevronDown className="h-5 w-5 text-primary" />}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="p-6 pt-2">
              <form onSubmit={handleAddProduct} className="space-y-6">
                {/* First Row: Basic Product Info + Filament Usage */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left: Basic Product Information */}
                  <div className="space-y-4 p-5 bg-muted/30 rounded-lg border border-muted">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Info className="h-5 w-5 text-primary" />
                      Product Information
                    </h3>
                    
                    <div className="space-y-4">
                      {/* First row: Name + Print Time */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                        <div>
                          <Label htmlFor="printTime" className="text-sm font-medium">
                            Print Time
                          </Label>
                          <Input
                            id="printTime"
                            type="text"
                            value={printTime}
                            onChange={(e) => {
                              const value = e.target.value
                              setPrintTime(value)
                              // Provide immediate visual feedback
                              const input = e.target as HTMLInputElement
                              if (value && !isValidTimeFormat(value)) {
                                input.setCustomValidity("Use format like 1h30m, 2h, 45m, or 1.5")
                              } else {
                                input.setCustomValidity("")
                              }
                            }}
                            placeholder={TIME_FORMAT_PLACEHOLDER}
                            required
                            className="bg-white dark:bg-gray-800"
                          />
                        </div>
                      </div>

                      {/* Second row: License */}
                      <div>
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
                                {sub.name} ({sub.platform})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Right: Filament Usage */}
                  <div className="space-y-4 p-5 bg-muted/30 rounded-lg border border-muted">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        Filament Usage
                      </h3>
                      <Button type="button" onClick={addFilamentUsageRow} variant="secondary" size="sm" className="gap-1">
                        <Plus className="h-4 w-4" /> Add Filament
                      </Button>
                    </div>
                    
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs font-semibold text-center">Filament</TableHead>
                            <TableHead className="text-xs font-semibold text-center w-32">Grams</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filamentUsageRows.map((usage, index) => (
                            <TableRow key={index}>
                              <TableCell className="text-center">
                                <div className="flex justify-center w-full px-2">
                                  <FilamentSelect
                                    key={`product-filament-${index}-${filaments.length}`}
                                    value={usage.filament_id}
                                    onValueChange={(value) => handleFilamentUsageChange(index, 'filament_id', value)}
                                    filaments={filaments}
                                    placeholder="Select filament"
                                    className="h-8 text-xs w-2/3"
                                    required
                                  />
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-center">
                                  <Input
                                    type="number"
                                    value={usage.grams_used}
                                    onChange={(e) => handleFilamentUsageChange(index, 'grams_used', e.target.value)}
                                    placeholder="0"
                                    min="0.1"
                                    step="0.1"
                                    required
                                    className="h-8 w-20 text-xs"
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                {filamentUsageRows.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                    onClick={() => removeFilamentUsageRow(index)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>

                {/* Second Row: Optional Sections */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Additional Parts (Optional) */}
                  <div className="space-y-4 p-5 bg-muted/30 rounded-lg border border-muted">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                      Additional Parts (Optional)
                    </h3>
                    <div>
                      <Label htmlFor="additionalPartsCost" className="text-sm font-medium">
                        Cost of additional parts (magnets, glue, screws, etc.)
                      </Label>
                      <Input
                        id="additionalPartsCost"
                        type="number"
                        min="0"
                        step="0.01"
                        value={additionalPartsCost}
                        onChange={(e) => setAdditionalPartsCost(e.target.value)}
                        placeholder="0.00"
                        className="bg-white dark:bg-gray-800"
                      />
                    </div>
                  </div>

                  {/* 3D Model File Upload (Optional) */}
                  <div className="space-y-4 p-5 bg-muted/30 rounded-lg border border-muted">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <UploadCloud className="h-5 w-5 text-primary" /> 3D Model File (Optional)
                    </h3>
                    <div 
                      className={`flex items-center justify-center w-full p-6 border-2 border-dashed rounded-lg cursor-pointer 
                                  ${isDragging ? 'border-gray-500 bg-gray-100 dark:bg-gray-800/50' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-white dark:bg-gray-950/20'}
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
                        <UploadCloud className={`mx-auto h-10 w-10 mb-2 ${isDragging ? 'text-gray-600 dark:text-gray-400' : 'text-gray-400'}`} />
                        <p className={`text-sm ${isDragging ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}>
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
                </div>

                <div className="flex justify-end gap-3">
                  <Button type="submit" size="lg" className="bg-primary hover:bg-primary/90 text-white shadow-md transition-all">
                    <Plus className="mr-2 h-5 w-5" /> Create Product
                  </Button>
                </div>
              </form>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Products List */}
      <Card className="bg-white dark:bg-gray-800 shadow-lg border-gray-200 dark:border-gray-700">
        <CardHeader className="border-b border-gray-200 dark:border-gray-700">
          <CardTitle className="text-xl font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Package className="h-6 w-6 text-primary" />
            Products ({filteredProducts.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredProducts.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Name</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">SKU</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Print Time</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Est. COP</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">License</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{product.sku}</Badge>
                      </TableCell>
                      <TableCell>
                        {product.print_time_formatted || formatHoursDisplay(product.print_time_hrs)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-semibold">
                          €{product.cop ? Number(product.cop).toFixed(2) : 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {product.license_id ? (
                          <Badge variant="outline" className="text-xs">
                            {getLicenseName(product.license_id)}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="hover:bg-gray-100 dark:hover:bg-gray-800"
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
                                        {selectedProduct.print_time_formatted || formatHoursDisplay(selectedProduct.print_time_hrs)}
                                      </dd>
                                    </div>
                                    <div className="bg-muted/30 p-3 rounded-lg border">
                                      <dt className="text-sm font-medium text-muted-foreground">Est. COP</dt>
                                      <dd className="mt-1">
                                        <Badge variant="secondary" className="text-lg font-semibold">
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
                                    {selectedProduct.file_path && (
                                    <div className="bg-muted/30 p-3 rounded-lg border">
                                      <dt className="text-sm font-medium text-muted-foreground">Model File</dt>
                                      <dd className="mt-1 text-sm">{selectedProduct.file_path}</dd>
                                    </div>
                                    )}
                                  </div>
                                  {/* Show filament usages */}
                                  {selectedProduct.filament_usages && selectedProduct.filament_usages.length > 0 && (
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
                                          <path d="M17 10c.7-.7 1.69 0 2.5 0a2.5 2.5 0 1 0 0-5 .5.5 0 0 1-.5-.5 2.5 2.5 0 1 0-5 0c0 .81.7 1.8 0 2.5l-7 7c-.7.7-1.69 0-2.5 0a2.5 2.5 0 0 0 0 5c.28 0 .5.22.5.5a2.5 2.5 0 1 0 5 0c0-.81-.7-1.8 0-2.5Z"></path>
                                        </svg>
                                        Filament Usage
                                      </h4>
                                      <div className="mt-2 space-y-2">
                                        {selectedProduct.filament_usages.map((usage: any, idx: number) => (
                                          <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-900/50 rounded">
                                            <span className="text-sm font-medium">{getFilamentName(usage.filament_id)}</span>
                                            <Badge variant="outline">{usage.grams_used}g</Badge>
                                          </div>
                                        ))}
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditProduct(product)}
                            className="hover:bg-blue-50 dark:hover:bg-blue-950/30"
                          >
                            <Pencil className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteProduct(product.id)}
                            className="hover:bg-red-50 dark:hover:bg-red-950/30"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">No products found.</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Create your first product to get started.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Product Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Edit Product
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateProduct} className="space-y-6 py-4 overflow-y-auto pr-2 flex-1">
            <div className="space-y-4">
              <div>
                <Label htmlFor="editName">Name</Label>
                <Input
                  id="editName"
                  value={editForm.name}
                  onChange={(e) => handleEditFormChange("name", e.target.value)}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="editPrintTime">Print Time</Label>
                <Input
                  id="editPrintTime"
                  type="text"
                  value={editForm.print_time_hrs}
                  onChange={(e) => {
                    const value = e.target.value
                    handleEditFormChange("print_time_hrs", value)
                    // Provide immediate visual feedback
                    const input = e.target as HTMLInputElement
                    if (value && !isValidTimeFormat(value)) {
                      input.setCustomValidity("Use format like 1h30m, 2h, 45m, or 1.5")
                    } else {
                      input.setCustomValidity("")
                    }
                  }}
                  placeholder={TIME_FORMAT_PLACEHOLDER}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="editLicense">Commercial License</Label>
                <Select
                  value={editForm.license_id ? editForm.license_id.toString() : "none"}
                  onValueChange={(value) => {
                    if (value === "none") handleEditFormChange("license_id", undefined)
                    else handleEditFormChange("license_id", value)
                  }}
                >
                  <SelectTrigger id="editLicense">
                    <SelectValue placeholder="Select License" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No License</SelectItem>
                    {subscriptions.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id.toString()}>
                        {sub.name} ({sub.platform})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}