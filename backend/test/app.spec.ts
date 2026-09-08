import { Body, Controller, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';

class TestDto {
  @IsString()
  name!: string;
}

@Controller('validation-probe')
class ValidationProbeController {
  @Post()
  create(@Body() dto: TestDto) {
    return { name: dto.name, transformed: dto instanceof TestDto };
  }
}

describe('Application bootstrap', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ValidationProbeController],
    }).compile();
    app = module.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  it('exposes health', async () => {
    await request(app.getHttpServer()).get('/health').expect(200, { status: 'ok' });
  });

  it('documents the health endpoint', async () => {
    const response = await request(app.getHttpServer()).get('/docs-json').expect(200);
    expect(response.body.paths['/health'].get.responses['200']).toBeDefined();
  });

  it('serves the Swagger UI', async () => {
    await request(app.getHttpServer()).get('/docs/').expect(200).expect('Content-Type', /html/);
  });

  it.each([{ name: 42 }, { name: 'test', extra: true }, {}])(
    'rejects invalid input %j through global validation', async (body) => {
      await request(app.getHttpServer()).post('/validation-probe').send(body).expect(400);
    },
  );

  it('transforms valid input to a DTO instance', async () => {
    await request(app.getHttpServer()).post('/validation-probe')
      .send({ name: 'test' }).expect(201, { name: 'test', transformed: true });
  });
});
