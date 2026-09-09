import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthorsController } from './authors.controller';
import { AuthorsService } from './authors.service';

@Module({ imports: [AuthModule, PrismaModule], controllers: [AuthorsController], providers: [AuthorsService] })
export class AuthorsModule {}
