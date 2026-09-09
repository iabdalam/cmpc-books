import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { isUUID } from 'class-validator';
import { UsersService } from '../users/users.service';
import { AuthenticatedUserDto } from './dto/login-response.dto';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly users: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      algorithms: ['HS256'],
      ignoreExpiration: false,
    });
  }

  async validate(payload: unknown): Promise<AuthenticatedUserDto> {
    if (!payload || typeof payload !== 'object') throw new UnauthorizedException();
    const { sub, exp } = payload as Record<string, unknown>;
    if (typeof sub !== 'string' || !isUUID(sub) || typeof exp !== 'number' || !Number.isInteger(exp)) {
      throw new UnauthorizedException();
    }
    // Consultar al usuario impide seguir usando tokens de cuentas que ya no existen.
    const user = await this.users.findPublicById(sub);
    if (!user) throw new UnauthorizedException();
    return { id: user.id, email: user.email };
  }
}
