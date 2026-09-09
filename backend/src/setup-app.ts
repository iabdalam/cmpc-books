import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpAdapterHost } from '@nestjs/core';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { ResponseTimeInterceptor } from './common/response-time.interceptor';
import { ApiErrorDto } from './common/dto/api-error.dto';

export function setupApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new ApiExceptionFilter(app.get(HttpAdapterHost)));
  app.useGlobalInterceptors(new ResponseTimeInterceptor());
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const config = new DocumentBuilder()
    .setTitle('CMPC Books API')
    .setDescription('API para la gestión del inventario de libros de CMPC Libros.')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();

  const document = SwaggerModule.createDocument(app, config, { extraModels: [ApiErrorDto] });
  for (const path of Object.values(document.paths)) {
    for (const method of ['get', 'post', 'patch', 'delete'] as const) {
      const operation = path[method];
      if (!operation) continue;
      operation.responses['500'] = { description: 'Error interno sin detalles sensibles.' };
      for (const [status, response] of Object.entries(operation.responses)) {
        if (Number(status) >= 400 && response && !('$ref' in response)) {
          response.content = { 'application/json': { schema: { $ref: '#/components/schemas/ApiErrorDto' } } };
        }
      }
    }
  }
  SwaggerModule.setup('api/docs', app, document);
}
