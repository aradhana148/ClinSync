import React, { createContext, useContext, useState } from 'react'

interface AuthUser {
  user_id: number
  full_name: string
  role: string
  token: string
}

interface AuthCtx {
  user: AuthUser | null
  setUser: (u: AuthUser | null) => void
  logout: () => void
}

const AuthContext = createContext<AuthCtx>({} as AuthCtx)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = sessionStorage.getItem('auth')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const setUserAndStore = (u: AuthUser | null) => {
    setUser(u)
    if (u) {
      sessionStorage.setItem('auth', JSON.stringify(u))
      sessionStorage.setItem('token', u.token)
    } else {
      sessionStorage.removeItem('auth')
      sessionStorage.removeItem('token')
    }
  }

  const logout = () => setUserAndStore(null)

  return (
    <AuthContext.Provider value={{ user, setUser: setUserAndStore, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// oxlint-disable-next-line react/only-export-components -- small shared authentication module
export const useAuth = () => useContext(AuthContext)
