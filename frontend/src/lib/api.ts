import axios from 'axios';
import { getAccessToken, setAccessToken, clearAccessToken } from './token-store';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api',
  withCredentials: true, // envía la cookie httpOnly del refresh token
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
        refreshing = axios
          .post(
            `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'}/auth/refresh`,
            {},
            { withCredentials: true },
          )
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
