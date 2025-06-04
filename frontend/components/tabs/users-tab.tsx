"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Trash2, UserPlus, Shield, User as UserIcon, Edit, Crown, AlertCircle, CheckCircle2, Loader2, RefreshCw, Copy, Eye, EyeOff } from "lucide-react"
import { api } from "@/lib/api"
import { toast } from "@/components/ui/use-toast"
import type { User } from "@/lib/auth"
import { useAuth } from "@/components/auth/auth-context"
import { SortableTableHeader, StaticTableHeader } from "@/components/ui/sortable-table-header"
import { getSortConfig, updateSortConfig, sortByDate, SortDirection, SortConfig } from "@/lib/sorting-utils"

export function UsersTab() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [isDeleting, setIsDeleting] = useState<number | null>(null)
  const [userToDelete, setUserToDelete] = useState<any>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    password: "",
    is_admin: false
  })
  const [editFormData, setEditFormData] = useState({
    email: "",
    name: "",
    password: "",
    is_admin: false
  })
  const [profileFormData, setProfileFormData] = useState({
    email: "",
    name: "",
    password: ""
  })
  const [formError, setFormError] = useState("")
  const [editFormError, setEditFormError] = useState("")
  const [profileFormError, setProfileFormError] = useState("")

  // Sorting state for users table
  const [sortConfig, setSortConfig] = useState<SortConfig>(() => 
    getSortConfig('users', 'created_at', 'desc')
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Password generator state
  const [showEditPassword, setShowEditPassword] = useState(false)
  const [showProfilePassword, setShowProfilePassword] = useState(false)
  const [editPasswordCopied, setEditPasswordCopied] = useState(false)
  const [profilePasswordCopied, setProfilePasswordCopied] = useState(false)

  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      const data = await api<User[]>("/users")
      setUsers(data)
    } catch (error) {
      console.error("Error fetching users:", error)
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle sort changes with persistence
  const handleSort = (field: string, direction: SortDirection) => {
    const newConfig = updateSortConfig('users', field, sortConfig.direction)
    setSortConfig(newConfig)
  }

  // Sorted users based on current sort configuration
  const sortedUsers = useMemo(() => {
    if (!users || users.length === 0) return []
    return sortByDate(users, sortConfig.field, sortConfig.direction)
  }, [users, sortConfig])

  useEffect(() => {
    fetchUsers()
  }, [])

  // Password generator functions
  const generateSecurePassword = () => {
    const length = 12
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
    let password = ""
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length))
    }
    return password
  }

  const generateEditUserPassword = () => {
    const newPassword = generateSecurePassword()
    setEditFormData({ ...editFormData, password: newPassword })
    setShowEditPassword(true)
  }

  const generateProfilePassword = () => {
    const newPassword = generateSecurePassword()
    setProfileFormData({ ...profileFormData, password: newPassword })
    setShowProfilePassword(true)
  }

  const copyEditPasswordToClipboard = async () => {
    if (editFormData.password) {
      try {
        await navigator.clipboard.writeText(editFormData.password)
        setEditPasswordCopied(true)
        setTimeout(() => setEditPasswordCopied(false), 2000)
        toast({
          title: "Password Copied",
          description: "Password copied to clipboard successfully"
        })
      } catch (error) {
        toast({
          title: "Copy Failed",
          description: "Failed to copy password to clipboard",
          variant: "destructive"
        })
      }
    }
  }

  const copyProfilePasswordToClipboard = async () => {
    if (profileFormData.password) {
      try {
        await navigator.clipboard.writeText(profileFormData.password)
        setProfilePasswordCopied(true)
        setTimeout(() => setProfilePasswordCopied(false), 2000)
        toast({
          title: "Password Copied",
          description: "Password copied to clipboard successfully"
        })
      } catch (error) {
        toast({
          title: "Copy Failed",
          description: "Failed to copy password to clipboard",
          variant: "destructive"
        })
      }
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setFormError("")

    try {
      await api("/users", {
        method: "POST",
        body: JSON.stringify(formData),
      })
      
      toast({
        title: "Success",
        description: "User created successfully",
      })
      
      setIsCreateDialogOpen(false)
      setFormData({ email: "", name: "", password: "", is_admin: false })
      fetchUsers()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to create user")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setEditFormData({
      email: user.email,
      name: user.name,
      password: "", // Don't prefill password
      is_admin: user.is_admin
    })
    setEditFormError("")
    setIsEditDialogOpen(true)
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    setIsSubmitting(true)
    setEditFormError("")

    try {
      // Only include fields that have changed or password if provided
      const updateData: any = {}
      
      if (editFormData.email !== editingUser.email) {
        updateData.email = editFormData.email
      }
      if (editFormData.name !== editingUser.name) {
        updateData.name = editFormData.name
      }
      if (editFormData.password.trim()) {
        updateData.password = editFormData.password
      }
      if (editFormData.is_admin !== editingUser.is_admin) {
        updateData.is_admin = editFormData.is_admin
      }

      await api(`/users/${editingUser.id}`, {
        method: "PATCH",
        body: JSON.stringify(updateData),
      })
      
      toast({
        title: "Success",
        description: "User updated successfully",
      })
      
      setIsEditDialogOpen(false)
      setEditingUser(null)
      fetchUsers()
    } catch (error) {
      setEditFormError(error instanceof Error ? error.message : "Failed to update user")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditProfile = () => {
    if (!currentUser) return
    setProfileFormData({
      email: currentUser.email,
      name: currentUser.name,
      password: ""
    })
    setProfileFormError("")
    setIsProfileDialogOpen(true)
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return

    setIsSubmitting(true)
    setProfileFormError("")

    try {
      // Only include fields that have changed or password if provided
      const updateData: any = {}
      
      if (profileFormData.email !== currentUser.email) {
        updateData.email = profileFormData.email
      }
      if (profileFormData.name !== currentUser.name) {
        updateData.name = profileFormData.name
      }
      if (profileFormData.password.trim()) {
        updateData.password = profileFormData.password
      }

      const updatedUser = await api("/users/me", {
        method: "PUT",
        body: JSON.stringify(updateData),
      })
      
      toast({
        title: "Success",
        description: "Profile updated successfully",
      })
      
      setIsProfileDialogOpen(false)
      
      // Update auth context with new user data
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_user', JSON.stringify(updatedUser))
      }
      
      fetchUsers()
    } catch (error) {
      setProfileFormError(error instanceof Error ? error.message : "Failed to update profile")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return
    
    setIsDeleting(userToDelete.id)
    try {
      await api(`/users/${userToDelete.id}`, { method: "DELETE" })
      toast({
        title: "Success",
        description: "User deleted successfully",
      })
      fetchUsers()
      setUserToDelete(null)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete user",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="text-muted-foreground">Manage user accounts and permissions</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleEditProfile}>
            <Edit className="w-4 h-4 mr-2" />
            Edit Profile
          </Button>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Add a new user to the system. Admin users can manage other users and access all features.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleCreateUser}>
              <div className="space-y-4 py-4">
                {formError && (
                  <Alert variant="destructive">
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_admin"
                    checked={formData.is_admin}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_admin: checked as boolean })}
                  />
                  <Label htmlFor="is_admin" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Administrator privileges
                  </Label>
                </div>

              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create User"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>

        <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            <DialogHeader className="space-y-4">
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2">
                  <Edit className="h-5 w-5 text-primary" />
                  Edit Profile
                </DialogTitle>
                {currentUser && (
                  <Badge 
                    variant={currentUser.is_superadmin ? "secondary" : currentUser.is_admin ? "default" : "outline"}
                    className={`${
                      currentUser.is_superadmin 
                        ? "bg-orange-500 hover:bg-orange-600" 
                        : currentUser.is_admin 
                        ? "bg-blue-500 hover:bg-blue-600" 
                        : "bg-gray-500 hover:bg-gray-600"
                    } text-white border-none px-3 py-1`}
                  >
                    {currentUser.is_superadmin ? "Root User" : currentUser.is_admin ? "Admin" : "User"}
                  </Badge>
                )}
              </div>
              
              {/* User Preview Card */}
              {currentUser && (
                <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    {currentUser.is_superadmin ? (
                      <Crown className="w-6 h-6 text-orange-600" />
                    ) : currentUser.is_admin ? (
                      <Shield className="w-6 h-6 text-primary" />
                    ) : (
                      <UserIcon className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg truncate">{currentUser.name}</h3>
                      {currentUser.is_superadmin && (
                        <Crown className="h-4 w-4 text-orange-600 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <UserIcon className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{currentUser.email}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-3 w-3" />
                        <span className="text-xs font-medium">Your Account</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <DialogDescription>
                Update your personal information and account settings. Changes will be saved immediately.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              {profileFormError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{profileFormError}</AlertDescription>
                </Alert>
              )}

              {/* Basic Information Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <UserIcon className="h-4 w-4 text-primary" />
                  <h3 className="font-medium text-sm">Personal Information</h3>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profile-name" className="text-sm font-medium">Full Name</Label>
                  <Input
                    id="profile-name"
                    value={profileFormData.name}
                    onChange={(e) => setProfileFormData({ ...profileFormData, name: e.target.value })}
                    placeholder="Enter your full name"
                    className="h-10"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="profile-email" className="text-sm font-medium">Email Address</Label>
                  <Input
                    id="profile-email"
                    type="email"
                    value={profileFormData.email}
                    onChange={(e) => setProfileFormData({ ...profileFormData, email: e.target.value })}
                    placeholder="your@email.com"
                    className="h-10"
                    required
                  />
                </div>
              </div>

              {/* Security Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Shield className="h-4 w-4 text-primary" />
                  <h3 className="font-medium text-sm">Security Settings</h3>
                </div>

                <div className="space-y-4 p-4 bg-muted/20 rounded-lg border">
                  <div className="space-y-2">
                    <Label htmlFor="profile-password" className="text-sm font-medium">Change Password</Label>
                    <div className="relative">
                      <Input
                        id="profile-password"
                        type={showProfilePassword ? "text" : "password"}
                        placeholder="Leave blank to keep current password"
                        value={profileFormData.password}
                        onChange={(e) => setProfileFormData({ ...profileFormData, password: e.target.value })}
                        className="h-10 pr-24"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={copyProfilePasswordToClipboard}
                                disabled={!profileFormData.password}
                              >
                                {profilePasswordCopied ? (
                                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Copy password</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => setShowProfilePassword(!showProfilePassword)}
                              >
                                {showProfilePassword ? (
                                  <EyeOff className="h-3 w-3" />
                                ) : (
                                  <Eye className="h-3 w-3" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{showProfilePassword ? "Hide" : "Show"} password</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={generateProfilePassword}
                        className="flex items-center gap-2"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Generate Password
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Minimum 8 characters recommended
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Only enter a password if you want to change it. Generated passwords are automatically copied to clipboard.
                    </p>
                  </div>
                </div>
              </div>

              {/* Account Info Alert */}
              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/30">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Account Security:</strong> After updating your email or password, you may need to log in again. 
                  Make sure you remember your new credentials.
                </AlertDescription>
              </Alert>
              
              <DialogFooter className="flex gap-2 pt-4 border-t">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsProfileDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="min-w-[120px]">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Profile"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            <DialogHeader className="space-y-4">
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2">
                  <Edit className="h-5 w-5 text-primary" />
                  Edit User
                </DialogTitle>
                {editingUser && (
                  <Badge 
                    variant={editingUser.is_superadmin ? "secondary" : editingUser.is_admin ? "default" : "outline"}
                    className={`${
                      editingUser.is_superadmin 
                        ? "bg-orange-500 hover:bg-orange-600" 
                        : editingUser.is_admin 
                        ? "bg-blue-500 hover:bg-blue-600" 
                        : "bg-gray-500 hover:bg-gray-600"
                    } text-white border-none px-3 py-1`}
                  >
                    {editingUser.is_superadmin ? "Root User" : editingUser.is_admin ? "Admin" : "User"}
                  </Badge>
                )}
              </div>
              
              {/* User Preview Card */}
              {editingUser && (
                <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    {editingUser.is_superadmin ? (
                      <Crown className="w-6 h-6 text-orange-600" />
                    ) : editingUser.is_admin ? (
                      <Shield className="w-6 h-6 text-primary" />
                    ) : (
                      <UserIcon className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg truncate">{editingUser.name}</h3>
                      {editingUser.is_superadmin && (
                        <Crown className="h-4 w-4 text-orange-600 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <UserIcon className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{editingUser.email}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1 text-blue-600">
                        <CheckCircle2 className="h-3 w-3" />
                        <span className="text-xs font-medium">Team Member</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <DialogDescription>
                Update user information and permissions. Changes will take effect immediately.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleUpdateUser} className="space-y-6">
              {editFormError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{editFormError}</AlertDescription>
                </Alert>
              )}

              {/* Basic Information Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <UserIcon className="h-4 w-4 text-primary" />
                  <h3 className="font-medium text-sm">Basic Information</h3>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-name" className="text-sm font-medium">Full Name</Label>
                  <Input
                    id="edit-name"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    placeholder="Enter user's full name"
                    className="h-10"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-email" className="text-sm font-medium">Email Address</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    placeholder="user@example.com"
                    className="h-10"
                    required
                  />
                </div>
              </div>

              {/* Security Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Shield className="h-4 w-4 text-primary" />
                  <h3 className="font-medium text-sm">Security & Permissions</h3>
                </div>

                <div className="space-y-4 p-4 bg-muted/20 rounded-lg border">
                  <div className="space-y-2">
                    <Label htmlFor="edit-password" className="text-sm font-medium">Reset Password</Label>
                    <div className="relative">
                      <Input
                        id="edit-password"
                        type={showEditPassword ? "text" : "password"}
                        placeholder="Leave blank to keep current password"
                        value={editFormData.password}
                        onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                        className="h-10 pr-24"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={copyEditPasswordToClipboard}
                                disabled={!editFormData.password}
                              >
                                {editPasswordCopied ? (
                                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Copy password</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => setShowEditPassword(!showEditPassword)}
                              >
                                {showEditPassword ? (
                                  <EyeOff className="h-3 w-3" />
                                ) : (
                                  <Eye className="h-3 w-3" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{showEditPassword ? "Hide" : "Show"} password</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={generateEditUserPassword}
                        className="flex items-center gap-2"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Generate Password
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Secure 12-character password
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Only enter a password if you want to reset it. User will need to use this new password to log in.
                    </p>
                  </div>

                  <div className="flex flex-row items-start space-x-3 space-y-0 p-3 bg-blue-50 dark:bg-blue-950/30 rounded border border-blue-200 dark:border-blue-800">
                    <div className="mt-1">
                      <Checkbox
                        id="edit-is_admin"
                        checked={editFormData.is_admin}
                        onCheckedChange={(checked) => setEditFormData({ ...editFormData, is_admin: checked as boolean })}
                      />
                    </div>
                    <div className="space-y-1 leading-none">
                      <Label htmlFor="edit-is_admin" className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        Administrator Privileges
                      </Label>
                      <p className="text-xs text-blue-700 dark:text-blue-200">
                        Can manage users, inventory, products, and system settings within the organization.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Notice */}
              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/30">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Security Notice:</strong> Permission changes take effect immediately. 
                  If you reset the password, make sure to communicate the new credentials securely.
                </AlertDescription>
              </Alert>
              
              <DialogFooter className="flex gap-2 pt-4 border-t">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsEditDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="min-w-[100px]">
                  {isSubmitting ? (
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
          </DialogContent>
        </Dialog>
      </div>

      {/* Team Membership Information */}
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/30">
        <UserIcon className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Team Membership:</strong> Users created here will join your organization team. 
          Users who register through the public registration form will create their own separate team.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <UserIcon className="h-5 w-5 text-primary" />
            Users
          </CardTitle>
          <CardDescription>
            {users.length} user{users.length !== 1 ? 's' : ''} in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <StaticTableHeader label="User" />
                <StaticTableHeader label="Email" />
                <StaticTableHeader label="Role" />
                <SortableTableHeader
                  label="Created"
                  sortKey="created_at"
                  currentSort={sortConfig}
                  onSort={handleSort}
                />
                <StaticTableHeader label="Actions" align="center" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedUsers.map((user) => (
                <TableRow key={user.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        {user.is_superadmin ? (
                          <Crown className="w-4 h-4 text-yellow-600" />
                        ) : user.is_admin ? (
                          <Shield className="w-4 h-4 text-primary" />
                        ) : (
                          <UserIcon className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <span className="font-medium">{user.name}</span>
                      {user.is_superadmin && (
                        <span className="text-xs text-yellow-600 font-medium">(Protected)</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    {user.is_superadmin ? (
                      <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-none">
                        SuperAdmin
                      </Badge>
                    ) : (
                      <Badge variant={user.is_admin ? "default" : "secondary"}>
                        {user.is_admin ? "Admin" : "User"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(user.created_at)}</TableCell>
                  <TableCell>
                    {user.id === currentUser?.id ? (
                      // Current user - no actions needed (use Edit Profile button instead)
                      <div className="flex items-center justify-center">
                        <span className="text-xs text-muted-foreground italic">You</span>
                      </div>
                    ) : !user.is_superadmin ? (
                      <div className="flex items-center justify-center gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditUser(user)}
                                className="h-8 w-8 text-amber-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                                title="Edit user"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Edit user</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setUserToDelete(user)}
                                disabled={isDeleting === user.id}
                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                title="Delete user"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Delete user</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete User Confirmation Dialog */}
      <Dialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Delete User
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              Are you sure you want to delete this user?
            </p>
            {userToDelete && (
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg space-y-1 text-sm">
                <p><strong>Name:</strong> {userToDelete.name}</p>
                <p><strong>Email:</strong> {userToDelete.email}</p>
                <p><strong>Role:</strong> {userToDelete.is_superadmin ? "Super Admin" : userToDelete.is_admin ? "Admin" : "User"}</p>
              </div>
            )}
            <p className="text-sm text-red-600">
              This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserToDelete(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteUser}
              disabled={isDeleting === userToDelete?.id}
            >
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}