# CMPC Books

Full Stack technical challenge for a book inventory management application.

## Estado

Backend implementado hasta la Fase 9: PostgreSQL + Prisma, JWT, CRUD de libros,
datos maestros de lectura, listado avanzado, errores uniformes, auditoría atómica,
CSV e imágenes locales. El frontend incluye sesión JWT, listado, filtros,
exportación, formularios, detalle, eliminación e imágenes de libros.

## Stack completo con Docker

Requiere Docker Desktop iniciado (contenedores Linux) y Docker Compose v2.
Si no existe `backend/.env`, copiar `backend/.env.example`; completar
`POSTGRES_PASSWORD`, `JWT_SECRET` (mínimo 32 bytes) y las credenciales de seed
descritas más abajo. No sobrescribir un `.env` existente. No se necesitan
Node.js ni dependencias instaladas en el host para ejecutar el stack.

Desde la raíz:

```sh
docker compose --env-file backend/.env config --quiet
docker compose --env-file backend/.env up -d --build --wait
docker compose --env-file backend/.env run --rm --no-deps -e NODE_ENV=development migrate npm run prisma:seed
```

El seed es explícito e idempotente; usar el email y la contraseña elegidos en
`SEED_DEMO_EMAIL` y `SEED_DEMO_PASSWORD` para iniciar sesión. No hay contraseñas
predeterminadas. `migrate` aplica las migraciones versionadas y termina antes de
arrancar el backend; el seed no se ejecuta automáticamente en producción.

| Servicio | Acceso local | Persistencia |
| --- | --- | --- |
| frontend (Nginx) | http://localhost:5173 | Archivos estáticos dentro de la imagen |
| backend (NestJS) | http://localhost:3000/api/health | `backend_uploads` en `/app/uploads` |
| postgres (PostgreSQL 16) | localhost:5432 | `postgres_data` en `/var/lib/postgresql/data` |
| migrate (temporal) | Sin puerto | Aplica migraciones sobre PostgreSQL |

Los puertos se publican solo en loopback. `PORT` y `POSTGRES_PORT` permiten cambiar
los puertos del host; los internos siguen siendo 3000 y 5432. Nginx usa 8080
dentro del contenedor y publica 5173. Todos comparten la red `app` de Compose.
Nginx resuelve rutas SPA como `/books/new` y reenvía `/api`, Swagger, CSV e imágenes
al backend; el navegador no necesita CORS ni conocer nombres internos de Docker.
`VITE_API_BASE_URL=/api` se fija al construir; `API_PROXY_TARGET` solo aplica a Vite.

Compose construye `DATABASE_URL` al arrancar usando las variables `POSTGRES_*`,
con caracteres especiales codificados y host `postgres`. La `DATABASE_URL` del
`.env` sigue destinada a comandos y tests ejecutados desde el host. No se copian
archivos `.env` ni uploads a las imágenes; los secretos se inyectan al arrancar.
Los contenedores frontend y backend ejecutan procesos sin privilegios de root.
El CLI Prisma y el seed permanecen en la imagen temporal de migraciones.

Los healthchecks comprueban PostgreSQL, HTTP de NestJS y Nginx. El backend espera
la base saludable y las migraciones completadas; el frontend espera al backend.
El health HTTP de NestJS es de disponibilidad del proceso, no una consulta continua
a PostgreSQL. Para comprobar la conexión real, iniciar sesión y consultar libros.

```sh
docker compose --env-file backend/.env ps -a
docker compose --env-file backend/.env stop
docker compose --env-file backend/.env up -d --wait
```

`stop` conserva ambos volúmenes. El volumen PostgreSQL preexistente mantiene su
nombre; cambiar credenciales en `.env` no modifica una base ya inicializada.
Los uploads del host en `backend/uploads` no se importan al volumen Docker
automáticamente; si se reutiliza una base con imágenes locales, copiar esos
archivos al volumen antes de consultar sus URLs. Respaldar base y uploads juntos.
No ejecutar `down -v` si se quieren conservar los datos. Liberar los puertos de
Vite/NestJS locales antes de levantar todo el stack.

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

Antes de arrancar el backend, completar `DATABASE_URL` y `JWT_SECRET`, y preparar PostgreSQL como
se explica a continuación. Luego ejecutar `npm run start:dev` desde `backend/`.
El backend verifica la conexión al arrancar y libera Prisma al cerrar.

## PostgreSQL de desarrollo (Fase 1)

