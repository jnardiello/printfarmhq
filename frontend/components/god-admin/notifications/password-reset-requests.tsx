"use client"

import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, CheckCircle, XCircle, Mail, History, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { ApprovePasswordResetModal } from "@/components/modals/approve-password-reset-modal"
import { RejectPasswordResetModal } from "@/components/modals/reject-password-reset-modal"
import { PasswordResetHistoryModal } from "@/components/modals/password-reset-history-modal"

interface PasswordResetRequest {
  id: number
  email: string
  status: string
  requested_at: string
  processed_at?: string
  processed_by_user_id?: number
  notes?: string
}

export function PasswordResetRequests() {
  const [passwordResetRequests, setPasswordResetRequests] = useState<PasswordResetRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [processingRequest, setProcessingRequest] = useState<number | null>(null)

  // Password reset request modal states
  const [approveModalOpen, setApproveModalOpen] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [selectedPasswordRequest, setSelectedPasswordRequest] = useState<PasswordResetRequest | null>(null)

  useEffect(() => {
    fetchPasswordResetRequests()
  }, [])

  const fetchPasswordResetRequests = async () => {
    try {
      setLoading(true)
      
      // Fetch password reset requests
      const requestsData = await api<PasswordResetRequest[]>("/god/password-reset/requests")
      setPasswordResetRequests(requestsData)
    } catch (error) {
      console.error("Error fetching password reset requests:", error)
      toast.error("Failed to load password reset requests")
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = (request: PasswordResetRequest) => {
    setSelectedPasswordRequest(request)
    setApproveModalOpen(true)
  }

  const handleReject = (request: PasswordResetRequest) => {
    setSelectedPasswordRequest(request)
    setRejectModalOpen(true)
  }

  const handleViewHistory = () => {
    setHistoryModalOpen(true)
  }

  const approvePasswordResetRequest = async (requestId: number, newPassword: string, notes?: string) => {
    try {
      setProcessingRequest(requestId)

      await api("/god/password-reset/process/" + requestId, {
        method: "POST",
        body: JSON.stringify({
          action: "approve",
          new_password: newPassword,
          notes: notes || ""
        })
      })

      toast.success("Password reset request approved successfully")
      
      fetchPasswordResetRequests() // Refresh the data
      // Trigger a refresh of the parent dashboard notification count
      window.dispatchEvent(new CustomEvent('godDashboardUpdate'))
    } catch (error) {
      console.error("Error approving password reset request:", error)
      toast.error("Failed to approve password reset request")
      throw error // Let the modal handle the error state
    } finally {
      setProcessingRequest(null)
    }
  }

  const rejectPasswordResetRequest = async (requestId: number, notes?: string) => {
    try {
      setProcessingRequest(requestId)

      await api("/god/password-reset/process/" + requestId, {
        method: "POST",
        body: JSON.stringify({
          action: "reject",
          notes: notes || ""
        })
      })

      toast.success("Password reset request rejected successfully")
      
      fetchPasswordResetRequests() // Refresh the data
      // Trigger a refresh of the parent dashboard notification count
      window.dispatchEvent(new CustomEvent('godDashboardUpdate'))
    } catch (error) {
      console.error("Error rejecting password reset request:", error)
      toast.error("Failed to reject password reset request")
      throw error // Let the modal handle the error state
    } finally {
      setProcessingRequest(null)
    }
  }

  const generateSecurePassword = (): string => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"
    let password = ""
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-2">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Loading notifications...</p>
          </div>
        </div>
      </div>
    )
  }

  const pendingRequests = passwordResetRequests.filter(req => req.status === "pending")

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Password Reset Notifications</h2>
          <p className="text-muted-foreground">
            Review and process password reset requests
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleViewHistory} variant="outline" size="sm">
            <History className="h-4 w-4 mr-2" />
            View History
          </Button>
          <Button onClick={fetchPasswordResetRequests} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Notifications Summary</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between p-2 bg-orange-50 dark:bg-orange-950/50 rounded">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-600" />
              <span className="font-medium text-sm">Pending Password Reset Requests</span>
            </div>
            <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
              {pendingRequests.length}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Password Reset Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Password Reset Requests</CardTitle>
          <CardDescription>
            {pendingRequests.length === 0 
              ? "No pending password reset requests"
              : `${pendingRequests.length} request${pendingRequests.length === 1 ? '' : 's'} awaiting review`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No pending password reset requests</p>
              <p className="text-sm">All requests have been processed</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-mono text-sm">{request.email}</TableCell>
                    <TableCell>
                      {new Date(request.requested_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="gap-1">
                        <Clock className="h-3 w-3" />
                        Pending
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApprove(request)}
                          disabled={processingRequest === request.id}
                          className="text-green-600 hover:text-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReject(request)}
                          disabled={processingRequest === request.id}
                          className="text-red-600 hover:text-red-700"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* All Requests History (last 10) */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Last 10 password reset requests (all statuses)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Processed</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {passwordResetRequests.slice(0, 10).map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-mono text-sm">{request.email}</TableCell>
                  <TableCell>
                    {new Date(request.requested_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={
                        request.status === "pending" ? "secondary" :
                        request.status === "approved" ? "default" : "destructive"
                      }
                      className="gap-1"
                    >
                      {request.status === "pending" && <Clock className="h-3 w-3" />}
                      {request.status === "approved" && <CheckCircle className="h-3 w-3" />}
                      {request.status === "rejected" && <XCircle className="h-3 w-3" />}
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {request.processed_at ? 
                      new Date(request.processed_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : 
                      "-"
                    }
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {request.notes || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modals */}
      <ApprovePasswordResetModal
        request={selectedPasswordRequest}
        open={approveModalOpen}
        onOpenChange={setApproveModalOpen}
        onApprove={approvePasswordResetRequest}
        generatePassword={generateSecurePassword}
      />

      <RejectPasswordResetModal
        request={selectedPasswordRequest}
        open={rejectModalOpen}
        onOpenChange={setRejectModalOpen}
        onReject={rejectPasswordResetRequest}
      />

      <PasswordResetHistoryModal
        open={historyModalOpen}
        onOpenChange={setHistoryModalOpen}
      />
    </div>
  )
}