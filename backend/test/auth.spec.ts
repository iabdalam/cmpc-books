import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { setupApp } from '../src/setup-app';
import { ProtectedProbeController } from './protected-probe.controller';

describe('JWT authentication', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const password = 'test-only-password';
  const user = { id: randomUUID(), email: 'demo@example.com', passwordHash: '' };
  const findUnique = jest.fn();

  beforeAll(async () => {
    user.passwordHash = await hash(password, 12);
    const module = await Test.createTestingModule({
      imports: [AppModule], controllers: [ProtectedProbeController],
    }).overrideProvider(PrismaService).useValue({ user: { findUnique } }).compile();
    app = module.createNestApplication();
    setupApp(app);
    await app.init();
    jwt = app.get(JwtService);
  });

  beforeEach(() => {
    findUnique.mockReset();
    findUnique.mockImplementation(async ({ where }) =>
      where.email === user.email || where.id === user.id ? user : null,
    );
  });

  afterAll(async () => { await app.close(); });

  it('logs in with normalized email and returns only public user fields', async () => {
    const response = await request(app.getHttpServer()).post('/api/auth/login')
      .send({ email: '  DEMO@example.com ', password }).expect(200).expect('Cache-Control', 'no-store');
    expect(Object.keys(response.body).sort()).toEqual(['accessToken', 'user']);
    expect(response.body.user).toEqual({ id: user.id, email: user.email });
    expect(response.text).not.toContain('passwordHash');
    expect(response.text).not.toContain(password);
    expect(findUnique).toHaveBeenCalledWith({
      where: { email: user.email }, select: { id: true, email: true, passwordHash: true },
    });
    const payload = await jwt.verifyAsync(response.body.accessToken);
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'sub']);
    expect(payload.sub).toBe(user.id);
    expect(payload.exp - payload.iat).toBe(app.get(ConfigService).get('JWT_EXPIRES_IN'));
  });

  it('returns the same 401 for incorrect passwords and unknown users', async () => {
    const wrong = await request(app.getHttpServer()).post('/api/auth/login')
      .send({ email: user.email, password: 'incorrect-password' }).expect(401);
    const missing = await request(app.getHttpServer()).post('/api/auth/login')
      .send({ email: 'missing@example.com', password }).expect(401);
    expect(wrong.body).toEqual(missing.body);
    expect(wrong.body.message).toBe('Invalid credentials');
    expect(wrong.text).not.toContain('passwordHash');
  });

  it.each([
    {}, { email: 'invalid', password }, { email: user.email },
    { email: user.email, password: '' }, { email: user.email, password: 123 },
    { email: 123, password }, { email: ['demo@example.com'], password },
    { email: user.email, password, extra: true },
    { email: user.email, password: 'a'.repeat(73) },
    { email: user.email, password: 'é'.repeat(37) },
  ])('rejects invalid login payload %# before accessing the database', async (body) => {
    const response = await request(app.getHttpServer()).post('/api/auth/login').send(body).expect(400);
    expect(findUnique).not.toHaveBeenCalled();
    expect(response.text).not.toContain('passwordHash');
    expect(response.body).not.toHaveProperty('password');
  });

  it('permits a valid bearer token and exposes a public request.user', async () => {
    const token = await jwt.signAsync({ sub: user.id });
    const response = await request(app.getHttpServer()).get('/api/protected-probe')
      .auth(token, { type: 'bearer' }).expect(200);
    expect(response.body).toEqual({ id: user.id, email: user.email });
    expect(findUnique).toHaveBeenCalledWith({ where: { id: user.id }, select: { id: true, email: true } });
  });

  it('rejects access without a token', async () => {
    await request(app.getHttpServer()).get('/api/protected-probe').expect(401);
  });

  it('does not accept a token in the query string', async () => {
    await request(app.getHttpServer()).get('/api/protected-probe')
      .query({ access_token: await jwt.signAsync({ sub: user.id }) }).expect(401);
  });

  it('rejects malformed tokens', async () => {
    await request(app.getHttpServer()).get('/api/protected-probe').auth('invalid', { type: 'bearer' }).expect(401);
  });

  it('rejects tokens signed with a different key', async () => {
    const token = await jwt.signAsync({ sub: user.id }, { secret: 'different-test-signing-key' });
    await request(app.getHttpServer()).get('/api/protected-probe').auth(token, { type: 'bearer' }).expect(401);
  });

  it('rejects expired tokens', async () => {
    const token = await jwt.signAsync({ sub: user.id }, { expiresIn: -1 });
    await request(app.getHttpServer()).get('/api/protected-probe').auth(token, { type: 'bearer' }).expect(401);
  });

  it('rejects a different signing algorithm', async () => {
    const token = await jwt.signAsync({ sub: user.id }, { algorithm: 'HS384' });
    await request(app.getHttpServer()).get('/api/protected-probe').auth(token, { type: 'bearer' }).expect(401);
  });

  it('rejects tokens without expiration', async () => {
    const token = new JwtService({ secret: process.env.JWT_SECRET }).sign({ sub: user.id });
    await request(app.getHttpServer()).get('/api/protected-probe').auth(token, { type: 'bearer' }).expect(401);
  });

  it('rejects tokens belonging to a user that no longer exists', async () => {
    const token = await jwt.signAsync({ sub: randomUUID() });
    await request(app.getHttpServer()).get('/api/protected-probe').auth(token, { type: 'bearer' }).expect(401);
  });

  it.each([{}, { sub: 'invalid-id' }, { sub: 123 }])('rejects invalid JWT claims %#', async (payload) => {
    const token = await jwt.signAsync(payload);
    await request(app.getHttpServer()).get('/api/protected-probe').auth(token, { type: 'bearer' }).expect(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it.each([null, 'not-an-object', { sub: user.id, exp: 1.5 }])('rejects invalid strategy input %#', async (payload) => {
    await expect(app.get(JwtStrategy).validate(payload)).rejects.toThrow('Unauthorized');
  });

  it('documents login and bearer authentication without exposing the hash', async () => {
    const { body } = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
    expect(body.paths['/api/auth/login'].post.responses['200']).toBeDefined();
    expect(body.components.securitySchemes.bearer).toMatchObject({ type: 'http', scheme: 'bearer' });
    expect(body.paths['/api/protected-probe'].get.security).toEqual([{ bearer: [] }]);
    expect(body.components.schemas.AuthenticatedUserDto.properties).not.toHaveProperty('passwordHash');
    expect(body.components.schemas.LoginDto.properties.password.writeOnly).toBe(true);
  });
});
