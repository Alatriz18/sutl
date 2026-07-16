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
import { LoginDto } from './dto/login.dto';
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
  ) {}

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
    });

    return this.issueTokens(user.id, user.tenantId, user.rol, user.email);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({ where: { email: dto.email } });
    if (!user || !user.activo) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordValida = await bcrypt.compare(dto.password, user.password);
    if (!passwordValida) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

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
