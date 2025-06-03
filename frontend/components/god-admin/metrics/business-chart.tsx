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

interface BusinessMetric {
  date: string
  total_filament_consumed_g: number
  avg_print_time_hrs: number
  print_success_rate: number
  top_products: Array<{ name: string; count: number }>
  top_filaments: Array<{ name: string; usage_g: number }>
}

interface BusinessChartProps {
  data: BusinessMetric[]
}

export function BusinessChart({ data }: BusinessChartProps) {
  // Transform data for chart display
  const chartData = data.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    }),
    'Filament (kg)': parseFloat((item.total_filament_consumed_g / 1000).toFixed(2)),
    'Avg Print Time (h)': parseFloat(item.avg_print_time_hrs.toFixed(1)),
    'Success Rate (%)': parseFloat(item.print_success_rate.toFixed(1)),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business Intelligence</CardTitle>
        <CardDescription>
          Daily filament consumption, print times, and success rates
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
              domain={[0, 100]}
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
              dataKey="Filament (kg)"
              fill="#8884d8"
              opacity={0.6}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="Avg Print Time (h)"
              stroke="#82ca9d"
              strokeWidth={2}
              dot={{ fill: "#82ca9d", strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="Success Rate (%)"
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