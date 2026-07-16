import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload, RequestUser } from '../../../common/interfaces/jwt-payload.interface';

const cookieExtractor = (req: Request): string | null => {
  return req?.cookies?.refreshToken ?? null;
};

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromBodyField('refreshToken'),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload): RequestUser & { refreshToken?: string } {
    const refreshToken = cookieExtractor(req) ?? req.body?.refreshToken;
    return {
      userId: payload.sub,
      tenantId: payload.tenantId,
      rol: payload.rol,
      email: payload.email,
      refreshToken,
    };
  }
}
