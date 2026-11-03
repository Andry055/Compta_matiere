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
  strapiId?: number
  name: string
  email: string
  role: UserRole
  department: string
  permissions: string[]
  demandeurLevel?: DemandeurLevel
  directionId?: string
  directionName?: string
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
  // L'identifiant SSE est l'id NUMÉRIQUE Strapi (currentUser.strapiId), jamais le documentId
  // (chaîne) qui donnerait NaN et empêcherait toute correspondance avec le flux backend.
  useEffect(() => {
    const rolesSSE = ['demandeur', 'depositaire', 'magasinier']
    if (currentUser?.role && rolesSSE.includes(currentUser.role)) {
      const jwt = getStrapiJwt()
      if (jwt && currentUser.strapiId != null) {
        connectSSE(currentUser.strapiId, jwt)
      }
    } else {
      disconnectSSE()
    }
    return () => {
      disconnectSSE()
    }
  }, [currentUser])

  // Gestion des événements SSE reçus (demande_aboutie, ordre_pret_distribution, ordre_sortie_autorise, preparation_terminee, preparation_rejetee).
  useEffect(() => {
    const rolesSSE = ['demandeur', 'depositaire', 'magasinier']
    if (!currentUser?.role || !rolesSSE.includes(currentUser.role)) return

    const unsubscribe = onSSEEvent((event) => {
      if (event.type === 'demande_aboutie' && (currentUser.role === 'demandeur' || currentUser.role === 'depositaire')) {
        const { message, date, demandeReference, sortieReference } = event.data

        const estReceptionConfirmee = typeof message === 'string' && /réception physique/i.test(message)

        // Notification push persistée dans localStorage (visible dans la cloche).
        // targetRole = rôle de l'utilisateur connecté qui reçoit l'événement SSE,
        // jamais 'demandeur' hardcodé.
        pushRealtimeNotification(
          'sortie',
          message || `Votre demande ${demandeReference || ''} est maintenant aboutie.`,
          date || new Date().toISOString(),
          undefined,
          currentUser.role
        )

        // Toast d'alerte immédiate.
        toast.success(estReceptionConfirmee ? "Réception confirmée" : "Demande aboutie", {
          description:
            message ||
            (estReceptionConfirmee
              ? `Votre réception physique de la sortie ${sortieReference || ''} a été enregistrée avec succès.`
              : `Votre demande ${demandeReference || sortieReference || ''} est passée en sortie effectuée.`),
        })

        // Rafraîchit la cloche (incrémente la version pour forcer le re-rendu).
        setNotificationVersion((v) => v + 1)
      } else if (event.type === 'ordre_pret_distribution' && currentUser.role === 'depositaire') {
        const { reference, date_sortie, direction, message } = event.data

        pushRealtimeNotification(
          'sortie',
          message || `Un ordre de sortie (${reference || ''}) est prêt à être distribué vers votre direction.`,
          date_sortie || new Date().toISOString(),
          undefined,
          currentUser.role
        )

        toast.success("Ordre prêt à distribuer", {
          description:
            message ||
            `L'ordre ${reference || ''} est validé et peut être acheminé vers votre direction.`,
        })

        setNotificationVersion((v) => v + 1)
      } else if (event.type === 'ordre_sortie_autorise' && currentUser.role === 'magasinier') {
        const { reference, date_sortie, direction, message } = event.data

        const estReceptionConfirmee = typeof message === 'string' && /réception physique/i.test(message)

        pushRealtimeNotification(
          'sortie',
          message || `Un ordre de sortie (${reference || ''}) est autorisé à la sortie.`,
          date_sortie || new Date().toISOString(),
          undefined,
          currentUser.role
        )

        toast.success(estReceptionConfirmee ? "Réception confirmée" : "Ordre autorisé", {
          description:
            message ||
            (estReceptionConfirmee
              ? `La réception physique de la sortie ${reference || ''} a été confirmée par le dépositaire.`
              : `L'ordre ${reference || ''} est autorisé : préparez les matériels pour l'expédition.`),
        })

        setNotificationVersion((v) => v + 1)
      } else if (event.type === 'preparation_terminee' && currentUser.role === 'depositaire') {
        // Notification au dépositaire : le magasinier a terminé la préparation
        const { reference, date_heure, direction, message, signataire_magasinier, sortieId } = event.data

        // Identifiant stable pour éviter les doublons (réconciliation outbox + SSE)
        const notificationId = typeof sortieId === 'string' && sortieId
          ? `preparation_terminee-${sortieId}`
          : undefined

        // Afficher l'heure locale (HH:MM) pour l'utilisateur
        const dateAffichage = date_heure
          ? new Date(date_heure).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          : new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

        pushRealtimeNotification(
          'sortie',
          message || `La préparation de l'ordre de sortie (${reference || ''}) est terminée et prête pour votre signature.`,
          date_heure || new Date().toISOString(),
          notificationId,
          currentUser.role,
          undefined,
          sortieId
        )

        toast.success("Préparation terminée", {
          description:
            message ||
            `Le magasinier ${signataire_magasinier || ''} a terminé la préparation de l'ordre ${reference || ''} à ${dateAffichage}.`,
        })

        setNotificationVersion((v) => v + 1)
      } else if (event.type === 'preparation_rejetee' && currentUser.role === 'depositaire') {
        // Notification au dépositaire : le magasinier a rejeté la préparation
        const { reference, date_heure, direction, message, motif_rejet, signataire_rejet, sortieId } = event.data

        // Identifiant stable pour éviter les doublons
        const notificationId = typeof sortieId === 'string' && sortieId
          ? `preparation_rejetee-${sortieId}`
          : undefined

        // Afficher l'heure locale (HH:MM) pour l'utilisateur
        const dateAffichage = date_heure
          ? new Date(date_heure).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          : new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

        pushRealtimeNotification(
          'sortie',
          message || `La préparation de l'ordre de sortie (${reference || ''}) a été rejetée par le magasinier.`,
          date_heure || new Date().toISOString(),
          notificationId,
          currentUser.role,
          undefined,
          sortieId
        )

        toast.error("Préparation rejetée", {
          description:
            message ||
            `Le magasinier ${signataire_rejet || ''} a rejeté la préparation de l'ordre ${reference || ''} à ${dateAffichage}. Motif : ${motif_rejet || 'Non spécifié'}.`,
        })

        setNotificationVersion((v) => v + 1)
      } else if (event.type === 'nouvelle_demande' && currentUser.role === 'depositaire') {
        const {
          notifId,
          demandeDocumentId,
          demandeReference,
          demandeDate,
          demandeur,
          message,
        } = event.data

        // L'identifiant de la notification est STABLE (clé d'idempotence
        // calculée par le serveur) : l'événement SSE et la réconciliation de
        // l'outbox produisent le MÊME identifiant, donc la notification
        // n'apparaît jamais deux fois.
        const notificationId =
          typeof notifId === 'string' && notifId
            ? notifId
            : typeof demandeDocumentId === 'string' && demandeDocumentId
              ? `nouvelle_demande-${demandeDocumentId}`
              : undefined

        pushRealtimeNotification(
          'nouvelle_demande',
          message || `Une nouvelle demande (${demandeReference || ''}) a été déposée.`,
          demandeDate || new Date().toISOString(),
          notificationId,
          currentUser.role,
          typeof demandeDocumentId === 'string' ? demandeDocumentId : undefined
        )

        toast.success("Nouvelle demande", {
          description:
            message ||
            `La demande ${demandeReference || ''} a été déposée${demandeur ? ` par ${demandeur}` : ''}.`,
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

  // Réconciliation des notifications outbox manquées pour le magasinier et
  // le dépositaire. Même principe que pour le demandeur : les notifications
  // de réception physique émises pendant une déconnexion SSE sont persistées
  // en outbox et doivent être rejouées à la reconnexion.
  //
  // L'événement `nouvelle_demande` est traité À PART : il porte son propre
  // identifiant stable (`payload.notifId`) et cible une demande précise. Il
  // ne doit donc JAMAIS être réinjecté comme une notification générique
  // « sortie », sous peine d'apparaître deux fois.
  //
  // Les nouveaux événements `preparation_terminee` et `preparation_rejetee`
  // sont traités de la même façon : identifiant stable basé sur sortieId.
  useEffect(() => {
    if (currentUser?.role !== 'magasinier' && currentUser?.role !== 'depositaire') return
    const jwt = getStrapiJwt()
    if (!jwt) return
    let mounted = true
    ;(async () => {
      const notifications = await fetchNotificationsOutbox()
      if (!mounted) return
      for (const n of notifications ?? []) {
        if (n.eventType === 'nouvelle_demande') {
          const payload = n.payload ?? {}
          const demandeDocumentId =
            typeof payload.demandeDocumentId === 'string'
              ? payload.demandeDocumentId
              : undefined
          // MÊME identifiant que celui utilisé par l'événement SSE : la
          // notification déjà reçue en direct n'est pas dupliquée.
          const notificationId =
            typeof payload.notifId === 'string' && payload.notifId
              ? payload.notifId
              : demandeDocumentId
                ? `nouvelle_demande-${demandeDocumentId}`
                : `outbox-${n.id}`
          pushRealtimeNotification(
            'nouvelle_demande',
            typeof payload.message === 'string'
              ? payload.message
              : `Une nouvelle demande (${payload.demandeReference || ''}) a été déposée.`,
            (typeof payload.demandeDate === 'string' && payload.demandeDate) ||
              n.createdAt ||
              new Date().toISOString(),
            notificationId,
            currentUser.role,
            demandeDocumentId
          )
          continue
        }

        // Traitement spécifique pour preparation_terminee (dépositaire)
        if (n.eventType === 'preparation_terminee' && currentUser.role === 'depositaire') {
          const payload = n.payload ?? {}
          const sortieId = typeof payload.sortieId === 'string' ? payload.sortieId : undefined
          const notificationId = sortieId ? `preparation_terminee-${sortieId}` : `outbox-${n.id}`

          pushRealtimeNotification(
            'sortie',
            typeof payload.message === 'string'
              ? payload.message
              : `La préparation de l'ordre de sortie (${payload.reference || ''}) est terminée et prête pour votre signature.`,
            (typeof payload.date_heure === 'string' && payload.date_heure) ||
              n.createdAt ||
              new Date().toISOString(),
            notificationId,
            currentUser.role,
            undefined,
            sortieId
          )
          continue
        }

        // Traitement spécifique pour preparation_rejetee (dépositaire)
        if (n.eventType === 'preparation_rejetee' && currentUser.role === 'depositaire') {
          const payload = n.payload ?? {}
          const sortieId = typeof payload.sortieId === 'string' ? payload.sortieId : undefined
          const notificationId = sortieId ? `preparation_rejetee-${sortieId}` : `outbox-${n.id}`

          pushRealtimeNotification(
            'sortie',
            typeof payload.message === 'string'
              ? payload.message
              : `La préparation de l'ordre de sortie (${payload.reference || ''}) a été rejetée par le magasinier.`,
            (typeof payload.date_heure === 'string' && payload.date_heure) ||
              n.createdAt ||
              new Date().toISOString(),
            notificationId,
            currentUser.role,
            undefined,
            sortieId
          )
          continue
        }

        const message =
          typeof n.payload?.message === 'string' ? n.payload.message : `Une notification de réception est en attente.`
        pushRealtimeNotification(
          'sortie',
          message,
          n.createdAt || new Date().toISOString(),
          `outbox-${n.id}`,
          currentUser.role
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
    // Confirmation avant déconnexion
    if (!window.confirm("Êtes-vous sûr de vouloir vous déconnecter ?")) {
      return;
    }

    const logoutUser = currentUser
    setCurrentUser(null)
    setAuthError(null)

    // Déconnecte le flux SSE s'il est ouvert.
    console.log('[App] Déconnexion utilisateur, fermeture SSE...')
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