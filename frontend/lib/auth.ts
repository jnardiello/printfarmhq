export interface User {
  id: number
  email: string
  name: string
  is_active: boolean
  is_admin: boolean
  is_superadmin: boolean
  is_god_user: boolean
  created_at: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterCredentials {
  email: string
  password: string
  name: string
}

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

export const authStorage = {
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

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
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
  
  register: async (credentials: RegisterCredentials): Promise<AuthResponse> => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
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
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
    
    if (!response.ok) {
      throw new Error('Failed to get user info')
    }
    
    return response.json()
  }
}