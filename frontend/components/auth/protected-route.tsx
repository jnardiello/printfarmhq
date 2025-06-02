"use client"

import { useAuth } from './auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading, setupRequired, godUserRequired } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading) {
      if (setupRequired) {
        router.push('/setup')
      } else if (godUserRequired) {
        router.push('/setup/god-user')
      } else if (!user) {
        router.push('/welcome')
      }
    }
  }, [user, isLoading, setupRequired, godUserRequired, router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (setupRequired || godUserRequired || !user) {
    return null
  }

  return <>{children}</>
}