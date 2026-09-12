/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ============================================================================
        // Brand colors (fixed — same in light and dark mode)
        // ============================================================================
        ink: '#17201E',        // brand dark: chrome, primary buttons, overlays
        cream: '#FAF8F4',      // brand light: text on dark, warm accents
        mint: '#10B981',       // brand accent: CTAs, active states, links
        'mint-dark': '#059669',
        'mint-soft': '#D1FAE5',

        // ============================================================================
        // Semantic tokens (CSS-variable driven — flip between light and dark).
        // Values live in src/index.css (:root / .dark) as channel triplets so
        // opacity modifiers like bg-surface/80 keep working.
        // ============================================================================
        background: 'rgb(var(--c-background) / <alpha-value>)',
        foreground: 'rgb(var(--c-foreground) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        'on-surface': 'rgb(var(--c-foreground) / <alpha-value>)',
        'on-background': 'rgb(var(--c-foreground) / <alpha-value>)',
        'surface-variant': 'rgb(var(--c-surface-variant) / <alpha-value>)',
        'on-surface-variant': 'rgb(var(--c-on-surface-variant) / <alpha-value>)',

        'surface-container-lowest': 'rgb(var(--c-surface-container-lowest) / <alpha-value>)',
        'surface-container-low': 'rgb(var(--c-surface-container-low) / <alpha-value>)',
        'surface-container': 'rgb(var(--c-surface-container) / <alpha-value>)',
        'surface-container-high': 'rgb(var(--c-surface-container-high) / <alpha-value>)',
        'surface-container-highest': 'rgb(var(--c-surface-container-highest) / <alpha-value>)',

        outline: 'rgb(var(--c-outline) / <alpha-value>)',
        'outline-variant': 'rgb(var(--c-outline-variant) / <alpha-value>)',

        // Primary = brand mint. Dark text on mint reads well in both modes.
        primary: '#10B981',
        'on-primary': '#17201E',
        'primary-container': 'rgb(var(--c-primary-container) / <alpha-value>)',
        'on-primary-container': 'rgb(var(--c-on-primary-container) / <alpha-value>)',

        secondary: '#55605F',
        'on-secondary': '#ffffff',
        'secondary-container': 'rgb(var(--c-secondary-container) / <alpha-value>)',
        'on-secondary-container': 'rgb(var(--c-foreground) / <alpha-value>)',

        tertiary: '#D97706',
        'on-tertiary': '#ffffff',
        'tertiary-container': 'rgb(var(--c-tertiary-container) / <alpha-value>)',
        'on-tertiary-container': 'rgb(var(--c-on-tertiary-container) / <alpha-value>)',

        success: '#059669',
        'on-success': '#ffffff',
        'success-container': 'rgb(var(--c-primary-container) / <alpha-value>)',
        'on-success-container': 'rgb(var(--c-on-primary-container) / <alpha-value>)',

        error: '#DC2626',
        'on-error': '#ffffff',
        'error-container': 'rgb(var(--c-error-container) / <alpha-value>)',
        'on-error-container': 'rgb(var(--c-on-error-container) / <alpha-value>)',

        warning: '#D97706',
        'on-warning': '#ffffff',
        'warning-container': 'rgb(var(--c-tertiary-container) / <alpha-value>)',
        'on-warning-container': 'rgb(var(--c-on-tertiary-container) / <alpha-value>)',

        // ============================================================================
        // Palette scales (CSS-variable driven). Remapping these re-skins the
        // entire app — pages use slate-*/emerald-*/etc. directly — and lets
        // every one of those classes adapt to dark mode automatically.
        // ============================================================================
        slate: {
          50: 'rgb(var(--c-slate-50) / <alpha-value>)',
          100: 'rgb(var(--c-slate-100) / <alpha-value>)',
          200: 'rgb(var(--c-slate-200) / <alpha-value>)',
          300: 'rgb(var(--c-slate-300) / <alpha-value>)',
          400: 'rgb(var(--c-slate-400) / <alpha-value>)',
          500: 'rgb(var(--c-slate-500) / <alpha-value>)',
          600: 'rgb(var(--c-slate-600) / <alpha-value>)',
          700: 'rgb(var(--c-slate-700) / <alpha-value>)',
          800: 'rgb(var(--c-slate-800) / <alpha-value>)',
          900: 'rgb(var(--c-slate-900) / <alpha-value>)',
          950: 'rgb(var(--c-slate-950) / <alpha-value>)',
        },
        emerald: {
          50: 'rgb(var(--c-emerald-50) / <alpha-value>)',
          100: 'rgb(var(--c-emerald-100) / <alpha-value>)',
          200: 'rgb(var(--c-emerald-200) / <alpha-value>)',
          300: 'rgb(var(--c-emerald-300) / <alpha-value>)',
          400: 'rgb(var(--c-emerald-400) / <alpha-value>)',
          500: 'rgb(var(--c-emerald-500) / <alpha-value>)',
          600: 'rgb(var(--c-emerald-600) / <alpha-value>)',
          700: 'rgb(var(--c-emerald-700) / <alpha-value>)',
          800: 'rgb(var(--c-emerald-800) / <alpha-value>)',
          900: 'rgb(var(--c-emerald-900) / <alpha-value>)',
        },
        amber: {
          50: 'rgb(var(--c-amber-50) / <alpha-value>)',
          100: 'rgb(var(--c-amber-100) / <alpha-value>)',
          200: 'rgb(var(--c-amber-200) / <alpha-value>)',
          300: 'rgb(var(--c-amber-300) / <alpha-value>)',
          400: 'rgb(var(--c-amber-400) / <alpha-value>)',
          500: 'rgb(var(--c-amber-500) / <alpha-value>)',
          600: 'rgb(var(--c-amber-600) / <alpha-value>)',
          700: 'rgb(var(--c-amber-700) / <alpha-value>)',
          800: 'rgb(var(--c-amber-800) / <alpha-value>)',
          900: 'rgb(var(--c-amber-900) / <alpha-value>)',
        },
        rose: {
          50: 'rgb(var(--c-rose-50) / <alpha-value>)',
          100: 'rgb(var(--c-rose-100) / <alpha-value>)',
          200: 'rgb(var(--c-rose-200) / <alpha-value>)',
          300: 'rgb(var(--c-rose-300) / <alpha-value>)',
          400: 'rgb(var(--c-rose-400) / <alpha-value>)',
          500: 'rgb(var(--c-rose-500) / <alpha-value>)',
          600: 'rgb(var(--c-rose-600) / <alpha-value>)',
          700: 'rgb(var(--c-rose-700) / <alpha-value>)',
          800: 'rgb(var(--c-rose-800) / <alpha-value>)',
          900: 'rgb(var(--c-rose-900) / <alpha-value>)',
        },
        red: {
          50: 'rgb(var(--c-red-50) / <alpha-value>)',
          100: 'rgb(var(--c-red-100) / <alpha-value>)',
          200: 'rgb(var(--c-red-200) / <alpha-value>)',
          300: 'rgb(var(--c-red-300) / <alpha-value>)',
          400: 'rgb(var(--c-red-400) / <alpha-value>)',
          500: 'rgb(var(--c-red-500) / <alpha-value>)',
          600: 'rgb(var(--c-red-600) / <alpha-value>)',
          700: 'rgb(var(--c-red-700) / <alpha-value>)',
        },
        blue: {
          50: 'rgb(var(--c-blue-50) / <alpha-value>)',
          100: 'rgb(var(--c-blue-100) / <alpha-value>)',
          200: 'rgb(var(--c-blue-200) / <alpha-value>)',
          300: 'rgb(var(--c-blue-300) / <alpha-value>)',
          400: 'rgb(var(--c-blue-400) / <alpha-value>)',
          500: 'rgb(var(--c-blue-500) / <alpha-value>)',
          600: 'rgb(var(--c-blue-600) / <alpha-value>)',
        },
        purple: {
          50: 'rgb(var(--c-purple-50) / <alpha-value>)',
          100: 'rgb(var(--c-purple-100) / <alpha-value>)',
          200: 'rgb(var(--c-purple-200) / <alpha-value>)',
          300: 'rgb(var(--c-purple-300) / <alpha-value>)',
          400: 'rgb(var(--c-purple-400) / <alpha-value>)',
          500: 'rgb(var(--c-purple-500) / <alpha-value>)',
          600: 'rgb(var(--c-purple-600) / <alpha-value>)',
          700: 'rgb(var(--c-purple-700) / <alpha-value>)',
        },
        sky: {
          50: 'rgb(var(--c-sky-50) / <alpha-value>)',
          100: 'rgb(var(--c-sky-100) / <alpha-value>)',
          200: 'rgb(var(--c-sky-200) / <alpha-value>)',
          300: 'rgb(var(--c-sky-300) / <alpha-value>)',
          400: 'rgb(var(--c-sky-400) / <alpha-value>)',
          500: 'rgb(var(--c-sky-500) / <alpha-value>)',
          600: 'rgb(var(--c-sky-600) / <alpha-value>)',
          700: 'rgb(var(--c-sky-700) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter var', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['Inter var', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        headline: ['Inter var', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        body: ['Inter var', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        label: ['Inter var', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      fontSize: {
        'headline-xl': ['38px', { lineHeight: '46px', letterSpacing: '-0.025em', fontWeight: '700' }],
        'headline-lg': ['30px', { lineHeight: '38px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-md': ['22px', { lineHeight: '30px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-sm': ['17px', { lineHeight: '24px', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '26px', fontWeight: '400' }],
        'body-md': ['14px', { lineHeight: '21px', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '18px', fontWeight: '400' }],
        'label-md': ['14px', { lineHeight: '20px', fontWeight: '500' }],
        'label-sm': ['12px', { lineHeight: '16px', fontWeight: '500', letterSpacing: '0.01em' }],
      },
      borderRadius: {
        DEFAULT: '0.625rem',
        sm: '0.375rem',
        md: '0.625rem',
        lg: '0.875rem',
        xl: '1.125rem',
        '2xl': '1.375rem',
        '3xl': '1.75rem',
        full: '9999px',
      },
      spacing: {
        gutter: '1.5rem',
        margin: '1.5rem',
        'space-xs': '0.25rem',
        'space-sm': '0.5rem',
        'space-md': '1rem',
        'space-lg': '1.5rem',
        'space-xl': '2.5rem',
        'space-2xl': '4rem',
      },
      boxShadow: {
        xs: '0 1px 2px rgba(23, 32, 30, 0.04)',
        sm: '0 1px 2px rgba(23, 32, 30, 0.04)',
        DEFAULT: '0 1px 3px rgba(23, 32, 30, 0.05), 0 1px 2px rgba(23, 32, 30, 0.03)',
        md: '0 4px 10px -2px rgba(23, 32, 30, 0.06), 0 2px 4px -2px rgba(23, 32, 30, 0.04)',
        lg: '0 12px 24px -6px rgba(23, 32, 30, 0.08), 0 4px 8px -4px rgba(23, 32, 30, 0.04)',
        xl: '0 20px 40px -12px rgba(23, 32, 30, 0.12)',
        '2xl': '0 25px 50px -12px rgba(23, 32, 30, 0.18)',
        inner: 'inset 0 2px 4px 0 rgba(23, 32, 30, 0.05)',
        'ambient': '0 2px 12px rgba(23, 32, 30, 0.05)',
        'elevated': '0 16px 48px rgba(23, 32, 30, 0.12)',
        'card': '0 1px 2px rgba(23, 32, 30, 0.04), 0 8px 24px -12px rgba(23, 32, 30, 0.10)',
        'card-hover': '0 2px 4px rgba(23, 32, 30, 0.05), 0 18px 40px -16px rgba(23, 32, 30, 0.16)',
      },
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
        '300': '300ms',
        '500': '500ms',
        '700': '700ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
        linear: 'linear',
        in: 'cubic-bezier(0.4, 0.0, 1, 1)',
        out: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
        'in-out': 'cubic-bezier(0.4, 0.0, 0.2, 1)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-gentle': 'bounce 2s infinite',
        'fade-in': 'fadeIn 200ms ease-out',
        'slide-up': 'slideUp 300ms ease-out',
        'scale-in': 'scaleIn 200ms ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
};
