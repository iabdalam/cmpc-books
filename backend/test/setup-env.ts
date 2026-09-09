// Los tests HTTP aíslan Prisma; esta URL no se utiliza para abrir conexiones.
process.env.DATABASE_URL = 'postgresql://localhost:1/books_test?schema=public';
