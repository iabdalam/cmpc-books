import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReferenceDto } from '../common/dto/reference.dto';
import { GenresService } from './genres.service';

@ApiTags('genres')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'JWT ausente o inválido.' })
@UseGuards(JwtAuthGuard)
@Controller('genres')
export class GenresController {
  constructor(private readonly genres: GenresService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar géneros ordenados alfabéticamente.' })
  @ApiOkResponse({ type: ReferenceDto, isArray: true })
  findAll() { return this.genres.findAll(); }
}
