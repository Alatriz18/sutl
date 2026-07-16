// El access token vive solo en memoria (nunca en localStorage) para reducir
// exposición a XSS. El refresh token vive en cookie httpOnly seteada por el
// backend, por eso la sesión sobrevive a un refresh de página vía /auth/refresh.
let accessToken: string | null = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string) {
  accessToken = token;
}

export function clearAccessToken() {
  accessToken = null;
}
