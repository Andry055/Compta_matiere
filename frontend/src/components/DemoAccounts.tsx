import { Copy, Check, User, Shield } from "lucide-react"
import { useState } from "react"

interface DemoAccount {
  name: string
  email: string
  password: string
  role: 'admin' | 'staff'
  department: string
  description: string
}

const demoAccounts: DemoAccount[] = [
  {
    name: "Admin Système",
    email: "admin@comptamatiere.com",
    password: "admin123",
    role: "admin",
    department: "IT - Administration",
    description: "Accès complet à toutes les fonctionnalités du système"
  },
  {
    name: "Marie Dubois",
    email: "marie.dubois@comptamatiere.com",
    password: "marie123",
    role: "staff",
    department: "Logistique - Entrepôt",
    description: "Gestion des entrées et sorties de matériel"
  },
  {
    name: "Pierre Martin",
    email: "pierre.martin@comptamatiere.com",
    password: "pierre123",
    role: "staff",
    department: "Réception - Magasin",
    description: "Responsable des réceptions et stockage"
  },
  {
    name: "Sophie Bernard",
    email: "sophie.bernard@comptamatiere.com",
    password: "sophie123",
    role: "staff",
    department: "Expédition - Logistique",
    description: "Gestion des expéditions et transferts"
  },
  {
    name: "Jean Moreau",
    email: "jean.moreau@comptamatiere.com",
    password: "jean123",
    role: "staff",
    department: "Production - Atelier",
    description: "Suivi du matériel de production"
  }
]

interface DemoAccountsProps {
  onSelectAccount?: (email: string, password: string) => void
}

export function DemoAccounts({ onSelectAccount }: DemoAccountsProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg text-foreground mb-2">Comptes de Démonstration</h3>
        <p className="text-sm text-muted-foreground">
          Utilisez ces comptes pour tester les différents niveaux d'accès
        </p>
      </div>

      <div className="grid gap-4">
        {demoAccounts.map((account, index) => (
          <div 
            key={index}
            className={`border border-border rounded-lg p-4 ${
              account.role === 'admin' 
                ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' 
                : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {account.role === 'admin' ? (
                  <Shield className="h-5 w-5 text-red-600 dark:text-red-400" />
                ) : (
                  <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                )}
                <div>
                  <h4 className="font-medium text-foreground">{account.name}</h4>
                  <p className="text-xs text-muted-foreground">{account.department}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs ${
                account.role === 'admin'
                  ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
              }`}>
                {account.role === 'admin' ? 'Administrateur' : 'Personnel'}
              </span>
            </div>

            <p className="text-sm text-muted-foreground mb-3">{account.description}</p>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-16">Email:</span>
                <code className="flex-1 text-xs bg-background px-2 py-1 rounded border font-mono">
                  {account.email}
                </code>
                <button
                  onClick={() => copyToClipboard(account.email, `email-${index}`)}
                  className="p-1 hover:bg-muted rounded transition-colors"
                  title="Copier l'email"
                >
                  {copiedField === `email-${index}` ? (
                    <Check className="h-3 w-3 text-green-600" />
                  ) : (
                    <Copy className="h-3 w-3 text-muted-foreground" />
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-16">Mot de passe:</span>
                <code className="flex-1 text-xs bg-background px-2 py-1 rounded border font-mono">
                  {account.password}
                </code>
                <button
                  onClick={() => copyToClipboard(account.password, `password-${index}`)}
                  className="p-1 hover:bg-muted rounded transition-colors"
                  title="Copier le mot de passe"
                >
                  {copiedField === `password-${index}` ? (
                    <Check className="h-3 w-3 text-green-600" />
                  ) : (
                    <Copy className="h-3 w-3 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>

            {onSelectAccount && (
              <button
                onClick={() => onSelectAccount(account.email, account.password)}
                className={`w-full mt-3 px-3 py-2 rounded text-sm transition-colors ${
                  account.role === 'admin'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                Utiliser ce compte
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">
          ℹ️ Mode Démonstration
        </h4>
        <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1">
          <li>• Les données sont simulées et ne sont pas persistantes</li>
          <li>• Chaque compte a des permissions différentes</li>
          <li>• L'administrateur a accès à toutes les fonctionnalités</li>
          <li>• Le personnel n'a accès qu'aux fonctions de gestion matériel</li>
        </ul>
      </div>
    </div>
  )
}