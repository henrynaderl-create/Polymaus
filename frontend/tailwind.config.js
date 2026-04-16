/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        term: {
          bg:    '#020b04',
          panel: '#040f06',
          card:  '#071209',
          border:'#0d2e12',
          dim:   '#1a5c2a',
          mid:   '#2d8c3c',
          green: '#00ff41',
          bright:'#39ff14',
          amber: '#ffaa00',
          red:   '#ff3333',
          purple:'#b44fff',
          cyan:  '#00ffcc',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Courier New"', 'monospace'],
      },
      animation: {
        blink: 'blink 1s step-end infinite',
        scroll: 'scrollUp 0.3s ease-out',
        glow:   'glow 2s ease-in-out infinite alternate',
        pulse2: 'pulse 1.5s cubic-bezier(0.4,0,0.6,1) infinite',
      },
      keyframes: {
        blink:    { '0%,100%': { opacity: '1' }, '50%': { opacity: '0' } },
        scrollUp: { from: { opacity: '0', transform: 'translateY(-4px)' }, to: { opacity: '1', transform: 'none' } },
        glow:     { from: { textShadow: '0 0 4px #00ff41' }, to: { textShadow: '0 0 12px #00ff41, 0 0 24px #00ff4166' } },
      },
    },
  },
  plugins: [],
};
