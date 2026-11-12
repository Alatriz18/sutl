// Las pruebas e2e deben correr con los límites de producción, no con los
// valores holgados del .env local (dotenv no pisa variables ya definidas).
process.env.LOGIN_RATE_LIMIT = '5';
process.env.RATE_LIMIT = '120';
// Reintentos de notificaciones rápidos en las pruebas (en producción: 5 s, 10 s…).
process.env.NOTIFICACIONES_BACKOFF_MS = '50';
// Webhooks: reintentos rápidos y destinos locales (el simulador de las pruebas) permitidos.
process.env.WEBHOOKS_BACKOFF_MS = '50';
process.env.WEBHOOKS_ALLOW_PRIVATE = 'true';
// Clave de cifrado solo para pruebas (no es un secreto real).
process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.LEADS_RATE_LIMIT = '5';
