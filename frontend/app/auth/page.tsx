"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/auth-context'
import { LoginForm } from '@/components/auth/login-form'

export default function AuthPage() {
  const { user, isLoading, setupRequired } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading) {
      if (setupRequired) {
        router.push('/setup')
      } else if (user) {
        router.push('/')
      }
    }
  }, [user, isLoading, setupRequired, router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (user || setupRequired) {
    return null // Will redirect in useEffect
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <LoginForm />
    </div>
  )
}