"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { XCircle, Mail, Calendar, AlertTriangle } from "lucide-react"

interface PasswordResetRequest {
  id: number
  email: string
  status: string
  requested_at: string
  processed_at?: string
  processed_by_user_id?: number
  notes?: string
}

interface RejectPasswordResetModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  request: PasswordResetRequest | null
  onReject: (requestId: number, reason?: string) => Promise<void>
}

export function RejectPasswordResetModal({
  open,
  onOpenChange,
  request,
  onReject
}: RejectPasswordResetModalProps) {
  const [reason, setReason] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  // Reset state when modal closes
  const handleClose = () => {
    setReason("")
    setIsProcessing(false)
    onOpenChange(false)
  }

  // Handle rejection
  const handleReject = async () => {
    if (!request) return
    
    try {
      setIsProcessing(true)
      await onReject(request.id, reason.trim() || undefined)
      handleClose()
    } catch (error) {
      // Error handling is done in parent component
      setIsProcessing(false)
    }
  }

  if (!request) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600" />
            Reject Password Reset
          </DialogTitle>
          <DialogDescription>
            Reject this password reset request and optionally provide a reason for the rejection.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Request Details */}
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <CardContent className="pt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-red-600" />
                      <span className="font-medium">{request.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>Requested: {new Date(request.requested_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {request.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Rejection Reason */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Rejection (Optional)</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Provide a reason for rejecting this password reset request..."
                className="resize-none"
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                This reason will be stored in the system for audit purposes.
              </p>
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Manual Process
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  After rejection, you should manually contact the user via email to explain why their password reset request was denied.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleReject}
            disabled={isProcessing}
            variant="destructive"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Rejecting...
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 mr-2" />
                Reject Request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}