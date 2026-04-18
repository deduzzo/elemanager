/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        neon: {
          cyan: '#22d3ee',
          violet: '#a78bfa',
          pink: '#f472b6',
        },
        bg: {
          deep: '#0a0f1e',
          panel: 'rgba(255,255,255,0.04)',
        },
      },
      backgroundImage: {
        'gradient-neon': 'linear-gradient(135deg,#22d3ee 0%,#a78bfa 50%,#f472b6 100%)',
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(34,211,238,0.35)',
      },
      backdropBlur: { xs: '2px' },
    },
  },
  plugins: [],
};
