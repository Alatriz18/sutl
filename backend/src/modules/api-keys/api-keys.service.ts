import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { sha256 } from '../../common/crypto';
import { PrismaService } from '../../prisma/prisma.service';

const MAX_ACTIVAS = 20;
const PUBLICO = { id: true, nombre: true, prefijo: true, ultimoUsoAt: true, revocadaAt: true, createdAt: true } as const;

// Formato: sutl_ + 32 caracteres aleatorios (192 bits). Se reconoce por el prefijo.
export const FORMATO_API_KEY = /^sutl_[A-Za-z0-9_-]{32}$/;

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  listar(tenantId: string) {
    return this.prisma.apiKey.findMany({ where: { tenantId }, select: PUBLICO, orderBy: { createdAt: 'desc' } });
  }

  async crear(tenantId: string, creadaPorId: string | null, nombre: string) {
    const activas = await this.prisma.apiKey.count({ where: { tenantId, revocadaAt: null } });
    if (activas >= MAX_ACTIVAS) {
      throw new BadRequestException(`Se alcanzó el máximo de ${MAX_ACTIVAS} claves activas. Revoca alguna que ya no uses.`);
    }
    const llave = `sutl_${randomBytes(24).toString('base64url')}`;
    const creada = await this.prisma.apiKey.create({
      data: { tenantId, nombre: nombre.trim(), prefijo: llave.slice(0, 11), hash: sha256(llave), creadaPorId },
      select: PUBLICO,
    });
    // La llave completa solo existe aquí: en la base queda únicamente su huella.
    return { ...creada, llave };
  }

  async revocar(tenantId: string, id: string) {
    const { count } = await this.prisma.apiKey.updateMany({ where: { id, tenantId, revocadaAt: null }, data: { revocadaAt: new Date() } });
    if (count === 0) throw new NotFoundException('API key no encontrada');
    return { id };
  }
}
