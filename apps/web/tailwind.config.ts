import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        slateInk: '#0f172a',
        cream: '#f8f5ed',
        field: '#5b7c3a',
        amberCard: '#f6c565',
      },
      boxShadow: {
        card: '0 10px 24px rgba(15, 23, 42, 0.14)',
      },
    },
  },
  plugins: [],
};

export default config;
