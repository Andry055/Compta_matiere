import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../lib/utils";

const messageVariants = cva("msg", {
  variants: {
    variant: {
      info: "msg--info",
      success: "msg--success",
      warning: "msg--warning",
      danger: "msg--danger",
    },
    size: {
      sm: "msg--sm",
      md: "",
      lg: "msg--lg",
    },
  },
  defaultVariants: {
    variant: "info",
    size: "md",
  },
});

/** Icône associée à chaque variante, utilisée si l'appelant n'en fournit pas. */
const VARIANT_ICONS: Record<string, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

const ICON_SIZES: Record<string, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

export interface MessageProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof messageVariants> {
  /** Titre court affiché en gras. */
  title?: React.ReactNode;
  /** Texte d'explication, une ou plusieurs lignes. */
  children?: React.ReactNode;
  /** Icône personnalisée (par défaut, celle de la variante). */
  icon?: LucideIcon | null;
  /** Contenu aligné à droite du message (bouton d'action, lien…). */
  action?: React.ReactNode;
  /** Masquer le message à l'impression. */
  printHidden?: boolean;
}

/**
 * Bandeau de message unifié (information, succès, avertissement, erreur).
 *
 * Remplace les dozens de `<div className="bg-*-50 border ...">` dispersés
 * dans l'application : le fond teinté, la bande d'accent à gauche et les
 * couleurs s'adaptent automatiquement au thème clair comme sombre.
 */
const Message = React.forwardRef<HTMLDivElement, MessageProps>(
  (
    {
      className,
      variant,
      size,
      title,
      children,
      icon,
      action,
      printHidden,
      ...props
    },
    ref,
  ) => {
    const resolvedSize = size ?? "md";
    const Icon = icon === null ? null : (icon ?? VARIANT_ICONS[variant ?? "info"]);

    return (
      <div
        ref={ref}
        role={variant === "danger" ? "alert" : "status"}
        className={cn(
          messageVariants({ variant, size: resolvedSize }),
          printHidden && "print-hidden",
          className,
        )}
        {...props}
      >
        {Icon ? (
          <Icon className={cn("msg-icon", ICON_SIZES[resolvedSize])} aria-hidden />
        ) : null}
        {children || title ? (
          <div className="msg-body">
            {title ? <p className="msg-title">{title}</p> : null}
            {children ? <div className="msg-text">{children}</div> : null}
          </div>
        ) : null}
        {action ? <div className="msg-action">{action}</div> : null}
      </div>
    );
  },
);
Message.displayName = "Message";

export { Message, messageVariants };
