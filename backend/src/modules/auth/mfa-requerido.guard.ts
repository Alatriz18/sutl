import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { SIN_MFA_KEY } from '../../common/decorators/sin-mfa.decorator';
import { RequestUser } from '../../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { MfaPoliticaService } from './mfa-politica.service';

// Guard global (después de autenticar): a quien debe tener segundo factor y todavía no lo activó solo le deja
// usar las rutas marcadas @SinMfa() (activarlo y cerrar sesión). Quien ya lo tiene paga una sola consulta.
@Injectable()
export class MfaRequeridoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly politica: MfaPoliticaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = context.switchToHttp().getRequest<Request & { user?: RequestUser }>().user;
    if (!user) return true; // ruta pública
    if (this.reflector.getAllAndOverride<boolean>(SIN_MFA_KEY, [context.getHandler(), context.getClass()])) return true;

    const u = await this.prisma.user.findUnique({ where: { id: user.userId }, select: { mfaEnabledAt: true } });
    if (u?.mfaEnabledAt) return true;
    if (!(await this.politica.exigido(user))) return true;
    throw new ForbiddenException({ message: 'Tu empresa exige activar el segundo factor para continuar', code: 'MFA_REQUERIDO' });
  }
}
