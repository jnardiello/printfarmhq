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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Users, Building2, UserCheck, MoreHorizontal, Edit, Trash2, Key } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { EditUserModal } from "@/components/modals/edit-user-modal"
import { DeleteUserModal } from "@/components/modals/delete-user-modal"
import { ResetPasswordModal } from "@/components/modals/reset-password-modal"

interface GodDashboardStats {
  total_superadmins: number
  total_users: number
  total_team_members: number
}

interface UserRead {
  id: number
  email: string
  name: string
  is_active: boolean
  is_admin: boolean
  is_superadmin: boolean
  is_god_user: boolean
  created_at: string
}

interface GodUserHierarchy {
  superadmin: UserRead
  team_members: UserRead[]
}

export function GodDashboardTab() {
  const [stats, setStats] = useState<GodDashboardStats | null>(null)
  const [userHierarchy, setUserHierarchy] = useState<GodUserHierarchy[]>([])
  const [loading, setLoading] = useState(true)

  // Modal states
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserRead | null>(null)

  useEffect(() => {
    fetchGodData()
  }, [])

  const fetchGodData = async () => {
    try {
      setLoading(true)
      
      // Fetch stats using the standardized api function
      const statsData = await api<GodDashboardStats>("/god/stats")
      setStats(statsData)
      
      // Fetch user hierarchy using the standardized api function
      const hierarchyData = await api<GodUserHierarchy[]>("/god/users")
      console.log("Fetched user hierarchy:", hierarchyData) // Debug log
      setUserHierarchy(hierarchyData)
    } catch (error) {
      console.error("Error fetching god dashboard data:", error)
      toast.error("Failed to load god dashboard data")
    } finally {
      setLoading(false)
    }
  }

  // Modal handlers
  const handleEditUser = (user: UserRead) => {
    setSelectedUser(user)
    setEditModalOpen(true)
  }

  const handleDeleteUser = (user: UserRead) => {
    setSelectedUser(user)
    setDeleteModalOpen(true)
  }

  const handleResetPassword = (user: UserRead) => {
    setSelectedUser(user)
    setPasswordModalOpen(true)
  }

  const handleModalSuccess = () => {
    fetchGodData() // Refresh the data
  }

  const closeModals = () => {
    setEditModalOpen(false)
    setDeleteModalOpen(false)
    setPasswordModalOpen(false)
    setSelectedUser(null)
  }

  // User actions component
  const UserActions = ({ user }: { user: UserRead }) => {
    console.log("Rendering UserActions for user:", user.name, user.id) // Debug log
    
    // Temporary: Using visible buttons instead of dropdown for debugging
    return (
      <div className="flex items-center gap-1">
        <Button 
          variant="outline" 
          size="sm" 
          className="h-6 px-2 text-xs"
          onClick={() => {
            console.log("Edit clicked for:", user.name)
            handleEditUser(user)
          }}
        >
          <Edit className="h-3 w-3" />
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-6 px-2 text-xs"
          onClick={() => {
            console.log("Reset password clicked for:", user.name)
            handleResetPassword(user)
          }}
        >
          <Key className="h-3 w-3" />
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
          onClick={() => {
            console.log("Delete clicked for:", user.name)
            handleDeleteUser(user)
          }}
          disabled={user.is_god_user}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="text-sm text-muted-foreground">Loading god dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Compact User Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Users Overview</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {/* Total Users */}
            <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-950/50 rounded">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-sm">Total Users</span>
              </div>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {stats?.total_users || 0}
              </span>
            </div>

            {/* Organizations and Team Members */}
            <div className="ml-4 space-y-2">
              <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950/50 rounded border-l-2 border-green-500">
                <div className="flex items-center gap-2">
                  <Building2 className="h-3 w-3 text-green-600" />
                  <span className="text-sm">Root Users</span>
                </div>
                <span className="font-semibold text-green-600 dark:text-green-400">
                  {stats?.total_superadmins || 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 bg-orange-50 dark:bg-orange-950/50 rounded border-l-2 border-orange-500">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-3 w-3 text-orange-600" />
                  <span className="text-sm">Team Members</span>
                </div>
                <span className="font-semibold text-orange-600 dark:text-orange-400">
                  {stats?.total_team_members || 0}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compact Users List */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Users List</CardTitle>
          <CardDescription>
            All root users and their team members
          </CardDescription>
        </CardHeader>
        <CardContent>
          {userHierarchy.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No root users registered yet
            </div>
          ) : (
            <div className="space-y-4">
              {userHierarchy.map((org) => {
                console.log("Rendering org:", org.superadmin.name) // Debug log
                return (
                <div key={org.superadmin.id} className="border rounded-lg overflow-hidden">
                  {/* Root User Row */}
                  <div className="p-3 bg-muted/30 border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {org.superadmin.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-sm truncate">{org.superadmin.name}</h4>
                            <Badge variant="secondary" className="text-xs px-1.5 py-0.5">Root</Badge>
                            {org.superadmin.is_god_user && (
                              <Badge variant="default" className="text-xs px-1.5 py-0.5 bg-purple-600 hover:bg-purple-700">
                                God
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{org.superadmin.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className={`h-2 w-2 rounded-full ${org.superadmin.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-xs text-muted-foreground">
                          {org.team_members.length} {org.team_members.length === 1 ? 'member' : 'members'}
                        </span>
                        {console.log("About to render UserActions for:", org.superadmin.name)}
                        <UserActions user={org.superadmin} />
                      </div>
                    </div>
                  </div>

                  {/* Team Members */}
                  {org.team_members.length > 0 && (
                    <div className="divide-y">
                      {org.team_members.map((member) => (
                        <div key={member.id} className="p-3 pl-6 hover:bg-muted/20 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">
                                  {member.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm truncate">{member.name}</span>
                                  <Badge variant={member.is_admin ? "default" : "outline"} className="text-xs px-1.5 py-0.5">
                                    {member.is_admin ? "Admin" : "User"}
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                                    ← {org.superadmin.name}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <div className={`h-2 w-2 rounded-full ${member.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                              <span className="text-xs text-muted-foreground">
                                {new Date(member.created_at).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric',
                                  year: '2-digit'
                                })}
                              </span>
                              <UserActions user={member} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {org.team_members.length === 0 && (
                    <div className="p-3 pl-6 text-xs text-muted-foreground italic">
                      No team members yet
                    </div>
                  )}
                </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <EditUserModal
        isOpen={editModalOpen}
        onClose={closeModals}
        user={selectedUser}
        onSuccess={handleModalSuccess}
      />
      <DeleteUserModal
        isOpen={deleteModalOpen}
        onClose={closeModals}
        user={selectedUser}
        onSuccess={handleModalSuccess}
      />
      <ResetPasswordModal
        isOpen={passwordModalOpen}
        onClose={closeModals}
        user={selectedUser}
        onSuccess={handleModalSuccess}
      />
    </div>
  )
}