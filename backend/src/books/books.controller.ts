import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { BookResponseDto } from './dto/book-response.dto';

@ApiTags('books')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'JWT ausente o inválido.' })
@ApiBadRequestResponse({ description: 'Payload, UUID o referencia inválidos.' })
@UseGuards(JwtAuthGuard)
@Controller('books')
export class BooksController {
  constructor(private readonly books: BooksService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un libro con datos maestros existentes.' })
  @ApiCreatedResponse({ type: BookResponseDto })
  create(@Body() dto: CreateBookDto) { return this.books.create(dto); }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un libro activo por ID.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: BookResponseDto })
  @ApiNotFoundResponse({ description: 'Libro inexistente o eliminado.' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) { return this.books.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar parcialmente un libro activo.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: BookResponseDto })
  @ApiNotFoundResponse({ description: 'Libro inexistente o eliminado.' })
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateBookDto) { return this.books.update(id, dto); }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar lógicamente un libro.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Libro eliminado lógicamente.' })
  @ApiNotFoundResponse({ description: 'Libro inexistente o ya eliminado.' })
  remove(@Param('id', new ParseUUIDPipe()) id: string) { return this.books.remove(id); }
}
