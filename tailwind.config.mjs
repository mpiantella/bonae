/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#f2f6f7',
          100: '#dbe5e7',
          200: '#c0d1d4',
          300: '#9fb8bc',
          400: '#7f9fa5',
          500: '#66888e',
          600: '#567279',
          700: '#4d656c',
          800: '#455e64',
          900: '#40575e'
        },
        gold: {
          50:  '#fdfaec',
          100: '#faf0c5',
          200: '#f5e08a',
          300: '#eecb4f',
          400: '#c9a84c',
          500: '#a88538',
          600: '#826428',
          700: '#5c461c',
          800: '#3a2c11',
          900: '#1e1608',
        },
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
