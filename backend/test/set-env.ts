// Las pruebas e2e deben correr con los límites de producción, no con los
// valores holgados del .env local (dotenv no pisa variables ya definidas).
process.env.LOGIN_RATE_LIMIT = '5';
process.env.RATE_LIMIT = '120';
