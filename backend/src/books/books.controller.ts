import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards, Req, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiConflictResponse, ApiBody, ApiConsumes, ApiProduces, ApiResponse, ApiBadRequestResponse, ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_IMAGE_BYTES, UploadedBookImage } from './book-images.service';
import { ListBooksDto } from './dto/list-books.dto';
import { BookFiltersDto } from './dto/book-filters.dto';
import { BookPageDto } from './dto/book-page.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { BookResponseDto } from './dto/book-response.dto';

@ApiTags('books')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'JWT ausente o inválido.' })
@ApiConflictResponse({ description: 'Cambio concurrente; reintentar la solicitud.' })
@ApiBadRequestResponse({ description: 'Payload, UUID o referencia inválidos.' })
@UseGuards(JwtAuthGuard)
@Controller('books')
export class BooksController {
  constructor(private readonly books: BooksService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un libro con datos maestros existentes.' })
  @ApiCreatedResponse({ type: BookResponseDto })
  create(@Body() dto: CreateBookDto, @Req() req: { user: { id: string } }) { return this.books.create(dto, req.user.id); }

  @Get()
  @ApiOperation({ summary: 'Listar libros activos con filtros, búsqueda, paginación y orden múltiple.' })
  @ApiOkResponse({ type: BookPageDto })
  findAll(@Query() query: ListBooksDto) { return this.books.findAll(query); }

  @Get('export')
  @ApiOperation({ summary: 'Exportar libros activos filtrados a CSV.' })
  @ApiProduces('text/csv')
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  exportCsv(@Query() query: BookFiltersDto) { return this.books.exportCsv(query); }

  @Post(':id/image')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0 } }))
  @ApiOperation({ summary: 'Reemplazar la imagen del libro (JPEG, PNG o WebP; máximo 5 MiB).' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOkResponse({ type: BookResponseDto })
  @ApiNotFoundResponse({ description: 'Libro inexistente o eliminado.' })
  @ApiResponse({ status: 413, description: 'Imagen demasiado grande.' })
  uploadImage(@Param('id', new ParseUUIDPipe()) id: string, @UploadedFile() file: UploadedBookImage | undefined, @Req() req: { user: { id: string } }) {
    return this.books.uploadImage(id, file, req.user.id);
  }

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
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateBookDto, @Req() req: { user: { id: string } }) { return this.books.update(id, dto, req.user.id); }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar lógicamente un libro.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Libro eliminado lógicamente.' })
  @ApiNotFoundResponse({ description: 'Libro inexistente o ya eliminado.' })
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: { user: { id: string } }) { return this.books.remove(id, req.user.id); }
}
