import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';

@Injectable()
export class AuditService {
  async recordBook(tx: Prisma.TransactionClient, userId: string, action: 'CREATE' | 'UPDATE' | 'DELETE', entityId: string, fields: string[]) {
    // Solo nombres de campos, nunca valores de usuario, credenciales ni contenido de archivos.
    return await tx.auditLog.create({ data: { userId, action, entity: 'Book', entityId, metadata: { fields } } });
  }
}
