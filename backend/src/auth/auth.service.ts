import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hashSync } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';

@Injectable()
export class AuthService {
  // También se ejecuta bcrypt para correos inexistentes, reduciendo diferencias de tiempo.
  private readonly dummyHash = hashSync(randomBytes(32).toString('hex'), 12);

  constructor(private readonly users: UsersService, private readonly jwt: JwtService) {}

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.users.findForAuthentication(dto.email);
    const matches = await compare(dto.password, user?.passwordHash ?? this.dummyHash);
    if (!user || !matches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.jwt.signAsync({ sub: user.id });
    return { accessToken, user: { id: user.id, email: user.email } };
  }
}
