// Falla rápido y con un mensaje claro si el backend no está arriba o la base
// no está sembrada, en vez de 20 pruebas con timeouts incomprensibles.
export default async function globalSetup() {
  const api = 'http://localhost:3001/api';
  const res = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@demo-transportes.com', password: 'Demo2026!' }),
  }).catch(() => null);
  if (!res) {
    throw new Error(
      'No hay backend en http://localhost:3001. Levanta el stack local (docker compose + npm run start:dev).',
    );
  }
  if (res.status !== 200) {
    throw new Error(`El login del usuario demo dio ${res.status}: ¿corriste la semilla (npx prisma db seed)?`);
  }
}
