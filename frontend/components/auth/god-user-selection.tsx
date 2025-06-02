"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Crown, Loader2 } from "lucide-react"

interface User {
  id: number
  email: string
  name: string
  is_active: boolean
  is_admin: boolean
  is_superadmin: boolean
  is_god_user: boolean
  created_at: string
}

export function GodUserSelection() {
  const router = useRouter()
  const [superadmins, setSuperadmins] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchSuperadmins()
  }, [])

  const fetchSuperadmins = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/superadmins`
      )
      
      if (!response.ok) {
        throw new Error("Failed to fetch super-admins")
      }
      
      const data = await response.json()
      setSuperadmins(data)
      
      // Pre-select the first super-admin
      if (data.length > 0) {
        setSelectedUserId(data[0].id.toString())
      }
    } catch (error) {
      console.error("Error fetching super-admins:", error)
      toast.error("Failed to load super-admins")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!selectedUserId) {
      toast.error("Please select a user to be the god user")
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/select-god-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: parseInt(selectedUserId),
          }),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || "Failed to set god user")
      }

      const data = await response.json()
      
      // Store the token and user info
      localStorage.setItem("token", data.access_token)
      localStorage.setItem("user", JSON.stringify(data.user))
      
      toast.success("God user selected successfully!")
      
      // Redirect to dashboard
      router.push("/")
    } catch (error) {
      console.error("Error selecting god user:", error)
      toast.error(error instanceof Error ? error.message : "Failed to set god user")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (superadmins.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>No Super-Admins Found</CardTitle>
            <CardDescription>
              No super-admin accounts exist in the system. Please complete the initial setup first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => router.push("/setup")}
              className="w-full"
            >
              Go to Setup
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-yellow-500" />
            <CardTitle>Select God User</CardTitle>
          </div>
          <CardDescription>
            The system requires a god user who can oversee all organizations. 
            Please select which super-admin should have this role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={selectedUserId}
            onValueChange={setSelectedUserId}
            className="space-y-4"
          >
            {superadmins.map((user) => (
              <div key={user.id} className="flex items-center space-x-4">
                <RadioGroupItem value={user.id.toString()} id={`user-${user.id}`} />
                <Label
                  htmlFor={`user-${user.id}`}
                  className="flex items-center gap-3 flex-1 cursor-pointer"
                >
                  <Avatar>
                    <AvatarFallback>
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Joined: {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>
          
          <div className="mt-6 space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> The god user will have access to all data across all organizations 
                and can manage all aspects of the system. This selection is permanent.
              </p>
            </div>
            
            <Button
              onClick={handleSubmit}
              disabled={!selectedUserId || submitting}
              className="w-full"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting God User...
                </>
              ) : (
                "Confirm Selection"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}