// Los tests HTTP aíslan Prisma; esta URL no se utiliza para abrir conexiones.
process.env.DATABASE_URL = 'postgresql://localhost:1/books_test?schema=public';
process.env.JWT_SECRET = require('node:crypto').randomBytes(32).toString('hex');
process.env.JWT_EXPIRES_IN = '900';
