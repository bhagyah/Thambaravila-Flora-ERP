import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#6BAF91',
          greenHover: '#4E9D82',
        },
        core: {
          dark: '#222826',
          light: '#FFFFFF',
        },
        flora: {
          green: '#4E9D82',
          sage: '#6BAF91',
          dark: 'var(--flora-dark)',
          darker: 'var(--flora-darker)',
          card: 'var(--flora-card)',
          border: 'var(--flora-border)',
          light: '#F8FAF9',
        },
      },
    },
  },
  plugins: [],
};

export default config;
