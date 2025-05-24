"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useData } from "@/components/data-provider"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Label } from "@/components/ui/label"
import { Pencil, Trash2, Download, ChevronDown, ChevronUp, Info, AlertTriangle, RefreshCw } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { PurchaseFormData } from "@/lib/types"
import { formatDate, calculateTotalSpent } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { FilamentStats } from "@/components/filament-stats"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
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

  const [purchasesOpen, setPurchasesOpen] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 10

  const colorOptions = ["Black", "White", "Gray", "Red", "Blue", "Green", "Yellow", "Orange", "Pink", "Purple"]

  const brandOptions = ["Bambu Lab", "Sunlu", "eSun", "Overture"]

  const materialOptions = [
    "PLA basic",
    "PLA matte",
    "PLA Silk",
    "PLA turbo/+",
    "PETG basic",
    "PETG matte",
    "ABS",
    "ASA",
    "Carbon Fiber",
    "Nylon Fiber",
  ]

  const initialPurchaseFormState: PurchaseFormData = {
    color: "",
    brand: "",
    material: "",
    quantity_kg: "",
    price_per_kg: "",
    purchase_date: new Date().toISOString().split("T")[0],
    channel: "",
    notes: "",
    colorCustom: "",
    brandCustom: "",
    materialCustom: "",
  }
  const [purchaseForm, setPurchaseForm] = useState<PurchaseFormData>(initialPurchaseFormState)

  const handlePurchaseChange = (field: keyof PurchaseFormData, value: string) => {
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

  const handleDeleteFilament = async (id: number) => {
    if (confirm(`Are you sure you want to delete filament #${id}? This action cannot be undone.`)) {
      await deleteFilament(id)
    }
  }

  const handleAddPurchase = async (e: React.FormEvent) => {
    e.preventDefault()

    const qtyKg = parseFloat(purchaseForm.quantity_kg)
    const pricePerKg = parseFloat(purchaseForm.price_per_kg)

    if (isNaN(qtyKg) || qtyKg <= 0) {
      toast({ title: "Invalid Quantity", description: "Quantity must be a positive number.", variant: "destructive" })
      return
    }
    if (isNaN(pricePerKg) || pricePerKg <= 0) {
      toast({ title: "Invalid Price", description: "Price must be a positive number with up to 2 decimals.", variant: "destructive" })
      return
    }
    if (!purchaseForm.color) {
      toast({ title: "Missing Field", description: "Please select a color.", variant: "destructive" })
      return
    }
    if (!purchaseForm.brand) {
      toast({ title: "Missing Field", description: "Please select a brand.", variant: "destructive" })
      return
    }
    if (!purchaseForm.material) {
      toast({ title: "Missing Field", description: "Please select a material.", variant: "destructive" })
      return
    }

    const colorFinal = purchaseForm.color === "Other" ? purchaseForm.colorCustom : purchaseForm.color
    const brandFinal = purchaseForm.brand === "Other" ? purchaseForm.brandCustom : purchaseForm.brand
    const materialFinal = purchaseForm.material === "Other" ? purchaseForm.materialCustom : purchaseForm.material

    if (purchaseForm.color === "Other" && !colorFinal) {
      toast({ title: "Missing Field", description: "Please enter a custom color.", variant: "destructive" })
      return
    }
    if (purchaseForm.brand === "Other" && !brandFinal) {
      toast({ title: "Missing Field", description: "Please enter a custom brand.", variant: "destructive" })
      return
    }
    if (purchaseForm.material === "Other" && !materialFinal) {
      toast({ title: "Missing Field", description: "Please enter a custom material.", variant: "destructive" })
      return
    }

    try {
      let filamentId = filaments.find(
        (f) => f.color === colorFinal && f.brand === brandFinal && f.material === materialFinal
      )?.id

      if (!filamentId) {
        toast({ title: "Creating Filament", description: `Adding new filament: ${colorFinal} ${brandFinal} ${materialFinal}` })
        const newFilament = await addFilament({
          color: colorFinal,
          brand: brandFinal,
          material: materialFinal,
        })
        if (newFilament && newFilament.id) {
          filamentId = newFilament.id
        } else {
          throw new Error("Failed to create new filament. It might already exist or an API error occurred.")
        }
      }
      
      if (!filamentId) {
        toast({ title: "Filament ID Error", description: "Could not determine filament ID for the purchase.", variant: "destructive" })
        return
      }

      await addPurchase({
        filament_id: Number(filamentId),
        quantity_kg: qtyKg,
        price_per_kg: pricePerKg,
        purchase_date: purchaseForm.purchase_date || null,
        channel: purchaseForm.channel || null,
        notes: purchaseForm.notes || null,
      })
      setPurchaseForm(initialPurchaseFormState)
      setPurchasesOpen(true)
    } catch (error) {
      console.error("Error during add purchase process:", error)
      toast({ title: "Purchase Operation Failed", description: (error as Error).message, variant: "destructive" })
    }
  }

  const handleDeletePurchase = async (id: number) => {
    if (confirm(`Are you sure you want to delete purchase #${id}?`)) {
      await deletePurchase(id)
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

  // Get low stock filaments (less than their min threshold, or less than 1kg if no threshold is set)
  const lowStockFilaments = filaments.filter((f) => 
    f.min_filaments_kg !== null && f.min_filaments_kg !== undefined
      ? f.total_qty_kg < f.min_filaments_kg
      : false // Only include filaments with a defined minimum threshold
  )

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

      <Card className="card-hover shadow-md">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xl">Filament Inventory</CardTitle>
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
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filaments.length > 0 ? (
                    filaments.map((filament) => (
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
                        <TableCell className="space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditQuantity(filament)}
                            className="h-8 w-8 text-gray-500 hover:text-primary"
                          >
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Pencil className="h-4 w-4" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  Edit filament quantity
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSetMinFilaments(filament)}
                            className="h-8 w-8 text-gray-500 hover:text-yellow-600"
                          >
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertTriangle className="h-4 w-4" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  Set minimum threshold for low stock alert
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500 hover:text-red-600"
                            onClick={() => handleDeleteFilament(filament.id)}
                          >
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Trash2 className="h-4 w-4" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  Delete filament
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
                          <p>No filaments added yet.</p>
                          <p className="text-sm mt-1">Add your first filament purchase below.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="card-hover shadow-md">
        <Collapsible open={purchasesOpen} onOpenChange={setPurchasesOpen}>
          <CollapsibleTrigger className="w-full text-left">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl">Filament Purchases</CardTitle>
              {purchasesOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="pt-6">
              <form
                onSubmit={handleAddPurchase}
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-end mb-6 p-4 bg-muted/30 rounded-lg border border-muted"
              >
                <div>
                  <Label htmlFor="purchaseColor" className="text-sm font-medium">
                    Color
                  </Label>
                  <Select
                    value={purchaseForm.color}
                    onValueChange={(value) => handlePurchaseChange("color", value)}
                    required
                  >
                    <SelectTrigger id="purchaseColor" className="bg-white dark:bg-gray-800">
                      <SelectValue placeholder="Select Color" />
                    </SelectTrigger>
                    <SelectContent>
                      {colorOptions.map((color) => (
                        <SelectItem key={`pc-${color}`} value={color}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full border border-gray-300"
                              style={{
                                backgroundColor: color.toLowerCase(),
                                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)",
                              }}
                            ></div>
                            {color}
                          </div>
                        </SelectItem>
                      ))}
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {purchaseForm.color === "Other" && (
                  <div>
                    <Label htmlFor="purchaseColorCustom" className="text-sm font-medium">
                      Custom Color
                    </Label>
                    <Input
                      id="purchaseColorCustom"
                      value={purchaseForm.colorCustom}
                      onChange={(e) => handlePurchaseChange("colorCustom", e.target.value)}
                      placeholder="Custom Color"
                      className="bg-white dark:bg-gray-800"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="purchaseBrand" className="text-sm font-medium">
                    Brand
                  </Label>
                  <Select
                    value={purchaseForm.brand}
                    onValueChange={(value) => handlePurchaseChange("brand", value)}
                    required
                  >
                    <SelectTrigger id="purchaseBrand" className="bg-white dark:bg-gray-800">
                      <SelectValue placeholder="Select Brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {brandOptions.map((brand) => (
                        <SelectItem key={`pb-${brand}`} value={brand}>
                          {brand}
                        </SelectItem>
                      ))}
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {purchaseForm.brand === "Other" && (
                  <div>
                    <Label htmlFor="purchaseBrandCustom" className="text-sm font-medium">
                      Custom Brand
                    </Label>
                    <Input
                      id="purchaseBrandCustom"
                      value={purchaseForm.brandCustom}
                      onChange={(e) => handlePurchaseChange("brandCustom", e.target.value)}
                      placeholder="Custom Brand"
                      className="bg-white dark:bg-gray-800"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="purchaseMaterial" className="text-sm font-medium">
                    Material
                  </Label>
                  <Select
                    value={purchaseForm.material}
                    onValueChange={(value) => handlePurchaseChange("material", value)}
                    required
                  >
                    <SelectTrigger id="purchaseMaterial" className="bg-white dark:bg-gray-800">
                      <SelectValue placeholder="Select Material" />
                    </SelectTrigger>
                    <SelectContent>
                      {materialOptions.map((material) => (
                        <SelectItem key={`pm-${material}`} value={material}>
                          {material}
                        </SelectItem>
                      ))}
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {purchaseForm.material === "Other" && (
                  <div>
                    <Label htmlFor="purchaseMaterialCustom" className="text-sm font-medium">
                      Custom Material
                    </Label>
                    <Input
                      id="purchaseMaterialCustom"
                      value={purchaseForm.materialCustom}
                      onChange={(e) => handlePurchaseChange("materialCustom", e.target.value)}
                      placeholder="Custom Material"
                      className="bg-white dark:bg-gray-800"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="purchaseQuantity" className="text-sm font-medium">
                    Quantity (kg)
                  </Label>
                  <Input
                    id="purchaseQuantity"
                    type="number"
                    min="0"
                    step="1"
                    value={purchaseForm.quantity_kg}
                    onChange={(e) => handlePurchaseChange("quantity_kg", e.target.value)}
                    placeholder="Qty (kg)"
                    required
                    className="bg-white dark:bg-gray-800"
                  />
                </div>

                <div>
                  <Label htmlFor="purchasePrice" className="text-sm font-medium">
                    Price €/kg
                  </Label>
                  <Input
                    id="purchasePrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={purchaseForm.price_per_kg}
                    onChange={(e) => handlePurchaseChange("price_per_kg", e.target.value)}
                    placeholder="€/kg"
                    required
                    className="bg-white dark:bg-gray-800"
                  />
                </div>

                <div>
                  <Label htmlFor="purchaseDate" className="text-sm font-medium">
                    Purchase Date
                  </Label>
                  <Input
                    id="purchaseDate"
                    type="date"
                    value={purchaseForm.purchase_date}
                    onChange={(e) => handlePurchaseChange("purchase_date", e.target.value)}
                    className="bg-white dark:bg-gray-800"
                  />
                </div>

                <div>
                  <Label htmlFor="purchaseChannel" className="text-sm font-medium">
                    Channel
                  </Label>
                  <Select
                    value={purchaseForm.channel}
                    onValueChange={(value) => handlePurchaseChange("channel", value)}
                  >
                    <SelectTrigger id="purchaseChannel" className="bg-white dark:bg-gray-800">
                      <SelectValue placeholder="Channel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Amazon">Amazon</SelectItem>
                      <SelectItem value="Ebay">Ebay</SelectItem>
                      <SelectItem value="Website">Website</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="sm:col-span-2 md:col-span-1 lg:col-span-1">
                  <Label htmlFor="purchaseNotes" className="text-sm font-medium">
                    Notes
                  </Label>
                  <Input
                    id="purchaseNotes"
                    value={purchaseForm.notes}
                    onChange={(e) => handlePurchaseChange("notes", e.target.value)}
                    placeholder="Optional notes"
                    className="bg-white dark:bg-gray-800"
                  />
                </div>

                <div className="self-end">
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90">
                    Add Purchase
                  </Button>
                </div>
              </form>

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
                          <TableHead></TableHead>
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
                            <TableCell className="space-x-2">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-gray-500 hover:text-primary"
                                    >
                                      <Info className="h-4 w-4" />
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
                              </TooltipProvider>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-500 hover:text-red-600"
                                onClick={() => handleDeletePurchase(purchase.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="mt-6 flex flex-col sm:flex-row justify-between items-center">
                    <div className="mb-4 sm:mb-0 flex items-center space-x-4">
                      <Button
                        onClick={exportPurchasesCSV}
                        variant="outline"
                        className="bg-green-600 text-white hover:bg-green-700 border-green-600"
                      >
                        <Download className="mr-2 h-4 w-4" /> Export CSV
                      </Button>
                      <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-lg shadow-sm border">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Spent:</span>{" "}
                        <span className="text-lg font-bold text-gray-800 dark:text-white">
                          €{totalSpent.toFixed(2)}
                        </span>
                      </div>
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
                  <p className="text-sm mt-1">Add your first purchase using the form above.</p>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  )
}
