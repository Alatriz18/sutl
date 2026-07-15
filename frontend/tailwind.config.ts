import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Paleta SUTL — navy / sky blue / gold (deck de inversionista)
        navy: '#0D2040',
        sky: '#0EA5E9',
        gold: '#F59E0B',
      },
    },
  },
  plugins: [],
};

export default config;
