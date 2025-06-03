"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface PrintJobsData {
  date: string
  total_count: number
}

interface PrintJobsChartProps {
  data: PrintJobsData[]
}

export function PrintJobsChart({ data }: PrintJobsChartProps) {
  // Transform data for chart display
  const chartData = data.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    }),
    'Print Jobs': item.total_count,
  }))

  // Calculate total print jobs
  const totalPrintJobs = data.reduce((sum, item) => sum + item.total_count, 0)

  // Calculate average daily jobs
  const avgDailyJobs = data.length > 0 ? (totalPrintJobs / data.length).toFixed(1) : '0'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Print Job Activity</CardTitle>
        <CardDescription>
          Daily print job creation ({totalPrintJobs} total jobs, {avgDailyJobs} avg/day)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip 
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col">
                          <span className="text-[0.70rem] uppercase text-muted-foreground">
                            Date
                          </span>
                          <span className="font-bold text-muted-foreground">
                            {label}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[0.70rem] uppercase text-muted-foreground">
                            Print Jobs
                          </span>
                          <span className="font-bold" style={{ color: payload[0]?.color }}>
                            {payload[0]?.value}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar
              dataKey="Print Jobs"
              fill="#82ca9d"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}