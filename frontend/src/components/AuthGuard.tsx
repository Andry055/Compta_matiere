import React, { useState, useEffect } from "react"
import { Shield, Lock, AlertTriangle } from "lucide-react"

interface AuthGuardProps {
  children: React.ReactNode
  user: any
}

export function AuthGuard({ children, user }: AuthGuardProps) {
  const [sessionValid, setSessionValid] = useState(true)
  const [lastActivity, setLastActivity] = useState(Date.now())

  // Session timeout (30 minutes of inactivity)
  const SESSION_TIMEOUT = 30 * 60 * 1000

  useEffect(() => {
    const checkSession = () => {
      const now = Date.now()
      const timeSinceLastActivity = now - lastActivity

      if (timeSinceLastActivity > SESSION_TIMEOUT) {
        setSessionValid(false)
        localStorage.removeItem('currentUser')
        alert('Votre session a expiré. Veuillez vous reconnecter.')
        window.location.reload()
      }
    }

    const interval = setInterval(checkSession, 60000) // Check every minute

    // Track user activity
    const updateActivity = () => setLastActivity(Date.now())
    
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart']
    events.forEach(event => {
      document.addEventListener(event, updateActivity, true)
    })

    return () => {
      clearInterval(interval)
      events.forEach(event => {
        document.removeEventListener(event, updateActivity, true)
      })
    }
  }, [lastActivity])

  // Validate user permissions for sensitive actions
  const hasPermission = (permission: string) => {
    if (!user || !user.permissions) return false
    return user.permissions.includes('all') || user.permissions.includes(permission)
  }

  if (!sessionValid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md mx-auto text-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl text-foreground mb-2">Session Expirée</h2>
          <p className="text-muted-foreground text-sm mb-4">
            Votre session a expiré pour des raisons de sécurité.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Se reconnecter
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

// Hook for checking permissions
export function usePermissions(user: any) {
  const hasPermission = (permission: string) => {
    if (!user || !user.permissions) return false
    return user.permissions.includes('all') || user.permissions.includes(permission)
  }

  const isAdmin = () => {
    return user?.role === 'admin'
  }

  const isStaff = () => {
    return user?.role === 'staff'
  }

  return {
    hasPermission,
    isAdmin,
    isStaff,
    canManageEquipment: hasPermission('material_entry') || hasPermission('material_exit'),
    canViewReports: hasPermission('view_reports') || hasPermission('all'),
    canManageUsers: hasPermission('manage_users') || hasPermission('all')
  }
}