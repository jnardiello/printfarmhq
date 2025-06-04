"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTheme } from "next-themes"
// Removed Tabs components as we now use custom navigation
import { FilamentsTab } from "@/components/tabs/filaments-tab"
import { ProductsTab } from "@/components/tabs/products-tab"
import { PrintersTab } from "@/components/tabs/printers-tab"
import { SubscriptionsTab } from "@/components/tabs/subscriptions-tab"
import { PrintsTab } from "@/components/tabs/prints-tab"
import { UsersTab } from "@/components/tabs/users-tab"
import { FilamentTypesTab } from "@/components/tabs/filament-types-tab"
import { GodAdminDropdown } from "@/components/god-admin/god-admin-dropdown"
import { MetricsDashboard } from "@/components/god-admin/metrics/metrics-dashboard"
import { UsersManagement } from "@/components/god-admin/users/users-management"
import { PasswordResetRequests } from "@/components/god-admin/notifications/password-reset-requests"
import { HomePage } from "@/components/home-page"
import { Toaster } from "@/components/ui/toaster"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserMenu } from "@/components/auth/user-menu"
import { useAuth } from "@/components/auth/auth-context"
import { useData } from "@/components/data-provider"
import { useIsMobile } from "@/hooks/use-mobile"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu"
import { Menu, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"

export function Dashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState("home")
  const [godAdminSection, setGodAdminSection] = useState<"metrics" | "users" | "notifications">("metrics")
  const { setCurrentTab } = useData()
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const { theme } = useTheme()
  const [godNotificationCount, setGodNotificationCount] = useState(0)

  // Set the active tab based on URL parameter on initial load
  useEffect(() => {
    const tab = searchParams.get("tab")
    const validTabs = ["home", "filaments", "products", "printers", "subscriptions", "prints"]
    if (user?.is_admin) {
      validTabs.push("users", "filament-types")
    }
    if (user?.is_god_user) {
      validTabs.push("god-admin")
    }
    
    if (tab && validTabs.includes(tab)) {
      setActiveTab(tab)
      setCurrentTab(tab)
    } else {
      // Default to home if no tab is specified
      setActiveTab("home")
      setCurrentTab("home")
      // Update URL to include tab=home
      router.push("/?tab=home", { shallow: true })
    }
  }, [searchParams, router, setCurrentTab, user])

  // Update URL when changing tabs
  const handleTabChange = (value: string) => {
    setActiveTab(value)
    setCurrentTab(value)
    if (value === "home") {
      router.push("/?tab=home")
    } else {
      router.push(`?tab=${value}`)
    }
  }

  // Handle clicking the logo/title to go to home
  const handleLogoClick = () => {
    handleTabChange("home")
  }

  // Fetch god admin notifications count (for god users only)
  useEffect(() => {
    if (!user?.is_god_user) return

    const fetchNotificationCount = async () => {
      try {
        const requests = await api("/god/password-reset/requests")
        setGodNotificationCount(requests?.length || 0)
      } catch (error) {
        console.error("Error fetching god notification count:", error)
        setGodNotificationCount(0)
      }
    }

    // Fetch initially
    fetchNotificationCount()

    // Refresh every 30 seconds
    const interval = setInterval(fetchNotificationCount, 30000)

    // Listen for god dashboard updates
    const handleGodDashboardUpdate = () => {
      fetchNotificationCount()
    }
    window.addEventListener('godDashboardUpdate', handleGodDashboardUpdate)

    return () => {
      clearInterval(interval)
      window.removeEventListener('godDashboardUpdate', handleGodDashboardUpdate)
    }
  }, [user?.is_god_user])

  const baseTabOptions = [
    { value: "home", label: "Overview" },
    { value: "prints", label: "Print Jobs" }
  ]

  const inventoryOptions = [
    { value: "filaments", label: "Filaments" },
    { value: "products", label: "Products" },
    { value: "printers", label: "Printers" },
    { value: "subscriptions", label: "Commercial Licenses" }
  ]
  
  const configurationOptions = [
    { value: "users", label: "Users" },
    { value: "filament-types", label: "Filament Types" }
  ]

  // Add God Admin as the very last option after configurations
  const godAdminOptions = user?.is_god_user ? [
    { value: "god-admin", label: "God Admin" }
  ] : []
  
  const tabOptions = baseTabOptions

  const allTabOptions = [
    ...baseTabOptions, 
    ...inventoryOptions, 
    ...(user?.is_admin ? configurationOptions : []),
    ...godAdminOptions
  ]
  
  const isInventoryTab = inventoryOptions.some(option => option.value === activeTab)
  const isConfigurationTab = configurationOptions.some(option => option.value === activeTab)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex justify-between items-center">
            <button 
              onClick={handleLogoClick}
              className="flex items-center gap-3 text-xl sm:text-2xl font-semibold text-foreground hover:text-foreground/80 transition-colors cursor-pointer"
            >
              <img
                src={theme === 'dark' ? "/logo-white.png" : "/logo.png"}
                alt="PrintFarmHQ Logo"
                className="w-12 h-12 sm:w-16 sm:h-16 object-contain"
              />
              <span className="truncate">PrintFarmHQ</span>
            </button>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-3 sm:px-6">
          {isMobile ? (
            <div className="py-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full flex justify-between items-center">
                    <span>{allTabOptions.find(tab => tab.value === activeTab)?.label || "Menu"}</span>
                    <Menu className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[calc(100vw-2rem)] max-w-[300px]">
                  {tabOptions.map((tab) => (
                    <DropdownMenuItem 
                      key={tab.value}
                      className={activeTab === tab.value ? "bg-accent text-accent-foreground" : ""}
                      onClick={() => handleTabChange(tab.value)}
                    >
                      {tab.label}
                    </DropdownMenuItem>
                  ))}
                  
                  <DropdownMenuItem className="font-medium text-muted-foreground">
                    Inventory
                  </DropdownMenuItem>
                  {inventoryOptions.map((tab) => (
                    <DropdownMenuItem 
                      key={tab.value}
                      className={`ml-4 ${activeTab === tab.value ? "bg-accent text-accent-foreground" : ""}`}
                      onClick={() => handleTabChange(tab.value)}
                    >
                      {tab.label}
                    </DropdownMenuItem>
                  ))}
                  
                  {user?.is_admin && (
                    <>
                      <DropdownMenuItem className="font-medium text-muted-foreground">
                        Configurations
                      </DropdownMenuItem>
                      {configurationOptions.map((tab) => (
                        <DropdownMenuItem 
                          key={tab.value}
                          className={`ml-4 ${activeTab === tab.value ? "bg-accent text-accent-foreground" : ""}`}
                          onClick={() => handleTabChange(tab.value)}
                        >
                          {tab.label}
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                  
                  {user?.is_god_user && (
                    <>
                      <DropdownMenuItem className="font-medium text-muted-foreground">
                        System
                      </DropdownMenuItem>
                      {godAdminOptions.map((tab) => (
                        <DropdownMenuItem 
                          key={tab.value}
                          className={`ml-4 ${activeTab === tab.value ? "bg-accent text-accent-foreground" : ""}`}
                          onClick={() => handleTabChange(tab.value)}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span>{tab.label}</span>
                            {godNotificationCount > 0 && (
                              <Badge 
                                variant="destructive" 
                                className="h-4 w-4 rounded-full p-0 flex items-center justify-center text-xs ml-2"
                              >
                                {godNotificationCount}
                              </Badge>
                            )}
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="py-2">
              <div className="flex items-center space-x-1">
                {tabOptions.map((tab) => (
                  <Button
                    key={tab.value}
                    variant={activeTab === tab.value ? "default" : "ghost"}
                    className="h-10"
                    onClick={() => handleTabChange(tab.value)}
                  >
                    {tab.label}
                  </Button>
                ))}
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant={isInventoryTab ? "default" : "ghost"}
                      className="h-10 flex items-center gap-1"
                    >
                      Inventory
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {inventoryOptions.map((option) => (
                      <DropdownMenuItem
                        key={option.value}
                        onClick={() => handleTabChange(option.value)}
                        className={activeTab === option.value ? "bg-accent text-accent-foreground" : ""}
                      >
                        {option.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {user?.is_admin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant={isConfigurationTab ? "default" : "ghost"}
                        className="h-10 flex items-center gap-1"
                      >
                        Configurations
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {configurationOptions.map((option) => (
                        <DropdownMenuItem
                          key={option.value}
                          onClick={() => handleTabChange(option.value)}
                          className={activeTab === option.value ? "bg-accent text-accent-foreground" : ""}
                        >
                          {option.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {user?.is_god_user && (
                  <GodAdminDropdown
                    currentSection={godAdminSection}
                    onSectionChange={setGodAdminSection}
                    notificationCount={godNotificationCount}
                    isActive={activeTab === "god-admin"}
                    onNavigateToGodAdmin={() => handleTabChange("god-admin")}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <main className="flex-1 container mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {activeTab === "home" && <HomePage />}
        {activeTab === "filaments" && <FilamentsTab />}
        {activeTab === "products" && <ProductsTab onNavigateToTab={setActiveTab} />}
        {activeTab === "printers" && <PrintersTab />}
        {activeTab === "prints" && <PrintsTab />}
        {activeTab === "subscriptions" && <SubscriptionsTab />}
        {user?.is_admin && activeTab === "users" && <UsersTab />}
        {user?.is_admin && activeTab === "filament-types" && <FilamentTypesTab />}
        {user?.is_god_user && activeTab === "god-admin" && (
          <>
            {godAdminSection === "metrics" && <MetricsDashboard />}
            {godAdminSection === "users" && <UsersManagement />}
            {godAdminSection === "notifications" && <PasswordResetRequests />}
          </>
        )}
      </main>
      <Toaster />
    </div>
  )
}
