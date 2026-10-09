import axios from 'axios';
import { getAccessToken, setAccessToken, clearAccessToken } from './token-store';
import { mockAdapter } from './mock/adapter';

// Modo demo: sin backend ni base de datos desplegados, toda la API se
// simula en el navegador con datos de muestra (ver src/lib/mock/). Se activa
// con NEXT_PUBLIC_DEMO_MODE=true — es el modo usado en el despliegue de
// Vercel hasta que el backend real esté en producción.
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api',
  withCredentials: true, // envía la cookie httpOnly del refresh token
  ...(DEMO_MODE ? { adapter: mockAdapter } : {}),
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!refreshing) {
        refreshing = api
          .post('/auth/refresh')
          .then((res) => {
            const newToken = res.data.accessToken as string;
            setAccessToken(newToken);
            return newToken;
          })
          .catch(() => {
            clearAccessToken();
            return null;
          })
          .finally(() => {
            refreshing = null;
          });
      }

      const newToken = await refreshing;
      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      }
    }

    return Promise.reject(error);
  },
);
