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
        space: {
          950: '#030712',
          900: '#050a15',
          850: '#070d1b',
          800: '#0d1628',
          700: '#152238',
          600: '#1e3250',
        },
        payload: {
          velc: '#f43f5e',
          suit: '#10b981',
          solexs: '#f97316',
          hel1os: '#14b8a6',
          aspex: '#38bdf8',
          papa: '#f59e0b',
          mag: '#0ea5e9',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(56, 189, 248, 0.25)',
        'glow-lg': '0 0 35px rgba(56, 189, 248, 0.35)',
        'glow-accent': '0 0 20px rgba(244, 63, 94, 0.3)',
      }
    },
  },
  plugins: [],
}
