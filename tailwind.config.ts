import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        subject: {
          math:    '#3B82F6',
          ela:     '#8B5CF6',
          science: '#10B981',
          ss:      '#F59E0B',
          spanish: '#EF4444',
          art:     '#EC4899',
          music:   '#6366F1',
          library: '#14B8A6',
          homeroom:'#6B7280',
        },
      },
    },
  },
  plugins: [],
}

export default config
