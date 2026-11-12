import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { sha256 } from '../../common/crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { FORMATO_API_KEY } from './api-keys.service';

const USO_CADA_MS = 60_000;

// Autentica las peticiones de la API pública por la cabecera X-API-Key. Deja
// el tenantId de la clave en la petición: la API pública SOLO ve datos de la
// empresa dueña de la clave. Toda falla responde lo mismo (no revela si la
// clave existió, fue revocada o su empresa está inactiva).
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const llave = req.headers['x-api-key'];
    if (typeof llave !== 'string' || !FORMATO_API_KEY.test(llave)) throw new UnauthorizedException('API key inválida');

    const registro = await this.prisma.apiKey.findUnique({
      where: { hash: sha256(llave) },
      select: { id: true, tenantId: true, revocadaAt: true, ultimoUsoAt: true, tenant: { select: { activo: true } } },
    });
    if (!registro || registro.revocadaAt || !registro.tenant.activo) throw new UnauthorizedException('API key inválida');

    // Marca de último uso: como mucho una vez por minuto, sin frenar la petición.
    if (!registro.ultimoUsoAt || Date.now() - registro.ultimoUsoAt.getTime() > USO_CADA_MS) {
      void this.prisma.apiKey.updateMany({ where: { id: registro.id }, data: { ultimoUsoAt: new Date() } }).catch(() => undefined);
    }
    req.apiTenantId = registro.tenantId;
    return true;
  }
}
