import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#0a0c10',
        panel: '#111318',
        border: '#1e2330',
        muted: '#64748b',
        accent: '#6366f1',
        'accent-light': '#a5b4fc',
        nvidia: '#76b900',
        'nvidia-dark': '#0a0e06',
        'nvidia-dim': '#3a5c00',
      },
      fontFamily: {
        mono: ['Consolas', 'monospace'],
      },
    },
  },
} satisfies Config
