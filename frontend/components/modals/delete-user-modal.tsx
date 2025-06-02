"use client"

import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { api } from "@/lib/api"

interface User {
  id: number
  name: string
  email: string
  is_active: boolean
  is_admin: boolean
  is_superadmin: boolean
  is_god_user: boolean
}

interface DeleteUserModalProps {
  isOpen: boolean
  onClose: () => void
  user: User | null
  onSuccess: () => void
}

export function DeleteUserModal({ isOpen, onClose, user, onSuccess }: DeleteUserModalProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleDelete = async () => {
    if (!user) return

    try {
      setIsLoading(true)
      await api(`/god/users/${user.id}`, {
        method: "DELETE",
      })

      toast.success(`User ${user.name} deleted successfully`)
      onSuccess()
      onClose()
    } catch (error) {
      console.error("Error deleting user:", error)
      toast.error(error instanceof Error ? error.message : "Failed to delete user")
    } finally {
      setIsLoading(false)
    }
  }

  // Determine the warning level based on user type
  const getWarningMessage = () => {
    if (!user) return ""
    
    if (user.is_god_user) {
      return "This is a God User and cannot be deleted for security reasons."
    }
    
    if (user.is_superadmin) {
      return "This is a Root User (Super Admin). Deleting them will remove their entire organization and all associated data. This action cannot be undone."
    }
    
    return "This action cannot be undone. The user will lose access to their account and all associated data."
  }

  const isGodUser = user?.is_god_user || false
  const isSuperAdmin = user?.is_superadmin || false

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isGodUser ? (
              <>
                🚫 Cannot Delete God User
              </>
            ) : isSuperAdmin ? (
              <>
                ⚠️ Delete Root User
              </>
            ) : (
              <>
                🗑️ Delete User
              </>
            )}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <div>
              Are you sure you want to delete <strong>{user?.name}</strong> ({user?.email})?
            </div>
            <div className={`text-sm p-3 rounded-lg ${
              isGodUser 
                ? "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200" 
                : isSuperAdmin 
                ? "bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-200"
                : "bg-yellow-50 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200"
            }`}>
              {getWarningMessage()}
            </div>
            {isSuperAdmin && !isGodUser && (
              <div className="text-sm text-muted-foreground">
                <strong>What will be deleted:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>User account and login credentials</li>
                  <li>All team members under this root user</li>
                  <li>All organization data (filaments, products, print jobs, etc.)</li>
                  <li>All associated files and uploads</li>
                </ul>
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {!isGodUser && (
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isLoading}
              className={`${
                isSuperAdmin 
                  ? "bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-800" 
                  : "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
              }`}
            >
              {isLoading ? "Deleting..." : isSuperAdmin ? "Delete Root User" : "Delete User"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}