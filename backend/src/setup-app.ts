import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupApp(app: INestApplication): void {
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const config = new DocumentBuilder()
    .setTitle('CMPC Books API')
    .setDescription('Book inventory API — Phase 0')
    .setVersion('0.0.1')
    .build();

  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
}
