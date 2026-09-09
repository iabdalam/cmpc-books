import { BadRequestException, Inject, Injectable, Logger, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';

export const UPLOADS_DIRECTORY = 'UPLOADS_DIRECTORY';
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export interface UploadedBookImage { buffer: Buffer; mimetype: string; size: number }
const filenamePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/;

@Injectable()
export class BookImagesService {
  private readonly logger = new Logger(BookImagesService.name);
  constructor(@Inject(UPLOADS_DIRECTORY) private readonly directory: string, private readonly prisma: PrismaService) {}

  async save(file: UploadedBookImage | undefined): Promise<string> {
    if (!file?.buffer.length) throw new BadRequestException('An image file is required');
    if (file.size > MAX_IMAGE_BYTES || file.buffer.length > MAX_IMAGE_BYTES) throw new PayloadTooLargeException('Image exceeds 5 MiB');
    const formats: Record<string, string> = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };
    if (!formats[file.mimetype]) throw new BadRequestException('Use JPEG, PNG or WebP');
    let buffer: Buffer;
    try {
      const input = sharp(file.buffer, { limitInputPixels: 20_000_000, failOn: 'warning' });
      const metadata = await input.metadata();
      if (metadata.format !== formats[file.mimetype] || (metadata.pages ?? 1) > 1) throw new Error('Invalid image');
      // Decodificar y recodificar elimina metadatos y contenido adjunto no gráfico.
      buffer = await input.rotate().webp().toBuffer();
    } catch { throw new BadRequestException('Invalid image content'); }
    if (buffer.length > MAX_IMAGE_BYTES) throw new PayloadTooLargeException('Image exceeds 5 MiB');
    await mkdir(this.directory, { recursive: true });
    const filename = `${randomUUID()}.webp`;
    await writeFile(join(this.directory, filename), buffer, { flag: 'wx' });
    return `/api/uploads/${filename}`;
  }

  async read(filename: string): Promise<Buffer> {
    if (!filenamePattern.test(filename)) throw new NotFoundException('Image not found');
    const book = await this.prisma.book.findFirst({ where: { imageUrl: `/api/uploads/${filename}`, deletedAt: null }, select: { id: true } });
    if (!book) throw new NotFoundException('Image not found');
    try { return await readFile(join(this.directory, filename)); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new NotFoundException('Image not found');
      throw error;
    }
  }

  async removeIfUnused(url: string | null): Promise<void> {
    if (!url?.startsWith('/api/uploads/')) return;
    const filename = url.slice('/api/uploads/'.length);
    if (!filenamePattern.test(filename)) return;
    try {
      const used = await this.prisma.book.findFirst({ where: { imageUrl: url, deletedAt: null }, select: { id: true } });
      if (!used) await unlink(join(this.directory, filename));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') this.logger.warn('Unable to remove unused image');
    }
  }
}
