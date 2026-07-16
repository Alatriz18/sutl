import { RolUsuario } from '@/types';

export interface DecodedToken {
  sub: string;
  tenantId: string;
  rol: RolUsuario;
  email: string;
  exp: number;
}

// Decodificación local del payload del JWT (sin verificar firma — la
// verificación real la hace el backend). Solo se usa para pintar la UI
// (nombre de rol, menú visible), nunca para decisiones de autorización.
export function decodeJwt(token: string): DecodedToken | null {
  try {
    const [, payload] = token.split('.');
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return json as DecodedToken;
  } catch {
    return null;
  }
}
