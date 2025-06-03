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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Copy, Eye, EyeOff, RefreshCw, CheckCircle, Mail, Calendar } from "lucide-react"
import { toast } from "sonner"

interface PasswordResetRequest {
  id: number
  email: string
  status: string
  requested_at: string
  processed_at?: string
  processed_by_user_id?: number
  notes?: string
}

interface ApprovePasswordResetModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  request: PasswordResetRequest | null
  onApprove: (requestId: number, password: string, notes?: string) => Promise<void>
  generatePassword: () => string
}

export function ApprovePasswordResetModal({
  open,
  onOpenChange,
  request,
  onApprove,
  generatePassword
}: ApprovePasswordResetModalProps) {
  const [password, setPassword] = useState("")
  const [notes, setNotes] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // Generate secure password
  const generateSecurePassword = () => {
    const newPassword = generatePassword()
    setPassword(newPassword)
  }

  // Initialize password when modal opens
  const handleModalOpen = () => {
    if (open && !password) {
      generateSecurePassword()
      setNotes("")
    }
  }

  // Reset state when modal closes
  const handleClose = () => {
    setPassword("")
    setNotes("")
    setShowPassword(false)
    setIsProcessing(false)
    onOpenChange(false)
  }

  // Copy password to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(password)
      toast.success("Password copied to clipboard")
    } catch (error) {
      console.error("Failed to copy password:", error)
      toast.error("Failed to copy password")
    }
  }

  // Handle approval
  const handleApprove = async () => {
    if (!request || !password.trim()) return
    
    try {
      setIsProcessing(true)
      await onApprove(request.id, password, notes.trim() || undefined)
      handleClose()
    } catch (error) {
      // Error handling is done in parent component
      setIsProcessing(false)
    }
  }

  // Call handleModalOpen when open changes
  if (open && !password) {
    handleModalOpen()
  }

  if (!request) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Approve Password Reset
          </DialogTitle>
          <DialogDescription>
            Generate a new password for the user and provide it to them manually via email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Request Details */}
          <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <CardContent className="pt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-green-600" />
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

          {/* Password Generation */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                Generated Password
                <Badge variant="outline" className="text-xs">
                  12 characters
                </Badge>
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10 font-mono"
                    placeholder="Generated secure password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateSecurePassword}
                  className="px-3"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyToClipboard}
                  className="px-3"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                You can modify this password or generate a new one. Copy it before approving.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this password reset approval..."
                className="resize-none"
                rows={3}
              />
            </div>
          </div>

          <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            <p className="text-sm text-orange-800 dark:text-orange-200">
              <strong>Manual Process:</strong> After approval, you must manually email this password to the user. 
              The user's current sessions will be invalidated and they'll need to log in with this new password.
            </p>
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
            onClick={handleApprove}
            disabled={isProcessing || !password.trim()}
            className="bg-green-600 hover:bg-green-700"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Approving...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve & Reset Password
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}