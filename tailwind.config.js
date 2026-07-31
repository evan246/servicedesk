/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#fbf9f4',
          100: '#f6f1e8',
          200: '#ede4d3',
          300: '#e0d2b8',
        },
        ink: {
          700: '#3d3a35',
          800: '#2b2926',
          900: '#1c1b19',
        },
        teal: {
          50: '#f0f7f6',
          100: '#d9ecea',
          200: '#b3d8d4',
          300: '#84bdb7',
          400: '#549d96',
          500: '#3a847d',
          600: '#2f6b65',
          700: '#285651',
          800: '#234743',
          900: '#1f3c39',
        },
        green: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        urgency: {
          low: '#8a8a86',
          medium: '#c98a1a',
          high: '#c2461b',
        },
        status: {
          open: '#3a847d',
          in_progress: '#c98a1a',
          resolved: '#6b7280',
        },
      },
      fontFamily: {
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(28,27,25,0.04), 0 1px 3px rgba(28,27,25,0.03)',
        card: '0 1px 2px rgba(28,27,25,0.05)',
      },
      borderRadius: {
        xl: '0.875rem',
      },
    },
  },
  plugins: [],
};
