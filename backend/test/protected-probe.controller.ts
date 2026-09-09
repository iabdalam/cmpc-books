import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { AuthenticatedUserDto } from '../src/auth/dto/login-response.dto';

// Solo se registra en suites de tests para comprobar el guard y request.user sin rutas de negocio.
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('protected-probe')
export class ProtectedProbeController {
  @Get()
  getUser(@Req() request: { user: AuthenticatedUserDto }) {
    return request.user;
  }
}
