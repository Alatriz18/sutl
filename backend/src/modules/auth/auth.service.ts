import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
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
    return this.issueTokens(user.id, user.tenantId, user.rol, user.email);
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

    return this.issueTokens(user.id, user.tenantId, user.rol, user.email);
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }

  private async issueTokens(
    userId: string,
    tenantId: string,
    rol: JwtPayload['rol'],
    email: string,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: userId, tenantId, rol, email };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
    });

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });

    return { accessToken, refreshToken };
  }
}
