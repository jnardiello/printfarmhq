"use client"

import type React from "react"

import { useState, useMemo } from "react"
import { useData } from "@/components/data-provider" // Placeholder - will need to update useData
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Trash2, Plus, Printer, Package, ScanLine, AlertCircle, ExternalLink, CreditCard, Calculator, Info, Edit, Eye } from "lucide-react"
import { motion } from "framer-motion"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


export function PrintsTab() {
  // Placeholder - will need to update useData and related functions/state
  const { products, printers, printJobs, addPrintJob, deletePrintJob, updatePrintJob } = useData()
  const router = useRouter()


  // State for print job form - removed since we're using separate states for products and printers

  const [jobProducts, setJobProducts] = useState([{ productId: "", itemsQty: "1" }]);
  const [jobPrinter, setJobPrinter] = useState({ printerId: "", printersQty: "1" });
  const [packagingCost, setPackagingCost] = useState("0");
  const [isAddJobModalOpen, setIsAddJobModalOpen] = useState(false);
  const [selectedJobForDetails, setSelectedJobForDetails] = useState<any>(null);
  const [selectedJobForEdit, setSelectedJobForEdit] = useState<any>(null);
  const [jobToDelete, setJobToDelete] = useState<any>(null);
  
  // Edit form states (separate from add form)
  const [editJobProducts, setEditJobProducts] = useState([{ productId: "", itemsQty: "1" }]);
  const [editJobPrinter, setEditJobPrinter] = useState({ printerId: "", printersQty: "1" });
  const [editPackagingCost, setEditPackagingCost] = useState("0");


  const handleProductRowChange = (idx: number, field: string, value: string) => {
    setJobProducts(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  };
  const handlePrinterChange = (field: string, value: string) => {
    setJobPrinter(prev => ({ ...prev, [field]: value }));
  };

  const addProductRow = () => setJobProducts(prev => [...prev, { productId: "", itemsQty: "1" }]);

  // Edit form handlers
  const handleEditProductRowChange = (idx: number, field: string, value: string) => {
    setEditJobProducts(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  };
  const handleEditPrinterChange = (field: string, value: string) => {
    setEditJobPrinter(prev => ({ ...prev, [field]: value }));
  };

  const addEditProductRow = () => setEditJobProducts(prev => [...prev, { productId: "", itemsQty: "1" }]);

  // Function to populate edit form with existing job data
  const populateEditForm = (job: any) => {
    // Convert job products to form format
    const formProducts = job.products?.map((product: any) => ({
      productId: String(product.product_id),
      itemsQty: String(product.items_qty)
    })) || [{ productId: "", itemsQty: "1" }];
    
    // Convert job printer to form format (take first printer since we only allow one type now)
    const formPrinter = job.printers?.[0] ? {
      printerId: String(job.printers[0].printer_profile_id),
      printersQty: String(job.printers[0].printers_qty)
    } : { printerId: "", printersQty: "1" };
    
    // Set form states
    setEditJobProducts(formProducts);
    setEditJobPrinter(formPrinter);
    setEditPackagingCost(String(job.packaging_cost_eur || 0));
    setSelectedJobForEdit(job);
  };

  // Calculate COGS preview using the same logic as backend
  const cogsPreview = useMemo(() => {
    let totalFilamentCost = 0;
    let totalPrintTime = 0;
    let printerCost = 0;
    let packagingCostNum = parseFloat(packagingCost) || 0;

    // 1. Calculate filament costs from products
    for (const jobProduct of jobProducts) {
      if (!jobProduct.productId || !jobProduct.itemsQty) continue;
      
      const product = products?.find(p => p.id === parseInt(jobProduct.productId));
      if (!product) continue;

      const itemsQty = parseInt(jobProduct.itemsQty) || 0;
      
      // Add filament costs (using product COP which includes all filament costs)
      totalFilamentCost += (product.cop || 0) * itemsQty;
      
      // Add print time (try total_print_time_hrs first, fallback to print_time_hrs)
      const printTime = product.total_print_time_hrs || product.print_time_hrs || 0;
      totalPrintTime += printTime * itemsQty;
    }

    // 2. Calculate printer costs
    if (jobPrinter.printerId && totalPrintTime > 0) {
      const printer = printers?.find(p => p.id === parseInt(jobPrinter.printerId));
      if (printer) {
        const printerPrice = printer.price_eur || 0;
        const printerLifeHours = printer.expected_life_hours || 0;
        
        if (printerLifeHours > 0 && printerPrice > 0) {
          const costPerHour = printerPrice / printerLifeHours;
          const printersQty = parseInt(jobPrinter.printersQty) || 1;
          printerCost = costPerHour * totalPrintTime * printersQty;
        }
      }
    }

    const totalCogs = totalFilamentCost + printerCost + packagingCostNum;

    return {
      filamentCost: totalFilamentCost,
      printerCost: printerCost,
      packagingCost: packagingCostNum,
      totalPrintTime: totalPrintTime,
      totalCogs: totalCogs,
      isValid: totalCogs > 0
    };
  }, [jobProducts, jobPrinter, packagingCost, products, printers]);

  // Calculate COGS preview for edit form
  const editCogsPreview = useMemo(() => {
    let totalFilamentCost = 0;
    let totalPrintTime = 0;
    let printerCost = 0;
    let packagingCostNum = parseFloat(editPackagingCost) || 0;

    // 1. Calculate filament costs from products
    for (const jobProduct of editJobProducts) {
      if (!jobProduct.productId || !jobProduct.itemsQty) continue;
      
      const product = products?.find(p => p.id === parseInt(jobProduct.productId));
      if (!product) continue;

      const itemsQty = parseInt(jobProduct.itemsQty) || 0;
      
      // Add filament costs (using product COP which includes all filament costs)
      totalFilamentCost += (product.cop || 0) * itemsQty;
      
      // Add print time (try total_print_time_hrs first, fallback to print_time_hrs)
      const printTime = product.total_print_time_hrs || product.print_time_hrs || 0;
      totalPrintTime += printTime * itemsQty;
    }

    // 2. Calculate printer costs
    if (editJobPrinter.printerId && totalPrintTime > 0) {
      const printer = printers?.find(p => p.id === parseInt(editJobPrinter.printerId));
      if (printer) {
        const printerPrice = printer.price_eur || 0;
        const printerLifeHours = printer.expected_life_hours || 0;
        
        if (printerLifeHours > 0 && printerPrice > 0) {
          const costPerHour = printerPrice / printerLifeHours;
          const printersQty = parseInt(editJobPrinter.printersQty) || 1;
          printerCost = costPerHour * totalPrintTime * printersQty;
        }
      }
    }

    const totalCogs = totalFilamentCost + printerCost + packagingCostNum;

    return {
      filamentCost: totalFilamentCost,
      printerCost: printerCost,
      packagingCost: packagingCostNum,
      totalPrintTime: totalPrintTime,
      totalCogs: totalCogs,
      isValid: totalCogs > 0
    };
  }, [editJobProducts, editJobPrinter, editPackagingCost, products, printers]);

  const handleAddPrintJob = async (e: React.FormEvent) => {
    e.preventDefault()

    if (jobProducts.some(p=> !p.productId) || !jobPrinter.printerId) {
      alert("Please select all products and the printer.");
      return;
    }
    await addPrintJob({
      products: jobProducts.map(p=>({ product_id: Number(p.productId), items_qty: Number(p.itemsQty) })),
      printers: [{ printer_profile_id: Number(jobPrinter.printerId), printers_qty: Number(jobPrinter.printersQty) }],
      packaging_cost_eur: Number(packagingCost),
      status: "pending",
    });
    setJobProducts([{ productId:"", itemsQty:"1" }]);
    setJobPrinter({ printerId:"", printersQty:"1" });
    setPackagingCost("0");
    setIsAddJobModalOpen(false); // Close modal after successful submission
  }

  const handleUpdatePrintJob = async (e: React.FormEvent) => {
    e.preventDefault()

    if (editJobProducts.some(p=> !p.productId) || !editJobPrinter.printerId) {
      alert("Please select all products and the printer.");
      return;
    }
    
    if (!selectedJobForEdit) {
      alert("No job selected for editing.");
      return;
    }

    try {
      // Debug: Log the data being sent
      const updateData = {
        name: selectedJobForEdit.name, // Include the original name
        products: editJobProducts.map(p=>({ product_id: Number(p.productId), items_qty: Number(p.itemsQty) })),
        printers: [{ printer_profile_id: Number(editJobPrinter.printerId), printers_qty: Number(editJobPrinter.printersQty) }],
        packaging_cost_eur: Number(editPackagingCost),
        status: selectedJobForEdit.status || "pending",
      };
      
      console.log("Updating print job with ID:", selectedJobForEdit.id);
      console.log("Update data:", updateData);
      
      await updatePrintJob(selectedJobForEdit.id, updateData);
      
      // Reset edit form
      setEditJobProducts([{ productId:"", itemsQty:"1" }]);
      setEditJobPrinter({ printerId:"", printersQty:"1" });
      setEditPackagingCost("0");
      setSelectedJobForEdit(null); // Close modal after successful submission
    } catch (error) {
      console.error("Failed to update print job:", error);
      console.error("Error details:", error instanceof Error ? error.message : error);
      alert(`Failed to update print job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Placeholder: Calculate COGS for a print queue entry
  const calculateCogs = (printJob: any) => {
    // This will be implemented later based on product, printer, filament, etc.
    // For now, returning a placeholder value
    if (!printJob || !products || !printers) return 0;
    const product = products.find(p => p.id === printJob.productId)
    const printer = printers.find(p => p.id === printJob.printerId)

    if (!product || !printer) return 0;

    // Simplified COGS calculation for now
    const materialCost = (product.filament_g ? product.filament_g / 1000 : 0) * 20; // Assuming filament cost of 20 EUR/kg
    const printerHourlyRate = printer.price_eur / printer.expected_life_hours;
    const printTimeHours = product.print_time_h || 1; // Assume 1 hour if not specified
    const printerCost = printerHourlyRate * printTimeHours;
    const packagingCost = 0.5; // Placeholder

    return (materialCost + printerCost + packagingCost) * printJob.quantity;
  }


  // Check if requirements are met to show the form
  const hasProducts = products && products.length > 0
  const hasPrinters = printers && printers.length > 0
  const canCreatePrintJob = hasProducts && hasPrinters

  // Navigation functions
  const goToProducts = () => {
    router.push('/?tab=products')
  }

  const goToPrinters = () => {
    router.push('/?tab=printers')
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Print Queue</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your print jobs and track progress</p>
        </div>
        
        {canCreatePrintJob && (
          <Dialog open={isAddJobModalOpen} onOpenChange={setIsAddJobModalOpen}>
            <DialogTrigger asChild>
              <Button 
                size="lg" 
                className="bg-primary hover:bg-primary/90 text-white shadow-md transition-all"
              >
                <Plus className="mr-2 h-5 w-5" />
                Add Job to Queue
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-2xl">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                    <ScanLine className="h-6 w-6 text-white" />
                  </div>
                  Add Job to Queue
                </DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleAddPrintJob} className="space-y-6 mt-6">
                
                {/* Products Section */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                        <Package className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Products</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Select products and quantities for this print job</p>
                      </div>
                    </div>
                    <Button 
                      type="button" 
                      onClick={addProductRow} 
                      variant="outline" 
                      size="sm" 
                      className="gap-2 bg-green-50 hover:bg-green-100 border-green-200 text-green-700 hover:text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400"
                    >
                      <Plus className="h-4 w-4" /> Add Product
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    {jobProducts.map((row, idx) => (
                      <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                          <div className="md:col-span-8">
                            <Label htmlFor={`product-select-${idx}`} className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                              Product *
                            </Label>
                            <Select value={row.productId} onValueChange={(v)=>handleProductRowChange(idx,"productId",v)}>
                              <SelectTrigger id={`product-select-${idx}`} className="h-11">
                                <SelectValue placeholder="Choose a product..." />
                              </SelectTrigger>
                              <SelectContent>
                                {products.map((p:any)=>(
                                  <SelectItem key={p.id} value={String(p.id)}>
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                      {p.name}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="md:col-span-3">
                            <Label htmlFor={`product-qty-${idx}`} className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                              Quantity *
                            </Label>
                            <Input 
                              id={`product-qty-${idx}`} 
                              type="number" 
                              min="1" 
                              value={row.itemsQty} 
                              onChange={(e)=>handleProductRowChange(idx,"itemsQty",e.target.value)} 
                              placeholder="1" 
                              className="h-11 text-center font-medium"
                            />
                          </div>
                          
                          {jobProducts.length > 1 && (
                            <div className="md:col-span-1 flex justify-center">
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                className="h-11 w-11 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20" 
                                onClick={() => setJobProducts(prev => prev.filter((_, i) => i !== idx))}
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

                {/* Printer and Packaging Sections */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Printer Section */}
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                        <Printer className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Printer Configuration</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Select printer profile and quantity</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <Label htmlFor="printer-select" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                          Printer Profile *
                        </Label>
                        <Select value={jobPrinter.printerId} onValueChange={(v)=>handlePrinterChange("printerId",v)}>
                          <SelectTrigger id="printer-select" className="h-11">
                            <SelectValue placeholder="Choose printer profile..." />
                          </SelectTrigger>
                          <SelectContent>
                            {printers.map((pr:any)=>(
                              <SelectItem key={pr.id} value={String(pr.id)}>
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                  {pr.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="md:col-span-1">
                        <Label htmlFor="printer-qty" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                          Quantity *
                        </Label>
                        <Input 
                          id="printer-qty" 
                          type="number" 
                          min="1" 
                          value={jobPrinter.printersQty} 
                          onChange={(e)=>handlePrinterChange("printersQty",e.target.value)} 
                          placeholder="1" 
                          className="h-11 text-center font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Packaging Section */}
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                        <CreditCard className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Additional Costs</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Packaging and other expenses</p>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="packagingCostInput" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        Packaging Cost (€)
                      </Label>
                      <div className="relative">
                        <Input 
                          id="packagingCostInput" 
                          type="number" 
                          min="0" 
                          step="0.01" 
                          value={packagingCost} 
                          onChange={(e)=>setPackagingCost(e.target.value)} 
                          placeholder="0.00" 
                          className="h-11 pl-8 font-medium"
                        />
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">€</div>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Leave empty or 0 if no packaging costs</p>
                    </div>
                  </div>

                </div>

                {/* COGS Preview Section */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Calculator className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">COGS Preview</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Real-time cost calculation for this print job</p>
                    </div>
                  </div>
                  
                  {cogsPreview.isValid ? (
                    <div className="space-y-3">
                      {/* Cost Breakdown */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-gray-600 dark:text-gray-400">Materials</span>
                          </div>
                          <div className="text-lg font-semibold text-gray-900 dark:text-white">
                            €{cogsPreview.filamentCost.toFixed(2)}
                          </div>
                        </div>
                        
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                            <span className="text-gray-600 dark:text-gray-400">Printer Costs</span>
                          </div>
                          <div className="text-lg font-semibold text-gray-900 dark:text-white">
                            €{cogsPreview.printerCost.toFixed(2)}
                          </div>
                          {cogsPreview.totalPrintTime > 0 && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {cogsPreview.totalPrintTime.toFixed(1)}h total
                            </div>
                          )}
                        </div>
                        
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                            <span className="text-gray-600 dark:text-gray-400">Packaging</span>
                          </div>
                          <div className="text-lg font-semibold text-gray-900 dark:text-white">
                            €{cogsPreview.packagingCost.toFixed(2)}
                          </div>
                        </div>
                      </div>
                      
                      {/* Total COGS */}
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-2 border-blue-200 dark:border-blue-700">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-lg font-medium text-gray-700 dark:text-gray-300">Total COGS</span>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Cost of Goods Sold</p>
                          </div>
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            €{cogsPreview.totalCogs.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-gray-400 dark:text-gray-500 mb-2">
                        <Calculator className="h-8 w-8 mx-auto opacity-50" />
                      </div>
                      <p className="text-gray-500 dark:text-gray-400">
                        Add products and select a printer to see cost preview
                      </p>
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button 
                    type="submit" 
                    size="lg" 
                    className="bg-primary hover:bg-primary/90 text-white shadow-md transition-all"
                  >
                    <Plus className="mr-2 h-5 w-5" /> 
                    Add to Print Queue
                  </Button>
                </div>
                
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!canCreatePrintJob && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-amber-800 dark:text-amber-400">
                <AlertCircle className="h-5 w-5" />
                Requirements Not Met
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-amber-700 dark:text-amber-300">
                  To add items to the print queue, you need at least one product and one printer configured.
                </p>
                
                <div className="space-y-2">
                  {!hasProducts && (
                    <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                      <Package className="h-4 w-4" />
                      <span>No products available</span>
                    </div>
                  )}
                  {!hasPrinters && (
                    <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                      <Printer className="h-4 w-4" />
                      <span>No printers available</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  {!hasProducts && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={goToProducts}
                      className="text-amber-700 border-amber-300 hover:bg-amber-100 dark:text-amber-300 dark:border-amber-600 dark:hover:bg-amber-800"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Create a product now
                    </Button>
                  )}
                  {!hasPrinters && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={goToPrinters}
                      className="text-amber-700 border-amber-300 hover:bg-amber-100 dark:text-amber-300 dark:border-amber-600 dark:hover:bg-amber-800"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add a printer now
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="card-hover shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Package className="h-5 w-5 text-primary" />
              Print Queue
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {/* Placeholder - update when printJobs data is available */}
              {printJobs && printJobs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Job Name</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Printer</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Calculated COGS (€)</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {printJobs.map((job: any) => (
                      <TableRow key={job.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-medium">{job.name || `Job #${job.id.slice(0,6)}`}</TableCell>
                        <TableCell>
                          {job.products && job.products.length > 0
                            ? `${job.products.length} Product Line${job.products.length > 1 ? 's' : ''}`
                            : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {job.printers && job.printers.length > 0
                            ? `${job.printers.reduce((acc: number, pr_item: any) => acc + (pr_item.printers_qty || 0), 0)} Printer${job.printers.reduce((acc: number, pr_item: any) => acc + (pr_item.printers_qty || 0), 0) > 1 ? 's' : ''}`
                            : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {job.products ? job.products.reduce((acc: number, p_item: any) => acc + (p_item.items_qty || 0), 0) : 0}
                        </TableCell>
                        <TableCell>
                          <span
                            className="font-medium text-gray-700 dark:text-gray-300"
                            title={`Filament Costs: Sum per product line ((grams/1000 * €/kg) * items qty) + Printer Costs: Sum per printer line ((€/hr * hours each) * printers qty) + Packaging Cost: €${job.packaging_cost_eur !== undefined ? job.packaging_cost_eur.toFixed(2) : '0.00'}`}
                          >
                            €{job.calculated_cogs_eur ? job.calculated_cogs_eur.toFixed(2) : 'N/A'}
                          </span>
                        </TableCell>
                        <TableCell>{new Date(job.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            {/* Info/Details Button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              onClick={() => setSelectedJobForDetails(job)}
                              title="View job details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            
                            {/* Edit Button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-amber-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                              onClick={() => populateEditForm(job)}
                              title="Edit job"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            
                            {/* Delete Button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() => setJobToDelete(job)}
                              title="Delete job"
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
                <div className="text-center text-muted-foreground py-12 bg-muted/30">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" /> {/* Changed icon */}
                  <p>No items in print queue yet.</p>
                  <p className="text-sm mt-1">Click on "Create New Print Queue Entry" above to add your first item.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Job Details Modal */}
      <Dialog open={!!selectedJobForDetails} onOpenChange={() => setSelectedJobForDetails(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              Job Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedJobForDetails && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Job Name</label>
                  <p className="text-lg font-semibold">{selectedJobForDetails.name || `Job #${selectedJobForDetails.id?.slice(0,6)}`}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
                  <p className="text-lg font-semibold capitalize">{selectedJobForDetails.status}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</label>
                  <p className="text-lg">{new Date(selectedJobForDetails.created_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Total COGS</label>
                  <p className="text-lg font-bold text-blue-600">€{selectedJobForDetails.calculated_cogs_eur?.toFixed(2) || 'N/A'}</p>
                </div>
              </div>

              {/* Products Section */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Package className="h-5 w-5 text-green-600" />
                  Products
                </h3>
                <div className="space-y-2">
                  {selectedJobForDetails.products?.map((productItem: any, idx: number) => (
                    <div key={idx} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 flex justify-between items-center">
                      <div>
                        <p className="font-medium">{productItem.product?.name || `Product ID: ${productItem.product_id}`}</p>
                        <p className="text-sm text-gray-500">Quantity: {productItem.items_qty}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Printers Section */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Printer className="h-5 w-5 text-purple-600" />
                  Printers
                </h3>
                <div className="space-y-2">
                  {selectedJobForDetails.printers?.map((printerItem: any, idx: number) => (
                    <div key={idx} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 flex justify-between items-center">
                      <div>
                        <p className="font-medium">{printerItem.printer_profile?.name || `Printer ID: ${printerItem.printer_profile_id}`}</p>
                        <p className="text-sm text-gray-500">Quantity: {printerItem.printers_qty}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Additional Costs */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-orange-600" />
                  Additional Costs
                </h3>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-sm text-gray-500">Packaging Cost</p>
                  <p className="text-lg font-semibold">€{selectedJobForDetails.packaging_cost_eur?.toFixed(2) || '0.00'}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Job Modal */}
      <Dialog open={!!selectedJobForEdit} onOpenChange={() => setSelectedJobForEdit(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <Edit className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              Edit Job
            </DialogTitle>
          </DialogHeader>
          
          {selectedJobForEdit && (
            <form onSubmit={handleUpdatePrintJob} className="space-y-6 mt-6">
              
              {/* Products Section */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <Package className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Products</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Select products and quantities for this print job</p>
                    </div>
                  </div>
                  <Button 
                    type="button" 
                    onClick={addEditProductRow} 
                    variant="outline" 
                    size="sm" 
                    className="gap-2 bg-green-50 hover:bg-green-100 border-green-200 text-green-700 hover:text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400"
                  >
                    <Plus className="h-4 w-4" /> Add Product
                  </Button>
                </div>
                
                <div className="space-y-4">
                  {editJobProducts.map((row, idx) => (
                    <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-8">
                          <Label htmlFor={`edit-product-select-${idx}`} className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                            Product *
                          </Label>
                          <Select value={row.productId} onValueChange={(v)=>handleEditProductRowChange(idx,"productId",v)}>
                            <SelectTrigger id={`edit-product-select-${idx}`} className="h-11">
                              <SelectValue placeholder="Choose a product..." />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map((p:any)=>(
                                <SelectItem key={p.id} value={String(p.id)}>
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                    {p.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="md:col-span-3">
                          <Label htmlFor={`edit-product-qty-${idx}`} className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                            Quantity *
                          </Label>
                          <Input 
                            id={`edit-product-qty-${idx}`} 
                            type="number" 
                            min="1" 
                            value={row.itemsQty} 
                            onChange={(e)=>handleEditProductRowChange(idx,"itemsQty",e.target.value)} 
                            placeholder="1" 
                            className="h-11 text-center font-medium"
                          />
                        </div>
                        
                        {editJobProducts.length > 1 && (
                          <div className="md:col-span-1 flex justify-center">
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="h-11 w-11 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20" 
                              onClick={() => setEditJobProducts(prev => prev.filter((_, i) => i !== idx))}
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

              {/* Printer and Packaging Sections */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Printer Section */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <Printer className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Printer Configuration</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Select printer profile and quantity</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <Label htmlFor="edit-printer-select" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        Printer Profile *
                      </Label>
                      <Select value={editJobPrinter.printerId} onValueChange={(v)=>handleEditPrinterChange("printerId",v)}>
                        <SelectTrigger id="edit-printer-select" className="h-11">
                          <SelectValue placeholder="Choose printer profile..." />
                        </SelectTrigger>
                        <SelectContent>
                          {printers.map((pr:any)=>(
                            <SelectItem key={pr.id} value={String(pr.id)}>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                {pr.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="md:col-span-1">
                      <Label htmlFor="edit-printer-qty" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        Quantity *
                      </Label>
                      <Input 
                        id="edit-printer-qty" 
                        type="number" 
                        min="1" 
                        value={editJobPrinter.printersQty} 
                        onChange={(e)=>handleEditPrinterChange("printersQty",e.target.value)} 
                        placeholder="1" 
                        className="h-11 text-center font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Packaging Section */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                      <CreditCard className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Additional Costs</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Packaging and other expenses</p>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="edit-packagingCostInput" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Packaging Cost (€)
                    </Label>
                    <div className="relative">
                      <Input 
                        id="edit-packagingCostInput" 
                        type="number" 
                        min="0" 
                        step="0.01" 
                        value={editPackagingCost} 
                        onChange={(e)=>setEditPackagingCost(e.target.value)} 
                        placeholder="0.00" 
                        className="h-11 pl-8 font-medium"
                      />
                      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">€</div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Leave empty or 0 if no packaging costs</p>
                  </div>
                </div>

              </div>

              {/* COGS Preview Section */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Calculator className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">COGS Preview</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Real-time cost calculation for this print job</p>
                  </div>
                </div>
                
                {editCogsPreview.isValid ? (
                  <div className="space-y-3">
                    {/* Cost Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-gray-600 dark:text-gray-400">Materials</span>
                        </div>
                        <div className="text-lg font-semibold text-gray-900 dark:text-white">
                          €{editCogsPreview.filamentCost.toFixed(2)}
                        </div>
                      </div>
                      
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                          <span className="text-gray-600 dark:text-gray-400">Printer Costs</span>
                        </div>
                        <div className="text-lg font-semibold text-gray-900 dark:text-white">
                          €{editCogsPreview.printerCost.toFixed(2)}
                        </div>
                        {editCogsPreview.totalPrintTime > 0 && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {editCogsPreview.totalPrintTime.toFixed(1)}h total
                          </div>
                        )}
                      </div>
                      
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                          <span className="text-gray-600 dark:text-gray-400">Packaging</span>
                        </div>
                        <div className="text-lg font-semibold text-gray-900 dark:text-white">
                          €{editCogsPreview.packagingCost.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    
                    {/* Total COGS */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-2 border-blue-200 dark:border-blue-700">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-lg font-medium text-gray-700 dark:text-gray-300">Total COGS</span>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Cost of Goods Sold</p>
                        </div>
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          €{editCogsPreview.totalCogs.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-gray-400 dark:text-gray-500 mb-2">
                      <Calculator className="h-8 w-8 mx-auto opacity-50" />
                    </div>
                    <p className="text-gray-500 dark:text-gray-400">
                      Add products and select a printer to see cost preview
                    </p>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setSelectedJobForEdit(null)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  size="lg" 
                  className="bg-primary hover:bg-primary/90 text-white shadow-md transition-all"
                >
                  <Edit className="mr-2 h-5 w-5" /> 
                  Update Job
                </Button>
              </div>
              
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!jobToDelete} onOpenChange={() => setJobToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Delete Print Job
            </DialogTitle>
          </DialogHeader>
          
          {jobToDelete && (
            <div className="space-y-4">
              <p className="text-gray-600 dark:text-gray-400">
                Are you sure you want to delete <span className="font-semibold">"{jobToDelete.name || `Job #${jobToDelete.id?.slice(0,6)}`}"</span>?
              </p>
              <p className="text-sm text-red-600 dark:text-red-400">
                This action cannot be undone.
              </p>
              
              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setJobToDelete(null)}
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => {
                    deletePrintJob(jobToDelete.id);
                    setJobToDelete(null);
                  }}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Job
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </motion.div>
  )
} 