import { ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { RolUsuario, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { claveDeCifradoConfigurada, cifrar, descifrar } from '../../common/crypto';
import { RequestUser } from '../../common/interfaces/jwt-payload.interface';
import {
  generarCodigosRecuperacion,
  generarSecreto,
  hashCodigoRecuperacion,
  urlOtpauth,
  verificarCodigo,
} from '../../common/totp';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const MAX_FALLOS = 5;
const BLOQUEO_MIN = 15;

type UsuarioMfa = Pick<User, 'id' | 'tenantId' | 'email' | 'mfaSecret' | 'mfaEnabledAt' | 'mfaLastStep' | 'mfaLockedUntil'>;

// Segundo factor con app de autenticación (TOTP). El secreto se guarda cifrado;
// los códigos de recuperación, solo como huella; cada código sirve una vez y
// tras 5 fallos seguidos la cuenta se bloquea 15 minutos para el segundo factor.
@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async estado(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { mfaEnabledAt: true } });
    const restantes = u.mfaEnabledAt ? await this.prisma.mfaRecoveryCode.count({ where: { userId, usedAt: null } }) : 0;
    return { activo: !!u.mfaEnabledAt, activadoEn: u.mfaEnabledAt, codigosDeRecuperacionRestantes: restantes };
  }

  // Paso 1: genera el secreto (todavía sin activar) para que la persona lo agregue a su app.
  async iniciar(actor: RequestUser) {
    if (!claveDeCifradoConfigurada()) throw new ServiceUnavailableException('El segundo factor no está disponible en este servidor');
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.userId }, select: { mfaEnabledAt: true } });
    if (u.mfaEnabledAt) throw new ConflictException('El segundo factor ya está activo. Desactívalo primero para volver a configurarlo.');
    const secreto = generarSecreto();
    await this.prisma.user.update({ where: { id: actor.userId }, data: { mfaSecret: cifrar(secreto), mfaLastStep: null } });
    return { secreto, otpauthUrl: urlOtpauth(secreto, actor.email) };
  }

  // Paso 2: confirma con un código de la app. Devuelve los códigos de recuperación (única vez).
  async activar(actor: RequestUser, codigo: string) {
    const u = await this.cargar(actor.userId);
    if (u.mfaEnabledAt) throw new ConflictException('El segundo factor ya está activo');
    if (!u.mfaSecret) throw new ConflictException('Primero genera el secreto del segundo factor');
    const step = verificarCodigo(descifrar(u.mfaSecret), codigo);
    if (step === null) throw new UnauthorizedException('Código de verificación inválido');

    const codigos = generarCodigosRecuperacion();
    const ahora = new Date();
    const { count } = await this.prisma.user.updateMany({
      where: { id: u.id, mfaEnabledAt: null },
      data: { mfaEnabledAt: ahora, mfaLastStep: step, mfaFailures: 0, mfaLockedUntil: null },
    });
    if (count === 0) throw new ConflictException('El segundo factor ya está activo');
    await this.prisma.mfaRecoveryCode.deleteMany({ where: { userId: u.id } });
    await this.prisma.mfaRecoveryCode.createMany({ data: codigos.map((c) => ({ userId: u.id, codeHash: hashCodigoRecuperacion(c) })) });
    await this.audit.registrar({ tenantId: u.tenantId, userId: u.id, accion: 'mfa.activado', entidad: 'usuario', entidadId: u.id });
    return { codigosDeRecuperacion: codigos };
  }

  // Desactivar exige la contraseña y un código vigente (o de recuperación).
  async desactivar(actor: RequestUser, password: string, codigo: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.userId } });
    if (!u.mfaEnabledAt) throw new ConflictException('El segundo factor no está activo');
    if (!(await bcrypt.compare(password, u.password))) throw new UnauthorizedException('Contraseña incorrecta');
    await this.verificarSegundoFactor(u, codigo);
    await this.limpiar(u.id, false);
    await this.audit.registrar({ tenantId: u.tenantId, userId: u.id, accion: 'mfa.desactivado', entidad: 'usuario', entidadId: u.id });
    return { ok: true };
  }

  // Un administrador restablece el segundo factor de alguien que perdió su teléfono y sus códigos.
  async restablecer(actor: RequestUser, userId: string) {
    const objetivo = await this.prisma.user.findFirst({
      where: { id: userId, ...(actor.rol === RolUsuario.super_admin ? {} : { tenantId: actor.tenantId }) },
      select: { id: true, tenantId: true, rol: true },
    });
    if (!objetivo) throw new NotFoundException('Usuario no encontrado');
    if (objetivo.rol === RolUsuario.super_admin && actor.rol !== RolUsuario.super_admin) {
      throw new ForbiddenException('No puedes modificar a un super administrador');
    }
    await this.limpiar(objetivo.id, true);
    await this.audit.registrar({
      tenantId: objetivo.tenantId,
      userId: actor.userId,
      accion: 'mfa.restablecido',
      entidad: 'usuario',
      entidadId: objetivo.id,
    });
    return { ok: true };
  }

  // Valida el segundo factor de quien ya puso bien su contraseña. Lanza 401 si falla.
  async verificarSegundoFactor(u: UsuarioMfa, codigo: string): Promise<void> {
    if (u.mfaLockedUntil && u.mfaLockedUntil > new Date()) {
      throw new UnauthorizedException('Demasiados intentos fallidos. Inténtalo de nuevo en unos minutos.');
    }
    if (await this.aceptar(u, codigo)) return;
    await this.registrarFallo(u);
    throw new UnauthorizedException('Código de verificación inválido');
  }

  private async aceptar(u: UsuarioMfa, codigo: string): Promise<boolean> {
    const limpio = codigo.trim();
    if (/^\d{6}$/.test(limpio)) {
      if (!u.mfaSecret) return false;
      const step = verificarCodigo(descifrar(u.mfaSecret), limpio);
      if (step === null) return false;
      // Un mismo código no sirve dos veces: el paso aceptado debe ser mayor al último usado (atómico).
      const { count } = await this.prisma.user.updateMany({
        where: { id: u.id, OR: [{ mfaLastStep: null }, { mfaLastStep: { lt: step } }] },
        data: { mfaLastStep: step, mfaFailures: 0, mfaLockedUntil: null },
      });
      return count === 1;
    }
    // Código de recuperación: se marca usado de forma atómica.
    const { count } = await this.prisma.mfaRecoveryCode.updateMany({
      where: { userId: u.id, codeHash: hashCodigoRecuperacion(limpio), usedAt: null },
      data: { usedAt: new Date() },
    });
    if (count !== 1) return false;
    await this.prisma.user.update({ where: { id: u.id }, data: { mfaFailures: 0, mfaLockedUntil: null } });
    await this.audit.registrar({ tenantId: u.tenantId, userId: u.id, accion: 'mfa.codigo_recuperacion_usado', entidad: 'usuario', entidadId: u.id });
    return true;
  }

  private async registrarFallo(u: UsuarioMfa) {
    const { mfaFailures } = await this.prisma.user.update({
      where: { id: u.id },
      data: { mfaFailures: { increment: 1 } },
      select: { mfaFailures: true },
    });
    if (mfaFailures >= MAX_FALLOS) {
      await this.prisma.user.update({
        where: { id: u.id },
        data: { mfaFailures: 0, mfaLockedUntil: new Date(Date.now() + BLOQUEO_MIN * 60_000) },
      });
      await this.audit.registrar({ tenantId: u.tenantId, userId: u.id, accion: 'mfa.bloqueado', entidad: 'usuario', entidadId: u.id, metadata: { minutos: BLOQUEO_MIN } });
    }
  }

  private async limpiar(userId: string, cerrarSesion: boolean) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: null, mfaEnabledAt: null, mfaLastStep: null, mfaFailures: 0, mfaLockedUntil: null, ...(cerrarSesion ? { refreshTokenHash: null } : {}) },
    });
    await this.prisma.mfaRecoveryCode.deleteMany({ where: { userId } });
  }

  private cargar(id: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: { id: true, tenantId: true, email: true, mfaSecret: true, mfaEnabledAt: true, mfaLastStep: true, mfaLockedUntil: true },
    });
  }
}
