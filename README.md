# CMPC Books

Full Stack technical challenge for a book inventory management application.

## Estado

Fases 0 y 1: aplicaciones base independientes y persistencia del backend con
PostgreSQL + Prisma. No hay autenticación, CRUD ni endpoints de datos maestros.

## Requisitos e instalación

Usar Node.js 24 (>=24.15) y npm. Cada aplicación mantiene su propio lockfile.
En PowerShell, usar `npm.cmd` si la política de ejecución bloquea `npm.ps1`.

Backend, desde `backend/`:

```sh
npm ci
cp .env.example .env
npm run prisma:generate
```

En PowerShell, copiar el entorno con `Copy-Item .env.example .env`.
`PORT` es opcional, vale 3000 por defecto y debe estar entre 1 y 65535.
Los archivos `.env` están ignorados por Git; el ejemplo no contiene secretos.

Antes de arrancar el backend, completar `DATABASE_URL` y preparar PostgreSQL como
se explica a continuación. Luego ejecutar `npm run start:dev` desde `backend/`.
El backend verifica la conexión al arrancar y libera Prisma al cerrar.

## PostgreSQL de desarrollo (Fase 1)

Se necesita Docker Desktop iniciado o una instancia propia de PostgreSQL.
El Compose actual ejecuta **solo PostgreSQL 16**, con volumen persistente y puerto
publicado únicamente en `127.0.0.1`. El stack completo corresponde a la Fase 14.

Completar en `backend/.env`:

- `POSTGRES_USER` y `POSTGRES_DB`: por defecto `books`.
- `POSTGRES_PASSWORD`: contraseña local elegida por el desarrollador, sin valor predeterminado.
- `POSTGRES_PORT`: por defecto `5432`.
- `DATABASE_URL`: `postgresql://USER:PASSWORD@localhost:PORT/DATABASE?schema=public`,
  reemplazando los marcadores con los mismos valores anteriores. Codificar los
  caracteres especiales de usuario y contraseña para una URL.

Desde la raíz del repositorio:

```sh
docker compose --env-file backend/.env up -d --wait postgres
```

Desde `backend/`, aplicar las migraciones versionadas:

```sh
npm run prisma:validate
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
npm run start:dev
```

`prisma:deploy` aplica la migración inicial sin resetear la base de datos. Para
cambios futuros del schema, usar `npm run prisma:migrate -- --name change_name`
en una base de desarrollo; revisar el SQL antes de versionarlo. No usar `db push`
ni modificar el schema directamente en PostgreSQL. El usuario de migraciones
necesita permiso para instalar la extensión `citext`.

Para detener PostgreSQL conservando los datos:

```sh
docker compose --env-file backend/.env stop postgres
```

Cambiar `POSTGRES_PASSWORD` no cambia la contraseña de un volumen ya inicializado.
Mantener la configuración que corresponde al volumen existente.

## Seed y usuario demo

El seed requiere `NODE_ENV=development`, `SEED_DEMO_EMAIL` y `SEED_DEMO_PASSWORD`.
El ejemplo propone `demo@example.com` como correo, pero no contiene contraseña.
Elegir una contraseña local de al menos 12 caracteres y como máximo 72 bytes UTF-8.
Durante la validación local se generaron contraseñas aleatorias en `backend/.env`;
ese archivo no se versiona ni sus valores se imprimen en los logs.

El seed crea un usuario con bcrypt (coste 12), tres autores, dos editoriales y tres
géneros. Usa upserts dentro de una transacción: repetirlo no duplica los registros
ni cambia sus IDs, timestamps o contraseñas. Si el correo ya existe, su contraseña
se conserva; cambiar `SEED_DEMO_PASSWORD` no restablece esa contraseña. Cambiar el
correo crea otro usuario. No se crean libros ni registros de auditoría en el seed.
El usuario demo aún no puede iniciar sesión: la autenticación corresponde a la Fase 2.

## API disponible

- Salud: http://localhost:3000/api/health devuelve `{"status":"ok"}`.
- Swagger UI: http://localhost:3000/api/docs
- OpenAPI JSON: http://localhost:3000/api/docs-json

El endpoint de salud solo indica que la aplicación responde; no vuelve a consultar
la base de datos por cada petición. La API usa el prefijo global `/api`, de acuerdo
con la arquitectura. Swagger describe el proyecto con la versión `1.0.0`.

## Frontend

Frontend, desde `frontend/`, en otra terminal:

```sh
npm ci
npm run dev
```

Abrir http://localhost:5173 para ver la pantalla inicial. No realiza llamadas a la API
ni necesita variables de entorno en esta fase. Las futuras variables `VITE_*`
serán públicas y no deben contener secretos.

## Verificación

Ejecutar en cada aplicación:

```sh
npm run build
npm test
npm run test:cov
```

Backend usa Jest y pruebas HTTP de salud, Swagger y validación global, además de
pruebas de configuración. Frontend usa Vitest y React Testing Library.
La cobertura excluye los entrypoints de arranque; no hay lógica de negocio todavía.
No se ha configurado un linter en esta fase.

