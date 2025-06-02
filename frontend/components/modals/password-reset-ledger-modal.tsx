"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { 
  History, 
  Mail, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search,
  FileText,
  User
} from "lucide-react"
import { api } from "@/lib/api"
import { toast } from "sonner"

interface PasswordResetLedgerEntry {
  id: number
  email: string
  status: "pending" | "approved" | "rejected"
  requested_at: string
  processed_at?: string
  processed_by_user_id?: number
  notes?: string
  processed_by?: {
    id: number
    name: string
    email: string
  }
}

interface PasswordResetLedgerModalProps {
  isOpen: boolean
  onClose: () => void
}

export function PasswordResetLedgerModal({
  isOpen,
  onClose
}: PasswordResetLedgerModalProps) {
  const [ledgerEntries, setLedgerEntries] = useState<PasswordResetLedgerEntry[]>([])
  const [filteredEntries, setFilteredEntries] = useState<PasswordResetLedgerEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all")

  // Fetch ledger data when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchLedgerData()
    }
  }, [isOpen])

  // Filter entries when search term or status filter changes
  useEffect(() => {
    let filtered = ledgerEntries

    // Apply search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(entry => 
        entry.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.notes && entry.notes.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(entry => entry.status === statusFilter)
    }

    // Sort by most recent first
    filtered = filtered.sort((a, b) => 
      new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
    )

    setFilteredEntries(filtered)
  }, [ledgerEntries, searchTerm, statusFilter])

  const fetchLedgerData = async () => {
    try {
      setLoading(true)
      // Use the same endpoint but it should return all requests (pending and processed)
      const data = await api<PasswordResetLedgerEntry[]>("/god/password-reset/ledger")
      setLedgerEntries(data)
    } catch (error) {
      console.error("Error fetching password reset ledger:", error)
      toast.error("Failed to load password reset ledger")
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-600" />
      case "pending":
        return <Clock className="h-4 w-4 text-orange-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Approved</Badge>
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>
      case "pending":
        return <Badge variant="secondary">Pending</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStats = () => {
    const total = ledgerEntries.length
    const pending = ledgerEntries.filter(e => e.status === "pending").length
    const approved = ledgerEntries.filter(e => e.status === "approved").length
    const rejected = ledgerEntries.filter(e => e.status === "rejected").length
    
    return { total, pending, approved, rejected }
  }

  const stats = getStats()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] h-[80vh] flex flex-col">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-blue-600" />
            Password Reset Ledger
          </DialogTitle>
          <DialogDescription>
            Complete audit trail of all password reset requests and their processing status.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="text-sm text-muted-foreground">Loading ledger...</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-hidden">
            {/* Stats Summary */}
            <div className="grid grid-cols-4 gap-3">
              <Card className="p-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">{stats.total}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-orange-600">{stats.pending}</div>
                  <div className="text-xs text-muted-foreground">Pending</div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">{stats.approved}</div>
                  <div className="text-xs text-muted-foreground">Approved</div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-red-600">{stats.rejected}</div>
                  <div className="text-xs text-muted-foreground">Rejected</div>
                </div>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by email or notes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-1">
                {["all", "pending", "approved", "rejected"].map((status) => (
                  <Button
                    key={status}
                    variant={statusFilter === status ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(status as any)}
                    className="capitalize"
                  >
                    {status}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Ledger Entries */}
            <div className="flex-1 overflow-y-auto space-y-3">
              {filteredEntries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {searchTerm || statusFilter !== "all" 
                      ? "No entries match your filters" 
                      : "No password reset requests yet"}
                  </p>
                </div>
              ) : (
                filteredEntries.map((entry) => (
                  <Card key={entry.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Header Row */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(entry.status)}
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Mail className="h-3 w-3 text-muted-foreground" />
                                <span className="font-medium text-sm">{entry.email}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                <span>Requested: {formatDate(entry.requested_at)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(entry.status)}
                          </div>
                        </div>

                        {/* Processing Details */}
                        {entry.processed_at && (
                          <div className="pt-2 border-t space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                <span>Processed: {formatDate(entry.processed_at)}</span>
                              </div>
                              {entry.processed_by && (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <User className="h-3 w-3" />
                                  <span>by {entry.processed_by.name}</span>
                                </div>
                              )}
                            </div>
                            
                            {entry.notes && (
                              <div className="bg-muted/50 rounded p-2">
                                <div className="flex items-start gap-2">
                                  <FileText className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                                  <div className="space-y-1">
                                    <div className="text-xs font-medium text-muted-foreground">Notes:</div>
                                    <div className="text-xs">{entry.notes}</div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}

        <div className="border-t pt-4">
          <div className="flex justify-between items-center">
            <div className="text-xs text-muted-foreground">
              Showing {filteredEntries.length} of {ledgerEntries.length} entries
            </div>
            <Button onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}