import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolve } from 'node:path';
import { AuditModule } from '../audit/audit.module';
import { BookImagesController } from './book-images.controller';
import { BookImagesService, UPLOADS_DIRECTORY } from './book-images.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';

@Module({
  imports: [AuthModule, PrismaModule, AuditModule],
  controllers: [BooksController, BookImagesController],
  providers: [
    BooksService,
    BookImagesService,
    {
      provide: UPLOADS_DIRECTORY,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => resolve(config.get<string>('UPLOADS_DIR') ?? 'uploads'),
    },
  ],
})
export class BooksModule {}
