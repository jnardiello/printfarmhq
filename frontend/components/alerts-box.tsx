"use client"

import { useEffect, useState } from 'react'
import { AlertTriangle, AlertCircle, Info, X, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertType, AlertPriority } from '@/lib/types'
import { api } from '@/lib/api'

const AlertIcon = ({ type, priority }: { type: AlertType; priority: AlertPriority }) => {
  if (priority === 'critical') {
    return <AlertTriangle className="h-4 w-4 text-red-500" />
  }
  if (priority === 'warning') {
    return <AlertCircle className="h-4 w-4 text-yellow-500" />
  }
  return <Info className="h-4 w-4 text-blue-500" />
}

const AlertItem = ({ alert, onDismiss }: { alert: Alert; onDismiss?: (id: string) => void }) => {
  const priorityStyles = {
    critical: 'border-l-red-500 bg-red-50 dark:bg-red-950/20',
    warning: 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20',
    info: 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20'
  }

  const handleAction = () => {
    if (alert.actionLink) {
      if (alert.actionLink.startsWith('http')) {
        window.open(alert.actionLink, '_blank')
      } else {
        window.location.href = alert.actionLink
      }
    }
  }

  return (
    <div className={`p-3 border-l-4 rounded-r-lg ${priorityStyles[alert.priority]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1">
          <AlertIcon type={alert.type} priority={alert.priority} />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-foreground">{alert.title}</h4>
            <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
            {alert.actionLabel && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAction}
                className="mt-2 h-7 text-xs"
              >
                {alert.actionLabel}
                {alert.actionLink?.startsWith('http') && <ExternalLink className="ml-1 h-3 w-3" />}
              </Button>
            )}
          </div>
        </div>
        {alert.dismissible && onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDismiss(alert.id)}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  )
}

export function AlertsBox() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAlerts = async () => {
    try {
      const response = await api<Alert[]>('/alerts')
      setAlerts(response)
    } catch (error) {
      console.error('Failed to fetch alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  const dismissAlert = async (alertId: string) => {
    try {
      await api(`/alerts/${alertId}/dismiss`, {
        method: 'POST'
      })
      setAlerts(alerts.filter(alert => alert.id !== alertId))
    } catch (error) {
      console.error('Failed to dismiss alert:', error)
    }
  }

  useEffect(() => {
    fetchAlerts()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-16 bg-muted rounded-lg"></div>
            <div className="h-16 bg-muted rounded-lg"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (alerts.length === 0) {
    return null
  }

  const criticalCount = alerts.filter(a => a.priority === 'critical').length
  const warningCount = alerts.filter(a => a.priority === 'warning').length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Alerts ({alerts.length})
          {criticalCount > 0 && (
            <span className="ml-2 px-2 py-1 text-xs bg-red-500 text-white rounded-full">
              {criticalCount} critical
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts
          .sort((a, b) => {
            const priorityOrder = { critical: 0, warning: 1, info: 2 }
            return priorityOrder[a.priority] - priorityOrder[b.priority]
          })
          .map(alert => (
            <AlertItem
              key={alert.id}
              alert={alert}
              onDismiss={alert.dismissible ? dismissAlert : undefined}
            />
          ))}
      </CardContent>
    </Card>
  )
}