import React, { useState, useEffect } from "react"
import { DashboardLayout } from "./components/DashboardLayout"
import { StaffDashboardLayout } from "./components/StaffDashboardLayout"
import { LoginScreen } from "./components/LoginScreen"
import { AuthGuard } from "./components/AuthGuard"
import { AppRole, DemandeurLevel } from "./types/roles"

export type UserRole = AppRole | 'admin' | 'staff' | null

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  department: string
  permissions: string[]
  demandeurLevel?: DemandeurLevel
  directionId?: string
  serviceId?: string
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    // Simulate checking for saved login
    const checkSavedLogin = async () => {
      try {
        const savedUser = localStorage.getItem('currentUser')
        const loginTime = localStorage.getItem('loginTime')
        
        if (savedUser && loginTime) {
          const user = JSON.parse(savedUser)
          const loginTimestamp = parseInt(loginTime)
          const now = Date.now()
          const twentyFourHours = 24 * 60 * 60 * 1000

          // Check if login is still valid (within 24 hours)
          if (now - loginTimestamp < twentyFourHours) {
            setCurrentUser(user)
          } else {
            // Clear expired session
            localStorage.removeItem('currentUser')
            localStorage.removeItem('loginTime')
            setAuthError('Votre session a expiré. Veuillez vous reconnecter.')
          }
        }
      } catch (error) {
        console.error('Error checking saved login:', error)
        localStorage.removeItem('currentUser')
        localStorage.removeItem('loginTime')
      }
      setLoading(false)
    }

    checkSavedLogin()
  }, [])

  const handleLogin = (user: User) => {
    setCurrentUser(user)
    setAuthError(null)
    
    // Store user and login timestamp
    localStorage.setItem('currentUser', JSON.stringify(user))
    localStorage.setItem('loginTime', Date.now().toString())
    
    // Track login event
    console.log(`User logged in: ${user.email} (${user.role}) at ${new Date().toISOString()}`)
  }

  const handleLogout = () => {
    const logoutUser = currentUser
    setCurrentUser(null)
    setAuthError(null)
    
    // Clear all stored authentication data
    localStorage.removeItem('currentUser')
    localStorage.removeItem('loginTime')
    localStorage.removeItem('rememberMe')
    localStorage.removeItem('savedEmail')
    
    if (logoutUser) {
      console.log(`User logged out: ${logoutUser.email} at ${new Date().toISOString()}`)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="size-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-muted-foreground">Vérification de l'authentification...</div>
        </div>
      </div>
    )
  }

  // Show login screen if no user is authenticated
  if (!currentUser) {
    return (
      <div className="size-full">
        <LoginScreen onLogin={handleLogin} />
        {authError && (
          <div className="fixed bottom-4 right-4 max-w-sm p-4 bg-destructive/10 border border-destructive/20 rounded-lg shadow-lg">
            <div className="flex items-center gap-2 text-destructive">
              <span className="text-sm">{authError}</span>
              <button
                onClick={() => setAuthError(null)}
                className="ml-auto text-destructive hover:text-destructive/80"
              >
                ×
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Normaliser le rôle pour la navigation unifiée
  const isSpecialStaff = currentUser.role === 'staff'

  return (
    <div className="size-full">
      <AuthGuard user={currentUser}>
        {isSpecialStaff ? (
          <StaffDashboardLayout user={currentUser} onLogout={handleLogout} />
        ) : (
          <DashboardLayout user={currentUser} onLogout={handleLogout} />
        )}
      </AuthGuard>
    </div>
  )
}