"use client"

import type React from "react"

import { useState, useMemo } from "react"
import { useData } from "@/components/data-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { CreditCard, Eye, Edit, Trash2, AlertCircle, Plus, Info, DollarSign, Globe } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { SortableTableHeader, StaticTableHeader } from "@/components/ui/sortable-table-header"
import { getSortConfig, updateSortConfig, sortByDate, SortDirection, SortConfig } from "@/lib/sorting-utils"

export function SubscriptionsTab() {
  const { subscriptions, addSubscription, updateSubscription, deleteSubscription } = useData()
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null)
  const [editingSubscription, setEditingSubscription] = useState<any>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAddLicenseModalOpen, setIsAddLicenseModalOpen] = useState(false)
  const [subscriptionToDelete, setSubscriptionToDelete] = useState<any>(null)

  // Sorting state for subscriptions table
  const [sortConfig, setSortConfig] = useState<SortConfig>(() => 
    getSortConfig('subscriptions', 'created_at', 'desc')
  )

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

  // Handle sort changes with persistence
  const handleSort = (field: string, direction: SortDirection) => {
    const newConfig = updateSortConfig('subscriptions', field, sortConfig.direction)
    setSortConfig(newConfig)
  }

  // Sorted subscriptions based on current sort configuration
  const sortedSubscriptions = useMemo(() => {
    if (!subscriptions || subscriptions.length === 0) return []
    return sortByDate(subscriptions, sortConfig.field, sortConfig.direction)
  }, [subscriptions, sortConfig])

  const handleSubscriptionChange = (field: string, value: string) => {
    setNewSubscription((prev) => ({ ...prev, [field]: value }))
  }

  const handleEditFormChange = (field: string, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleAddSubscription = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
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
      setIsAddLicenseModalOpen(false)

      toast({
        title: "Success",
        description: "Commercial license created successfully"
      })
    } catch (error) {
      console.error('Failed to create license:', error)
      toast({
        title: "Error",
        description: "Failed to create commercial license. Please try again.",
        variant: "destructive"
      })
    }
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
    <div className="max-w-[1400px] mx-auto space-y-8">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Commercial Licenses</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your commercial licenses and subscriptions</p>
        </div>
        
        <Dialog open={isAddLicenseModalOpen} onOpenChange={setIsAddLicenseModalOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-white shadow-md transition-all">
              <Plus className="mr-2 h-5 w-5" />
              Add License
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-2xl">
                <div className="p-2 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg">
                  <CreditCard className="h-6 w-6 text-white" />
                </div>
                Add Commercial License
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleAddSubscription} className="space-y-6 mt-6">
              {/* License Information Section */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                    <Info className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">License Information</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Basic license details and identification</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="subName" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      License Name *
                    </Label>
                    <Input
                      id="subName"
                      value={newSubscription.name}
                      onChange={(e) => handleSubscriptionChange("name", e.target.value)}
                      placeholder="e.g., Monthly Design Pack, Creator Pro License"
                      required
                      className="h-11"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      A descriptive name for this license
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="subPlatform" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Platform *
                    </Label>
                    <Select
                      value={newSubscription.platform}
                      onValueChange={(v) => handleSubscriptionChange("platform", v)}
                    >
                      <SelectTrigger id="subPlatform" className="h-11">
                        <SelectValue placeholder="Select Platform" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Thangs">Thangs</SelectItem>
                        <SelectItem value="Patreon">Patreon</SelectItem>
                        <SelectItem value="No Platform">No Platform</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Where this license is hosted
                    </p>
                  </div>
                </div>
              </div>

              {/* Financial & URL Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Financial Information */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Financial Details</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Cost information</p>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="subPrice" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Price (€)
                    </Label>
                    <div className="relative">
                      <Input
                        id="subPrice"
                        type="number"
                        step="0.01"
                        min="0"
                        value={newSubscription.price_eur}
                        onChange={(e) => handleSubscriptionChange("price_eur", e.target.value)}
                        placeholder="19.99"
                        className="h-11 pl-8"
                      />
                      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">€</div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Monthly or one-time license cost
                    </p>
                  </div>
                </div>

                {/* License URL */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">License Link</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">External reference</p>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="subLicenseUri" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      License URL
                    </Label>
                    <Input
                      id="subLicenseUri"
                      value={newSubscription.license_uri}
                      onChange={(e) => handleSubscriptionChange("license_uri", e.target.value)}
                      placeholder="https://example.com/license"
                      className="h-11"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Link to license terms or subscription page
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
                  Create License
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Licenses List */}
      <Card className="card-hover shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <CreditCard className="h-5 w-5 text-primary" />
            Commercial Licenses ({subscriptions.length})
          </CardTitle>
        </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {subscriptions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <StaticTableHeader label="ID" />
                      <StaticTableHeader label="Name" />
                      <StaticTableHeader label="Platform" />
                      <StaticTableHeader label="License URI" />
                      <StaticTableHeader label="Price €" />
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
                    {sortedSubscriptions.map((subscription) => (
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
                        <TableCell>{new Date(subscription.created_at).toLocaleDateString()}</TableCell>
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
                  <p>No commercial licenses added yet.</p>
                  <p className="text-sm mt-1">Click "Add License" to create your first commercial license.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl">
              <div className="p-2 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg">
                <Edit className="h-6 w-6 text-white" />
              </div>
              Edit Commercial License
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleUpdateSubscription} className="space-y-6 mt-6">
            {/* License Information Section */}
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                  <Info className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">License Information</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Update license details</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="edit-name" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    License Name *
                  </Label>
                  <Input
                    id="edit-name"
                    value={editForm.name}
                    onChange={(e) => handleEditFormChange("name", e.target.value)}
                    placeholder="e.g., Monthly Design Pack, Creator Pro License"
                    required
                    className="h-11"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-platform" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Platform *
                  </Label>
                  <Select
                    value={editForm.platform}
                    onValueChange={(v) => handleEditFormChange("platform", v)}
                  >
                    <SelectTrigger id="edit-platform" className="h-11">
                      <SelectValue placeholder="Select Platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Thangs">Thangs</SelectItem>
                      <SelectItem value="Patreon">Patreon</SelectItem>
                      <SelectItem value="No Platform">No Platform</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Financial & URL Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Financial Information */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Financial Details</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Cost information</p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="edit-price" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Price (€)
                  </Label>
                  <div className="relative">
                    <Input
                      id="edit-price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm.price_eur}
                      onChange={(e) => handleEditFormChange("price_eur", e.target.value)}
                      placeholder="19.99"
                      className="h-11 pl-8"
                    />
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">€</div>
                  </div>
                </div>
              </div>

              {/* License URL */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">License Link</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">External reference</p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="edit-license-uri" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    License URL
                  </Label>
                  <Input
                    id="edit-license-uri"
                    value={editForm.license_uri}
                    onChange={(e) => handleEditFormChange("license_uri", e.target.value)}
                    placeholder="https://example.com/license"
                    className="h-11"
                  />
                </div>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                size="lg" 
                className="bg-primary hover:bg-primary/90 text-white shadow-md transition-all"
              >
                <Edit className="mr-2 h-5 w-5" /> 
                Update License
              </Button>
            </div>
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
    </div>
  )
}