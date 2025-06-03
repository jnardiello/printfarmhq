"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, Calendar } from "lucide-react"
import { api } from "@/lib/api"
import { UserGrowthChart } from "./user-growth-chart"
import { ProductsChart } from "./products-chart"
import { PrintJobsChart } from "./print-jobs-chart"
import { ActiveUsersChart } from "./active-users-chart"
import { EngagementChart } from "./engagement-chart"
import { BusinessChart } from "./business-chart"

interface MetricsData {
  users: Array<{
    date: string
    total_count: number
    superadmins: number
    regular_users: number
  }>
  products: Array<{
    date: string
    total_count: number
  }>
  print_jobs: Array<{
    date: string
    total_count: number
  }>
}

interface ActiveUserMetric {
  date: string
  daily_active_users: number
  weekly_active_users: number
  monthly_active_users: number
  new_vs_returning: { new: number; returning: number }
}

interface EngagementMetric {
  date: string
  total_logins: number
  unique_users_logged_in: number
  avg_actions_per_user: number
  peak_hour: number | null
  feature_usage: Record<string, number>
}

interface BusinessMetric {
  date: string
  total_filament_consumed_g: number
  avg_print_time_hrs: number
  print_success_rate: number
  top_products: Array<{ name: string; count: number }>
  top_filaments: Array<{ name: string; usage_g: number }>
}

interface EnhancedMetricsData {
  activeUsers: ActiveUserMetric[]
  engagement: EngagementMetric[]
  business: BusinessMetric[]
}

export function MetricsDashboard() {
  const [data, setData] = useState<MetricsData | null>(null)
  const [enhancedData, setEnhancedData] = useState<EnhancedMetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(30)

  const fetchMetricsData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      console.log('Fetching metrics data for', days, 'days...')
      
      // Check authentication token
      const token = localStorage.getItem('auth_token')
      console.log('Current auth token:', token ? token.substring(0, 20) + '...' : 'No token found')
      
      // First test a simpler endpoint
      console.log('Testing god/stats endpoint first...')
      const statsData = await api('/god/stats')
      console.log('Stats data received:', statsData)
      
      // Fetch original metrics
      const metricsData = await api<MetricsData>(`/god/metrics/summary?days=${days}`)
      console.log('Metrics data received:', metricsData)
      setData(metricsData)
      
      // Fetch enhanced metrics
      console.log('Fetching enhanced metrics...')
      const [activeUsersData, engagementData, businessData] = await Promise.all([
        api<ActiveUserMetric[]>(`/god/metrics/active-users?days=${days}`),
        api<EngagementMetric[]>(`/god/metrics/engagement?days=${days}`),
        api<BusinessMetric[]>(`/god/metrics/business?days=${days}`)
      ])
      
      const enhancedMetrics: EnhancedMetricsData = {
        activeUsers: activeUsersData,
        engagement: engagementData,
        business: businessData
      }
      
      console.log('Enhanced metrics received:', enhancedMetrics)
      setEnhancedData(enhancedMetrics)
    } catch (err) {
      console.error('Error fetching metrics:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetricsData()
  }, [days])

  const handleRefresh = () => {
    fetchMetricsData()
  }

  const handleDaysChange = (newDays: number) => {
    setDays(newDays)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading metrics...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-600">
            <p className="text-lg font-semibold mb-2">Error loading metrics</p>
            <p className="text-sm bg-red-50 p-4 rounded mb-4 font-mono">{error}</p>
            <Button onClick={handleRefresh} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-gray-500">
            No metrics data available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">God Admin Metrics</h2>
          <p className="text-muted-foreground">
            System-wide analytics and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Days selector */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">Days:</span>
            {[7, 30, 90].map((dayOption) => (
              <Button
                key={dayOption}
                variant={days === dayOption ? "default" : "outline"}
                size="sm"
                onClick={() => handleDaysChange(dayOption)}
              >
                {dayOption}
              </Button>
            ))}
          </div>
          
          {/* Refresh button */}
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.users.reduce((sum, day) => sum + day.total_count, 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.users.reduce((sum, day) => sum + day.superadmins, 0)} superadmins, {' '}
              {data.users.reduce((sum, day) => sum + day.regular_users, 0)} regular users
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.products.reduce((sum, day) => sum + day.total_count, 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all organizations
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Total Print Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.print_jobs.reduce((sum, day) => sum + day.total_count, 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              In the last {days} days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UserGrowthChart data={data.users} />
        <ProductsChart data={data.products} />
      </div>
      
      <div className="grid grid-cols-1">
        <PrintJobsChart data={data.print_jobs} />
      </div>

      {/* Enhanced Metrics Charts */}
      {enhancedData && (
        <>
          {/* Enhanced Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ActiveUsersChart data={enhancedData.activeUsers} />
            <EngagementChart data={enhancedData.engagement} />
          </div>
          
          {/* Enhanced Charts Row 2 */}
          <div className="grid grid-cols-1">
            <BusinessChart data={enhancedData.business} />
          </div>

          {/* Top Products and Filaments Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Products ({days} days)</CardTitle>
                <CardDescription>Most frequently printed products</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {enhancedData.business
                    .flatMap(day => day.top_products)
                    .reduce((acc, product) => {
                      const existing = acc.find(p => p.name === product.name)
                      if (existing) {
                        existing.count += product.count
                      } else {
                        acc.push({ ...product })
                      }
                      return acc
                    }, [] as Array<{ name: string; count: number }>)
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5)
                    .map((product, index) => (
                      <div key={product.name} className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          {index + 1}. {product.name}
                        </span>
                        <span className="text-sm font-medium">{product.count}</span>
                      </div>
                    ))
                  }
                  {enhancedData.business.flatMap(day => day.top_products).length === 0 && (
                    <p className="text-sm text-muted-foreground">No product data available</p>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Filaments ({days} days)</CardTitle>
                <CardDescription>Most consumed filament materials</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {enhancedData.business
                    .flatMap(day => day.top_filaments)
                    .reduce((acc, filament) => {
                      const existing = acc.find(f => f.name === filament.name)
                      if (existing) {
                        existing.usage_g += filament.usage_g
                      } else {
                        acc.push({ ...filament })
                      }
                      return acc
                    }, [] as Array<{ name: string; usage_g: number }>)
                    .sort((a, b) => b.usage_g - a.usage_g)
                    .slice(0, 5)
                    .map((filament, index) => (
                      <div key={filament.name} className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          {index + 1}. {filament.name}
                        </span>
                        <span className="text-sm font-medium">{(filament.usage_g / 1000).toFixed(1)}kg</span>
                      </div>
                    ))
                  }
                  {enhancedData.business.flatMap(day => day.top_filaments).length === 0 && (
                    <p className="text-sm text-muted-foreground">No filament data available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}