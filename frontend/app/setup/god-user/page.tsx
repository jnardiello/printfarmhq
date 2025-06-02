"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { GodUserSelection } from "@/components/auth/god-user-selection"
import { Loader2 } from "lucide-react"

export default function GodUserSelectionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [needsGodUser, setNeedsGodUser] = useState(false)

  useEffect(() => {
    checkSetupStatus()
  }, [])

  const checkSetupStatus = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/setup-status`
      )
      
      if (!response.ok) {
        throw new Error("Failed to check setup status")
      }
      
      const data = await response.json()
      
      if (!data.god_user_required) {
        // God user already exists or no setup required
        router.push("/")
      } else {
        setNeedsGodUser(true)
      }
    } catch (error) {
      console.error("Error checking setup status:", error)
      router.push("/")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!needsGodUser) {
    return null
  }

  return <GodUserSelection />
}