/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0A0B0D',
          surface: '#14161A',
          elevated: '#1C1F24',
        },
        border: {
          subtle: '#23272E',
        },
        text: {
          primary: '#F4F5F7',
          secondary: '#A8ADB8',
          tertiary: '#6B7280',
        },
        accent: {
          DEFAULT: '#C9F378',
          dim: 'rgba(201, 243, 120, 0.12)',
          glow: 'rgba(201, 243, 120, 0.18)',
        },
        ok: '#4ADE80',
        warn: '#FBBF24',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.02em',
        tighter: '-0.015em',
        tight2: '-0.01em',
      },
      maxWidth: {
        content: '1200px',
        prose2: '720px',
        narrow: '880px',
      },
      backgroundImage: {
        'hero-glow':
          'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(201,243,120,0.08) 0%, transparent 60%)',
        'cta-glow':
          'radial-gradient(ellipse 60% 100% at 50% 50%, rgba(201,243,120,0.06) 0%, transparent 70%)',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        drift: {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '50%': { transform: 'translate(20px, -10px)' },
        },
        gradientDrift: {
          '0%, 100%': { backgroundPosition: '50% 0%' },
          '50%': { backgroundPosition: '50% 30%' },
        },
      },
      animation: {
        'fade-up': 'fadeUp 600ms ease-out forwards',
        drift: 'drift 8s ease-in-out infinite',
        'gradient-drift': 'gradientDrift 20s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
