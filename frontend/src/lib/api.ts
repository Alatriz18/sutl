import axios from 'axios';

// TODO (Fase 1 - Claude Code): agregar interceptor de refresh token
// una vez que el módulo auth del backend esté implementado.
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api',
  withCredentials: true,
});
