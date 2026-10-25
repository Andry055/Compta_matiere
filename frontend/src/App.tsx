import React, { useState, useEffect } from "react"
import { clearStrapiSession, fetchNotificationsOutbox, fetchSessionRole, getStrapiJwt } from "./lib/api"
import { mapStrapiUser } from "./lib/session"
import { DashboardLayout } from "./components/DashboardLayout"
import { StaffDashboardLayout } from "./components/StaffDashboardLayout"
import { LoginScreen } from "./components/LoginScreen"
import { AuthGuard } from "./components/AuthGuard"
import { AppRole, DemandeurLevel } from "./types/roles"
import { connectSSE, disconnectSSE, onSSEEvent } from "./lib/sseNotifications"
import { pushRealtimeNotification } from "./lib/notifications"
import { toast } from "sonner"

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
  const [notificationVersion, setNotificationVersion] = useState(0)

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
            // Revalidation : l'identité affichée doit être celle du JETON.
            // `currentUser` peut provenir du repli de démonstration de
            // LoginScreen (API momentanément injoignable) alors que le jeton
            // appartient à un autre compte — l'écran affichait alors un rôle
            // que le serveur refuse (403 à la signature). On interroge donc
            // /api/session/role et on réaligne l'identité ; en cas d'échec
            // (API hors ligne) on conserve la session telle quelle.
            const session = await fetchSessionRole()
            const reel = mapStrapiUser(session)
            if (reel && reel.role !== user.role) {
              localStorage.setItem('currentUser', JSON.stringify(reel))
              setCurrentUser(reel)
              return
            }
            setCurrentUser(user)
          } else {
            // Clear expired session
            localStorage.removeItem('currentUser')
            localStorage.removeItem('loginTime')
            clearStrapiSession()
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

  // Connexion/déconnexion SSE pour les utilisateurs concernés (demandeur, dépositaire, magasinier).
  useEffect(() => {
    const rolesSSE = ['demandeur', 'depositaire', 'magasinier']
    if (currentUser?.role && rolesSSE.includes(currentUser.role)) {
      const jwt = getStrapiJwt()
      if (jwt) {
        connectSSE(Number(currentUser.id), jwt)
      }
    } else {
      disconnectSSE()
    }
    return () => {
      disconnectSSE()
    }
  }, [currentUser])

  // Gestion des événements SSE reçus (demande_aboutie, ordre_pret_distribution, ordre_sortie_autorise).
  useEffect(() => {
    const rolesSSE = ['demandeur', 'depositaire', 'magasinier']
    if (!currentUser?.role || !rolesSSE.includes(currentUser.role)) return

    const unsubscribe = onSSEEvent((event) => {
      if (event.type === 'demande_aboutie' && currentUser.role === 'demandeur') {
        const { message, date, demandeReference, sortieReference } = event.data

        // Notification push persistée dans localStorage (visible dans la cloche).
        pushRealtimeNotification(
          'sortie',
          message || `Votre demande ${demandeReference || ''} est maintenant aboutie.`,
          date || new Date().toISOString()
        )

        // Toast d'alerte immédiate.
        toast.success("Demande aboutie", {
          description:
            message ||
            `Votre demande ${demandeReference || sortieReference || ''} est passée en sortie effectuée.`,
        })

        // Rafraîchit la cloche (incrémente la version pour forcer le re-rendu).
        setNotificationVersion((v) => v + 1)
      } else if (event.type === 'ordre_pret_distribution' && currentUser.role === 'depositaire') {
        const { reference, date_sortie, direction, message } = event.data

        pushRealtimeNotification(
          'sortie',
          message || `Un ordre de sortie (${reference || ''}) est prêt à être distribué vers votre direction.`,
          date_sortie || new Date().toISOString()
        )

        toast.success("Ordre prêt à distribuer", {
          description:
            message ||
            `L'ordre ${reference || ''} est validé et peut être acheminé vers votre direction.`,
        })

        setNotificationVersion((v) => v + 1)
      } else if (event.type === 'ordre_sortie_autorise' && currentUser.role === 'magasinier') {
        const { reference, date_sortie, direction, message } = event.data

        pushRealtimeNotification(
          'sortie',
          message || `Un ordre de sortie (${reference || ''}) est autorisé à la sortie.`,
          date_sortie || new Date().toISOString()
        )

        toast.success("Ordre autorisé", {
          description:
            message ||
            `L'ordre ${reference || ''} est autorisé : préparez les matériels pour l'expédition.`,
        })

        setNotificationVersion((v) => v + 1)
      }
    })

    return unsubscribe
  }, [currentUser?.role])

  // Réconciliation des notifications outbox manquées pour le demandeur.
  // Les notifications émises pendant une déconnexion SSE (remise, etc.) sont
  // persistées en outbox ; on les recharge à la connexion pour qu'elles
  // apparaissent dans la cloche sans jamais les dupliquer.
  useEffect(() => {
    if (currentUser?.role !== 'demandeur') return
    const jwt = getStrapiJwt()
    if (!jwt) return
    let mounted = true
    ;(async () => {
      const notifications = await fetchNotificationsOutbox()
      if (!mounted) return
      for (const n of notifications ?? []) {
        const message =
          typeof n.payload?.message === 'string' ? n.payload.message : `Votre demande est maintenant aboutie.`
        pushRealtimeNotification(
          'sortie',
          message,
          n.createdAt || new Date().toISOString(),
          `outbox-${n.id}`
        )
      }
    })()
    return () => {
      mounted = false
    }
  }, [currentUser?.role])

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

    // Déconnecte le flux SSE s'il est ouvert.
    disconnectSSE()

    // Clear all stored authentication data
    localStorage.removeItem('currentUser')
    localStorage.removeItem('loginTime')
    localStorage.removeItem('rememberMe')
    localStorage.removeItem('savedEmail')
    // Jeton JWT Content API
    clearStrapiSession()
    
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
          <DashboardLayout user={currentUser} onLogout={handleLogout} notificationVersion={notificationVersion} />
        )}
      </AuthGuard>
    </div>
  )
}