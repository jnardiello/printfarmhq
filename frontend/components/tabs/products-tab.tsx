"use client"

import type React from "react"
import { useState, useRef } from "react"
import { useData } from "@/components/data-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Trash2, Plus, Eye, Package, Upload, Info, CreditCard, AlertCircle, Settings, FileText, Clock } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { formatTimeToHHMM } from "@/lib/utils"
import { FilamentSelect } from "@/components/filament-select"
import { motion } from "framer-motion"
import { PlateManager } from "@/components/plate-manager"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { DollarSign } from "lucide-react"
import { toast } from "@/components/ui/use-toast"

const TIME_FORMAT_PLACEHOLDER = "e.g., 1h30m, 2h, 45m, or 1.5"

interface FilamentUsage {
  filament_id: string
  grams_used: string
}

export function ProductsTab() {
  const { products, filaments, subscriptions, addProduct, deleteProduct } = useData()
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [productToDelete, setProductToDelete] = useState<any>(null)
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false)

  const [productForm, setProductForm] = useState<{
    name: string
    license_id: string | number | undefined
  }>({
    name: "",
    license_id: undefined,
  })
  
  const [printTime, setPrintTime] = useState("")
  const [filamentUsageRows, setFilamentUsageRows] = useState<FilamentUsage[]>([{ filament_id: "", grams_used: "" }])
  const [additionalPartsCost, setAdditionalPartsCost] = useState("")
  const [modelFileName, setModelFileName] = useState("")
  const modelFileRef = useRef<HTMLInputElement>(null)

  const handleProductChange = (field: string, value: string | number | undefined) => {
    setProductForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleFilamentUsageChange = (index: number, field: keyof FilamentUsage, value: string) => {
    const updated = [...filamentUsageRows]
    updated[index][field] = value
    setFilamentUsageRows(updated)
  }

  const addFilamentUsageRow = () => {
    setFilamentUsageRows([...filamentUsageRows, { filament_id: "", grams_used: "" }])
  }

  const removeFilamentUsageRow = (index: number) => {
    setFilamentUsageRows(filamentUsageRows.filter((_, i) => i !== index))
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setModelFileName(file?.name || "")
  }

  const isValidTimeFormat = (value: string): boolean => {
    if (!value) return false
    
    // Check for valid formats
    const patterns = [
      /^\d+(\.\d+)?$/,          // Decimal hours (e.g., 1.5)
      /^\d+h$/,                  // Hours only (e.g., 2h)
      /^\d+m$/,                  // Minutes only (e.g., 45m)
      /^\d+h\d+m$/,              // Hours and minutes (e.g., 1h30m)
      /^\d+h\s+\d+m$/,           // Hours and minutes with space
    ]
    
    return patterns.some(pattern => pattern.test(value.toLowerCase()))
  }

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate time format
    if (!isValidTimeFormat(printTime)) {
      alert(`Invalid time format. Please use one of these formats:\n• 1h30m (1 hour 30 minutes)\n• 2h (2 hours)\n• 45m (45 minutes)\n• 1.5 (1.5 hours)`)
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
      setIsAddProductModalOpen(false)
      
      toast({
        title: "Success",
        description: "Product created successfully"
      })
    } catch (error) {
      console.error('Failed to create product:', error)
      toast({
        title: "Error",
        description: "Failed to create product. Please check your inputs and try again.",
        variant: "destructive"
      })
    }
  }

  const handleDeleteProduct = async () => {
    if (productToDelete) {
      try {
        await deleteProduct(productToDelete.id)
        setProductToDelete(null)
      } catch (error) {
        console.error('Failed to delete product:', error)
        toast({
          title: "Error",
          description: "Failed to delete product",
          variant: "destructive"
        })
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
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Products</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your product catalog</p>
        </div>
        
        <Dialog open={isAddProductModalOpen} onOpenChange={setIsAddProductModalOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-white shadow-md transition-all">
              <Plus className="mr-2 h-5 w-5" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-2xl">
                <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
                  <Package className="h-6 w-6 text-white" />
                </div>
                Add Product
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleAddProduct} className="space-y-6 mt-6">
              {/* Basic Information Section */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <Info className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Product Information</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Basic product details</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="prodName" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Product Name *
                    </Label>
                    <Input
                      id="prodName"
                      value={productForm.name}
                      onChange={(e) => handleProductChange("name", e.target.value)}
                      placeholder="Enter product name"
                      required
                      className="h-11"
                    />
                  </div>

                  <div>
                    <Label htmlFor="printTime" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Print Time *
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
                      className="h-11"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Format: 1h30m, 2h, 45m, or 1.5 (decimal hours)
                    </p>
                  </div>
                </div>
              </div>

              {/* Filament Usage Section */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Filament Usage</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Specify filaments used in this product</p>
                    </div>
                  </div>
                  <Button 
                    type="button" 
                    onClick={addFilamentUsageRow} 
                    variant="outline" 
                    size="sm" 
                    className="gap-2 bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700 hover:text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400"
                  >
                    <Plus className="h-4 w-4" /> Add Filament
                  </Button>
                </div>

                <div className="space-y-4">
                  {filamentUsageRows.map((usage, index) => (
                    <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-8">
                          <Label htmlFor={`filament-${index}`} className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                            Filament Type *
                          </Label>
                          <FilamentSelect
                            key={`product-filament-${index}-${filaments.length}`}
                            value={usage.filament_id}
                            onValueChange={(value) => handleFilamentUsageChange(index, 'filament_id', value)}
                            filaments={filaments}
                            placeholder="Select filament"
                            required
                          />
                        </div>
                        
                        <div className="md:col-span-3">
                          <Label htmlFor={`grams-${index}`} className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                            Grams Used *
                          </Label>
                          <Input
                            id={`grams-${index}`}
                            type="number"
                            value={usage.grams_used}
                            onChange={(e) => handleFilamentUsageChange(index, 'grams_used', e.target.value)}
                            placeholder="100"
                            min="0.1"
                            step="0.1"
                            required
                            className="h-11 text-center font-medium"
                          />
                        </div>
                        
                        {filamentUsageRows.length > 1 && (
                          <div className="md:col-span-1 flex justify-center">
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="h-11 w-11 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20" 
                              onClick={() => removeFilamentUsageRow(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial & Licensing Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Financial Information */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                      <DollarSign className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Financial Details</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Cost information</p>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="additionalPartsCost" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Additional Parts Cost (€)
                    </Label>
                    <div className="relative">
                      <Input
                        id="additionalPartsCost"
                        type="number"
                        min="0"
                        step="0.01"
                        value={additionalPartsCost}
                        onChange={(e) => setAdditionalPartsCost(e.target.value)}
                        placeholder="0.00"
                        className="h-11 pl-8"
                      />
                      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">€</div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      For non-filament components (screws, magnets, etc.)
                    </p>
                  </div>
                </div>

                {/* Licensing & Files */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">License & Files</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Optional information</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="prodLicense" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        Commercial License
                      </Label>
                      <Select
                        value={productForm.license_id ? productForm.license_id.toString() : "none"}
                        onValueChange={(value) => {
                          if (value === "none") handleProductChange("license_id", undefined)
                          else handleProductChange("license_id", value)
                        }}
                      >
                        <SelectTrigger id="prodLicense" className="h-11">
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

                    <div>
                      <Label htmlFor="modelFile" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        3D Model File
                      </Label>
                      <div className="flex items-center gap-3">
                        <Input
                          ref={modelFileRef}
                          id="modelFile"
                          type="file"
                          accept=".stl,.obj,.3mf"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => modelFileRef.current?.click()}
                          className="h-11"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Choose File
                        </Button>
                        {modelFileName && (
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {modelFileName}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Supported formats: STL, OBJ, 3MF
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button 
                  type="submit" 
                  size="lg" 
                  className="bg-primary hover:bg-primary/90 text-white shadow-md transition-all"
                >
                  <Plus className="mr-2 h-5 w-5" /> 
                  Create Product
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Products List */}
      <Card className="card-hover shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Package className="h-5 w-5 text-primary" />
            Products ({filteredProducts.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredProducts.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Print Time</TableHead>
                    <TableHead>Est. COP</TableHead>
                    <TableHead>License</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                          {product.sku}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span>{formatTimeToHHMM(product.print_time_hrs)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          €{product.cop?.toFixed(2) || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {product.license_id ? (
                          <span className="text-sm">
                            {getLicenseName(product.license_id)}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                      onClick={() => setSelectedProduct(product)}
                                      title="View details"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-md">
                                    <DialogHeader>
                                      <DialogTitle className="flex items-center gap-2 text-xl">
                                        <Package className="h-5 w-5 text-primary" />
                                        Product Details
                                      </DialogTitle>
                                    </DialogHeader>
                                    {selectedProduct && (
                                      <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                          <div>
                                            <label className="text-sm font-medium text-gray-500">Name</label>
                                            <p className="text-sm font-semibold">{selectedProduct.name}</p>
                                          </div>
                                          <div>
                                            <label className="text-sm font-medium text-gray-500">SKU</label>
                                            <p className="text-sm font-mono">{selectedProduct.sku}</p>
                                          </div>
                                          <div>
                                            <label className="text-sm font-medium text-gray-500">Print Time</label>
                                            <p className="text-sm">{formatTimeToHHMM(selectedProduct.print_time_hrs)}</p>
                                          </div>
                                          <div>
                                            <label className="text-sm font-medium text-gray-500">Est. COP</label>
                                            <p className="text-sm">€{selectedProduct.cop?.toFixed(2) || "—"}</p>
                                          </div>
                                          {selectedProduct.additional_parts_cost > 0 && (
                                            <div className="col-span-2">
                                              <label className="text-sm font-medium text-gray-500">Additional Parts Cost</label>
                                              <p className="text-sm">€{selectedProduct.additional_parts_cost.toFixed(2)}</p>
                                            </div>
                                          )}
                                          {selectedProduct.license_id && (
                                            <div className="col-span-2">
                                              <label className="text-sm font-medium text-gray-500">License</label>
                                              <p className="text-sm">{getLicenseName(selectedProduct.license_id)}</p>
                                            </div>
                                          )}
                                        </div>

                                        {selectedProduct.filament_usages && selectedProduct.filament_usages.length > 0 && (
                                          <div>
                                            <label className="text-sm font-medium text-gray-500">Filament Usage</label>
                                            <div className="mt-2 space-y-2">
                                              {selectedProduct.filament_usages.map((usage: any, idx: number) => (
                                                <div key={idx} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 flex justify-between items-center">
                                                  <span className="text-sm">{getFilamentName(usage.filament_id)}</span>
                                                  <span className="text-sm font-medium">{usage.grams_used}g</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {selectedProduct.g_code_file && (
                                          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                                            <Info className="h-4 w-4" />
                                            <AlertDescription>
                                              <p className="text-sm font-medium mb-1">Uploaded Files:</p>
                                              <p className="text-xs">{selectedProduct.g_code_file}</p>
                                            </AlertDescription>
                                          </Alert>
                                        )}
                                      </div>
                                    )}
                                  </DialogContent>
                                </Dialog>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>View product details</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  onClick={() => setProductToDelete(product)}
                                  title="Delete product"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Delete product</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-12 bg-muted/30">
              <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p>No products added yet.</p>
              <p className="text-sm mt-1">Click "Add Product" to create your first product.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plate Manager Section - Removed as it requires specific product context */}

      {/* Delete Product Confirmation Dialog */}
      <Dialog open={!!productToDelete} onOpenChange={() => setProductToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Delete Product
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Are you sure you want to delete this product?</p>
            {productToDelete && (
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg space-y-1 text-sm">
                <p><strong>Name:</strong> {productToDelete.name}</p>
                <p><strong>SKU:</strong> {productToDelete.sku}</p>
                <p><strong>Print Time:</strong> {formatTimeToHHMM(productToDelete.print_time_hrs)}</p>
                {productToDelete.filament_usages && productToDelete.filament_usages.length > 0 && (
                  <p><strong>Filament Usages:</strong> {productToDelete.filament_usages.length} type(s)</p>
                )}
              </div>
            )}
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This action cannot be undone. All associated data will be permanently deleted.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteProduct}>
              Delete Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}