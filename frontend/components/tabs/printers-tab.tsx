"use client"

import type React from "react"

import { useState } from "react"
import { useData } from "@/components/data-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Trash2, Plus, Settings, AlertCircle, Edit } from "lucide-react"
import { motion } from "framer-motion"

export function PrintersTab() {
  const { printers, addPrinter, updatePrinter, deletePrinter } = useData()
  const [printerToDelete, setPrinterToDelete] = useState<any>(null)
  const [editingPrinter, setEditingPrinter] = useState<any>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  const [newPrinter, setNewPrinter] = useState({
    name: "",
    price_eur: "",
    expected_life_hours: "",
  })

  const [editForm, setEditForm] = useState({
    name: "",
    price_eur: "",
    expected_life_hours: "",
  })

  const handlePrinterChange = (field: string, value: string) => {
    setNewPrinter((prev) => ({ ...prev, [field]: value }))
  }

  const handleAddPrinter = async (e: React.FormEvent) => {
    e.preventDefault()

    await addPrinter({
      name: newPrinter.name,
      price_eur: Number.parseFloat(newPrinter.price_eur),
      expected_life_hours: Number.parseInt(newPrinter.expected_life_hours),
    })

    // Reset form
    setNewPrinter({
      name: "",
      price_eur: "",
      expected_life_hours: "",
    })
  }

  const handleDeletePrinter = async () => {
    if (printerToDelete) {
      await deletePrinter(printerToDelete.id)
      setPrinterToDelete(null)
    }
  }

  const handleEditPrinter = (printer: any) => {
    setEditingPrinter(printer)
    setEditForm({
      name: printer.name,
      price_eur: printer.price_eur.toString(),
      expected_life_hours: printer.expected_life_hours.toString(),
    })
    setIsEditModalOpen(true)
  }

  const handleUpdatePrinter = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPrinter) return

    await updatePrinter(editingPrinter.id, {
      name: editForm.name,
      price_eur: Number.parseFloat(editForm.price_eur),
      expected_life_hours: Number.parseInt(editForm.expected_life_hours),
    })

    setIsEditModalOpen(false)
    setEditingPrinter(null)
    setEditForm({ name: "", price_eur: "", expected_life_hours: "" })
  }

  const handleEditFormChange = (field: string, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="card-hover shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Settings className="h-5 w-5 text-primary" />
              Add Printer Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form
              onSubmit={handleAddPrinter}
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end p-4 bg-muted/30 rounded-lg border border-muted"
            >
              <div>
                <Label htmlFor="printerName" className="text-sm font-medium">
                  Name
                </Label>
                <Input
                  id="printerName"
                  value={newPrinter.name}
                  onChange={(e) => handlePrinterChange("name", e.target.value)}
                  placeholder="Profile Name"
                  required
                  className="bg-white dark:bg-gray-800"
                />
              </div>

              <div>
                <Label htmlFor="printerCost" className="text-sm font-medium">
                  Cost (€)
                </Label>
                <Input
                  id="printerCost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newPrinter.price_eur}
                  onChange={(e) => handlePrinterChange("price_eur", e.target.value)}
                  placeholder="e.g. 299.90"
                  required
                  className="bg-white dark:bg-gray-800"
                />
              </div>

              <div>
                <Label htmlFor="printerLifeHours" className="text-sm font-medium">
                  Life hours
                </Label>
                <Input
                  id="printerLifeHours"
                  type="number"
                  min="1"
                  step="1"
                  value={newPrinter.expected_life_hours}
                  onChange={(e) => handlePrinterChange("expected_life_hours", e.target.value)}
                  placeholder="e.g. 2000"
                  required
                  className="bg-white dark:bg-gray-800"
                />
              </div>

              <div className="self-end">
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary"
                >
                  <Plus className="mr-2 h-4 w-4" /> Add Printer
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="card-hover shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Settings className="h-5 w-5 text-primary" />
              Printer Profiles
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {printers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Name</TableHead>
                      <TableHead>Cost €</TableHead>
                      <TableHead>Life hrs</TableHead>
                      <TableHead>Cost/hr €</TableHead>
                      <TableHead className="text-center w-[120px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {printers.map((printer) => (
                      <TableRow key={printer.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-medium">{printer.name}</TableCell>
                        <TableCell>€{printer.price_eur.toFixed(2)}</TableCell>
                        <TableCell>{printer.expected_life_hours}</TableCell>
                        <TableCell>
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            €{(printer.price_eur / printer.expected_life_hours).toFixed(3)}
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
                                    className="h-8 w-8 text-amber-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                                    onClick={() => handleEditPrinter(printer)}
                                    title="Edit printer"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Edit printer profile</p>
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    onClick={() => setPrinterToDelete(printer)}
                                    title="Delete printer"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Delete printer profile</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center text-muted-foreground py-12 bg-muted/30">
                  <Settings className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p>No printer profiles added yet.</p>
                  <p className="text-sm mt-1">Add your first printer profile using the form above.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Edit Printer Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Printer Profile
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdatePrinter} className="space-y-4">
            <div>
              <Label htmlFor="edit-printer-name">Printer Name</Label>
              <Input
                id="edit-printer-name"
                value={editForm.name}
                onChange={(e) => handleEditFormChange("name", e.target.value)}
                placeholder="e.g., Prusa i3 MK3S+"
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-printer-price">Cost € (purchase price)</Label>
              <Input
                id="edit-printer-price"
                type="number"
                step="0.01"
                min="0"
                value={editForm.price_eur}
                onChange={(e) => handleEditFormChange("price_eur", e.target.value)}
                placeholder="750.00"
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-printer-life">Expected Life (hours)</Label>
              <Input
                id="edit-printer-life"
                type="number"
                min="1"
                value={editForm.expected_life_hours}
                onChange={(e) => handleEditFormChange("expected_life_hours", e.target.value)}
                placeholder="26280"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                3 years = 26,280 hours (3 × 365 × 24)
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Update Printer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Printer Confirmation Dialog */}
      <Dialog open={!!printerToDelete} onOpenChange={() => setPrinterToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Delete Printer Profile
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              Are you sure you want to delete this printer profile?
            </p>
            {printerToDelete && (
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg space-y-1 text-sm">
                <p><strong>Name:</strong> {printerToDelete.name}</p>
                <p><strong>Cost:</strong> €{printerToDelete.price_eur}</p>
                <p><strong>Expected Life:</strong> {printerToDelete.expected_life_hours} hours</p>
              </div>
            )}
            <p className="text-sm text-red-600">
              This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrinterToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeletePrinter}>
              Delete Printer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