Los tests habituales del backend no requieren PostgreSQL: sustituyen Prisma en
las pruebas HTTP y usan una URL ficticia sin credenciales. `prebuild` y `pretest`
generan Prisma Client automáticamente, incluso sin `.env`.

Con la base local migrada y `backend/.env` configurado para desarrollo, ejecutar
desde `backend/`:

```sh
npm run test:db
```

Esta suite requiere una base de desarrollo: ejecuta el seed dos veces y conserva
sus datos. Los demás registros de prueba se revierten mediante transacciones.
Verifica unicidad, nombres normalizados, relaciones, claves foráneas, precio decimal
y no negativo, timestamps, `deletedAt`, metadatos y hash del usuario demo.

Para ejecutar el backend compilado usar `npm run start:prod` desde `backend/`.
Para previsualizar el frontend compilado usar `npm run preview` desde `frontend/`.

## Estructura y decisiones

- `backend/src/`: módulo raíz NestJS, controlador y servicio de salud, configuración
  de entorno y configuración compartida de ValidationPipe y Swagger.
- `backend/test/`: pruebas de configuración e integración HTTP. La ruta de prueba
  de validación solo existe en el entorno de tests.
- `backend/src/prisma/`: PrismaModule exporta PrismaService; los futuros módulos
  consumidores lo importarán explícitamente, sin una capa Repository adicional.
- `backend/prisma/`: schema, migración inicial y seed de desarrollo.
- `backend/prisma.config.ts`: configuración del CLI y carga de `.env`.
- `backend/src/generated/prisma/`: cliente generado, ignorado por Git y por cobertura.
- `frontend/src/app/`: composición raíz y estilos de React.
- `frontend/src/test/`: preparación de React Testing Library.
- `docs/`: requisitos, arquitectura y plan de implementación.

Se mantiene la arquitectura de monolito modular con aplicaciones separadas.
Los módulos backend y las carpetas frontend por funcionalidad se agregarán al
implementar cada fase. La comunicación HTTP se centralizará cuando sea necesaria.
No se han añadido autenticación, lógica CRUD, filtros, CSV, imágenes ni auditoría
funcional. El frontend sigue en Fase 0.

### Modelo de persistencia

- UUID generados por PostgreSQL y timestamps con zona horaria. `updatedAt` lo
  mantiene Prisma; los futuros cambios de datos deben pasar por Prisma.
- `User.email` usa un índice único `citext`, que también cubre búsquedas por correo.
- Nombres de autores, editoriales y géneros: `citext` único y restricciones CHECK
  que rechazan cadenas vacías, espacios exteriores o espacios consecutivos.
  Los futuros DTOs deberán normalizar esos espacios antes de guardar. Se conservan
  mayúsculas de presentación y se distinguen acentos; no se hace comparación difusa.
- `Book.price` usa `Decimal(12,2)` y CHECK de precio no negativo; no se define moneda.
- Cada libro requiere un autor, una editorial y un género, con claves foráneas
  `RESTRICT` para preservar referencias. Los seis índices de Book pedidos están creados.
- `deletedAt` es nullable. Solo se prepara el campo; las futuras consultas de negocio
  deberán añadir `deletedAt: null`, y la eliminación lógica se implementará en Fase 3.
- `AuditLog.userId` es opcional y usa `SET NULL` para preservar historial. `entityId`
  es texto para admitir distintos tipos de entidad y `metadata` es JSONB opcional.
- La migración se generó con `prisma migrate diff --from-empty --to-schema
  prisma/schema.prisma --script` y se completó con `citext` y CHECK. Esas restricciones
  SQL no se representan completamente en Prisma; deben conservarse en migraciones futuras.
- Prisma 7 genera CommonJS para conservar la configuración NestJS existente y usa
  `@prisma/adapter-pg` para PostgreSQL. `bcryptjs` sirve únicamente al seed por ahora;
  `dotenv` carga el entorno del CLI y `tsx` ejecuta el seed TypeScript.

```mermaid
erDiagram
    Author ||--o{ Book : author
    Publisher ||--o{ Book : publisher
    Genre ||--o{ Book : genre
    User o|--o{ AuditLog : user
```

Se usa un override acotado de Multer 2.3.0 para corregir vulnerabilidades de la
dependencia transitiva fijada por NestJS 11.2.3. Retirarlo cuando NestJS incorpore
la versión corregida. Esto no implementa carga de archivos. Vitest usa la rama 4
con las correcciones de seguridad a partir de 4.1.11.

### Verificación de Fase 1 y limitaciones

Prisma Client 7.10.0 generado, schema validado, migración inicial aplicada y seed
ejecutado contra PostgreSQL 16 local. Build correcto; 39 tests habituales y 12 tests
de integración aprobados. La repetición del seed conserva el hash y los registros.

La instalación de Prisma incorporó avisos de `npm audit` en dependencias transitivas
del CLI (`deepmerge-ts` y `mysql2`, propagados a paquetes Prisma). Quedan pendientes
de actualización compatible del proveedor; no se forzaron cambios mayores ni se
introdujo MySQL como base de datos. La integración también emite un aviso de
deprecación de `pg` sobre consultas en curso; las pruebas pasan con la versión actual.
