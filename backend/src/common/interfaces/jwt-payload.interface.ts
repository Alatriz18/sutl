import { RolUsuario } from '@prisma/client';

export interface JwtPayload {
  sub: string; // userId
  tenantId: string;
  rol: RolUsuario;
  email: string;
}

export interface RequestUser {
  userId: string;
  tenantId: string;
  rol: RolUsuario;
  email: string;
}
