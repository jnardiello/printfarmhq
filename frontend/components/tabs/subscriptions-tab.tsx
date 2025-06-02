"use client"

import type React from "react"

import { useState } from "react"
import { useData } from "@/components/data-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { CreditCard, Eye, Edit, Trash2, AlertCircle } from "lucide-react"
import { motion } from "framer-motion"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function SubscriptionsTab() {
  const { subscriptions, addSubscription, updateSubscription, deleteSubscription } = useData()
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null)
  const [editingSubscription, setEditingSubscription] = useState<any>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [subscriptionToDelete, setSubscriptionToDelete] = useState<any>(null)

  const [newSubscription, setNewSubscription] = useState({
    name: "",
    platform: "No Platform",
    license_uri: "",
    price_eur: "",
  })

  const [editForm, setEditForm] = useState({
    name: "",
    platform: "No Platform",
    license_uri: "",
    price_eur: "",
  })

  const handleSubscriptionChange = (field: string, value: string) => {
    setNewSubscription((prev) => ({ ...prev, [field]: value }))
  }

  const handleEditFormChange = (field: string, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }))
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

  const handleEditSubscription = (subscription: any) => {
    setEditingSubscription(subscription)
    setEditForm({
      name: subscription.name,
      platform: subscription.platform,
      license_uri: subscription.license_uri || "",
      price_eur: subscription.price_eur?.toString() || "",
    })
    setIsEditModalOpen(true)
  }

  const handleUpdateSubscription = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingSubscription) return

    await updateSubscription(editingSubscription.id, {
      name: editForm.name,
      platform: editForm.platform as any,
      license_uri: editForm.license_uri || null,
      price_eur: editForm.price_eur ? Number.parseFloat(editForm.price_eur) : null,
    })

    setIsEditModalOpen(false)
    setEditingSubscription(null)
  }

  const handleDeleteSubscription = async () => {
    if (subscriptionToDelete) {
      await deleteSubscription(subscriptionToDelete.id)
      setSubscriptionToDelete(null)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="card-hover shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <CreditCard className="h-5 w-5 text-primary" />
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
        <Card className="card-hover shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <CreditCard className="h-5 w-5 text-primary" />
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
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscriptions.map((subscription) => (
                      <TableRow key={subscription.id} className="hover:bg-muted/50 transition-colors">
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
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                    onClick={() => setSelectedSubscription(subscription)}
                                    title="View details"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>View subscription details</p>
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-amber-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                                    onClick={() => handleEditSubscription(subscription)}
                                    title="Edit subscription"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Edit subscription</p>
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    onClick={() => setSubscriptionToDelete(subscription)}
                                    title="Delete subscription"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Delete subscription</p>
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
                  <CreditCard className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p>No subscriptions added yet.</p>
                  <p className="text-sm mt-1">Add your first subscription using the form above.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* View Subscription Details Dialog */}
      <Dialog open={!!selectedSubscription} onOpenChange={() => setSelectedSubscription(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-600" />
              Subscription Details
            </DialogTitle>
          </DialogHeader>
          {selectedSubscription && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">ID</label>
                  <p className="text-sm">{selectedSubscription.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Name</label>
                  <p className="text-sm">{selectedSubscription.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Platform</label>
                  <p className="text-sm">{selectedSubscription.platform}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Price</label>
                  <p className="text-sm">
                    {selectedSubscription.price_eur ? `€${selectedSubscription.price_eur.toFixed(2)}` : "-"}
                  </p>
                </div>
              </div>
              {selectedSubscription.license_uri && (
                <div>
                  <label className="text-sm font-medium text-gray-500">License URI</label>
                  <a 
                    href={selectedSubscription.license_uri} 
                    className="text-sm text-blue-600 underline block mt-1" 
                    target="_blank" 
                    rel="noreferrer"
                  >
                    {selectedSubscription.license_uri}
                  </a>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedSubscription(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Subscription Dialog */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-amber-600" />
              Edit Subscription
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateSubscription} className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => handleEditFormChange("name", e.target.value)}
                placeholder="Subscription Name"
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-platform">Platform</Label>
              <Select
                value={editForm.platform}
                onValueChange={(v) => handleEditFormChange("platform", v)}
              >
                <SelectTrigger id="edit-platform">
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
              <Label htmlFor="edit-license-uri">License URI</Label>
              <Input
                id="edit-license-uri"
                value={editForm.license_uri}
                onChange={(e) => handleEditFormChange("license_uri", e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label htmlFor="edit-price">Price €</Label>
              <Input
                id="edit-price"
                type="number"
                step="0.01"
                min="0"
                value={editForm.price_eur}
                onChange={(e) => handleEditFormChange("price_eur", e.target.value)}
                placeholder="e.g. 19.99"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Update Subscription</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Subscription Confirmation Dialog */}
      <Dialog open={!!subscriptionToDelete} onOpenChange={() => setSubscriptionToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Delete Subscription
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              Are you sure you want to delete this subscription?
            </p>
            {subscriptionToDelete && (
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg space-y-1 text-sm">
                <p><strong>Name:</strong> {subscriptionToDelete.name}</p>
                <p><strong>Platform:</strong> {subscriptionToDelete.platform}</p>
                {subscriptionToDelete.price_eur && (
                  <p><strong>Price:</strong> €{subscriptionToDelete.price_eur.toFixed(2)}</p>
                )}
              </div>
            )}
            <p className="text-sm text-red-600">
              This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubscriptionToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteSubscription}>
              Delete Subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}