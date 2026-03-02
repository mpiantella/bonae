/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#f0f4f9',
          100: '#d9e4f0',
          200: '#b3c9e0',
          300: '#7fa3c8',
          400: '#4d7db0',
          500: '#2e5f94',
          600: '#1e3a5f',
          700: '#172d4a',
          800: '#0f1f33',
          900: '#08111c',
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
