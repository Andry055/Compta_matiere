import { LucideIcon } from "lucide-react"
import type { CSSProperties } from "react"

interface QuickActionCardProps {
  icon: LucideIcon
  title: string
  description: string
  buttonText: string
  onClick: () => void
  color: 'green' | 'blue' | 'purple' | 'orange'
  className?: string
}

/**
 * Teintes d'accent par famille d'action.
 *
 * On ne peint plus la carte entière d'un dégradé : seule l'icône et le
 * liseré portent la couleur, le reste de la surface reste neutre. C'est
 * lisible en thème clair comme en thème sombre, et la hiérarchie visuelle
 * reste celle des données affichées autour.
 */
const ACCENTS: Record<QuickActionCardProps['color'], string> = {
  green: 'oklch(0.68 0.17 150)',
  blue: 'oklch(0.62 0.19 258)',
  purple: 'oklch(0.6 0.22 300)',
  orange: 'oklch(0.7 0.19 45)',
}

export function QuickActionCard({
  icon: Icon,
  title,
  description,
  buttonText,
  onClick,
  color,
  className = ""
}: QuickActionCardProps) {
  const accent = ACCENTS[color]

  return (
    <div
      className={`cm-action ${className}`}
      style={{ ["--cm-action-accent" as string]: accent } as CSSProperties}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <div className="flex items-center gap-3">
        <span className="cm-kpi-icon">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <h3 className="cm-action-title">{title}</h3>
      </div>
      <p className="cm-action-desc">{description}</p>
      <button
        className="cm-btn-primary w-full"
        style={{ ["--cm-btn-accent" as string]: accent } as CSSProperties}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
      >
        {buttonText}
      </button>
    </div>
  )
}