Se necesita Docker Desktop iniciado o una instancia propia de PostgreSQL.
Para trabajar con Node.js en el host, se puede levantar únicamente el servicio
PostgreSQL 16 del mismo Compose, con su volumen persistente y puerto en loopback.

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
El usuario demo puede iniciar sesión con el correo y la contraseña usados al crearlo.

## Autenticación JWT (Fase 2)

Configurar en `backend/.env`:

- `JWT_SECRET`: secreto aleatorio de al menos 32 bytes, sin espacios exteriores.
  Es obligatorio; `.env.example` lo deja vacío. Usar un generador criptográfico o
  un gestor de contraseñas. Para esta validación se agregó un secreto aleatorio al
  `.env` local sin modificar las credenciales existentes.
- `JWT_EXPIRES_IN`: entero en segundos entre 1 y 86400; por defecto `900` (15 minutos).
  No acepta formatos como `15m`. La aplicación rechaza configuración inválida al arrancar.

`POST /api/auth/login` es público y recibe:

```json
{
  "email": "demo@example.com",
  "password": "CONTRASEÑA_LOCAL_DEL_USUARIO_DEMO"
}
```

Devuelve HTTP 200 con `{ "accessToken": "...", "user": { "id": "...", "email": "..." } }`
y `Cache-Control: no-store`. Email se normaliza mediante trim y minúsculas; la
contraseña no se transforma y se limita a 72 bytes UTF-8 para evitar truncamiento
de bcrypt. Un payload inválido devuelve 400; contraseña incorrecta o usuario
inexistente devuelven el mismo 401 (`Invalid credentials`). Se ejecuta bcrypt
también para correos inexistentes para reducir diferencias de tiempo.

El JWT usa HS256, contiene `sub` (UUID del usuario), `iat` y `exp`; no incluye
contraseñas, hashes ni datos privados. Passport valida firma, algoritmo y expiración.
JwtStrategy exige un usuario existente y expone solo `{ id, email }` en `request.user`.
No se modificaron el schema ni el seed para implementar autenticación.

Los módulos con rutas protegidas deberán importar `AuthModule` y aplicar
`@UseGuards(JwtAuthGuard)` y `@ApiBearerAuth()`. El cliente enviará
`Authorization: Bearer <accessToken>`. Swagger ofrece el botón **Authorize**.
Login, health y Swagger permanecen públicos. La ruta `/api/protected-probe` existe
exclusivamente en tests para comprobar el guard y el contexto del usuario, incluso
contra PostgreSQL; no se registra en la aplicación desplegada.

No hay refresh tokens, roles ni OAuth.

## API disponible

- Salud: http://localhost:3000/api/health devuelve `{"status":"ok"}`.
- Swagger UI: http://localhost:3000/api/docs
- OpenAPI JSON: http://localhost:3000/api/docs-json
- Login: `POST http://localhost:3000/api/auth/login`

El endpoint de salud solo indica que la aplicación responde; no vuelve a consultar
la base de datos por cada petición. La API usa el prefijo global `/api`, de acuerdo
con la arquitectura. Swagger describe el proyecto con la versión `1.0.0`.

## Frontend

Frontend, desde `frontend/`, en otra terminal:

```sh
npm ci
npm run dev
```

Abrir http://localhost:5173 e iniciar sesión con el usuario demo. Vite reenvía
`/api` a `http://127.0.0.1:3000`; `frontend/.env.example` permite ajustar ese destino
para desarrollo. Las variables `VITE_*` son públicas y no deben contener secretos.

## Verificación

Ejecutar en cada aplicación:

```sh
npm run build
npm test
npm run test:cov
```

Backend usa Jest y pruebas HTTP de salud, Swagger y validación global, además de
pruebas de configuración y autenticación con JWT y bcrypt reales. Frontend usa
Vitest y React Testing Library. La cobertura excluye `src/main.ts` y el cliente generado.
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
También comprueba el login del usuario demo existente y el acceso rechazado sin token
y permitido con token válido. Requiere la configuración JWT y las credenciales del
seed en `.env`; no modifica la contraseña del usuario demo.

Para ejecutar el backend compilado usar `npm run start:prod` desde `backend/`.
Para previsualizar el frontend compilado usar `npm run preview` desde `frontend/`.

## Estructura y decisiones

- `backend/src/`: módulo raíz NestJS, controlador y servicio de salud, configuración
  de entorno y configuración compartida de ValidationPipe y Swagger.
