import { RolUsuario } from '@prisma/client';

export interface JwtPayload {
  sub: string; // userId
  tenantId: string;
  rol: RolUsuario;
  email: string;
  // Solo analista_sutl: su empresa de origen (la de SUTL). Si tenantId es otro,
  // está trabajando en una empresa cliente y cada request exige un permiso vigente.
  origen?: string;
}

export interface RequestUser {
  userId: string;
  tenantId: string;
  rol: RolUsuario;
  email: string;
  origen?: string;
}
