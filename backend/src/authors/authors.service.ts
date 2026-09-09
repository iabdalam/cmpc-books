import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReferenceDto } from '../common/dto/reference.dto';

@Injectable()
export class AuthorsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<ReferenceDto[]> {
    try {
      return await this.prisma.author.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } });
    } catch {
      throw new InternalServerErrorException('Unable to load authors');
    }
  }
}