- `backend/test/`: pruebas de configuración e integración HTTP. La ruta de prueba
  de validación solo existe en el entorno de tests.
- `backend/src/prisma/`: PrismaModule exporta PrismaService; los futuros módulos
  consumidores lo importarán explícitamente, sin una capa Repository adicional.
- `backend/src/users/`: consultas de usuarios mediante Prisma para autenticación.
- `backend/src/auth/`: login, DTOs, emisión JWT, estrategia Passport y guard reutilizable.
- `backend/prisma/`: schema, migración inicial y seed de desarrollo.
- `backend/prisma.config.ts`: configuración del CLI y carga de `.env`.
- `backend/src/generated/prisma/`: cliente generado, ignorado por Git y por cobertura.
- `frontend/src/app/`: composición raíz y estilos de React.
- `frontend/src/test/`: preparación de React Testing Library.
- `docs/`: requisitos, arquitectura y plan de implementación.

Se mantiene la arquitectura de monolito modular con aplicaciones separadas.
Los módulos backend y las carpetas frontend por funcionalidad se agregarán al
implementar cada fase. La comunicación HTTP se centralizará cuando sea necesaria.
`books` contiene las operaciones de libros y almacenamiento local de imágenes;
`authors`, `publishers` y `genres` exponen datos maestros de lectura. `audit`
registra las mutaciones utilizando la misma transacción Prisma del libro.
`common` contiene el filtro global de errores y el interceptor de tiempo de respuesta.
El frontend organiza autenticación y libros por funcionalidad, con cliente HTTP
y componentes compartidos.

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
- `deletedAt` es nullable. Consultas normales, listado, exportación y acceso a
  imágenes exigen `deletedAt: null`; DELETE conserva físicamente el libro.
- `AuditLog.userId` es opcional y usa `SET NULL` para preservar historial. `entityId`
  es texto para admitir distintos tipos de entidad y `metadata` es JSONB opcional.
- La migración se generó con `prisma migrate diff --from-empty --to-schema
  prisma/schema.prisma --script` y se completó con `citext` y CHECK. Esas restricciones
  SQL no se representan completamente en Prisma; deben conservarse en migraciones futuras.
- Prisma 7 genera CommonJS para conservar la configuración NestJS existente y usa
  `@prisma/adapter-pg` para PostgreSQL. `bcryptjs` se comparte entre seed y autenticación;
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
la versión corregida. Multer procesa las imágenes multipart. Vitest usa la rama 4
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

### Verificación de Fase 2

Build backend correcto; 80 tests habituales y 15 tests de integración aprobados.
`npm run test:cov` reporta 100% de statements, branches, funciones y líneas del código
incluido (excluye `src/main.ts` y Prisma Client generado). La validación HTTP contra
PostgreSQL usa el usuario demo existente, confirma firma del JWT y verifica acceso
sin/con token mediante una ruta registrada solo por los tests. Persisten los avisos
transitivos de Prisma y la deprecación de `pg` descritos en Fase 1.

## Backend: Fases 3 a 9

Todas las operaciones de libros y datos maestros requieren Bearer JWT. Swagger
permanece en `/api/docs`, con contratos de errores y archivos.

| Método | Ruta | Resultado |
| --- | --- | --- |
| POST | /api/books | Crear libro (201) |
| GET | /api/books/:id | Libro activo con autor, editorial y género |
| PATCH | /api/books/:id | Actualización parcial |
| DELETE | /api/books/:id | Soft delete (204; inexistente/eliminado: 404) |
| GET | /api/books | Listado filtrado y paginado |
| GET | /api/books/export | CSV de libros activos filtrados |
| POST | /api/books/:id/image | Reemplazar imagen multipart, campo `file` (200) |
| GET | /api/uploads/:filename | Imagen pública de un libro activo |
| GET | /api/authors, /api/publishers, /api/genres | Datos maestros alfabéticos |

Listado: `page` comienza en 1 (máximo 1000000), `limit` vale 20 por defecto
(máximo 100). Filtros UUID: `authorId`, `publisherId`, `genreId`;
`available` acepta únicamente `true` o `false`. `search` busca texto literal
sin distinguir mayúsculas en título, autor y editorial (1 a 200 caracteres,
espacios exteriores eliminados; % y _ no funcionan como comodines).

