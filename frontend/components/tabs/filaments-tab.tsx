"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useData } from "@/components/data-provider"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Pencil, Trash2, Download, Eye, AlertTriangle, RefreshCw, CreditCard, Package, Plus, DollarSign, Calendar, Clock, Search, Filter } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { formatDate, calculateTotalSpent } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { FilamentStats } from "@/components/filament-stats"
import { FilamentSelect } from "@/components/filament-select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertCircle } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { api } from "@/lib/api"
import { getColorHex } from "@/lib/constants/filaments"

export function FilamentsTab() {
  const {
    filaments,
    purchases,
    loadingFilaments,
    deleteFilament,
    clearFilamentInventory,
    updateFilament,
    addPurchase,
    deletePurchase,
    exportPurchasesCSV,
    addFilament,
    fetchFilaments,
    fetchPurchases,
  } = useData()
  
  const refreshInventory = () => {
    fetchFilaments()
    fetchPurchases()
    toast({ 
      title: "Refreshing Inventory", 
      description: "Fetching latest filament inventory data." 
    })
  }

  const [isAddPurchaseModalOpen, setIsAddPurchaseModalOpen] = useState(false)
  const [isPurchaseHistoryModalOpen, setIsPurchaseHistoryModalOpen] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 10

  const [selectedFilamentId, setSelectedFilamentId] = useState<string>("")
  const [purchaseToDelete, setPurchaseToDelete] = useState<any>(null)
  const [filamentToDelete, setFilamentToDelete] = useState<any>(null)
  
  // Search and filter states for purchase history
  const [searchQuery, setSearchQuery] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [channelFilter, setChannelFilter] = useState("all")
  const [purchaseForm, setPurchaseForm] = useState({
    quantity_kg: "",
    price_per_kg: "",
    purchase_date: new Date().toISOString().split("T")[0],
    channel: "",
    notes: "",
  })

  const handlePurchaseChange = (field: string, value: string) => {
    setPurchaseForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleEditQuantity = async (filament: any) => {
    const newQty = prompt("New quantity (kg)", filament.total_qty_kg.toString())
    if (newQty === null) return

    const qty = Number.parseFloat(newQty)
    if (isNaN(qty) || qty < 0) {
      toast({ title: "Invalid Input", description: "Quantity must be a non-negative number.", variant: "destructive" })
      return
    }

    await updateFilament(filament.id, { total_qty_kg: qty })
  }

  const handleSetMinFilaments = async (filament: any) => {
    const currentMin = filament.min_filaments_kg !== null ? filament.min_filaments_kg.toString() : "";
    const newMin = prompt("Set minimum quantity alert threshold (kg)\nLeave empty to remove threshold", currentMin)
    
    if (newMin === null) return // User cancelled

    if (newMin === "") {
      // User wants to remove the minimum threshold
      await updateFilament(filament.id, { min_filaments_kg: null })
      return
    }

    const minQty = Number.parseFloat(newMin)
    if (isNaN(minQty) || minQty < 0) {
      toast({ title: "Invalid Input", description: "Minimum quantity must be a non-negative number.", variant: "destructive" })
      return
    }

    await updateFilament(filament.id, { min_filaments_kg: minQty })
  }


  const handleAddPurchase = async (e: React.FormEvent) => {
    e.preventDefault()

    const qtyKg = parseFloat(purchaseForm.quantity_kg)
    const pricePerKg = parseFloat(purchaseForm.price_per_kg)

    if (!selectedFilamentId) {
      toast({ title: "Missing Field", description: "Please select a filament type.", variant: "destructive" })
      return
    }
    
    if (isNaN(qtyKg) || qtyKg <= 0) {
      toast({ title: "Invalid Quantity", description: "Quantity must be a positive number.", variant: "destructive" })
      return
    }
    if (isNaN(pricePerKg) || pricePerKg <= 0) {
      toast({ title: "Invalid Price", description: "Price must be a positive number with up to 2 decimals.", variant: "destructive" })
      return
    }
    try {
      await addPurchase({
        filament_id: Number(selectedFilamentId),
        quantity_kg: qtyKg,
        price_per_kg: pricePerKg,
        purchase_date: purchaseForm.purchase_date || null,
        channel: purchaseForm.channel || null,
        notes: purchaseForm.notes || null,
      })
      
      // Reset form
      setSelectedFilamentId("")
      setPurchaseForm({
        quantity_kg: "",
        price_per_kg: "",
        purchase_date: new Date().toISOString().split("T")[0],
        channel: "",
        notes: "",
      })
      setIsAddPurchaseModalOpen(false)
      
      toast({ 
        title: "Success", 
        description: "Purchase added successfully" 
      })
    } catch (error) {
      console.error("Error during add purchase process:", error)
      toast({ title: "Purchase Operation Failed", description: (error as Error).message, variant: "destructive" })
    }
  }

  const handleDeletePurchase = async () => {
    if (purchaseToDelete) {
      await deletePurchase(purchaseToDelete.id)
      setPurchaseToDelete(null)
    }
  }

  const handleDeleteFilament = async () => {
    if (filamentToDelete) {
      await clearFilamentInventory(filamentToDelete.id)
      setFilamentToDelete(null)
    }
  }

  // Filter purchases based on search and filters
  const filteredPurchases = purchases.filter(purchase => {
    // Search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase()
      const matchesSearch = 
        purchase.filament.color.toLowerCase().includes(searchLower) ||
        purchase.filament.brand.toLowerCase().includes(searchLower) ||
        purchase.filament.material.toLowerCase().includes(searchLower)
      if (!matchesSearch) return false
    }
    
    // Date filters
    if (dateFrom && purchase.purchase_date) {
      if (new Date(purchase.purchase_date) < new Date(dateFrom)) return false
    }
    if (dateTo && purchase.purchase_date) {
      if (new Date(purchase.purchase_date) > new Date(dateTo)) return false
    }
    
    // Channel filter
    if (channelFilter !== "all" && purchase.channel !== channelFilter) {
      return false
    }
    
    return true
  })

  const paginatedPurchases = filteredPurchases.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = Math.max(1, Math.ceil(filteredPurchases.length / pageSize))
  const totalSpent = calculateTotalSpent(filteredPurchases)
  const avgPricePerKg = filteredPurchases.length > 0 
    ? filteredPurchases.reduce((sum, p) => sum + p.price_per_kg, 0) / filteredPurchases.length
    : 0

  // Update page number when purchases change
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [purchases, page, totalPages])
  
  // Refresh inventory data when component mounts
  useEffect(() => {
    refreshInventory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Get low stock filaments (only those with inventory and below minimum threshold)
  const lowStockFilaments = filaments.filter((f) => (
    f.total_qty_kg > 0 && // Only consider filaments with actual inventory
    f.min_filaments_kg !== null && 
    f.min_filaments_kg !== undefined &&
    f.total_qty_kg < f.min_filaments_kg
  ))

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <FilamentStats filaments={filaments} purchases={purchases} />

      {/* Low Stock Alert */}
      {lowStockFilaments.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700">
          <CardContent className="p-4">
            <div className="flex items-start space-x-4">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-800 rounded-full">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <h3 className="font-medium text-yellow-800 dark:text-yellow-400">Low Stock Alert</h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-500 mt-1">
                  {lowStockFilaments.length} filament{lowStockFilaments.length > 1 ? "s" : ""} running low on stock
                  (below minimum threshold)
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {lowStockFilaments.map((f) => (
                    <span
                      key={f.id}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-800/50 dark:text-yellow-300"
                    >
                      {f.color} {f.material} ({f.total_qty_kg.toFixed(2)} kg / Min: {f.min_filaments_kg?.toFixed(2)} kg)
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header with action buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Filaments</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your filament inventory and purchases</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="lg" 
            onClick={() => setIsPurchaseHistoryModalOpen(true)}
            className="shadow-sm"
          >
            <Clock className="mr-2 h-5 w-5" />
            View Purchase History
          </Button>
          
          <Dialog open={isAddPurchaseModalOpen} onOpenChange={setIsAddPurchaseModalOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-white shadow-md transition-all">
                <Plus className="mr-2 h-5 w-5" />
                Add Purchase
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-2xl">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                    <CreditCard className="h-6 w-6 text-white" />
                  </div>
                  Add Filament Purchase
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleAddPurchase} className="space-y-6 mt-6">
                {/* Filament Selection Section */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Filament Details</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Select the filament type and quantity</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <Label htmlFor="purchaseFilament" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        Filament Type *
                      </Label>
                      <FilamentSelect
                        value={selectedFilamentId}
                        onValueChange={(value) => setSelectedFilamentId(value.toString())}
                        filaments={filaments}
                        placeholder="Select filament type"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="purchaseQuantity" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        Quantity (kg) *
                      </Label>
                      <Input
                        id="purchaseQuantity"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={purchaseForm.quantity_kg}
                        onChange={(e) => handlePurchaseChange("quantity_kg", e.target.value)}
                        placeholder="1.00"
                        required
                        className="h-11"
                      />
                    </div>

                    <div>
                      <Label htmlFor="purchasePrice" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        Price per kg (€) *
                      </Label>
                      <div className="relative">
                        <Input
                          id="purchasePrice"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={purchaseForm.price_per_kg}
                          onChange={(e) => handlePurchaseChange("price_per_kg", e.target.value)}
                          placeholder="25.00"
                          required
                          className="h-11 pl-8"
                        />
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">€</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Purchase Information Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Purchase Details */}
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                        <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Purchase Information</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Transaction details</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="purchaseDate" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                          Purchase Date
                        </Label>
                        <Input
                          id="purchaseDate"
                          type="date"
                          value={purchaseForm.purchase_date}
                          onChange={(e) => handlePurchaseChange("purchase_date", e.target.value)}
                          className="h-11"
                        />
                      </div>

                      <div>
                        <Label htmlFor="purchaseChannel" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                          Purchase Channel
                        </Label>
                        <Select
                          value={purchaseForm.channel}
                          onValueChange={(value) => handlePurchaseChange("channel", value)}
                        >
                          <SelectTrigger id="purchaseChannel" className="h-11">
                            <SelectValue placeholder="Select channel" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Amazon">Amazon</SelectItem>
                            <SelectItem value="Ebay">Ebay</SelectItem>
                            <SelectItem value="Website">Website</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Additional Information */}
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                        <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Additional Information</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Optional details</p>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="purchaseNotes" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        Notes
                      </Label>
                      <textarea
                        id="purchaseNotes"
                        value={purchaseForm.notes}
                        onChange={(e) => handlePurchaseChange("notes", e.target.value)}
                        placeholder="Add any relevant notes about this purchase..."
                        className="w-full h-24 px-3 py-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        e.g., supplier details, order number, special conditions
                      </p>
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
                    Add Purchase
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="card-hover shadow-md">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Package className="h-5 w-5 text-primary" />
            Filament Inventory
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refreshInventory}
            className="text-xs flex items-center gap-1"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Inventory
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {loadingFilaments ? (
              <div className="space-y-2 p-6">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Color</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Qty (kg)</TableHead>
                    <TableHead>Min (kg)</TableHead>
                    <TableHead>Avg €/kg</TableHead>
                    <TableHead className="text-center w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    // Show filaments that have current inventory OR have had purchases (even if now 0kg)
                    const inventoryFilaments = filaments.filter(f => 
                      f.total_qty_kg > 0 || purchases.some(p => p.filament.id === f.id)
                    )
                    return inventoryFilaments.length > 0 ? (
                      inventoryFilaments.map((filament) => (
                      <TableRow
                        key={filament.id}
                        className={`
                          transition-colors hover:bg-muted/50
                          ${filament.min_filaments_kg !== null && filament.total_qty_kg < filament.min_filaments_kg ? "bg-yellow-50/50 dark:bg-yellow-900/20" : ""}
                        `}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded-full border border-gray-300"
                              style={{
                                backgroundColor: getColorHex(filament.color),
                                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)",
                              }}
                            ></div>
                            {filament.color}
                          </div>
                        </TableCell>
                        <TableCell>{filament.brand}</TableCell>
                        <TableCell>{filament.material}</TableCell>
                        <TableCell>
                          <span
                            className={`font-medium ${
                              filament.total_qty_kg === 0 
                                ? "text-red-600 dark:text-red-400" 
                                : filament.min_filaments_kg !== null && filament.total_qty_kg < filament.min_filaments_kg 
                                  ? "text-yellow-700 dark:text-yellow-400" 
                                  : ""
                            }`}
                          >
                            {filament.total_qty_kg.toFixed(2)}
                            {filament.total_qty_kg === 0 && (
                              <span className="ml-1 text-xs text-red-500 dark:text-red-400">(empty)</span>
                            )}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {filament.min_filaments_kg !== null ? filament.min_filaments_kg.toFixed(2) : "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            €{filament.price_per_kg.toFixed(2)}
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
                                    onClick={() => handleEditQuantity(filament)}
                                    className="h-8 w-8 text-amber-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                                    title="Edit filament"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Edit filament quantity</p>
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleSetMinFilaments(filament)}
                                    className="h-8 w-8 text-orange-500 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                                    title="Set minimum stock"
                                  >
                                    <AlertTriangle className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Set minimum stock alert</p>
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setFilamentToDelete(filament)}
                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    title="Delete filament from inventory"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Delete filament from inventory</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        <div className="flex flex-col items-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="40"
                            height="40"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-muted-foreground/50 mb-3"
                          >
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                            <polyline points="3.29 7 12 12 20.71 7"></polyline>
                            <line x1="12" y1="22" x2="12" y2="12"></line>
                          </svg>
                          <p>No filament inventory to display</p>
                          <p className="text-sm mt-1">Add filament purchases above to start tracking inventory.</p>
                          <p className="text-xs mt-2 text-muted-foreground">Configure filament types in Administration → Filament Types</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                  })()}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Purchase History Modal */}
      <Dialog open={isPurchaseHistoryModalOpen} onOpenChange={setIsPurchaseHistoryModalOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg">
                <Clock className="h-6 w-6 text-white" />
              </div>
              Purchase History
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-6">
            {/* Summary Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total Purchases</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{filteredPurchases.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total Spent</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">€{totalSpent.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <CreditCard className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Avg Price/kg</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">€{avgPricePerKg.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-800">
                <CardContent className="p-4">
                  <Button
                    onClick={exportPurchasesCSV}
                    className="w-full h-full bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-green-600 dark:text-green-400 border-2 border-green-500 hover:border-green-600"
                  >
                    <Download className="mr-2 h-5 w-5" /> 
                    Export CSV
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Filters Section */}
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="search" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Search Filament
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="search"
                      type="text"
                      placeholder="Color, brand, or material..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value)
                        setPage(1) // Reset to first page on search
                      }}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="dateFrom" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Date From
                  </Label>
                  <Input
                    id="dateFrom"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value)
                      setPage(1)
                    }}
                  />
                </div>

                <div>
                  <Label htmlFor="dateTo" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Date To
                  </Label>
                  <Input
                    id="dateTo"
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value)
                      setPage(1)
                    }}
                  />
                </div>

                <div>
                  <Label htmlFor="channel" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Channel
                  </Label>
                  <Select value={channelFilter} onValueChange={(value) => {
                    setChannelFilter(value)
                    setPage(1)
                  }}>
                    <SelectTrigger id="channel">
                      <SelectValue placeholder="All channels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Channels</SelectItem>
                      <SelectItem value="Amazon">Amazon</SelectItem>
                      <SelectItem value="Ebay">Ebay</SelectItem>
                      <SelectItem value="Website">Website</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Clear Filters Button */}
              {(searchQuery || dateFrom || dateTo || channelFilter !== "all") && (
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("")
                      setDateFrom("")
                      setDateTo("")
                      setChannelFilter("all")
                      setPage(1)
                    }}
                    className="text-gray-600 dark:text-gray-400"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Clear Filters
                  </Button>
                </div>
              )}
            </div>

            {/* Purchase Table */}
            {filteredPurchases.length > 0 ? (
              <>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Date</TableHead>
                        <TableHead>Filament</TableHead>
                        <TableHead>Brand</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead>Quantity (kg)</TableHead>
                        <TableHead>Price €/kg</TableHead>
                        <TableHead>Total €</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedPurchases.map((purchase) => (
                        <TableRow key={purchase.id} className="hover:bg-muted/50 transition-colors">
                          <TableCell>{formatDate(purchase.purchase_date)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full border border-gray-300"
                                style={{
                                  backgroundColor: getColorHex(purchase.filament.color),
                                  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)",
                                }}
                              />
                              {purchase.filament.color}
                            </div>
                          </TableCell>
                          <TableCell>{purchase.filament.brand}</TableCell>
                          <TableCell>{purchase.filament.material}</TableCell>
                          <TableCell className="font-medium">{purchase.quantity_kg}</TableCell>
                          <TableCell>€{purchase.price_per_kg.toFixed(2)}</TableCell>
                          <TableCell className="font-medium">
                            €{(purchase.quantity_kg * purchase.price_per_kg).toFixed(2)}
                          </TableCell>
                          <TableCell>{purchase.channel || "—"}</TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                      title="View notes"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-white dark:bg-gray-800 p-4 shadow-xl border rounded-lg max-w-xs">
                                    <div className="text-start">
                                      <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Notes:</p>
                                      <p className="text-gray-600 dark:text-gray-400">
                                        {purchase.notes || "No notes"}
                                      </p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                      onClick={() => {
                                        setPurchaseToDelete(purchase)
                                        setIsPurchaseHistoryModalOpen(false)
                                      }}
                                      title="Delete purchase"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Delete purchase</p>
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

                {/* Pagination */}
                <div className="flex justify-center">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                      className="h-9 px-4"
                    >
                      Previous
                    </Button>
                    <span className="text-sm bg-white dark:bg-gray-800 px-4 py-2 rounded-md border">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages}
                      className="h-9 px-4"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <div className="text-gray-400 dark:text-gray-500 mb-4">
                  <Clock className="h-12 w-12 mx-auto opacity-50" />
                </div>
                <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
                  {searchQuery || dateFrom || dateTo || channelFilter !== "all" 
                    ? "No purchases found matching your filters"
                    : "No purchase history yet"}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {searchQuery || dateFrom || dateTo || channelFilter !== "all" 
                    ? "Try adjusting your search criteria"
                    : "Start by adding your first filament purchase"}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Purchase Confirmation Dialog */}
      <Dialog open={!!purchaseToDelete} onOpenChange={() => setPurchaseToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Delete Purchase
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              Are you sure you want to delete this purchase?
            </p>
            {purchaseToDelete && (
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg space-y-1 text-sm">
                <p><strong>Filament:</strong> {purchaseToDelete.filament?.color} {purchaseToDelete.filament?.brand} {purchaseToDelete.filament?.material}</p>
                <p><strong>Quantity:</strong> {purchaseToDelete.quantity_kg} kg</p>
                <p><strong>Price:</strong> €{purchaseToDelete.price_per_kg}/kg</p>
              </div>
            )}
            <p className="text-sm text-red-600">
              This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeletePurchase}>
              Delete Purchase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Filament Confirmation Dialog */}
      <Dialog open={!!filamentToDelete} onOpenChange={() => setFilamentToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Delete Filament from Inventory
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              Are you sure you want to delete this filament from your inventory?
            </p>
            {filamentToDelete && (
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg space-y-1 text-sm">
                <p><strong>Filament:</strong> {filamentToDelete.color} {filamentToDelete.brand} {filamentToDelete.material}</p>
                <p><strong>Current Quantity:</strong> {filamentToDelete.total_qty_kg} kg</p>
                <p><strong>Average Price:</strong> €{filamentToDelete.price_per_kg?.toFixed(2)}/kg</p>
              </div>
            )}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> This will only remove the filament from your inventory. 
                The filament type will remain available for future purchases.
              </p>
            </div>
            <p className="text-sm text-red-600">
              This action cannot be undone and will remove all purchase history for this filament.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFilamentToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteFilament}>
              Delete from Inventory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}