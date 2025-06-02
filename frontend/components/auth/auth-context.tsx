"use client"

// TODO: Implement proper error tracking service (e.g., Sentry) to replace console.error statements

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@/lib/auth'
import { API_BASE_URL } from '@/lib/api'

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

const authStorage = {
  getToken: (): string | null => {
    if (typeof window === 'undefined') return null
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch (error) {
      console.error('Error accessing localStorage for token:', error)
      return null
    }
  },
  
  setToken: (token: string): void => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch (error) {
      console.error('Error setting token in localStorage:', error)
    }
  },
  
  getUser: (): User | null => {
    if (typeof window === 'undefined') return null
    try {
      const user = localStorage.getItem(USER_KEY)
      return user ? JSON.parse(user) : null
    } catch (error) {
      console.error('Error accessing localStorage for user:', error)
      return null
    }
  },
  
  setUser: (user: User): void => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    } catch (error) {
      console.error('Error setting user in localStorage:', error)
    }
  },
  
  clear: (): void => {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    } catch (error) {
      console.error('Error clearing localStorage:', error)
    }
  }
}

const authApi = {
  login: async (credentials: { email: string; password: string }) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Login failed')
    }
    
    return response.json()
  },
  
  register: async (credentials: { email: string; password: string; name: string }) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Registration failed')
    }
    
    return response.json()
  },
  
  getCurrentUser: async (): Promise<User> => {
    const token = authStorage.getToken()
    if (!token) throw new Error('No token found')
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
    
    if (!response.ok) {
      throw new Error('Failed to get user info')
    }
    
    return response.json()
  },

  getSetupStatus: async () => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/auth/setup-status`)
    
    if (!response.ok) {
      throw new Error('Failed to get setup status')
    }
    
    return response.json()
  }
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
  isLoading: boolean
  setupRequired: boolean | null
  godUserRequired: boolean | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null)
  const [godUserRequired, setGodUserRequired] = useState<boolean | null>(null)

  useEffect(() => {
    // Check setup status and auth on mount
    const checkAuth = async () => {
      try {
        // First check if setup is required
        try {
          const setupStatus = await authApi.getSetupStatus()
          setSetupRequired(setupStatus.setup_required)
          setGodUserRequired(setupStatus.god_user_required || false)
          
          // If setup is required, no need to check auth
          if (setupStatus.setup_required || setupStatus.god_user_required) {
            setIsLoading(false)
            return
          }
        } catch (error) {
          console.error('Error checking setup status:', error)
          // Continue with auth check if setup status fails
        }
        
        const token = authStorage.getToken()
        const savedUser = authStorage.getUser()
        
        if (token && savedUser) {
          try {
            // Verify token is still valid
            await authApi.getCurrentUser()
            setUser(savedUser)
          } catch (error) {
            // Token is invalid, clear storage
            authStorage.clear()
          }
        }
      } catch (error) {
        console.error('Error during auth check:', error)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = async (email: string, password: string) => {
    try {
      const response = await authApi.login({ email, password })
      authStorage.setToken(response.access_token)
      authStorage.setUser(response.user)
      setUser(response.user)
    } catch (error) {
      throw error
    }
  }

  const register = async (email: string, password: string, name: string) => {
    try {
      const response = await authApi.register({ email, password, name })
      authStorage.setToken(response.access_token)
      authStorage.setUser(response.user)
      setUser(response.user)
    } catch (error) {
      throw error
    }
  }

  const logout = () => {
    authStorage.clear()
    setUser(null)
    router.push('/auth')
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading, setupRequired, godUserRequired }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}