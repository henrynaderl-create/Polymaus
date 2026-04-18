/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Modern dark theme tokens
        surface: {
          bg:    '#0B0B0F',
          panel: '#111118',
          card:  '#16161F',
          hover: '#1D1D28',
          input: '#1A1A24',
        },
        accent: {
          DEFAULT: '#FF6B35',
          orange:  '#FF6B35',
          red:     '#FF4500',
          glow:    'rgba(255,107,53,0.15)',
          border:  'rgba(255,107,53,0.25)',
        },
        // Legacy term-* remapped to modern dark palette
        term: {
          bg:    '#0B0B0F',
          panel: '#111118',
          card:  '#16161F',
          border:'#1E1E2A',
          dim:   '#4B5563',
          mid:   '#64748B',
          green: '#10B981',
          bright:'#34D399',
          amber: '#F59E0B',
          red:   '#EF4444',
          purple:'#A78BFA',
          cyan:  '#22D3EE',
        },
        success: '#10B981',
        danger:  '#EF4444',
        warning: '#F59E0B',
        info:    '#3B82F6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      backgroundImage: {
        'accent-gradient':  'linear-gradient(135deg, #FF4500, #FF8C00)',
        'card-accent':      'linear-gradient(135deg, rgba(255,107,53,0.07) 0%, transparent 60%)',
        'hero-glow':        'radial-gradient(ellipse at 50% 0%, rgba(255,107,53,0.10) 0%, transparent 70%)',
        'sidebar-bg':       'linear-gradient(180deg, #0F0F16 0%, #0B0B0F 100%)',
      },
      boxShadow: {
        card:      '0 4px 20px rgba(0,0,0,0.5)',
        'card-lg': '0 8px 40px rgba(0,0,0,0.6)',
        'glow-sm': '0 0 12px rgba(255,107,53,0.25)',
        'glow-md': '0 0 24px rgba(255,107,53,0.2)',
        'glow-lg': '0 0 40px rgba(255,107,53,0.15)',
      },
      animation: {
        'blink':      'blink 1s step-end infinite',
        'scroll':     'scrollUp 0.3s ease-out',
        'flash-in':   'flashIn 0.5s ease-out forwards',
        'slide-in':   'slideIn 0.25s ease-out forwards',
        'fade-in':    'fadeIn 0.2s ease-out forwards',
        'pulse2':     'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'glow':       'glowPulse 2s ease-in-out infinite alternate',
      },
      keyframes: {
        blink:     { '0%,100%': { opacity: '1' }, '50%': { opacity: '0' } },
        scrollUp:  { from: { opacity: '0', transform: 'translateY(-6px)' }, to: { opacity: '1', transform: 'none' } },
        flashIn:   { '0%': { backgroundColor: 'rgba(255,107,53,0.1)' }, '100%': { backgroundColor: 'transparent' } },
        slideIn:   { from: { opacity: '0', transform: 'translateX(-8px)' }, to: { opacity: '1', transform: 'none' } },
        fadeIn:    { from: { opacity: '0' }, to: { opacity: '1' } },
        glowPulse: {
          from: { boxShadow: '0 0 8px rgba(255,107,53,0.2)' },
          to:   { boxShadow: '0 0 20px rgba(255,107,53,0.4)' },
        },
      },
    },
  },
  plugins: [],
};
