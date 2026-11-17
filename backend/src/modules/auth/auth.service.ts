import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { AnalystAccessService } from '../analyst-access/analyst-access.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';
import { MfaService } from './mfa.service';
import { RegisterDto } from './dto/register.dto';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mfa: MfaService,
    private readonly audit: AuditService,
    private readonly analystAccess: AnalystAccessService,
  ) {}

  // Invocado solo por super_admin (ver AuthController) para aprovisionar el
  // primer usuario de un tenant nuevo. A propósito NO emite tokens ni inicia
  // sesión como el usuario creado — quien llama sigue siendo super_admin, no
  // el usuario recién creado; secuestrar su sesión sería un bug de seguridad
  // en sí mismo, además de la fuga entre tenants que esto reemplaza.
  async register(dto: RegisterDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: dto.tenantId } });
    if (!tenant || !tenant.activo) {
      throw new UnauthorizedException('Tenant no válido o inactivo');
    }

    const existente = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: dto.tenantId, email: dto.email } },
    });
    if (existente) {
      throw new ConflictException('Ya existe un usuario con ese email en este tenant');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        tenantId: dto.tenantId,
        email: dto.email,
        password: hashedPassword,
        nombre: dto.nombre,
      },
      select: {
        id: true,
        email: true,
        nombre: true,
        rol: true,
        tenantId: true,
        activo: true,
        createdAt: true,
      },
    });

    return user;
  }

  // Devuelve los tokens, o { mfaRequerido: true } si la contraseña es correcta
  // pero la cuenta tiene segundo factor y todavía no llegó el código.
  async login(dto: LoginDto): Promise<AuthTokens | { mfaRequerido: true }> {
    const user = await this.prisma.user.findFirst({ where: { email: dto.email } });
    if (!user || !user.activo) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordValida = await bcrypt.compare(dto.password, user.password);
    if (!passwordValida) {
      await this.audit.registrar({ tenantId: user.tenantId, userId: user.id, accion: 'auth.login_fallido', entidad: 'usuario', entidadId: user.id });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.mfaEnabledAt) {
      if (!dto.codigo) return { mfaRequerido: true };
      try {
        await this.mfa.verificarSegundoFactor(user, dto.codigo);
      } catch (e) {
        await this.audit.registrar({ tenantId: user.tenantId, userId: user.id, accion: 'auth.login_fallido', entidad: 'usuario', entidadId: user.id, metadata: { motivo: 'segundo_factor' } });
        throw e;
      }
    }

    await this.audit.registrar({ tenantId: user.tenantId, userId: user.id, accion: 'auth.login', entidad: 'usuario', entidadId: user.id, metadata: { mfa: !!user.mfaEnabledAt } });
    return this.emitirParaUsuario(user);
  }

  async refresh(userId: string, refreshToken: string | undefined) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token no proporcionado');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Sesión inválida');
    }

    const coincide = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!coincide) {
      throw new UnauthorizedException('Sesión inválida');
    }

    return this.emitirParaUsuario(user);
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }

  // Empresas en las que un analista de SUTL puede trabajar: la suya y las que tiene con permiso vigente.
  async empresasAccesibles(userId: string) {
    const user = await this.analistaActivo(userId);
    const [propia, otras, activa] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { id: true, nombre: true } }),
      this.analystAccess.empresasDe(userId),
      this.contextoDeEmpresa(user),
    ]);
    return {
      activaId: activa.tenantId,
      empresas: [
        ...(propia ? [{ id: propia.id, nombre: propia.nombre, propia: true, soloLectura: false }] : []),
        ...otras.map((g) => ({ id: g.tenant.id, nombre: g.tenant.nombre, propia: false, soloLectura: g.soloLectura })),
      ],
    };
  }

  // El analista elige en qué empresa trabaja: se guarda en su cuenta (así sobrevive a
  // renovar la sesión) y se emite un token nuevo con esa empresa. Cada request
  // posterior vuelve a comprobar el permiso (ver AnalystAccessGuard).
  async cambiarEmpresa(userId: string, tenantId: string): Promise<AuthTokens> {
    const user = await this.analistaActivo(userId);
    if (tenantId !== user.tenantId) {
      const grant = await this.analystAccess.accesoVigente(userId, tenantId);
      if (!grant) throw new ForbiddenException('No tienes acceso a esa empresa');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { empresaActivaId: tenantId === user.tenantId ? null : tenantId } });
    if (tenantId !== user.tenantId) {
      await this.audit.registrar({ tenantId, userId, accion: 'analista.ingreso_empresa', entidad: 'usuario', entidadId: userId });
    }
    return this.emitirParaUsuario({ ...user, empresaActivaId: tenantId === user.tenantId ? null : tenantId });
  }

  private async analistaActivo(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.activo || user.rol !== 'analista_sutl') {
      throw new ForbiddenException('Solo el personal de SUTL puede cambiar de empresa');
    }
    return user;
  }

  // La empresa en la que debe operar el usuario. Solo el analista de SUTL puede estar
  // fuera de la suya, y únicamente con un permiso vigente: si lo perdió, vuelve a la propia.
  private async contextoDeEmpresa(user: { id: string; tenantId: string; rol: JwtPayload['rol']; empresaActivaId: string | null }) {
    if (user.rol !== 'analista_sutl') return { tenantId: user.tenantId, origen: undefined };
    if (user.empresaActivaId && user.empresaActivaId !== user.tenantId) {
      if (await this.analystAccess.accesoVigente(user.id, user.empresaActivaId)) {
        return { tenantId: user.empresaActivaId, origen: user.tenantId };
      }
      await this.prisma.user.update({ where: { id: user.id }, data: { empresaActivaId: null } });
    }
    return { tenantId: user.tenantId, origen: user.tenantId };
  }

  private async emitirParaUsuario(user: { id: string; tenantId: string; rol: JwtPayload['rol']; email: string; empresaActivaId: string | null }) {
    const ctx = await this.contextoDeEmpresa(user);
    return this.issueTokens(user.id, ctx.tenantId, user.rol, user.email, ctx.origen);
  }

  private async issueTokens(
    userId: string,
    tenantId: string,
    rol: JwtPayload['rol'],
    email: string,
    origen?: string,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: userId, tenantId, rol, email, ...(origen ? { origen } : {}) };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: (this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m') as JwtSignOptions['expiresIn'],
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: (this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d') as JwtSignOptions['expiresIn'],
    });

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });

    return { accessToken, refreshToken };
  }
}
