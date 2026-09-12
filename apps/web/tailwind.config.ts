import type { Config } from 'tailwindcss';

/**
 * Vicinity design system — an original enterprise palette.
 * Brand: a calm indigo/violet. Surfaces: warm-neutral slate. Ink: text scale.
 * Semantic: success / danger / amber. Deliberately distinct from any competitor.
 */
const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef1ff',
          100: '#e0e5ff',
          200: '#c6ceff',
          300: '#a3adff',
          400: '#7c83fb',
          500: '#5f5cf0',
          600: '#4b41db',
          700: '#3e34b8',
          800: '#332d94',
          900: '#2d2a76',
        },
        surface: {
          0: '#ffffff',
          1: '#f8f9fc',
          2: '#eef0f6',
          3: '#e2e5ee',
        },
        ink: {
          300: '#b6bccb',
          400: '#8b93a7',
          500: '#697086',
          700: '#3d4356',
          900: '#1b1e2b',
        },
        success: { 500: '#22b07d', 600: '#1a9068' },
        danger: { 400: '#f27a7a', 500: '#e5484d', 600: '#cf3438' },
        amber: { 400: '#f5b544' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
};

export default config;
