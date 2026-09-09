import { Controller, Get, Header, Param, StreamableFile } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { BookImagesService } from './book-images.service';

@ApiTags('books')
@Controller('uploads')
export class BookImagesController {
  constructor(private readonly images: BookImagesService) {}

  @Get(':filename')
  @Header('Cache-Control', 'no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @ApiOperation({ summary: 'Leer públicamente la imagen de un libro activo.' })
  @ApiProduces('image/webp')
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  @ApiNotFoundResponse({ description: 'Imagen inexistente o libro eliminado.' })
  async read(@Param('filename') filename: string) {
    return new StreamableFile(await this.images.read(filename), { type: 'image/webp' });
  }
}
