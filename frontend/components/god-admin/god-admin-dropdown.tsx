"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, BarChart3, Users, Bell } from "lucide-react"

interface GodAdminDropdownProps {
  currentSection: "metrics" | "users" | "notifications"
  onSectionChange: (section: "metrics" | "users" | "notifications") => void
  notificationCount?: number
  isActive?: boolean
  onNavigateToGodAdmin?: () => void
}

export function GodAdminDropdown({ 
  currentSection, 
  onSectionChange, 
  notificationCount = 0,
  isActive = false,
  onNavigateToGodAdmin
}: GodAdminDropdownProps) {
  const getSectionIcon = (section: string) => {
    switch (section) {
      case "metrics":
        return <BarChart3 className="h-4 w-4" />
      case "users":
        return <Users className="h-4 w-4" />
      case "notifications":
        return <Bell className="h-4 w-4" />
      default:
        return null
    }
  }

  const getSectionLabel = (section: string) => {
    switch (section) {
      case "metrics":
        return "Metrics"
      case "users":
        return "Users"
      case "notifications":
        return "Notifications"
      default:
        return ""
    }
  }

  const handleSectionClick = (section: "metrics" | "users" | "notifications") => {
    if (!isActive && onNavigateToGodAdmin) {
      // If not on God Admin tab, navigate there first
      onNavigateToGodAdmin()
      // Set section after navigation (with a small delay to ensure navigation completes)
      setTimeout(() => onSectionChange(section), 0)
    } else {
      // If already on God Admin tab, just change section
      onSectionChange(section)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={isActive ? "default" : "ghost"} 
          className="h-10 gap-2 relative"
        >
          God Admin
          {notificationCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {notificationCount}
            </Badge>
          )}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => handleSectionClick("metrics")}
          className="gap-2 cursor-pointer"
        >
          <BarChart3 className="h-4 w-4" />
          Metrics
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleSectionClick("users")}
          className="gap-2 cursor-pointer"
        >
          <Users className="h-4 w-4" />
          Users
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleSectionClick("notifications")}
          className="gap-2 cursor-pointer"
        >
          <Bell className="h-4 w-4" />
          Notifications
          {notificationCount > 0 && (
            <Badge variant="destructive" className="ml-auto px-1.5 py-0.5 text-xs">
              {notificationCount}
            </Badge>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}