"use client"

import { useState, useEffect } from "react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { 
  User, 
  Mail, 
  Shield, 
  AlertCircle, 
  Crown,
  CheckCircle2,
  XCircle,
  Loader2
} from "lucide-react"

const editUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  is_active: z.boolean().default(true),
  is_admin: z.boolean().default(false),
})

type EditUserForm = z.infer<typeof editUserSchema>

interface UserData {
  id: number
  name: string
  email: string
  is_active: boolean
  is_admin: boolean
  is_superadmin: boolean
  is_god_user: boolean
  created_at?: string
}

interface EditUserModalProps {
  isOpen: boolean
  onClose: () => void
  user: UserData | null
  onSuccess: () => void
}

export function EditUserModal({ isOpen, onClose, user, onSuccess }: EditUserModalProps) {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      name: "",
      email: "",
      is_active: true,
      is_admin: false,
    },
  })

  // Reset form when user changes
  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name,
        email: user.email,
        is_active: user.is_active,
        is_admin: user.is_admin,
      })
    }
  }, [user, form])

  const onSubmit = async (data: EditUserForm) => {
    if (!user) return

    try {
      setIsLoading(true)
      await api(`/god/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      })

      toast.success(`User ${data.name} updated successfully`)
      onSuccess()
      onClose()
    } catch (error) {
      console.error("Error updating user:", error)
      toast.error(error instanceof Error ? error.message : "Failed to update user")
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    form.reset()
    onClose()
  }

  const getUserRoleDisplay = (user: UserData) => {
    if (user.is_god_user) {
      return { label: "God User", variant: "default" as const, color: "bg-purple-600 hover:bg-purple-700" }
    }
    if (user.is_superadmin) {
      return { label: "Root User", variant: "secondary" as const, color: "bg-orange-500 hover:bg-orange-600" }
    }
    if (user.is_admin) {
      return { label: "Admin", variant: "default" as const, color: "bg-blue-500 hover:bg-blue-600" }
    }
    return { label: "User", variant: "outline" as const, color: "bg-gray-500 hover:bg-gray-600" }
  }

  if (!user) return null

  const roleDisplay = getUserRoleDisplay(user)

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Edit User
            </DialogTitle>
            <Badge 
              variant={roleDisplay.variant}
              className={`${roleDisplay.color} text-white border-none px-3 py-1`}
            >
              {roleDisplay.label}
            </Badge>
          </div>
          
          {/* User Preview Card */}
          <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="text-lg font-semibold">
                {user.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg truncate">{user.name}</h3>
                {user.is_god_user && (
                  <Crown className="h-4 w-4 text-purple-600 flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{user.email}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                {user.is_active ? (
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    <span className="text-xs font-medium">Active</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-red-600">
                    <XCircle className="h-3 w-3" />
                    <span className="text-xs font-medium">Inactive</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <DialogDescription>
            Update user information and permissions. Changes will take effect immediately.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <User className="h-4 w-4 text-primary" />
                <h3 className="font-medium text-sm">Basic Information</h3>
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Full Name</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Enter user's full name"
                        className="h-10"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Email Address</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="email" 
                        placeholder="user@example.com"
                        className="h-10"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Permissions Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Shield className="h-4 w-4 text-primary" />
                <h3 className="font-medium text-sm">Permissions & Access</h3>
              </div>

              <div className="space-y-4 p-4 bg-muted/20 rounded-lg border">
                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={user?.is_god_user} // Prevent god user from deactivating themselves
                          className="mt-1"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-medium">
                          Active User
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          User can log in and access the system. Deactivated users cannot log in.
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_admin"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="mt-1"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-medium">
                          Administrator Privileges
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Can manage users, inventory, products, and system settings within their organization.
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                {/* Superadmin Status Display (Read-only) */}
                {user.is_superadmin && (
                  <div className="flex flex-row items-start space-x-3 space-y-0 p-3 bg-orange-50 dark:bg-orange-950/30 rounded border border-orange-200 dark:border-orange-800">
                    <div className="mt-1">
                      <CheckCircle2 className="h-4 w-4 text-orange-600" />
                    </div>
                    <div className="space-y-1 leading-none">
                      <div className="text-sm font-medium text-orange-900 dark:text-orange-100">
                        Root User (Super Admin)
                      </div>
                      <p className="text-xs text-orange-700 dark:text-orange-200">
                        Organization owner with full permissions. This status cannot be changed from this form.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Warning for God User */}
            {user.is_god_user && (
              <Alert className="border-purple-200 bg-purple-50 dark:bg-purple-950/30">
                <Crown className="h-4 w-4 text-purple-600" />
                <AlertDescription className="text-sm text-purple-800 dark:text-purple-200">
                  <strong>God User Protection:</strong> Some options are restricted to prevent accidental self-lockout. 
                  God users cannot deactivate themselves.
                </AlertDescription>
              </Alert>
            )}

            {/* Security Notice */}
            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/30">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Security Notice:</strong> Permission changes take effect immediately. 
                The user will need to log out and back in to see interface changes.
              </AlertDescription>
            </Alert>

            <DialogFooter className="flex gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="min-w-[100px]">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update User"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}