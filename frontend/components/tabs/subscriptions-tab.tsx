"use client"

import type React from "react"

import { useState } from "react"
import { useData } from "@/components/data-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { CreditCard } from "lucide-react"
import { motion } from "framer-motion"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function SubscriptionsTab() {
  const { subscriptions, addSubscription } = useData()

  const [newSubscription, setNewSubscription] = useState({
    name: "",
    platform: "No Platform",
    license_uri: "",
    price_eur: "",
  })

  const handleSubscriptionChange = (field: string, value: string) => {
    setNewSubscription((prev) => ({ ...prev, [field]: value }))
  }

  const handleAddSubscription = async (e: React.FormEvent) => {
    e.preventDefault()

    await addSubscription({
      name: newSubscription.name,
      platform: newSubscription.platform as any,
      license_uri: newSubscription.license_uri || null,
      price_eur: newSubscription.price_eur ? Number.parseFloat(newSubscription.price_eur) : null,
    })

    // Reset form
    setNewSubscription({
      name: "",
      platform: "No Platform",
      license_uri: "",
      price_eur: "",
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
                <rect width="20" height="14" x="2" y="5" rx="2"></rect>
                <line x1="2" x2="22" y1="10" y2="10"></line>
              </svg>
              Add Commercial License
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form
              onSubmit={handleAddSubscription}
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end p-4 bg-muted/30 rounded-lg border border-muted"
            >
              <div className="md:col-span-2">
                <Label htmlFor="subName" className="text-sm font-medium">
                  Name
                </Label>
                <Input
                  id="subName"
                  value={newSubscription.name}
                  onChange={(e) => handleSubscriptionChange("name", e.target.value)}
                  placeholder="Subscription Name"
                  required
                  className="bg-white dark:bg-gray-800"
                />
              </div>

              <div>
                <Label htmlFor="subPlatform" className="text-sm font-medium">
                  Platform
                </Label>
                <Select
                  value={newSubscription.platform}
                  onValueChange={(v) => handleSubscriptionChange("platform", v)}
                >
                  <SelectTrigger id="subPlatform" className="bg-white dark:bg-gray-800">
                    <SelectValue placeholder="Select Platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Thangs">Thangs</SelectItem>
                    <SelectItem value="Patreon">Patreon</SelectItem>
                    <SelectItem value="No Platform">No Platform</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="subLicenseUri" className="text-sm font-medium">
                  License URI
                </Label>
                <Input
                  id="subLicenseUri"
                  value={newSubscription.license_uri}
                  onChange={(e) => handleSubscriptionChange("license_uri", e.target.value)}
                  placeholder="https://..."
                  className="bg-white dark:bg-gray-800"
                />
              </div>

              <div>
                <Label htmlFor="subPrice" className="text-sm font-medium">
                  Price €
                </Label>
                <Input
                  id="subPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newSubscription.price_eur}
                  onChange={(e) => handleSubscriptionChange("price_eur", e.target.value)}
                  placeholder="e.g. 19.99"
                  className="bg-white dark:bg-gray-800"
                />
              </div>

              <div className="self-end md:col-start-5">
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary"
                >
                  Add Subscription
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
                <rect width="20" height="14" x="2" y="5" rx="2"></rect>
                <line x1="2" x2="22" y1="10" y2="10"></line>
              </svg>
              Commercial Licenses List
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {subscriptions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>License URI</TableHead>
                      <TableHead>Price €</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscriptions.map((subscription) => (
                      <TableRow key={subscription.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{subscription.id}</TableCell>
                        <TableCell>{subscription.name}</TableCell>
                        <TableCell>{subscription.platform}</TableCell>
                        <TableCell>
                          {subscription.license_uri ? <a href={subscription.license_uri} className="text-blue-600 underline" target="_blank" rel="noreferrer">link</a> : "-"}
                        </TableCell>
                        <TableCell>
                          {subscription.price_eur ? (
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              €{subscription.price_eur.toFixed(2)}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center text-muted-foreground py-12 bg-muted/30">
                  <CreditCard className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p>No subscriptions added yet.</p>
                  <p className="text-sm mt-1">Add your first subscription using the form above.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
