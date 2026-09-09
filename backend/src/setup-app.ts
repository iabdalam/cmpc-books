import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const config = new DocumentBuilder()
    .setTitle('CMPC Books API')
    .setDescription('API para la gestión del inventario de libros de CMPC Libros.')
    .setVersion('1.0.0')
    .build();

  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
}
