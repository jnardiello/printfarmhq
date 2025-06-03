"use client"

import { useState, useEffect } from "react"
import { GodAdminDropdown } from "./god-admin-dropdown"
import { MetricsDashboard } from "./metrics/metrics-dashboard"
import { UsersManagement } from "./users/users-management"
import { PasswordResetRequests } from "./notifications/password-reset-requests"
import { api } from "@/lib/api"

type GodAdminSection = "metrics" | "users" | "notifications"

export function GodAdminContainer() {
  const [currentSection, setCurrentSection] = useState<GodAdminSection>("metrics")
  const [notificationCount, setNotificationCount] = useState(0)

  useEffect(() => {
    fetchNotificationCount()

    // Listen for god dashboard updates
    const handleGodDashboardUpdate = () => {
      fetchNotificationCount()
    }
    window.addEventListener('godDashboardUpdate', handleGodDashboardUpdate)

    // Refresh every 30 seconds
    const interval = setInterval(fetchNotificationCount, 30000)

    return () => {
      clearInterval(interval)
      window.removeEventListener('godDashboardUpdate', handleGodDashboardUpdate)
    }
  }, [])

  const fetchNotificationCount = async () => {
    try {
      const requests = await api("/god/password-reset/requests")
      setNotificationCount(requests?.length || 0)
    } catch (error) {
      console.error("Error fetching god notification count:", error)
      setNotificationCount(0)
    }
  }

  const handleSectionChange = (section: GodAdminSection) => {
    setCurrentSection(section)
  }

  const renderCurrentSection = () => {
    switch (currentSection) {
      case "metrics":
        return <MetricsDashboard />
      case "users":
        return <UsersManagement />
      case "notifications":
        return <PasswordResetRequests />
      default:
        return <MetricsDashboard />
    }
  }

  return (
    <div className="space-y-6">
      {/* God Admin Navigation */}
      <div className="flex items-center justify-between">
        <GodAdminDropdown
          currentSection={currentSection}
          onSectionChange={handleSectionChange}
          notificationCount={notificationCount}
        />
      </div>

      {/* Current Section Content */}
      {renderCurrentSection()}
    </div>
  )
}