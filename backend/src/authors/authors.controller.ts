import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReferenceDto } from '../common/dto/reference.dto';
import { AuthorsService } from './authors.service';

@ApiTags('authors')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'JWT ausente o inválido.' })
@UseGuards(JwtAuthGuard)
@Controller('authors')
export class AuthorsController {
  constructor(private readonly authors: AuthorsService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar autores ordenados alfabéticamente.' })
  @ApiOkResponse({ type: ReferenceDto, isArray: true })
  findAll() { return this.authors.findAll(); }
}
