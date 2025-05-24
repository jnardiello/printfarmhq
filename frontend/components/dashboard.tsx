"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FilamentsTab } from "@/components/tabs/filaments-tab"
import { ProductsTab } from "@/components/tabs/products-tab"
import { PrintersTab } from "@/components/tabs/printers-tab"
import { SubscriptionsTab } from "@/components/tabs/subscriptions-tab"
import { PrintsTab } from "@/components/tabs/prints-tab"
import { UsersTab } from "@/components/tabs/users-tab"
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
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Dashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState("home")
  const { setCurrentTab } = useData()
  const { user } = useAuth()
  const isMobile = useIsMobile()

  // Set the active tab based on URL parameter on initial load
  useEffect(() => {
    const tab = searchParams.get("tab")
    const validTabs = ["home", "filaments", "products", "printers", "subscriptions", "prints"]
    if (user?.is_admin) {
      validTabs.push("users")
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

  const baseTabOptions = [
    { value: "home", label: "Overview" },
    { value: "prints", label: "Prints" },
    { value: "filaments", label: "Filaments" },
    { value: "products", label: "Products" },
    { value: "printers", label: "Printers" },
    { value: "subscriptions", label: "Commercial Licenses" }
  ]
  
  const adminTabOptions = [
    { value: "users", label: "Users" }
  ]
  
  const tabOptions = user?.is_admin 
    ? [...baseTabOptions, ...adminTabOptions]
    : baseTabOptions

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex justify-between items-center">
            <button 
              onClick={handleLogoClick}
              className="text-xl sm:text-2xl font-semibold text-foreground truncate hover:text-foreground/80 transition-colors cursor-pointer"
            >
              PrintFarmHQ
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
                    <span>{tabOptions.find(tab => tab.value === activeTab)?.label || "Menu"}</span>
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
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <Tabs defaultValue="home" value={activeTab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="h-12 bg-transparent space-x-2 mt-1">
                {tabOptions.map((tab) => (
                  <TabsTrigger 
                    key={tab.value} 
                    value={tab.value} 
                    className="data-[state=active]:bg-background"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
        </div>
      </div>

      <main className="flex-1 container mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsContent value="home">
            <HomePage />
          </TabsContent>

          <TabsContent value="filaments">
            <FilamentsTab />
          </TabsContent>

          <TabsContent value="products">
            <ProductsTab />
          </TabsContent>

          <TabsContent value="printers">
            <PrintersTab />
          </TabsContent>

          <TabsContent value="prints">
            <PrintsTab />
          </TabsContent>

          <TabsContent value="subscriptions">
            <SubscriptionsTab />
          </TabsContent>

          {user?.is_admin && (
            <TabsContent value="users">
              <UsersTab />
            </TabsContent>
          )}
        </Tabs>
      </main>
      <Toaster />
    </div>
  )
}
