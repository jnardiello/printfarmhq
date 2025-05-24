"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
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
import type { FilamentRowData, ProductFormData, Product as ProductType, Printer, Filament, Subscription, FilamentUsage } from "@/lib/types"
import { motion } from "framer-motion"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

// Define a type for the edit form, can be similar to ProductFormData or more specific
// For now, let's assume it might have slight differences or could be a partial ProductType
interface ProductEditFormData {
  name: string;
  print_time_hrs: string | number;
  license_id?: string | number; // Keep as string for form compatibility, convert on submit
  // Filament usages and model file will be handled separately in state for the edit modal
}

interface ProductsTabProps {
  onNavigateToTab?: (tab: string) => void
}

export function ProductsTab({ onNavigateToTab }: ProductsTabProps) {
  const { filaments, products, printers, subscriptions, addProduct, deleteProduct, updateProduct } = useData()

  const [productForm, setProductForm] = useState<ProductFormData>({
    name: "",
    print_time_hrs: "",
    license_id: undefined,
  })

  const [filamentRows, setFilamentRows] = useState<FilamentRowData[]>([])
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

  useEffect(() => {
    if (editingProduct) {
      setEditForm({
        name: editingProduct.name,
        print_time_hrs: editingProduct.print_time_hrs.toString(),
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
    formData.append("print_time_hrs", editForm.print_time_hrs.toString());
    
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

  const addFilamentRow = () => {
    setFilamentRows([...filamentRows, { filament_id: "", grams_used: "" }])
  }

  const removeFilamentRow = (index: number) => {
    const newRows = [...filamentRows]
    newRows.splice(index, 1)
    setFilamentRows(newRows)
  }

  const handleFilamentRowChange = (index: number, field: keyof FilamentRowData, value: string | number) => {
    const newRows = [...filamentRows]
    newRows[index] = { ...newRows[index], [field]: value }
    setFilamentRows(newRows)
  }

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()

    if (filamentRows.length === 0) {
      alert("Add at least one filament row")
      return
    }

    const usages = filamentRows.map((row: FilamentRowData) => ({
      filament_id: Number(row.filament_id),
      grams_used: Number(row.grams_used),
    }))

    // Base payload fields that will go into FormData
    const productFields = {
      name: productForm.name,
      print_time_hrs: Number(productForm.print_time_hrs),
      filament_usages: JSON.stringify(usages), 
      license_id: productForm.license_id ? Number(productForm.license_id) : null,
    };

    const formData = new FormData();

    // Append product fields to formData
    for (const key in productFields) {
      // @ts-ignore // Accessing productFields with string key
      const value = productFields[key];
      if (value !== null && value !== undefined) {
        // @ts-ignore
        formData.append(key, typeof value === 'number' ? value.toString() : value);
      } else if (key === 'license_id') {
         // Ensure null license_id is sent as an empty string if backend expects a value, or handle explicitly
         formData.append(key, ''); 
      }
    }
    
    // Append the model file if selected
    if (modelFileRef.current?.files?.[0]) {
      formData.append("model_file", modelFileRef.current.files[0]); // "model_file" must match backend expected key
      console.log("Appending model file to FormData:", modelFileRef.current.files[0].name);
    } else {
      console.log("No model file selected for upload.");
    }

    // console.log("Product Payload (no files uploaded yet):", productPayload)
    // For now, using the existing addProduct which expects JSON
    // await addProduct(productPayload) 
    await addProduct(formData); // Call addProduct with FormData

    setProductForm({
      name: "",
      print_time_hrs: "",
      license_id: undefined,
    })
    setFilamentRows([])
    if (modelFileRef.current) modelFileRef.current.value = ""
    setModelFileName("")
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

                      <div>
                        <Label htmlFor="prodPrintTime" className="text-sm font-medium">
                          Print time (hrs)
                        </Label>
                        <Input
                          id="prodPrintTime"
                          type="number"
                          step="0.1"
                          min="0"
                          value={productForm.print_time_hrs}
                          onChange={(e) => handleProductChange("print_time_hrs", e.target.value)}
                          placeholder="e.g. 2.5"
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
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                            <polyline points="3.29 7 12 12 20.71 7"></polyline>
                            <line x1="12" y1="22" x2="12" y2="12"></line>
                          </svg>
                          Filaments Used
                        </h3>
                        <Button type="button" variant="outline" onClick={addFilamentRow} size="sm" className="gap-1">
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
                            {filamentRows.length > 0 ? (
                              filamentRows.map((row, index) => (
                                <TableRow key={index} className="hover:bg-muted/50 transition-colors">
                                  <TableCell>
                                    <Select
                                      value={row.filament_id ? row.filament_id.toString() : undefined}
                                      onValueChange={(value) => handleFilamentRowChange(index, "filament_id", value)}
                                      required
                                    >
                                      <SelectTrigger className="bg-white dark:bg-gray-800">
                                        <SelectValue placeholder="Select Filament" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {filaments.length > 0 ? (
                                          filaments.map((filament) => (
                                            <SelectItem key={filament.id} value={filament.id.toString()}>
                                              <div className="flex items-center gap-2">
                                                <div
                                                  className="w-3 h-3 rounded-full border border-gray-300"
                                                  style={{
                                                    backgroundColor: filament.color.toLowerCase(),
                                                    boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)",
                                                  }}
                                                ></div>
                                                {filament.color} {filament.material} ({filament.brand})
                                              </div>
                                            </SelectItem>
                                          ))
                                        ) : (
                                          <div className="px-3 py-2 text-sm text-muted-foreground">
                                            Please add filaments first.
                                          </div>
                                        )}
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
                                      className="bg-white dark:bg-gray-800"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-gray-500 hover:text-red-600"
                                      onClick={() => removeFilamentRow(index)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                                  <Package className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                                  <p>No filaments added to this product yet.</p>
                                  <p className="text-sm mt-1">Click "Add Filament" to add materials.</p>
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
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
                                        {selectedProduct.print_time_hrs} h
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
                                    Filaments Used
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
                  <Label htmlFor="editProdPrintTime" className="text-sm font-medium">Print time (hrs)</Label>
                  <Input
                    id="editProdPrintTime"
                    type="number"
                    step="0.1"
                    min="0"
                    value={editForm.print_time_hrs}
                    onChange={(e) => handleEditFormChange("print_time_hrs", e.target.value)}
                    placeholder="e.g. 2.5"
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
