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
import { Pencil, Trash2, Download, Eye, AlertTriangle, RefreshCw, CreditCard, Package, Plus, DollarSign, Calendar } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { formatDate, calculateTotalSpent } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { FilamentStats } from "@/components/filament-stats"
import { FilamentSelect } from "@/components/filament-select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertCircle } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { api } from "@/lib/api"

export function FilamentsTab() {
  const {
    filaments,
    purchases,
    loadingFilaments,
    deleteFilament,
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
  const [page, setPage] = useState(1)
  const pageSize = 10

  const [selectedFilamentId, setSelectedFilamentId] = useState<string>("")
  const [purchaseToDelete, setPurchaseToDelete] = useState<any>(null)
  const [filamentToDelete, setFilamentToDelete] = useState<any>(null)
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

  const handleDeleteFilament = async () => {
    if (filamentToDelete) {
      await deleteFilament(filamentToDelete.id)
      setFilamentToDelete(null)
    }
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

  const paginatedPurchases = purchases.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = Math.max(1, Math.ceil(purchases.length / pageSize))
  const totalSpent = calculateTotalSpent(purchases)

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

      {/* Filament Purchases Card with Modal */}
      <Card className="card-hover shadow-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl">
            <CreditCard className="h-5 w-5 text-primary" />
            Filament Purchases
          </CardTitle>
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
        </CardHeader>

        <CardContent>
          {purchases.length > 0 ? (
            <>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Color</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead>Qty (kg)</TableHead>
                      <TableHead>€/kg</TableHead>
                      <TableHead>Total €</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-center w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPurchases.map((purchase) => (
                      <TableRow key={purchase.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full border border-gray-300"
                              style={{
                                backgroundColor: purchase.filament.color.toLowerCase(),
                                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)",
                              }}
                            ></div>
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
                        <TableCell>{formatDate(purchase.purchase_date)}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                    title="View details"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-white dark:bg-gray-800 p-4 shadow-xl border rounded-lg max-w-xs">
                                  <div className="text-start space-y-2">
                                    <div>
                                      <span className="font-semibold text-gray-700 dark:text-gray-300">Channel:</span>{" "}
                                      <span className="text-gray-600 dark:text-gray-400">
                                        {purchase.channel || "n/a"}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="font-semibold text-gray-700 dark:text-gray-300">Notes:</span>{" "}
                                      <span className="text-gray-600 dark:text-gray-400">
                                        {purchase.notes || "—"}
                                      </span>
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    onClick={() => setPurchaseToDelete(purchase)}
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

              <div className="mt-6 flex flex-col sm:flex-row justify-between items-center">
                <div className="mb-4 sm:mb-0">
                  <Button
                    onClick={exportPurchasesCSV}
                    variant="outline"
                    className="bg-green-600 text-white hover:bg-green-700 border-green-600"
                  >
                    <Download className="mr-2 h-4 w-4" /> Export CSV
                  </Button>
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="h-9 px-4"
                  >
                    Prev
                  </Button>
                  <span className="text-sm bg-white dark:bg-gray-800 px-3 py-1.5 rounded-md border">
                    Page {page} / {totalPages}
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
            <div className="text-center text-muted-foreground py-12 bg-muted/30 rounded-lg border border-dashed">
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
                className="mx-auto text-muted-foreground/50 mb-3"
              >
                <path d="M3 3v18h18"></path>
                <path d="m19 9-5 5-4-4-3 3"></path>
              </svg>
              <p>No purchases yet.</p>
              <p className="text-sm mt-1">Click "Add Purchase" to record your first filament purchase.</p>
            </div>
          )}
        </CardContent>
      </Card>

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
                    <TableHead className="text-center w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const inventoryFilaments = filaments.filter(f => f.total_qty_kg > 0)
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
                                backgroundColor: filament.color.toLowerCase(),
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
                            className={`font-medium ${filament.min_filaments_kg !== null && filament.total_qty_kg < filament.min_filaments_kg ? "text-yellow-700 dark:text-yellow-400" : ""}`}
                          >
                            {filament.total_qty_kg.toFixed(2)}
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
                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    onClick={() => setFilamentToDelete(filament)}
                                    title="Delete filament"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Delete filament</p>
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
                          <p>No filaments in inventory</p>
                          <p className="text-sm mt-1">Add filament purchases above to track inventory.</p>
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
              Delete Filament
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              Are you sure you want to delete this filament?
            </p>
            {filamentToDelete && (
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg space-y-1 text-sm">
                <p><strong>Filament:</strong> {filamentToDelete.color} {filamentToDelete.brand} {filamentToDelete.material}</p>
                <p><strong>Current Stock:</strong> {filamentToDelete.total_qty_kg} kg</p>
              </div>
            )}
            <p className="text-sm text-red-600">
              This action cannot be undone. All associated purchase history will also be deleted.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFilamentToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteFilament}>
              Delete Filament
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}