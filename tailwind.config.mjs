/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  safelist: [
    'from-dark-blue', 'to-dark-blue-dark',
    'from-mid-blue', 'to-dark-blue',
    'from-terracotta', 'to-terracotta-dark',
  ],
  theme: {
    extend: {
      colors: {
        terracotta: {
          DEFAULT: '#FF6B35',
          dark: '#e85a28',
        },
        brown: '#9C8172',
        'mid-blue': '#3996AE',
        'light-blue': '#F4F4ED', 
        'dark-blue': {
          DEFAULT: '#40575D',
          dark: '#3A4E53',
        },
        pacificblue: '#48A8C1',
        cream: '#F4F4ED',
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
