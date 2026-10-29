import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Referencias a otros registros que llegan en el body de un create/update.
// Prisma solo valida que el ID exista (FK), no que sea del mismo tenant: sin
// este control, un tenant podría enlazar sus registros a un cliente, envío o
// usuario de otro tenant y, vía `include`, leer sus datos en la respuesta.
export interface TenantRefs {
  clienteId?: string | null;
  partnerId?: string | null;
  shipmentId?: string | null;
  quoteId?: string | null;
  driverId?: string | null;
  userId?: string | null;
  // Catálogo global (sin tenantId): solo se valida que exista, para
  // responder 404 en vez de un 500 por violación de FK.
  carrierId?: string | null;
}

type RefCheck = {
  mensaje: string;
  existe: (prisma: PrismaService, tenantId: string, id: string) => Promise<number>;
};

const CHECKS: Record<keyof TenantRefs, RefCheck> = {
  clienteId: {
    mensaje: 'Cliente no encontrado',
    existe: (p, tenantId, id) => p.partner.count({ where: { id, tenantId } }),
  },
  partnerId: {
    mensaje: 'Contraparte no encontrada',
    existe: (p, tenantId, id) => p.partner.count({ where: { id, tenantId } }),
  },
  shipmentId: {
    mensaje: 'Envío no encontrado',
    existe: (p, tenantId, id) => p.shipment.count({ where: { id, tenantId } }),
  },
  quoteId: {
    mensaje: 'Cotización no encontrada',
    existe: (p, tenantId, id) => p.quote.count({ where: { id, tenantId } }),
  },
  driverId: {
    mensaje: 'Conductor no encontrado',
    existe: (p, tenantId, id) => p.driver.count({ where: { id, tenantId } }),
  },
  userId: {
    mensaje: 'Usuario no encontrado',
    existe: (p, tenantId, id) => p.user.count({ where: { id, tenantId } }),
  },
  carrierId: {
    mensaje: 'Transportista no encontrado',
    existe: (p, _tenantId, id) => p.carrier.count({ where: { id } }),
  },
};

// Lanza 404 si alguna referencia presente no pertenece al tenant. Mismo
// mensaje que para un ID inexistente: no revela si el ID existe en otro tenant.
export async function assertTenantRefs(
  prisma: PrismaService,
  tenantId: string,
  refs: TenantRefs,
): Promise<void> {
  for (const campo of Object.keys(refs) as (keyof TenantRefs)[]) {
    const id = refs[campo];
    if (id == null) continue;
    const check = CHECKS[campo];
    if ((await check.existe(prisma, tenantId, id)) === 0) {
      throw new NotFoundException(check.mensaje);
    }
  }
}
