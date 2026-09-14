import { LucideIcon } from "lucide-react"

interface QuickActionCardProps {
  icon: LucideIcon
  title: string
  description: string
  buttonText: string
  onClick: () => void
  color: 'green' | 'blue' | 'purple' | 'orange'
  className?: string
}

const colorStyles = {
  green: {
    background: 'bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20',
    border: 'border-green-200 dark:border-green-700',
    icon: 'text-green-600 dark:text-green-400',
    title: 'text-green-900 dark:text-green-100',
    description: 'text-green-700 dark:text-green-300',
    button: 'bg-green-600 hover:bg-green-700 text-white',
    hover: 'hover:from-green-100 hover:to-green-200 dark:hover:from-green-800/30 dark:hover:to-green-700/30'
  },
  blue: {
    background: 'bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20',
    border: 'border-blue-200 dark:border-blue-700',
    icon: 'text-blue-600 dark:text-blue-400',
    title: 'text-blue-900 dark:text-blue-100',
    description: 'text-blue-700 dark:text-blue-300',
    button: 'bg-blue-600 hover:bg-blue-700 text-white',
    hover: 'hover:from-blue-100 hover:to-blue-200 dark:hover:from-blue-800/30 dark:hover:to-blue-700/30'
  },
  purple: {
    background: 'bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20',
    border: 'border-purple-200 dark:border-purple-700',
    icon: 'text-purple-600 dark:text-purple-400',
    title: 'text-purple-900 dark:text-purple-100',
    description: 'text-purple-700 dark:text-purple-300',
    button: 'bg-purple-600 hover:bg-purple-700 text-white',
    hover: 'hover:from-purple-100 hover:to-purple-200 dark:hover:from-purple-800/30 dark:hover:to-purple-700/30'
  },
  orange: {
    background: 'bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20',
    border: 'border-orange-200 dark:border-orange-700',
    icon: 'text-orange-600 dark:text-orange-400',
    title: 'text-orange-900 dark:text-orange-100',
    description: 'text-orange-700 dark:text-orange-300',
    button: 'bg-orange-600 hover:bg-orange-700 text-white',
    hover: 'hover:from-orange-100 hover:to-orange-200 dark:hover:from-orange-800/30 dark:hover:to-orange-700/30'
  }
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
  const styles = colorStyles[color]
  
  return (
    <div 
      className={`
        ${styles.background} ${styles.border} ${styles.hover}
        border rounded-lg p-4 sm:p-6 cursor-pointer 
        hover:shadow-lg hover:shadow-${color}-200/50 dark:hover:shadow-${color}-900/50
        transition-all duration-300 transform hover:-translate-y-1
        ${className}
      `}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg bg-white dark:bg-black/20 ${styles.icon} shadow-sm`}>
          <Icon className="h-6 w-6" />
        </div>
        <h3 className={`text-lg ${styles.title}`}>{title}</h3>
      </div>
      <p className={`text-sm ${styles.description} mb-4 leading-relaxed`}>
        {description}
      </p>
      <button 
        className={`
          group relative w-full px-4 py-3 ${styles.button} 
          rounded-lg transition-all duration-200 text-sm font-medium
          shadow-lg hover:shadow-xl transform-gpu overflow-hidden
          hover:scale-105 active:scale-95
        `}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-white/0 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        <span className="relative">{buttonText}</span>
        <div className="absolute inset-0 border border-white/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      </button>
    </div>
  )
}