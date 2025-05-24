"use client"

import type React from "react"

import { useState } from "react"
import { useData } from "@/components/data-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Trash2, Plus, Printer } from "lucide-react"
import { motion } from "framer-motion"

export function PrintersTab() {
  const { printers, addPrinter, deletePrinter } = useData()

  const [newPrinter, setNewPrinter] = useState({
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="card-hover overflow-hidden border-t-4 border-t-primary shadow-md">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
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
                className="text-primary"
              >
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect width="12" height="8" x="6" y="14"></rect>
              </svg>
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
        <Card className="card-hover overflow-hidden border-t-4 border-t-secondary shadow-md">
          <CardHeader className="bg-gradient-to-r from-secondary/5 to-transparent">
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
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect width="12" height="8" x="6" y="14"></rect>
              </svg>
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
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {printers.map((printer) => (
                      <TableRow key={printer.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{printer.name}</TableCell>
                        <TableCell>€{printer.price_eur.toFixed(2)}</TableCell>
                        <TableCell>{printer.expected_life_hours}</TableCell>
                        <TableCell>
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            €{(printer.price_eur / printer.expected_life_hours).toFixed(3)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500 hover:text-red-600"
                            onClick={() => {
                              if (confirm(`Delete printer profile #${printer.id}?`)) {
                                deletePrinter(printer.id)
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
                  <Printer className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p>No printer profiles added yet.</p>
                  <p className="text-sm mt-1">Add your first printer profile using the form above.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
