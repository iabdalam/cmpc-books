import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';
import { readSeedConfig } from '../prisma/seed-data';
import { ProtectedProbeController } from './protected-probe.controller';

describe('JWT authentication with PostgreSQL demo user', () => {
  let app: INestApplication;
  let token: string;
  let user: { id: string; email: string };

  beforeAll(async () => {
    const credentials = readSeedConfig(process.env);
    const module = await Test.createTestingModule({
      imports: [AppModule], controllers: [ProtectedProbeController],
    }).compile();
    app = module.createNestApplication();
    setupApp(app);
    await app.init();
    const response = await request(app.getHttpServer()).post('/api/auth/login')
      .send(credentials).expect(200);
    token = response.body.accessToken;
    user = response.body.user;
  });

  afterAll(async () => { await app?.close(); });

  it('authenticates the existing seed user and returns a verifiable JWT without a hash', async () => {
    expect(Object.keys(user).sort()).toEqual(['email', 'id']);
    expect(user.email).toBe(readSeedConfig(process.env).email);
    const payload = await app.get(JwtService).verifyAsync(token);
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'sub']);
    expect(payload.sub).toBe(user.id);
  });

  it('denies access without a token', async () => {
    await request(app.getHttpServer()).get('/api/protected-probe').expect(401);
  });

  it('allows access with the demo token and populates request.user', async () => {
    const response = await request(app.getHttpServer()).get('/api/protected-probe')
      .auth(token, { type: 'bearer' }).expect(200);
    expect(response.body).toEqual(user);
  });
});
