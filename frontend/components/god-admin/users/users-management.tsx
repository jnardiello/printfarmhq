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
import { Users, Building2, UserCheck, Edit, Trash2, Key, RefreshCw } from "lucide-react"
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

export function UsersManagement() {
  const [stats, setStats] = useState<GodDashboardStats | null>(null)
  const [userHierarchy, setUserHierarchy] = useState<GodUserHierarchy[]>([])
  const [loading, setLoading] = useState(true)

  // Modal states
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserRead | null>(null)

  useEffect(() => {
    fetchUsersData()
  }, [])

  const fetchUsersData = async () => {
    try {
      setLoading(true)
      
      // Fetch stats and users data
      const statsData = await api<GodDashboardStats>("/god/stats")
      setStats(statsData)
      
      const usersData = await api<GodUserHierarchy[]>("/god/users")
      setUserHierarchy(usersData)
    } catch (error) {
      console.error("Error fetching god dashboard data:", error)
      toast.error("Failed to load user management data")
    } finally {
      setLoading(false)
    }
  }

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

  const handleUserUpdate = () => {
    fetchUsersData()
    // Trigger a refresh of the parent dashboard notification count
    window.dispatchEvent(new CustomEvent('godDashboardUpdate'))
  }

  const UserActions = ({ user }: { user: UserRead }) => {
    return (
      <div className="flex items-center gap-1">
        <Button 
          variant="outline" 
          size="sm" 
          className="h-6 px-2 text-xs"
          onClick={() => handleEditUser(user)}
        >
          <Edit className="h-3 w-3" />
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-6 px-2 text-xs"
          onClick={() => handleResetPassword(user)}
        >
          <Key className="h-3 w-3" />
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
          onClick={() => handleDeleteUser(user)}
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
            <RefreshCw className="h-8 w-8 animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Loading users...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="text-muted-foreground">
            Manage all users across organizations
          </p>
        </div>
        <Button onClick={fetchUsersData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Stats Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Users Overview</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-950/50 rounded">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-sm">Total Users</span>
              </div>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {stats?.total_users || 0}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950/50 rounded">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-green-600" />
                <span className="font-medium text-sm">Organizations (Superadmins)</span>
              </div>
              <span className="text-lg font-bold text-green-600 dark:text-green-400">
                {stats?.total_superadmins || 0}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 bg-purple-50 dark:bg-purple-950/50 rounded">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-purple-600" />
                <span className="font-medium text-sm">Team Members</span>
              </div>
              <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                {stats?.total_team_members || 0}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Hierarchy */}
      <Card>
        <CardHeader>
          <CardTitle>Users by Organization</CardTitle>
          <CardDescription>
            Hierarchical view of all users grouped by organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {userHierarchy.map((org) => (
              <div key={org.superadmin.id} className="space-y-3">
                {/* Organization Header */}
                <div className="flex items-center gap-3 pb-2 border-b">
                  <Building2 className="h-4 w-4 text-green-600" />
                  <span className="font-semibold text-green-700 dark:text-green-400">
                    {org.superadmin.name}'s Organization
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {org.team_members.length + 1} users
                  </Badge>
                </div>

                {/* Organization Users Table */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Superadmin */}
                    <TableRow>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {org.superadmin.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{org.superadmin.name}</span>
                          {org.superadmin.is_god_user && (
                            <Badge variant="destructive" className="text-xs px-1.5 py-0.5">GOD</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{org.superadmin.email}</TableCell>
                      <TableCell>
                        <Badge variant="default" className="text-xs">
                          {org.superadmin.is_god_user ? "God Admin" : "Organization Admin"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={org.superadmin.is_active ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {org.superadmin.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <UserActions user={org.superadmin} />
                      </TableCell>
                    </TableRow>

                    {/* Team Members */}
                    {org.team_members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-2 border-l-2 border-gray-300 h-4 ml-4"></div>
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {member.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{member.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{member.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {member.is_admin ? "Team Admin" : "Team Member"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={member.is_active ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {member.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <UserActions user={member} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <EditUserModal
        user={selectedUser}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSuccess={handleUserUpdate}
      />

      <DeleteUserModal
        user={selectedUser}
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onSuccess={handleUserUpdate}
      />

      <ResetPasswordModal
        user={selectedUser}
        open={passwordModalOpen}
        onOpenChange={setPasswordModalOpen}
        onSuccess={handleUserUpdate}
      />
    </div>
  )
}