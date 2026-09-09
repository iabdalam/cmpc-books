import { Controller, Get, HttpException, INestApplication, InternalServerErrorException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Prisma } from '../src/generated/prisma/client';
import { setupApp } from '../src/setup-app';

let failure: unknown;
@Controller('test-errors')
class ErrorController {
  @Get() run() { if (failure) throw failure; return { ok: true }; }
}

describe('Global HTTP errors and timing', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [ErrorController] }).compile();
    app = module.createNestApplication(); setupApp(app); await app.init();
  });
  afterAll(async () => { await app.close(); });
  it.each([
    ['P2002', 409], ['P2003', 400], ['P2025', 404], ['P2034', 409], ['P2024', 500],
  ])('maps Prisma %s to %s without details', async (code, status) => {
    failure = new Prisma.PrismaClientKnownRequestError('secret PostgreSQL details', { code: code as string, clientVersion: '7' });
    const response = await request(app.getHttpServer()).get('/api/test-errors').expect(status as number);
    expect(response.body).toEqual({ statusCode: status, message: expect.any(String), error: expect.any(String) });
    expect(response.text).not.toMatch(/secret|PostgreSQL|Prisma|stack/);
    expect(response.headers['x-response-time']).toMatch(/^\d+(\.\d+)?ms$/);
  });
  it.each([new Error('secret'), new InternalServerErrorException('secret')])('sanitizes unexpected failures', async (error) => {
    failure = error;
    await request(app.getHttpServer()).get('/api/test-errors').expect(500, { statusCode: 500, message: 'Internal server error', error: 'Internal Server Error' });
  });
  it.each([
    new HttpException('Denied', 403), new HttpException({ message: ['Invalid field'] }, 400), new HttpException({}, 400),
  ])('retains appropriate HTTP status and public validation messages %#', async (error) => {
    failure = error;
    const response = await request(app.getHttpServer()).get('/api/test-errors').expect(error.getStatus());
    expect(response.body).toHaveProperty('message'); expect(response.body).not.toHaveProperty('stack');
  });
  it('adds duration without wrapping successful responses', async () => {
    failure = undefined;
    const response = await request(app.getHttpServer()).get('/api/test-errors').expect(200, { ok: true });
    expect(response.headers['x-response-time']).toMatch(/ms$/);
  });
});
