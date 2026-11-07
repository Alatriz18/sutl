// Nombres de colas y de trabajos. Una cola por responsabilidad, para poder
// escalar o pausar cada una por separado (reglas, notificaciones, webhooks).
export const COLA_MANTENIMIENTO = 'mantenimiento';

export const TRABAJO_LATIDO = 'latido';

// Cada cuánto corre el trabajo programado de prueba.
export const LATIDO_CADA_MS = 60_000;
