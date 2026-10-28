import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Paleta SUTL — navy / steel blue / bronze gold (deck de inversionista).
        // Tonos desaturados a propósito frente al cian/ámbar de antes, para
        // leer como software corporativo de logística, no como un SaaS de
        // consumo.
        navy: '#0D2040',
        sky: '#2E86AB',
        gold: '#B38A3C',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'navy-radial':
          'radial-gradient(120% 120% at 50% 0%, #163463 0%, #0D2040 55%, #081730 100%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        flow: {
          to: { strokeDashoffset: '-24' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        glow: {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '0.9' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease-out both',
        flow: 'flow 1.2s linear infinite',
        marquee: 'marquee 40s linear infinite',
        float: 'float 6s ease-in-out infinite',
        'slide-in': 'slide-in 0.4s ease-out both',
        glow: 'glow 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
