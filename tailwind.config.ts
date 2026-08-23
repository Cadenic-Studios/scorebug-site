import type { Config } from 'tailwindcss'

/**
 * Mirrors the native app's dark palette (app/globals.css in scorebug-app):
 * the site and the product must read as the same object.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#0A0B0E',
        card: '#11151C',
        'sb-red': '#F85149',
        'sb-blue': '#58A6FF',
        'sb-teal': '#2DD4BF',
        'sb-gold': '#E5B53C',
        ink: '#E6EDF3',
        'ink-2': '#A8B3BF',
        'ink-3': '#7D8590',
      },
      fontFamily: {
        display: ['var(--font-oswald)', 'Arial Narrow', 'sans-serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
