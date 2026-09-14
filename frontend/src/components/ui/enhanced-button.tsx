import * as React from "react";
import { cn } from "../../lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const enhancedButtonVariants = cva(
  "group relative inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 transform-gpu overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40",
        secondary:
          "bg-gradient-to-r from-secondary to-secondary/90 text-secondary-foreground shadow-lg shadow-secondary/25 hover:shadow-xl hover:shadow-secondary/40",
        success:
          "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/25 hover:shadow-xl hover:shadow-green-500/40",
        warning:
          "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/40",
        destructive:
          "bg-gradient-to-r from-destructive to-destructive/90 text-destructive-foreground shadow-lg shadow-destructive/25 hover:shadow-xl hover:shadow-destructive/40",
        outline:
          "border-2 border-primary bg-background text-primary hover:bg-primary hover:text-primary-foreground shadow-md hover:shadow-lg",
        ghost:
          "hover:bg-accent hover:text-accent-foreground shadow-none hover:shadow-md",
      },
      size: {
        sm: "px-4 py-2 text-sm rounded-lg",
        default: "px-6 py-3 text-base rounded-lg",
        lg: "px-8 py-4 text-lg rounded-xl",
      },
      animation: {
        none: "",
        scale: "hover:scale-105 active:scale-95",
        bounce: "hover:scale-105 active:scale-95 hover:animate-pulse",
        float: "hover:-translate-y-1 hover:scale-105 active:scale-95",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      animation: "scale",
    },
  }
);

export interface EnhancedButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof enhancedButtonVariants> {
  asChild?: boolean;
  loading?: boolean;
  iconRotation?: number;
  children?: React.ReactNode;
}

const EnhancedButton = React.forwardRef<HTMLButtonElement, EnhancedButtonProps>(
  (
    {
      className,
      variant,
      size,
      animation,
      loading,
      iconRotation = 0,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        className={cn(
          enhancedButtonVariants({ variant, size, animation, className })
        )}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {/* Shimmer effect overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Glow border */}
        {variant !== "ghost" && variant !== "outline" && (
          <div className="absolute inset-0 border border-white/20 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        )}

        {/* Content */}
        <div className="relative flex items-center gap-2">
          {loading ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            React.Children.map(children, (child) => {
              if (
                React.isValidElement(child) &&
                child.type &&
                typeof child.type === "object" &&
                "displayName" in child.type
              ) {
                // This is likely a Lucide icon
                return React.cloneElement(child as React.ReactElement, {
                  className: cn(
                    child.props.className,
                    `group-hover:rotate-[${iconRotation}deg] transition-transform duration-200`
                  ),
                });
              }
              return child;
            })
          )}
        </div>

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-current/10 rounded-[inherit]" />
        )}
      </button>
    );
  }
);
EnhancedButton.displayName = "EnhancedButton";

export { EnhancedButton, enhancedButtonVariants };