Ejemplo: `/api/books?page=1&limit=10&available=true&sort=title:asc,price:desc`.
`sort` acepta title, price, available, createdAt, updatedAt e id, cada campo una
sola vez y dirección asc/desc. El orden predeterminado es createdAt:desc; se añade
id:asc como desempate cuando no se especifica id. Campos o direcciones inválidos
producen 400. PostgreSQL ejecuta los filtros, búsqueda, orden y paginación.
Respuesta: `{ data: Book[], meta: { page, limit, total, totalPages } }`;
un resultado vacío tiene totalPages:0. Conteo y página comparten una transacción
RepeatableRead. El precio se conserva como cadena decimal con dos decimales.

CREATE, UPDATE y DELETE registran Book y AuditLog en una sola transacción
Serializable. Un fallo de auditoría revierte ambos; conflictos concurrentes
responden 409 y requieren reintentar la solicitud. La auditoría incluye el usuario
JWT, acción, entidad Book, ID y timestamp; metadata contiene solo los nombres de
campos, sin contraseñas, tokens, valores de usuario ni archivos. No hay endpoint
de auditoría ni registro automático de lecturas.

Los errores JSON usan `{ statusCode, message, error }`; message puede ser una
lista de validaciones. Los errores inesperados no revelan detalles internos.
El interceptor agrega `X-Response-Time` (milisegundos hasta preparar la respuesta,
no duración de transferencia del archivo), sin envolver JSON ni archivos.

CSV reutiliza los filtros y search; no acepta paginación ni sort y exporta todos
los resultados activos por ID. Se transmite por lotes de 500, UTF-8 con BOM,
comas, campos entre comillas, comillas duplicadas y finales CRLF. Se antepone un
apóstrofo a texto que pueda ejecutarse como fórmula en hojas de cálculo.
Content-Type es `text/csv; charset=utf-8` y Content-Disposition es
`attachment; filename="books.csv"`. Una falla durante la transferencia corta
la conexión para evitar presentar un CSV incompleto como exitoso. Cada lote ve
los datos vigentes: la exportación no garantiza una instantánea única frente a
mutaciones concurrentes.

Imágenes: JPEG, PNG o WebP, hasta 5 MiB y 20 millones de píxeles, una imagen fija
por libro. Se comprueban MIME declarado, formato real y decodificación completa
con sharp; se recodifica a WebP sin metadatos y se genera un UUID como nombre.
SVG, contenido falso, MIME discordante, imágenes animadas y exceso de tamaño se
rechazan (400 o 413). La dependencia sharp usa la versión corregida >=0.35.4.
`UPLOADS_DIR` es opcional y vale `uploads`, relativo al directorio desde donde
se ejecuta el backend; iniciar desde `backend/`. La carpeta está ignorada por Git.
Docker Compose monta `/app/uploads` en el volumen `backend_uploads`.

La URL guardada es `/api/uploads/<uuid>.webp`. La ruta pública sirve solamente
archivos asociados a libros activos, con Content-Type image/webp, nosniff y
Cache-Control no-store; no lista directorios ni acepta rutas arbitrarias. Esta
ruta controlada mantiene la URL estática y permite excluir libros eliminados.
POST/PATCH conservan la compatibilidad previa con imageUrl HTTP(S) externo o null.

Base de datos y filesystem no comparten transacción: se compensa el archivo nuevo
si falla la mutación y se retira el anterior sin referencias al cambiar imageUrl
mediante upload o PATCH. Una caída del proceso o fallo de limpieza puede dejar un
archivo huérfano. Soft delete conserva el archivo, aunque ya no es accesible.
No hay proceso de purga automática
en estas fases; revisar retención y espacio al desplegar.

Las pruebas habituales incluyen filtros, paginación, orden, autenticación,
errores, auditoría, CSV y archivos reales. `npm run test:db` comprueba también
consultas, exportación, imágenes y rollback contra PostgreSQL de desarrollo.
Los fixtures se revierten y sus archivos temporales se retiran. El test de creación
fallida usa una transacción Prisma real; actualización/eliminación usan savepoints
dentro de la transacción exterior de prueba para preservar la base de desarrollo.

Verificación de este bloque: 227 pruebas habituales aprobadas; build y generación
Prisma correctos. Cobertura: 99,53% de statements, 97,87% de ramas, 100% de funciones
y 99,80% de líneas (excluye main y el cliente generado). Las 22 pruebas PostgreSQL
aprueban. `git diff --check` no detecta errores. Persisten los avisos transitivos
de Prisma y la deprecación de pg descritos anteriormente.
