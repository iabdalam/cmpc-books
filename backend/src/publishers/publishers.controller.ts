import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReferenceDto } from '../common/dto/reference.dto';
import { PublishersService } from './publishers.service';

@ApiTags('publishers')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'JWT ausente o inválido.' })
@UseGuards(JwtAuthGuard)
@Controller('publishers')
export class PublishersController {
  constructor(private readonly publishers: PublishersService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar editoriales ordenados alfabéticamente.' })
  @ApiOkResponse({ type: ReferenceDto, isArray: true })
  findAll() { return this.publishers.findAll(); }
}
