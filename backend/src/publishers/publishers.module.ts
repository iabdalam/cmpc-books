import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PublishersController } from './publishers.controller';
import { PublishersService } from './publishers.service';

@Module({ imports: [AuthModule, PrismaModule], controllers: [PublishersController], providers: [PublishersService] })
export class PublishersModule {}
