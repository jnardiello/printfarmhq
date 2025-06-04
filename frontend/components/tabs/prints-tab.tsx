"use client"

import type React from "react"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useData } from "@/components/data-provider" // Placeholder - will need to update useData
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Trash2, Plus, Printer, Package, ScanLine, AlertCircle, ExternalLink, CreditCard, Calculator, Info, Edit, Eye, Play, Square, StopCircle, Settings } from "lucide-react"
import { motion } from "framer-motion"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SortableTableHeader, StaticTableHeader } from "@/components/ui/sortable-table-header"
import { getSortConfig, updateSortConfig, sortByDate, SortDirection, SortConfig } from "@/lib/sorting-utils";
import { api } from "@/lib/api";
import { PrinterTypeSelect } from "@/components/printer-type-select";


export function PrintsTab() {
  // Placeholder - will need to update useData and related functions/state
  const { products, printers, printerTypes, printJobs, addPrintJob, deletePrintJob, updatePrintJob } = useData()
  const router = useRouter()
  
  // State for tracking current time for countdown
  const [currentTime, setCurrentTime] = useState(new Date())


  // State for print job form - removed since we're using separate states for products and printers

  const [jobProducts, setJobProducts] = useState([{ productId: "", itemsQty: "1" }]);
  const [jobPrinter, setJobPrinter] = useState({ printerTypeId: "" });
  const [packagingCost, setPackagingCost] = useState("0");
  const [isAddJobModalOpen, setIsAddJobModalOpen] = useState(false);
  const [selectedJobForDetails, setSelectedJobForDetails] = useState<any>(null);
  const [selectedJobForEdit, setSelectedJobForEdit] = useState<any>(null);
  const [jobToDelete, setJobToDelete] = useState<any>(null);
  
  // Modal states for errors and confirmations
  const [errorModal, setErrorModal] = useState({ isOpen: false, title: '', message: '' });
  const [confirmStopModal, setConfirmStopModal] = useState({ isOpen: false, jobId: '' });
  const [printerSelectionModal, setPrinterSelectionModal] = useState<{
    isOpen: boolean;
    jobId: string;
    printerTypeId: number | null;
    requiredCount: number;
  }>({ isOpen: false, jobId: '', printerTypeId: null, requiredCount: 1 });
  const [selectedPrinters, setSelectedPrinters] = useState<number[]>([]);
  
  // Edit form states (separate from add form)
  const [editJobProducts, setEditJobProducts] = useState([{ productId: "", itemsQty: "1" }]);
  const [editJobPrinter, setEditJobPrinter] = useState({ printerTypeId: "" });
  const [editPackagingCost, setEditPackagingCost] = useState("0");

  // Sorting state for print jobs table
  const [sortConfig, setSortConfig] = useState<SortConfig>(() => 
    getSortConfig('print-queue', 'created_at', 'desc')
  );

  // Handle sort changes with persistence
  const handleSort = (field: string, direction: SortDirection) => {
    const newConfig = updateSortConfig('print-queue', field, sortConfig.direction);
    setSortConfig(newConfig);
  };

  // Sorted print jobs based on current sort configuration (only pending jobs for the queue)
  const sortedPrintJobs = useMemo(() => {
    if (!printJobs || printJobs.length === 0) return [];
    // Filter to only show pending jobs in the queue table
    const pendingJobs = printJobs.filter((job: any) => job.status === "pending");
    return sortByDate(pendingJobs, sortConfig.field, sortConfig.direction);
  }, [printJobs, sortConfig]);

  // Update current time every second for countdown timers
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    
    return () => clearInterval(timer)
  }, [])


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
      printerTypeId: String(job.printers[0].printer_type_id || job.printers[0].printer_profile_id)
    } : { printerTypeId: "" };
    
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
      
      // Add print time from product
      const printTime = product.print_time_hrs || 0;
      totalPrintTime += printTime * itemsQty;
    }

    // 2. Calculate printer costs (estimate based on average printer price)
    if (jobPrinter.printerTypeId && totalPrintTime > 0) {
      const printerType = printerTypes?.find(pt => pt.id === parseInt(jobPrinter.printerTypeId));
      if (printerType && printers) {
        // Get all printers of this type
        const printersOfType = printers.filter(p => p.printer_type_id === printerType.id);
        
        if (printersOfType.length > 0) {
          // Calculate average price of printers of this type
          const avgPrice = printersOfType.reduce((sum, p) => sum + p.purchase_price_eur, 0) / printersOfType.length;
          const hourlyRate = avgPrice / printerType.expected_life_hours;
          printerCost = hourlyRate * totalPrintTime;
        } else {
          // No printers of this type exist yet
          printerCost = 0;
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
  }, [jobProducts, jobPrinter, packagingCost, products, printerTypes]);

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
      
      // Add print time from product
      const printTime = product.print_time_hrs || 0;
      totalPrintTime += printTime * itemsQty;
    }

    // 2. Calculate printer costs (estimate based on average printer price)
    if (editJobPrinter.printerTypeId && totalPrintTime > 0) {
      const printerType = printerTypes?.find(pt => pt.id === parseInt(editJobPrinter.printerTypeId));
      if (printerType && printers) {
        // Get all printers of this type
        const printersOfType = printers.filter(p => p.printer_type_id === printerType.id);
        
        if (printersOfType.length > 0) {
          // Calculate average price of printers of this type
          const avgPrice = printersOfType.reduce((sum, p) => sum + p.purchase_price_eur, 0) / printersOfType.length;
          const hourlyRate = avgPrice / printerType.expected_life_hours;
          printerCost = hourlyRate * totalPrintTime;
        } else {
          // No printers of this type exist yet
          printerCost = 0;
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
  }, [editJobProducts, editJobPrinter, editPackagingCost, products, printerTypes]);

  const handleAddPrintJob = async (e: React.FormEvent) => {
    e.preventDefault()

    if (jobProducts.some(p=> !p.productId) || !jobPrinter.printerTypeId) {
      setErrorModal({
        isOpen: true,
        title: 'Incomplete Form',
        message: 'Please select all products and the printer.'
      });
      return;
    }
    await addPrintJob({
      products: jobProducts.map(p=>({ product_id: Number(p.productId), items_qty: Number(p.itemsQty) })),
      printers: [{ printer_type_id: Number(jobPrinter.printerTypeId) }],
      packaging_cost_eur: Number(packagingCost),
      status: "pending",
    });
    setJobProducts([{ productId:"", itemsQty:"1" }]);
    setJobPrinter({ printerTypeId:"" });
    setPackagingCost("0");
    setIsAddJobModalOpen(false); // Close modal after successful submission
  }

  const handleUpdatePrintJob = async (e: React.FormEvent) => {
    e.preventDefault()

    if (editJobProducts.some(p=> !p.productId) || !editJobPrinter.printerTypeId) {
      setErrorModal({
        isOpen: true,
        title: 'Incomplete Form',
        message: 'Please select all products and the printer.'
      });
      return;
    }
    
    if (!selectedJobForEdit) {
      setErrorModal({
        isOpen: true,
        title: 'No Job Selected',
        message: 'No job selected for editing.'
      });
      return;
    }

    try {
      // Debug: Log the data being sent
      const updateData = {
        name: selectedJobForEdit.name, // Include the original name
        products: editJobProducts.map(p=>({ product_id: Number(p.productId), items_qty: Number(p.itemsQty) })),
        printers: [{ printer_type_id: Number(editJobPrinter.printerTypeId) }],
        packaging_cost_eur: Number(editPackagingCost),
        status: selectedJobForEdit.status || "pending",
      };
      
      console.log("Updating print job with ID:", selectedJobForEdit.id);
      console.log("Update data:", updateData);
      
      await updatePrintJob(selectedJobForEdit.id, updateData);
      
      // Reset edit form
      setEditJobProducts([{ productId:"", itemsQty:"1" }]);
      setEditJobPrinter({ printerTypeId:"" });
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

  // Calculate progress percentage for a printing job
  const calculateProgress = useCallback((job: any) => {
    if (!job.started_at || !job.estimated_completion_at) return 0
    
    // Parse timestamps - they come from backend as UTC strings
    // Ensure we're treating them as UTC by appending 'Z' if not present
    const startTimeStr = job.started_at.endsWith('Z') ? job.started_at : job.started_at + 'Z'
    const endTimeStr = job.estimated_completion_at.endsWith('Z') ? job.estimated_completion_at : job.estimated_completion_at + 'Z'
    
    const startTime = new Date(startTimeStr).getTime()
    const endTime = new Date(endTimeStr).getTime()
    const now = Date.now() // Use Date.now() for consistency
    
    const totalDuration = endTime - startTime
    const elapsed = now - startTime
    
    // Debug logging
    console.log('Progress calculation:', {
      jobId: job.id,
      started_at: job.started_at,
      estimated_completion_at: job.estimated_completion_at,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      now: new Date(now).toISOString(),
      nowLocal: new Date(now).toString(),
      totalDurationMinutes: totalDuration / 1000 / 60,
      elapsedMinutes: elapsed / 1000 / 60,
      elapsedSeconds: elapsed / 1000,
      progress: Math.round((elapsed / totalDuration) * 100)
    })
    
    // Ensure we don't go over 100% or under 0%
    const progress = Math.max(0, Math.min(100, Math.round((elapsed / totalDuration) * 100)))
    
    return progress
  }, [currentTime])

  // Format remaining time for display
  const formatRemainingTime = useCallback((job: any) => {
    if (!job.estimated_completion_at) return 'Unknown'
    
    // Ensure we're treating the timestamp as UTC
    const endTimeStr = job.estimated_completion_at.endsWith('Z') ? job.estimated_completion_at : job.estimated_completion_at + 'Z'
    const endTime = new Date(endTimeStr).getTime()
    const now = Date.now()
    const remaining = endTime - now
    
    if (remaining <= 0) {
      // Mark job as completed in UI when time is up
      if (job.status === 'printing') {
        console.log(`Job ${job.id} has completed - time remaining: ${remaining}ms`)
      }
      return 'Completed'
    }
    
    const hours = Math.floor(remaining / (1000 * 60 * 60))
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000)
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    } else {
      return `${seconds}s`
    }
  }, [currentTime])

  // Handle starting a print job - first show printer selection modal
  const handleStartJob = async (jobId: string) => {
    // Find the job to get printer type info
    const job = printJobs?.find((j: any) => j.id === jobId);
    if (!job || !job.printers || job.printers.length === 0) {
      setErrorModal({
        isOpen: true,
        title: 'Invalid Job',
        message: 'Job data not found or no printers specified'
      });
      return;
    }

    // Get the first printer requirement (assuming single printer type per job for now)
    const printerReq = job.printers[0];
    
    // Open printer selection modal
    setPrinterSelectionModal({
      isOpen: true,
      jobId: jobId,
      printerTypeId: printerReq.printer_type_id,
      requiredCount: printerReq.printers_qty || 1
    });
    setSelectedPrinters([]);
  }

  // Handle confirming printer selection and starting the job
  const handleConfirmPrinterSelection = async () => {
    const { jobId } = printerSelectionModal;
    
    if (selectedPrinters.length !== 1) {
      setErrorModal({
        isOpen: true,
        title: 'Invalid Selection',
        message: 'Please select exactly one printer'
      });
      return;
    }

    try {
      await api(`/print_jobs/${jobId}/start`, {
        method: 'PUT',
        body: JSON.stringify({ printer_id: selectedPrinters[0] })
      });

      // Close modal and refresh
      setPrinterSelectionModal({ isOpen: false, jobId: '', printerTypeId: null, requiredCount: 1 });
      setSelectedPrinters([]);
      
      // Refresh the print jobs data
      window.location.reload(); // Temporary solution
    } catch (error: any) {
      console.error('Error starting print job:', error);
      setPrinterSelectionModal({ isOpen: false, jobId: '', printerTypeId: null, requiredCount: 1 });
      
      if (error.message && error.message.includes('currently in use')) {
        setErrorModal({
          isOpen: true,
          title: 'Printer In Use',
          message: error.message
        });
      } else {
        setErrorModal({
          isOpen: true,
          title: 'Failed to Start Print Job',
          message: error.message || 'Unknown error occurred'
        });
      }
    }
  }

  // Handle stopping a print job
  const handleStopJob = async (jobId: string) => {
    setConfirmStopModal({ isOpen: true, jobId });
  }

  // Confirm and execute stop job
  const confirmStopJob = async () => {
    const jobId = confirmStopModal.jobId;
    setConfirmStopModal({ isOpen: false, jobId: '' });
    
    try {
      await api(`/print_jobs/${jobId}/stop`, {
        method: 'PUT',
      });

      // Refresh the print jobs data
      window.location.reload(); // Temporary solution
    } catch (error: any) {
      console.error('Error stopping print job:', error);
      setErrorModal({
        isOpen: true,
        title: 'Failed to Stop Print Job',
        message: error.message || 'Unknown error occurred'
      });
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Print Jobs</h1>
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
                Create New Print Job
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-2xl">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                    <ScanLine className="h-6 w-6 text-white" />
                  </div>
                  Create New Print Job
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
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Printer Type</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Select the printer type for this job</p>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="printer-type-select" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        Printer Type *
                      </Label>
                      <PrinterTypeSelect
                        value={jobPrinter.printerTypeId}
                        onValueChange={(value) => {
                          handlePrinterChange("printerTypeId", value.toString());
                        }}
                        printerTypes={printerTypes}
                        required
                      />
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
                    Create Print Job
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
                  To create print jobs, you need at least one product and one printer configured.
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

      {/* Currently Printing Section */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="card-hover shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Printer className="h-5 w-5 text-green-600 animate-pulse" />
              Printer Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {printers && printers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {printers.map((printer) => {
                  // Find any active print job for this printer
                  const activeJob = printJobs?.find((job: any) => 
                    job.status === "printing" && 
                    job.printers?.some((p: any) => p.assigned_printer_id === printer.id)
                  )
                  
                  return (
                    <div 
                      key={printer.id} 
                      className={`rounded-lg p-4 border-2 transition-all ${
                        activeJob 
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' 
                          : 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      {/* Printer Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-base flex items-center gap-2">
                            <Settings className={`h-4 w-4 ${activeJob ? 'text-green-600' : 'text-gray-500'}`} />
                            {printer.name}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {printer.manufacturer} {printer.model}
                          </p>
                        </div>
                        <div className={`px-2 py-1 rounded text-xs font-medium ${
                          activeJob 
                            ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' 
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                        }`}>
                          {activeJob ? 'PRINTING' : 'IDLE'}
                        </div>
                      </div>
                      
                      {/* Printer Content */}
                      {activeJob ? (
                        <div className="space-y-3">
                          {/* Job Info */}
                          <div>
                            <p className="text-sm font-medium mb-1">
                              {activeJob.name || `Job #${activeJob.id.slice(0,6)}`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {activeJob.products?.reduce((acc: number, p: any) => acc + (p.items_qty || 0), 0) || 0} items
                            </p>
                          </div>
                          
                          {/* Progress Bar */}
                          <div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                              <div 
                                className="bg-green-600 h-1.5 rounded-full transition-all duration-1000" 
                                style={{ width: `${calculateProgress(activeJob)}%` }}
                              ></div>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                              <p className="text-xs text-muted-foreground">{calculateProgress(activeJob)}%</p>
                              <p className="text-xs font-medium text-green-600 dark:text-green-400">
                                {formatRemainingTime(activeJob)}
                              </p>
                            </div>
                          </div>
                          
                          {/* Stop Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full bg-gradient-to-r from-red-50 to-pink-50 hover:from-red-100 hover:to-pink-100 dark:from-red-900/30 dark:to-pink-900/30 dark:hover:from-red-900/50 dark:hover:to-pink-900/50 text-red-600 dark:text-red-400 border-red-300 dark:border-red-700"
                            onClick={() => handleStopJob(activeJob.id)}
                          >
                            <StopCircle className="h-3.5 w-3.5 mr-1.5" />
                            Stop
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-2">
                            <Settings className="h-6 w-6" />
                          </div>
                          <p className="text-sm">Idle</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Ready for printing
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8 bg-muted/30 rounded-lg">
                <Printer className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                <p>No printers configured</p>
                <p className="text-sm mt-1">Add a printer to start tracking print jobs</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Job Queue Section */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="card-hover shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Package className="h-5 w-5 text-primary" />
              Job Queue (Pending)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {/* Placeholder - update when printJobs data is available */}
              {sortedPrintJobs && sortedPrintJobs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <StaticTableHeader label="Job Name" />
                      <StaticTableHeader label="Product" />
                      <StaticTableHeader label="Printer" />
                      <StaticTableHeader label="Quantity" />
                      <StaticTableHeader label="Calculated COGS (€)" />
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
                    {sortedPrintJobs.map((job: any) => (
                      <TableRow key={job.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-medium">{job.name || `Job #${job.id.slice(0,6)}`}</TableCell>
                        <TableCell>
                          {job.products && job.products.length > 0
                            ? job.products.map((p: any) => p.product?.name || 'Unknown').join(', ')
                            : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {job.printers && job.printers.length > 0
                            ? job.printers.map((p: any) => p.printer_name || 'Unknown').join(', ')
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
                            {/* Start Button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-green-500 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                              onClick={() => handleStartJob(job.id)}
                              title="Start print job"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                            
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
                  <p>No print jobs yet.</p>
                  <p className="text-sm mt-1">Click on "Create New Print Job" above to add your first item.</p>
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
                  Products ({selectedJobForDetails.products?.length || 0})
                </h3>
                <div className="space-y-2">
                  {selectedJobForDetails.products?.map((productItem: any, idx: number) => {
                    const productName = productItem.product?.name || 'Unknown Product';
                    const productCop = productItem.product?.cop || 0;
                    const totalCost = productCop * productItem.items_qty;
                    
                    return (
                      <div key={idx} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium text-lg">{productName}</p>
                            {productItem.product?.sku && (
                              <p className="text-sm text-gray-500 dark:text-gray-400">SKU: {productItem.product.sku}</p>
                            )}
                            <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Quantity:</span>
                                <span className="ml-2 font-medium">{productItem.items_qty}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Print Time:</span>
                                <span className="ml-2 font-medium">{(productItem.product?.print_time_hrs || 0).toFixed(1)}h each</span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">COP/unit:</span>
                                <span className="ml-2 font-medium">€{productCop.toFixed(2)}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Total Cost:</span>
                                <span className="ml-2 font-medium text-green-600">€{totalCost.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Printers Section */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Printer className="h-5 w-5 text-purple-600" />
                  Printers
                </h3>
                <div className="space-y-2">
                  {selectedJobForDetails.printers?.map((printerItem: any, idx: number) => {
                    const printerName = printerItem.printer_name || 'Unknown Printer';
                    const workingHours = printerItem.working_hours || 0;
                    const expectedLife = printerItem.printer_expected_life_hours || 0;
                    const lifeLeftHours = Math.max(0, expectedLife - workingHours);
                    const lifePercentage = expectedLife > 0 ? (lifeLeftHours / expectedLife) * 100 : 0;
                    const hourlyRate = printerItem.printer_price_eur && expectedLife > 0 
                      ? printerItem.printer_price_eur / expectedLife 
                      : 0;
                    const totalCost = hourlyRate * printerItem.hours_each * printerItem.printers_qty;
                    
                    return (
                      <div key={idx} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium text-lg">{printerName}</p>
                            {printerItem.printer_manufacturer && printerItem.printer_model && (
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {printerItem.printer_manufacturer} {printerItem.printer_model}
                              </p>
                            )}
                            <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Quantity:</span>
                                <span className="ml-2 font-medium">{printerItem.printers_qty}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Hours/printer:</span>
                                <span className="ml-2 font-medium">{printerItem.hours_each?.toFixed(1) || '0.0'}h</span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Cost/hour:</span>
                                <span className="ml-2 font-medium">€{hourlyRate.toFixed(3)}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Total Cost:</span>
                                <span className="ml-2 font-medium text-purple-600">€{totalCost.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cost Breakdown */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-orange-600" />
                  Cost Breakdown
                </h3>
                <div className="space-y-2">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Products Cost (COP):</span>
                        <span className="font-medium">
                          €{selectedJobForDetails.products?.reduce((acc: number, p: any) => 
                            acc + ((p.product?.cop || 0) * p.items_qty), 0
                          ).toFixed(2) || '0.00'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Printer Usage Cost:</span>
                        <span className="font-medium">
                          €{selectedJobForDetails.printers?.reduce((acc: number, pr: any) => {
                            const hourlyRate = pr.printer_price_eur && pr.printer_expected_life_hours > 0 
                              ? pr.printer_price_eur / pr.printer_expected_life_hours 
                              : 0;
                            return acc + (hourlyRate * pr.hours_each * pr.printers_qty);
                          }, 0).toFixed(2) || '0.00'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Packaging Cost:</span>
                        <span className="font-medium">€{selectedJobForDetails.packaging_cost_eur?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="border-t pt-3 flex justify-between items-center">
                        <span className="font-medium">Total COGS:</span>
                        <span className="text-lg font-bold text-blue-600">
                          €{selectedJobForDetails.calculated_cogs_eur?.toFixed(2) || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
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
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Printer Type</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Select the printer type for this job</p>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="edit-printer-type-select" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Printer Type *
                    </Label>
                    <PrinterTypeSelect
                      value={editJobPrinter.printerTypeId}
                      onValueChange={(value) => {
                        handleEditPrinterChange("printerTypeId", value.toString());
                      }}
                      printerTypes={printerTypes}
                      required
                    />
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

      {/* Error Modal */}
      <Dialog open={errorModal.isOpen} onOpenChange={(isOpen) => setErrorModal({ ...errorModal, isOpen })}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              {errorModal.title}
            </DialogTitle>
            <DialogDescription className="pt-2">
              {errorModal.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setErrorModal({ isOpen: false, title: '', message: '' })}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Stop Modal */}
      <Dialog open={confirmStopModal.isOpen} onOpenChange={(isOpen) => setConfirmStopModal({ ...confirmStopModal, isOpen })}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StopCircle className="h-5 w-5 text-red-500" />
              Stop Print Job?
            </DialogTitle>
            <DialogDescription className="pt-2">
              Are you sure you want to stop this print job? It will be moved back to the queue and the printer will become available.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setConfirmStopModal({ isOpen: false, jobId: '' })}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmStopJob}>
              Stop Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Printer Selection Modal */}
      <Dialog 
        open={printerSelectionModal.isOpen} 
        onOpenChange={(open) => {
          if (!open) {
            setPrinterSelectionModal({ isOpen: false, jobId: '', printerTypeId: null, requiredCount: 1 });
            setSelectedPrinters([]);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                <Printer className="h-6 w-6 text-white" />
              </div>
              Select Printer
            </DialogTitle>
            <DialogDescription>
              Select a printer for this job
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {(() => {
              // Filter printers by type and availability
              const availablePrinters = printers?.filter((printer: any) => 
                printer.printer_type_id === printerSelectionModal.printerTypeId && 
                printer.status === 'idle'
              ) || [];

              if (availablePrinters.length === 0) {
                return (
                  <div className="text-center py-8 text-muted-foreground">
                    <Printer className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-lg font-medium">No Available Printers</p>
                    <p className="text-sm mt-1">
                      All printers of this type are currently in use or offline.
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid gap-3">
                  {availablePrinters.map((printer: any) => (
                    <div
                      key={printer.id}
                      className={`
                        p-4 rounded-lg border-2 cursor-pointer transition-all
                        ${selectedPrinters.includes(printer.id) 
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }
                      `}
                      onClick={() => {
                        // Single selection only
                        setSelectedPrinters([printer.id]);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-lg">{printer.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {printer.printer_type?.brand} {printer.printer_type?.model}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="text-muted-foreground">
                              Working hours: {printer.working_hours?.toFixed(1) || 0}h
                            </span>
                            <span className="text-muted-foreground">
                              Life left: {printer.life_percentage?.toFixed(0) || 0}%
                            </span>
                          </div>
                        </div>
                        {selectedPrinters.includes(printer.id) && (
                          <div className="flex items-center justify-center w-8 h-8 bg-blue-500 rounded-full">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setPrinterSelectionModal({ isOpen: false, jobId: '', printerTypeId: null, requiredCount: 1 });
                setSelectedPrinters([]);
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmPrinterSelection}
              disabled={selectedPrinters.length !== 1}
            >
              Start Print Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </motion.div>
  )
} 