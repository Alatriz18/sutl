import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

const config = [
  ...nextCoreWebVitals,
  {
    // La regla nueva de React 19 marca el patrón de cargar datos al montar el componente (effect + fetch + setState),
    // que usamos de forma estándar en toda la app. Se deja como aviso mientras se migra a otro enfoque de carga.
    rules: { 'react-hooks/set-state-in-effect': 'warn' },
  },
  { ignores: ['.next/**', 'node_modules/**', 'test-results/**', 'next-env.d.ts'] },
];

export default config;
