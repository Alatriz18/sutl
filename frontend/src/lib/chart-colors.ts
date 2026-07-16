// Paleta de referencia validada (dataviz skill): orden categórico fijo con
// separación CVD garantizada — nunca reordenar ni ciclar estos slots.
export const CATEGORICAL = [
  '#2a78d6', // 1 blue
  '#1baf7a', // 2 aqua
  '#eda100', // 3 yellow
  '#008300', // 4 green
  '#4a3aa7', // 5 violet
  '#e34948', // 6 red
  '#e87ba4', // 7 magenta
  '#eb6834', // 8 orange
] as const;

// Rampa secuencial de un solo hue (azul), clara → oscura.
export const SEQUENTIAL_BLUE = [
  '#cde2fb',
  '#9ec5f4',
  '#6da7ec',
  '#3987e5',
  '#256abf',
  '#184f95',
  '#0d366b',
] as const;

// Paleta de estado — fija, nunca reutilizada para series categóricas.
export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
} as const;

// Tinta y chrome del chart (modo claro — el dashboard actual es solo claro).
export const CHART_INK = {
  primary: '#0b0b0b',
  secondary: '#52514e',
  muted: '#898781',
  gridline: '#e1e0d9',
  baseline: '#c3c2b7',
  surface: '#fcfcfb',
} as const;
