import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-dm-sans)", "ui-sans-serif", "system-ui", "Segoe UI", "Inter", "Roboto", "Helvetica", "Arial"],
      },
      fontSize: {
        // Scale typographique professionnelle avec fluid typography
        'display': ['clamp(1.75rem, 5vw, 2.25rem)', { lineHeight: '1.15', fontWeight: '800' }],  // 28-36px
        'h1': ['clamp(1.25rem, 4vw, 1.5rem)', { lineHeight: '1.3', fontWeight: '700' }],          // 20-24px
        'h2': ['clamp(1rem, 3vw, 1.125rem)', { lineHeight: '1.4', fontWeight: '600' }],           // 16-18px
        'body': ['clamp(0.8125rem, 2.5vw, 0.875rem)', { lineHeight: '1.5', fontWeight: '400' }],  // 13-14px
        'caption': ['0.75rem', { lineHeight: '1rem', fontWeight: '500' }],                         // 12px
        'micro': ['0.6875rem', { lineHeight: '0.875rem', fontWeight: '500' }],                     // 11px
        // Large mobile-friendly sizes
        'amount': ['clamp(1.5rem, 7vw, 2rem)', { lineHeight: '1.1', fontWeight: '700' }],         // 24-32px for amounts
        'balance': ['clamp(1.75rem, 8vw, 2.5rem)', { lineHeight: '1.1', fontWeight: '800' }],     // 28-40px for balances
      },
      borderRadius: {
        '3xl': '24px',
        '2xl': '20px',
        xl: '16px',
        lg: '12px',
        md: '8px',
      },
      spacing: {
        // Touch-friendly spacing
        'touch': '48px',      // Minimum touch target
        'touch-lg': '56px',   // Large touch target
        'safe-b': 'env(safe-area-inset-bottom, 0)',
        'safe-t': 'env(safe-area-inset-top, 0)',
      },
      minHeight: {
        'touch': '48px',
        'touch-lg': '56px',
      },
      boxShadow: {
        soft: "0 18px 60px rgba(0,0,0,.18)",
        softDark: "0 18px 60px rgba(0,0,0,.45)",
        glow: "0 0 20px rgba(247,201,72,.25)",
        glowOk: "0 0 16px rgba(53,200,122,.3)",
        card: "0 4px 24px rgba(0,0,0,.12)",
        cardDark: "0 4px 32px rgba(0,0,0,.5)",
        input: "0 2px 8px rgba(0,0,0,.08)",
      },
      transitionTimingFunction: {
        standard: "cubic-bezier(0.22, 1, 0.36, 1)",
        emphasized: "cubic-bezier(0.2, 0.9, 0.25, 1)",
      },
      transitionDuration: {
        fast: "160ms",
        base: "240ms",
        slow: "360ms",
      },
      colors: {
        sp: {
          bg: "#0B0F17",
          surface: "#0F1623",
          surface2: "#151D2E",
          surface3: "#1A2436",
          border: "rgba(255,255,255,.12)",
          borderHover: "rgba(255,255,255,.20)",
          borderActive: "rgba(247,201,72,.5)",
          text: "rgba(255,255,255,.95)",
          muted: "rgba(255,255,255,.65)",
          muted2: "rgba(255,255,255,.45)",
          accent: "#F7C948",
          accentHover: "#FFDA6A",
          ok: "#35C87A",
          okMuted: "#2AA366",
          warn: "#FFBF47",
          bad: "#FF5D5D",
          blue: "#4D8EFF",
          // Light theme
          lightBg: "#F6F7FB",
          lightSurface: "#FFFFFF",
          lightSurface2: "#F2F4F8",
          lightBorder: "rgba(18,25,38,.10)",
          lightBorderHover: "rgba(18,25,38,.18)",
          lightText: "rgba(18,25,38,.95)",
          lightMuted: "rgba(18,25,38,.60)",
        },
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        bounce: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-2px)' },
        },
        spin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(247,201,72,.25)' },
          '50%': { boxShadow: '0 0 30px rgba(247,201,72,.45)' },
        },
        'press': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)' },
        },
        'success-pop': {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '50%': { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
      },
      animation: {
        shimmer: 'shimmer 2s infinite linear',
        fadeIn: 'fadeIn 0.2s ease-out',
        scaleIn: 'scaleIn 0.15s ease-out',
        slideUp: 'slideUp 0.25s ease-out',
        slideIn: 'slideIn 0.3s ease-out',
        slideInRight: 'slideInRight 0.3s ease-out',
        slideDown: 'slideDown 0.2s ease-out',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        bounce: 'bounce 1s ease-in-out infinite',
        'bounce-subtle': 'bounce-subtle 0.4s ease-out',
        spin: 'spin 1s linear infinite',
        wiggle: 'wiggle 0.3s ease-in-out',
        float: 'float 3s ease-in-out infinite',
        glow: 'glow 2s ease-in-out infinite',
        press: 'press 0.15s ease-out',
        'success-pop': 'success-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        shake: 'shake 0.3s ease-in-out',
      },
    },
  },
  plugins: [],
};

export default config;
