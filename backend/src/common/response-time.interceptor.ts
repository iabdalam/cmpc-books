import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { tap } from 'rxjs';

@Injectable()
export class ResponseTimeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const start = performance.now();
    const response = context.switchToHttp().getResponse();
    const recordTime = () => {
      if (!response.headersSent) response.setHeader('X-Response-Time', `${(performance.now() - start).toFixed(2)}ms`);
    };
    // Medir sin transformar JSON, CSV o streams y sin registrar cuerpos ni tokens.
    return next.handle().pipe(tap({ next: recordTime, error: recordTime }));
  }
}
