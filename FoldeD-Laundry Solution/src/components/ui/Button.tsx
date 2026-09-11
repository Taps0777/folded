import React from "react";
import { cn } from "../../utils/cn";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "coral" | "mint" | "ink" | "secondary" | "outline" | "ghost" | "danger" | "primary";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

// `ink`/`coral`/`primary` are the same brand button: solid ink in light mode,
// flipping to cream-on-ink in dark mode. `mint` is the accent CTA.
const SOLID_INK =
  "bg-ink text-cream dark:bg-cream dark:text-ink hover:bg-ink/90 dark:hover:bg-cream/90 shadow-xs active:scale-[0.99] font-medium transition-all";

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "coral", size = "md", isLoading, children, disabled, ...props }, ref) => {
    const variants = {
      coral: SOLID_INK,
      ink: SOLID_INK,
      primary: SOLID_INK,
      mint: "bg-mint text-ink hover:bg-mint-dark shadow-xs active:scale-[0.99] font-medium transition-all",
      secondary:
        "bg-surface text-foreground border border-slate-200/80 hover:bg-slate-100/70 hover:border-slate-300 active:scale-[0.99] font-medium transition-all shadow-xs",
      outline: "bg-transparent text-slate-700 border border-slate-200/80 hover:bg-slate-100/70 hover:text-foreground font-medium transition-all",
      ghost: "bg-transparent text-slate-600 hover:bg-slate-100/70 hover:text-foreground font-medium transition-all",
      danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-xs active:scale-[0.99] font-medium transition-all",
    };

    const sizes = {
      sm: "h-8 px-3.5 text-xs rounded-xl",
      md: "h-10 px-5 text-sm rounded-xl font-medium",
      lg: "h-12 px-7 text-sm sm:text-base rounded-xl font-medium",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "btn select-none tracking-wide",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
