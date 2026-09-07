import React from "react";
import { cn } from "../../utils/cn";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "coral" | "mint" | "ink" | "secondary" | "outline" | "ghost" | "danger" | "primary";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "coral", size = "md", isLoading, children, disabled, ...props }, ref) => {
    const variants = {
      coral: "bg-slate-900 text-white hover:bg-black shadow-xs active:scale-[0.99] font-medium transition-all",
      mint: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs active:scale-[0.99] font-medium transition-all",
      ink: "bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.99] font-medium transition-all",
      primary: "bg-slate-900 text-white hover:bg-black shadow-xs active:scale-[0.99] font-medium transition-all",
      secondary: "bg-white text-slate-900 border border-slate-200/80 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.99] font-medium transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
      outline: "bg-transparent text-slate-700 border border-slate-200/80 hover:bg-slate-50 hover:text-slate-900 font-medium transition-all",
      ghost: "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium transition-all",
      danger: "bg-rose-600 text-white hover:bg-rose-700 font-medium transition-all",
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
