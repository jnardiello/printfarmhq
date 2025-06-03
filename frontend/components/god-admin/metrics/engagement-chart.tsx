"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Bar,
} from "recharts"

interface EngagementMetric {
  date: string
  total_logins: number
  unique_users_logged_in: number
  avg_actions_per_user: number
  peak_hour: number | null
  feature_usage: Record<string, number>
}

interface EngagementChartProps {
  data: EngagementMetric[]
}

export function EngagementChart({ data }: EngagementChartProps) {
  // Transform data for chart display
  const chartData = data.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    }),
    'Total Logins': item.total_logins,
    'Unique Users': item.unique_users_logged_in,
    'Avg Actions/User': parseFloat(item.avg_actions_per_user.toFixed(1)),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Engagement</CardTitle>
        <CardDescription>
          Daily login activity and user engagement metrics
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              yAxisId="left"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
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
                        {payload.map((entry, index) => (
                          <div key={index} className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              {entry.dataKey}
                            </span>
                            <span className="font-bold" style={{ color: entry.color }}>
                              {entry.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            <Legend />
            <Bar
              yAxisId="left"
              dataKey="Total Logins"
              fill="#8884d8"
              opacity={0.6}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="Unique Users"
              stroke="#82ca9d"
              strokeWidth={2}
              dot={{ fill: "#82ca9d", strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="Avg Actions/User"
              stroke="#ff7300"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: "#ff7300", strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}