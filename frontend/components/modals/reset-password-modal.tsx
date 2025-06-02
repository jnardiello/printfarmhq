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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { Eye, EyeOff, RefreshCw, Copy, CheckCheck } from "lucide-react"

const resetPasswordSchema = z.object({
  new_password: z.string().min(8, "Password must be at least 8 characters"),
})

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>

interface User {
  id: number
  name: string
  email: string
  is_active: boolean
  is_admin: boolean
  is_superadmin: boolean
  is_god_user: boolean
}

interface ResetPasswordModalProps {
  isOpen: boolean
  onClose: () => void
  user: User | null
  onSuccess: () => void
}

export function ResetPasswordModal({ isOpen, onClose, user, onSuccess }: ResetPasswordModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState(false)

  const form = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      new_password: "",
    },
  })

  const generatePassword = () => {
    // Generate a secure random password
    const length = 12
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
    let password = ""
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length))
    }
    form.setValue("new_password", password)
  }

  const copyToClipboard = async () => {
    const password = form.getValues("new_password")
    if (password) {
      try {
        await navigator.clipboard.writeText(password)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        toast.success("Password copied to clipboard")
      } catch (error) {
        toast.error("Failed to copy password")
      }
    }
  }

  const onSubmit = async (data: ResetPasswordForm) => {
    if (!user) return

    try {
      setIsLoading(true)
      await api(`/god/users/${user.id}/reset-password`, {
        method: "POST",
        body: JSON.stringify(data),
      })

      toast.success(`Password reset successfully for ${user.name}`)
      onSuccess()
      onClose()
    } catch (error) {
      console.error("Error resetting password:", error)
      toast.error(error instanceof Error ? error.message : "Failed to reset password")
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    form.reset()
    setShowPassword(false)
    setCopied(false)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Set a new password for <strong>{user?.name}</strong> ({user?.email})
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="new_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        {...field} 
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter new password"
                        className="pr-20"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={copyToClipboard}
                          disabled={!field.value}
                        >
                          {copied ? (
                            <CheckCheck className="h-3 w-3 text-green-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={generatePassword}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Generate Password
              </Button>
              <div className="text-sm text-muted-foreground">
                Min. 8 characters
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/50 p-3 rounded-lg text-sm">
              <div className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                Security Note:
              </div>
              <div className="text-blue-800 dark:text-blue-200">
                The user will need to use this new password to log in. Make sure to communicate it securely.
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || !form.getValues("new_password")}>
                {isLoading ? "Resetting..." : "Reset Password"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}