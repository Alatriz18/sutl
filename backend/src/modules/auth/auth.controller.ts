import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { RolUsuario } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/jwt-payload.interface';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';

const REFRESH_COOKIE = 'refreshToken';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  // NUNCA @Public(): registrar un usuario recibe un tenantId arbitrario en el
  // body, así que dejarlo público permitiría que cualquiera se una a CUALQUIER
  // tenant sin invitación — es una fuga de datos entre tenants, no un simple
  // bug. Solo super_admin lo usa, al aprovisionar el primer admin_tenant de
  // una empresa nueva (las altas normales de usuarios van por POST /users,
  // que toma el tenantId del JWT del que llama, no del body).
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.super_admin)
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // Anti fuerza bruta: 5 intentos por minuto por IP, mucho más estricto que
  // el límite global de la app (120/min) — el login es el endpoint más
  // valioso para un atacante.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.login(dto);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @CurrentUser() user: RequestUser & { refreshToken?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
    const tokens = await this.authService.refresh(user.userId, refreshToken);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(
    @CurrentUser('userId') userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(userId);
    res.clearCookie(REFRESH_COOKIE);
    return { ok: true };
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}
