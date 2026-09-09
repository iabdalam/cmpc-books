import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service';

describe('PrismaService lifecycle', () => {
  let service: PrismaService;

  beforeEach(() => {
    service = new PrismaService(new ConfigService({ DATABASE_URL: process.env.DATABASE_URL }));
  });

  it('connects at startup and disconnects on shutdown', async () => {
    const connect = jest.spyOn(service, '$connect').mockResolvedValue();
    const disconnect = jest.spyOn(service, '$disconnect').mockResolvedValue();
    await service.onModuleInit();
    await service.onModuleDestroy();
    expect(connect).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('fails startup without exposing connection details', async () => {
    jest.spyOn(service, '$connect').mockRejectedValue(new Error('internal connection details'));
    await expect(service.onModuleInit()).rejects.toThrow(
      'Database connection failed. Check database configuration and availability.',
    );
  });
});
