"use client"

import type React from "react"

import { useState } from "react"
import { useData } from "@/components/data-provider" // Placeholder - will need to update useData
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Trash2, Plus, Printer, Package, ScanLine, ChevronDown, ChevronUp } from "lucide-react" // Added ChevronDown, ChevronUp icons
import { motion } from "framer-motion"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"


export function PrintsTab() {
  // Placeholder - will need to update useData and related functions/state
  const { products, printers, printJobs, addPrintJob, deletePrintJob } = useData()

  // Add state to control collapsible form
  const [formOpen, setFormOpen] = useState(false)

  const [newPrintJob, setNewPrintJob] = useState({
    name: "", // Optional: name for the print job
    productId: "",
    printerId: "",
    quantity: "1",
    // Add other relevant fields for COGS calculation (e.g. filament used, print time)
  })

  const [jobProducts, setJobProducts] = useState([{ productId: "", itemsQty: "1" }]);
  const [jobPrinters, setJobPrinters] = useState([{ printerId: "", printersQty: "1", hoursEach: "1" }]);
  const [packagingCost, setPackagingCost] = useState("0");

  const handlePrintJobChange = (field: string, value: string) => {
    setNewPrintJob((prev) => ({ ...prev, [field]: value }))
  }

  const handleProductRowChange = (idx: number, field: string, value: string) => {
    setJobProducts(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  };
  const handlePrinterRowChange = (idx: number, field: string, value: string) => {
    setJobPrinters(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  };

  const addProductRow = () => setJobProducts(prev => [...prev, { productId: "", itemsQty: "1" }]);
  const addPrinterRow = () => setJobPrinters(prev => [...prev, { printerId: "", printersQty: "1", hoursEach: "1" }]);

  const handleAddPrintJob = async (e: React.FormEvent) => {
    e.preventDefault()

    if (jobProducts.some(p=> !p.productId) || jobPrinters.some(p=> !p.printerId)) {
      alert("Please select all products and printers rows.");
      return;
    }
    await addPrintJob({
      name: newPrintJob.name,
      products: jobProducts.map(p=>({ product_id: Number(p.productId), items_qty: Number(p.itemsQty) })),
      printers: jobPrinters.map(p=>({ printer_profile_id: Number(p.printerId), printers_qty: Number(p.printersQty), hours_each: Number(p.hoursEach) })),
      packaging_cost_eur: Number(packagingCost),
      status: "pending",
    });

    setNewPrintJob({ name: "" });
    setJobProducts([{ productId:"", itemsQty:"1" }]);
    setJobPrinters([{ printerId:"", printersQty:"1", hoursEach:"1" }]);
    setPackagingCost("0");
    setFormOpen(false); // Close the form after submission
  }

  // Placeholder: Calculate COGS for a print job
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


  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="card-hover shadow-md">
          <Collapsible open={formOpen} onOpenChange={setFormOpen}>
            <CollapsibleTrigger className="w-full text-left">
              <CardHeader className="flex flex-row items-center justify-between cursor-pointer">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <ScanLine />
                  Create New Print Job
                </CardTitle>
                {formOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="p-6">
                <form
                  onSubmit={handleAddPrintJob}
                  className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end p-4 bg-muted/30 rounded-lg border border-muted"
                >
                  <div>
                    <Label htmlFor="printJobName" className="text-sm font-medium">
                      Job Name (Optional)
                    </Label>
                    <Input
                      id="printJobName"
                      value={newPrintJob.name}
                      onChange={(e) => handlePrintJobChange("name", e.target.value)}
                      placeholder="e.g. Batch A - Blue PLA"
                      className="bg-white dark:bg-gray-800"
                    />
                  </div>

                  {/* Product rows */}
                  <div className="col-span-full space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Products</span>
                      <Button type="button" size="sm" onClick={addProductRow}>
                        <Plus className="h-4 w-4 mr-1" /> Add Product
                      </Button>
                    </div>
                    {jobProducts.map((row, idx) => (
                      <div key={idx} className="grid grid-cols-4 gap-2 items-end">
                        <div className="col-span-2">
                          <Label htmlFor={`product-select-${idx}`} className="text-xs text-muted-foreground">Product</Label>
                          <Select value={row.productId} onValueChange={(v)=>handleProductRowChange(idx,"productId",v)}>
                            <SelectTrigger id={`product-select-${idx}`} className="bg-white dark:bg-gray-800"><SelectValue placeholder="Select Product"/></SelectTrigger>
                            <SelectContent>
                              {products.map((p:any)=>(<SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor={`product-qty-${idx}`} className="text-xs text-muted-foreground">Items Qty</Label>
                          <Input id={`product-qty-${idx}`} type="number" min="1" value={row.itemsQty} onChange={(e)=>handleProductRowChange(idx,"itemsQty",e.target.value)} className="bg-white dark:bg-gray-800" placeholder="Qty" />
                        </div>
                        {/* Add a remove button for product row if idx > 0 */}
                        {jobProducts.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => setJobProducts(prev => prev.filter((_, i) => i !== idx))}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Printer rows */}
                  <div className="col-span-full space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Printers</span>
                      <Button type="button" size="sm" onClick={addPrinterRow}>
                        <Plus className="h-4 w-4 mr-1" /> Add Printer
                      </Button>
                    </div>
                    {jobPrinters.map((row, idx)=>(
                      <div key={idx} className="grid grid-cols-5 gap-2 items-end">
                        <div className="col-span-2">
                            <Label htmlFor={`printer-select-${idx}`} className="text-xs text-muted-foreground">Printer</Label>
                            <Select value={row.printerId} onValueChange={(v)=>handlePrinterRowChange(idx,"printerId",v)}>
                            <SelectTrigger id={`printer-select-${idx}`} className="bg-white dark:bg-gray-800"><SelectValue placeholder="Select Printer"/></SelectTrigger>
                            <SelectContent>
                                {printers.map((pr:any)=>(<SelectItem key={pr.id} value={String(pr.id)}>{pr.name}</SelectItem>))}
                            </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor={`printer-qty-${idx}`} className="text-xs text-muted-foreground">Printers Qty</Label>
                            <Input id={`printer-qty-${idx}`} type="number" min="1" value={row.printersQty} onChange={(e)=>handlePrinterRowChange(idx,"printersQty",e.target.value)} className="bg-white dark:bg-gray-800" placeholder="Qty" />
                        </div>
                        <div>
                            <Label htmlFor={`printer-hours-${idx}`} className="text-xs text-muted-foreground">Hours Each</Label>
                            <Input id={`printer-hours-${idx}`} type="number" min="0" step="0.1" value={row.hoursEach} onChange={(e)=>handlePrinterRowChange(idx,"hoursEach",e.target.value)} className="bg-white dark:bg-gray-800" placeholder="Hours each" />
                        </div>
                        {/* Add a remove button for printer row if idx > 0 */}
                         {jobPrinters.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => setJobPrinters(prev => prev.filter((_, i) => i !== idx))}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Packaging cost */}
                  <div>
                    <Label htmlFor="packagingCostInput" className="text-sm font-medium">Packaging €</Label>
                    <Input id="packagingCostInput" type="number" min="0" step="0.01" value={packagingCost} onChange={(e)=>setPackagingCost(e.target.value)} placeholder="e.g. 0.50" className="bg-white dark:bg-gray-800" />
                  </div>

                  <div className="self-end md:col-span-4"> {/* Ensure button spans full width on smaller screens if needed */}
                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-blue-500 to-blue-500/80 hover:from-blue-500/90 hover:to-blue-500" // Changed color
                    >
                      <Plus className="mr-2 h-4 w-4" /> Add Print Job
                    </Button>
                  </div>
                </form>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="card-hover shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Package />
              Print Jobs
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
                      <TableHead></TableHead>
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
                            title={(
`Filament Costs: Sum per product line ((grams/1000 * €/kg) * items qty) + 
Printer Costs: Sum per printer line ((€/hr * hours each) * printers qty) + 
Packaging Cost: €${job.packaging_cost_eur !== undefined ? job.packaging_cost_eur.toFixed(2) : '0.00'}`
                            ).replace(/\n/g, ' ')}
                          >
                            €{job.calculated_cogs_eur ? job.calculated_cogs_eur.toFixed(2) : 'N/A'}
                          </span>
                        </TableCell>
                        <TableCell>{new Date(job.created_at).toLocaleDateString()}</TableCell> {/* Assuming created_at exists */}
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500 hover:text-red-600"
                            onClick={() => {
                              if (confirm(`Delete print job #${job.id}? This action cannot be undone.`)) {
                                deletePrintJob(job.id)
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
                  <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" /> {/* Changed icon */}
                  <p>No print jobs created yet.</p>
                  <p className="text-sm mt-1">Click on "Create New Print Job" above to add your first print job.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
} 