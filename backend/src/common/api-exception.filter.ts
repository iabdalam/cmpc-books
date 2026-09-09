import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '../generated/prisma/client';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost) {
    let statusCode = 500;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';
    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      if (statusCode < 500) {
        if (typeof body === 'string') message = body;
        else message = (body as { message?: string | string[] }).message ?? exception.message;
        error = typeof body === 'object' ? (body as { error?: string }).error ?? 'Request failed' : 'Request failed';
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mappings: Record<string, [number, string]> = {
        P2002: [409, 'Resource already exists'], P2003: [400, 'Invalid reference'],
        P2025: [404, 'Resource not found'], P2034: [409, 'Concurrent modification; retry the request'],
      };
      if (mappings[exception.code]) [statusCode, message] = mappings[exception.code];
    }
    if (statusCode === 400) error = 'Bad Request';
    if (statusCode === 401) error = 'Unauthorized';
    if (statusCode === 403) error = 'Forbidden';
    if (statusCode === 404) error = 'Not Found';
    if (statusCode === 409) error = 'Conflict';
    const response = host.switchToHttp().getResponse();
    if (!this.adapterHost.httpAdapter.isHeadersSent(response)) {
      this.adapterHost.httpAdapter.reply(response, { statusCode, message, error }, statusCode);
    }
  }
}
