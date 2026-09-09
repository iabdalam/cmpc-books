# CMPC Books

Aplicación del desafío técnico para administrar un inventario de libros. Incluye
autenticación JWT, CRUD con eliminación lógica, búsqueda, filtros, ordenamiento
múltiple, paginación en servidor, exportación CSV, imágenes y auditoría de cambios.

## Stack y arquitectura

| Capa | Tecnologías |
| --- | --- |
| Frontend | React 19, TypeScript 5.9, Vite 7, React Router 7 |
| Backend | NestJS 11, TypeScript, Passport/JWT, class-validator |
| Persistencia | PostgreSQL 16, Prisma 7, adaptador pg |
| Archivos | sharp, almacenamiento local persistente |
| Pruebas | Jest/Supertest; Vitest 4/React Testing Library |
| Ejecución | Docker Compose, Node.js 24, Nginx |

Monolito modular con aplicaciones independientes en el mismo repositorio.
El navegador consume `/api` del mismo origen: Nginx en Docker o el proxy Vite
en desarrollo. NestJS valida y autoriza; los servicios coordinan Prisma y PostgreSQL.

- [Arquitectura y decisiones](docs/architecture.md), con diagrama del despliegue.
- [Modelo relacional](docs/data-model.md), con campos, relaciones e índices reales.
- [Requisitos](docs/requirements.md) y [plan de implementación](docs/implementation-plan.md).

```text
backend/
  src/           auth, users, books, authors, publishers, genres, audit,
                 prisma, common y config
  prisma/        schema, migraciones y seed
  test/          pruebas unitarias, HTTP e integración PostgreSQL
  docker/        configuración de conexión al arrancar el contenedor
  Dockerfile
frontend/
  src/app/       routing, layout y estilos
  src/features/  auth y books
  src/shared/    cliente HTTP, descargas y componentes compartidos
  src/test/      configuración y fixtures de pruebas
  Dockerfile
  nginx.conf
docs/
docker-compose.yml
```

## Inicio recomendado: Docker Compose

Requisitos: Git y Docker con Compose v2 y soporte de `up --wait`; en Windows,
Docker Desktop iniciado con contenedores Linux. La primera construcción requiere
acceso a los registros de imágenes y npm. No se necesita Node.js en el host.
Los puertos 5173, 3000 y 5432 deben estar libres.

### 1. Configurar el entorno

Desde la raíz, **solo si no existe `backend/.env`**:

```sh
cp backend/.env.example backend/.env
```

En PowerShell: `Copy-Item backend/.env.example backend/.env`.

Editar ese archivo local y completar:

| Variable | Configuración |
| --- | --- |
| `POSTGRES_USER`, `POSTGRES_DB` | Conservar `books` para el inicio recomendado |
| `POSTGRES_PASSWORD` | Elegir una contraseña local; no hay valor predeterminado |
| `JWT_SECRET` | Generar un secreto aleatorio de al menos 32 bytes, sin espacios exteriores |
| `JWT_EXPIRES_IN` | `900` segundos; acepta enteros entre 1 y 86400 |
| `SEED_DEMO_EMAIL` | Conservar `demo@example.com` o elegir un email válido |
| `SEED_DEMO_PASSWORD` | Elegir una contraseña de al menos 12 caracteres sin contar espacios exteriores y máximo 72 bytes UTF-8 |
| `NODE_ENV` | `development` para comandos locales y seed; Compose fija `production` para la API |
| `PORT`, `POSTGRES_PORT` | `3000`, `5432`; controlan los puertos publicados del host |
| `DATABASE_URL` | Conexión del host, explicada en ejecución local; Compose la construye internamente |
| `UPLOADS_DIR` | `uploads` en ejecución local; Compose fija `/app/uploads` |

Usar un gestor de contraseñas o generador criptográfico para los secretos. Guardar
las contraseñas únicamente en `.env`, nunca en Git. Si contienen `$`, `#` o espacios,
envolver el valor en comillas simples en `.env` para preservar su contenido literal.
No copiar credenciales de ejemplo como credenciales reales.

### 2. Construir, migrar y arrancar

Desde la raíz:

```sh
docker compose --env-file backend/.env config --quiet
docker compose --env-file backend/.env up -d --build --wait
docker compose --env-file backend/.env run --rm --no-deps -e NODE_ENV=development migrate npm run prisma:seed
docker compose --env-file backend/.env ps -a
```

`config --quiet` valida sin imprimir los secretos interpolados. PostgreSQL debe
estar saludable antes de ejecutar `migrate`; este servicio aplica las migraciones
versionadas y termina con código 0. Después arranca backend y finalmente frontend.
El estado `Exited (0)` de `migrate` es normal. El seed es explícito, no automático.

### 3. Credenciales de acceso e inicio de sesión

> **Importante:** el repositorio no incluye una contraseña demo predefinida.
> La contraseña se define localmente mediante `SEED_DEMO_PASSWORD` antes de
> ejecutar el seed y no se versiona en Git.

Para una instalación nueva, configurar en `backend/.env`:

```env
SEED_DEMO_EMAIL=demo@example.com
SEED_DEMO_PASSWORD=LaPasswordLocalQueDeseeUsar
```

`SEED_DEMO_PASSWORD` debe tener al menos 12 caracteres y un máximo de 72 bytes UTF-8.

Después de ejecutar el seed indicado en el paso anterior, abrir:

**http://localhost:5173/login**

e iniciar sesión con:

| Campo | Valor |
| --- | --- |
| Email | Valor configurado en `SEED_DEMO_EMAIL` (`demo@example.com` por defecto) |
| Contraseña | Valor configurado en `SEED_DEMO_PASSWORD` antes de ejecutar el seed |

Por ejemplo, si para una instalación local se configura:

```env
SEED_DEMO_EMAIL=demo@example.com
SEED_DEMO_PASSWORD=MiPasswordLocal123!
```

el acceso será:

```text
Email: demo@example.com
Contraseña: MiPasswordLocal123!
```

La contraseña del ejemplo es únicamente ilustrativa. Cada evaluador puede definir
su propia contraseña local antes de ejecutar el seed.

El seed normaliza el email y almacena la contraseña mediante bcrypt con coste 12;
la contraseña en texto plano no se persiste en PostgreSQL.

Además crea tres autores (Isabel Allende, Gabriel García Márquez, Julio Cortázar),
dos editoriales (Sudamericana, Alfaguara) y tres géneros (Novela, Cuento, Ensayo).
No crea libros: el listado inicial vacío es correcto.

El seed es idempotente. Si el usuario ya existe, volver a ejecutar el seed conserva
su hash de contraseña. Por ello, cambiar posteriormente `SEED_DEMO_PASSWORD` en
`.env` **no cambia la contraseña de un usuario ya creado**. En ese caso se debe
utilizar la contraseña original o configurar otro email para crear un nuevo usuario
de desarrollo. No existe endpoint de registro ni de restablecimiento de contraseña.

### URLs y operación

| Recurso | URL predeterminada |
| --- | --- |
| Frontend | http://localhost:5173 |
| Backend / health | http://localhost:3000/api/health |
| Swagger | http://localhost:3000/api/docs |
| OpenAPI JSON | http://localhost:3000/api/docs-json |
| Swagger mediante Nginx | http://localhost:5173/api/docs |
| PostgreSQL | `localhost:5432`, base y usuario configurados en `.env` |

Todos los puertos se publican en loopback. La raíz del backend no es un endpoint;
usar `/api/health`. Este health comprueba HTTP, no consulta continuamente la base.
La conexión PostgreSQL se valida al iniciar la API y mediante operaciones como login.

```sh
docker compose --env-file backend/.env stop
docker compose --env-file backend/.env up -d --wait
```

Estos comandos conservan los volúmenes `postgres_data` y `backend_uploads` del
proyecto Compose `cmpc-books`. No usar `down -v` si se quieren conservar datos.
Cambiar `POSTGRES_PASSWORD` no modifica la contraseña de una base ya inicializada.
Para aplicar cambios de código, repetir `up -d --build --wait`.

## Alternativa: ejecución local con Node.js

Requiere Node.js **>=24.15 y <25** y npm. En PowerShell usar `npm.cmd` si la política
de ejecución bloquea `npm.ps1`. Cada aplicación tiene su propio lockfile.

Configurar `backend/.env` como arriba. Además, completar `DATABASE_URL` con
`postgresql://USER:PASSWORD@localhost:PORT/DATABASE?schema=public`, usando los mismos
valores `POSTGRES_*` y codificando usuario/contraseña como componentes de URL.
No usar el host interno `postgres` desde Node.js en el host.

Si el stack completo estaba activo, detener frontend y backend para liberar puertos:

```sh
docker compose --env-file backend/.env stop frontend backend
docker compose --env-file backend/.env up -d --wait postgres
```

En una terminal desde `backend/`:

```sh
npm ci
npm run prisma:validate
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
npm run start:dev
```

En otra terminal desde `frontend/`:

```sh
npm ci
npm run dev
```

Vite sirve en 5173 y reenvía `/api` a `http://127.0.0.1:3000`. Opcionalmente copiar
`frontend/.env.example` a `.env` para ajustar `API_PROXY_TARGET` si cambia el puerto
backend. `VITE_API_BASE_URL=/api` es público; no poner secretos en variables `VITE_*`.
Docker fija `/api` durante el build y no utiliza `API_PROXY_TARGET`.

Para ejecutar compilados: `npm run build` y `npm run start:prod` en backend;
`npm run build` y `npm run preview` en frontend (Vite preview usa 4173 por defecto).
La imagen frontend usa Nginx, no Vite preview.

Las migraciones se gestionan con Prisma. `prisma:deploy` aplica las versionadas sin
resetear la base. Para futuros cambios, ejecutar en una base de desarrollo
`npm run prisma:migrate -- --name change_name` y revisar el SQL. No usar `db push`.
El usuario de migración necesita permiso para instalar `citext`.

## Flujo básico de evaluación

1. Iniciar sesión y pulsar **Nuevo libro** en `/books`.
2. Completar título, autor, editorial, género, precio y disponibilidad; elegir
   opcionalmente una imagen JPEG, PNG o WebP de hasta 5 MiB.
3. Guardar y abrir el detalle. Editar el precio o reemplazar la imagen.
4. En el listado, buscar por título, autor o editorial; la búsqueda espera 400 ms.
   Combinar filtros, añadir criterios de orden y cambiar página o tamaño de página.
5. Exportar CSV: aplica búsqueda y filtros, exporta todos los resultados activos.
6. Eliminar un libro confirmando la acción; desaparece del listado y su detalle e
   imagen dejan de estar disponibles. La base conserva el registro con `deletedAt`.
7. Cerrar sesión. Las páginas de libros requieren sesión; un 401 limpia la sesión.

Rutas frontend: `/login`, `/books`, `/books/new`, `/books/:id`, `/books/:id/edit`.

Los formularios evitan doble envío. Primero guardan el libro y luego su imagen;
si falla la imagen, informan que el libro se guardó y permiten reintentar el upload.

## Contratos principales de API

Swagger es la referencia interactiva de DTOs, validaciones, respuestas y Bearer JWT.
Ejecutar login allí, copiar `accessToken` y pegar solo el token en **Authorize**.

| Método | Endpoint | Resultado / acceso |
| --- | --- | --- |
| POST | `/api/auth/login` | Público; 200 con `accessToken` y `user: { id, email }` |
| GET | `/api/health` | Público; `{ "status": "ok" }` |
| GET | `/api/books` | JWT; listado paginado |
| POST | `/api/books` | JWT; creación, 201 |
| GET | `/api/books/:id` | JWT; detalle activo |
| PATCH | `/api/books/:id` | JWT; actualización parcial |
| DELETE | `/api/books/:id` | JWT; soft delete, 204; inexistente/eliminado, 404 |
| GET | `/api/books/export` | JWT; CSV de libros activos filtrados |
| POST | `/api/books/:id/image` | JWT; multipart, campo `file`, respuesta 200 |
| GET | `/api/uploads/:filename` | Público; solo imagen asociada a libro activo |
| GET | `/api/authors`, `/api/publishers`, `/api/genres` | JWT; maestros alfabéticos, solo lectura |

Login recibe `{ "email": "demo@example.com", "password": "VALOR_LOCAL_ELEGIDO" }`.

Crear recibe título (1–255 caracteres tras trim), `price` numérico no negativo,
máximo 9999999999.99 y dos decimales, `available` booleano y los tres UUID de maestros
existentes. `imageUrl` opcional acepta URL HTTP(S) o null; el frontend utiliza upload.

La respuesta Book incluye relaciones `{ id, name }`, timestamps y precio como
**cadena decimal** de dos decimales, sin objetos internos de Prisma.

### Listado y CSV

```text
/api/books?page=1&limit=10&available=true&sort=title:asc,price:desc
```

- `page`: 1–1000000; `limit`: 1–100, predeterminado 20. El contrato usa `limit`, no `pageSize`.
- `authorId`, `publisherId`, `genreId`: UUID; `available`: `true` o `false`.
- `search`: 1–200 caracteres, busca texto literal sin distinguir mayúsculas en
  título, autor y editorial. `%` y `_` no son comodines.
- `sort`: campos `title`, `price`, `available`, `createdAt`, `updatedAt`, `id`;
  direcciones `asc`/`desc`, sin repetir campos. Predeterminado `createdAt:desc`;
  se añade `id:asc` como desempate si falta id.
- Respuesta: `{ data: Book[], meta: { page, limit, total, totalPages } }`.
  Sin resultados, `totalPages` es 0.

CSV acepta los filtros y `search`, **no paginación ni sort**. Exporta por ID en
lotes de 500, UTF-8 con BOM, comillas escapadas y CRLF, con protección frente a
fórmulas de hojas de cálculo. Usa `text/csv; charset=utf-8` y
`Content-Disposition: attachment; filename="books.csv"`.

## Imágenes y persistencia

Una imagen fija por libro. El backend valida MIME y contenido real, tamaño máximo
5 MiB y 20 millones de píxeles; rechaza animaciones y recodifica a WebP sin metadatos
con nombre UUID. Las URLs son `/api/uploads/<uuid>.webp`, servidas por una ruta
controlada con `nosniff` y `Cache-Control: no-store`.

En Docker, `backend_uploads` monta `/app/uploads`; en local, `UPLOADS_DIR` vale
`uploads`, relativo al directorio de ejecución (arrancar desde `backend/`).

Ambos almacenamientos son distintos: imágenes previas en `backend/uploads` no se
importan automáticamente al volumen Docker. Si se reutiliza esa base, copiar los
archivos al volumen. Respaldar PostgreSQL e imágenes juntos.

Reemplazar una imagen retira la anterior sin referencias. Soft delete conserva el
archivo, pero impide servirlo. No hay purga automática.

## Tests y cobertura

Después de `npm ci`, ejecutar **desde cada aplicación**:

```sh
npm test
npm run test:cov
npm run build
```

Backend genera Prisma Client en `pretest` y `prebuild`. Si se ejecuta cobertura
aisladamente en un checkout nuevo, ejecutar antes `npm run prisma:generate`.

Los tests habituales no necesitan PostgreSQL. Para integración, con la base de
desarrollo migrada, seed/configuración local y `NODE_ENV=development`, ejecutar
desde backend `npm run test:db`. Estas pruebas conservan el seed y revierten los
demás fixtures mediante transacciones; nunca usar una base productiva.

Desde la raíz: `git diff --check`. No hay script de lint configurado.

Resultados del cierre, 2026-09-09 (código incluido por cada configuración):

| Suite | Tests | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | ---: | ---: |
| Backend | 227 | 99,53% | 97,87% | 100% | 99,80% |
| Frontend | 109 | 99,41% | 94,82% | 99,34% | 100% |

Backend excluye `main.ts` y Prisma Client generado; frontend excluye `main.tsx`,
tests y su preparación. La cobertura no mide Dockerfiles/Nginx ni sustituye una
prueba de navegador. En este cierre también pasaron 22 tests PostgreSQL, la validación
Compose y los checks HTTP de frontend, health, Swagger, login y listado autenticado.
El bloque DevOps anterior validó persistencia de upload tras recrear backend.
Builds de ambas aplicaciones correctos.

## Decisiones, seguridad y rendimiento

- NestJS organiza reglas en servicios; Prisma evita una capa Repository redundante.
- React hooks y un almacén de sesión pequeño bastan; no hay Redux ni framework de monorepo.
- JWT HS256 con expiración configurable, Passport y bcrypt; nunca se devuelve
  `passwordHash`. Un login inválido no distingue correo inexistente de contraseña incorrecta.
- JWT y usuario persisten en localStorage para el challenge; no se guarda la contraseña.
  La firma se valida en backend, no mediante la lectura del payload en frontend.
- ValidationPipe rechaza campos desconocidos. Errores JSON uniformes
  `{ statusCode, message, error }` ocultan stack traces y detalles de Prisma.
- Consultas, conteo y orden se ejecutan en PostgreSQL. Paginación y conteo comparten
  transacción RepeatableRead; las mutaciones y su AuditLog usan Serializable.
- La auditoría registra usuario, acción y campos afectados, sin valores sensibles.
  No hay endpoint de auditoría. El interceptor mide `X-Response-Time`; los logs
  operativos de Nest/Nginx son distintos del historial persistente de negocio.
- Los índices cubren título, relaciones, disponibilidad y soft delete; no hay
  carga completa del inventario en memoria para filtrar/paginar. CSV usa lotes.
- Nginx resuelve rutas SPA y proxy `/api`; no se habilita CORS porque ambos modos
  soportados usan el mismo origen. Docker no incorpora `.env` a las imágenes;
  backend y frontend corren sin root. El CLI Prisma queda en la imagen de migración.

## Limitaciones y evolución futura

Son decisiones y límites del alcance local, no funcionalidades implementadas:

- localStorage es accesible ante XSS. Una evolución a cookies HttpOnly/Secure exige
  diseñar también CSRF, expiración y flujo de sesión. No hay refresh tokens,
  revocación remota, roles, OAuth ni limitador de intentos de login.
- Migrar imágenes a S3/Azure Blob en producción y definir retención/purga. Base y
  filesystem no comparten transacción; se compensan fallos, pero una caída puede
  dejar archivos huérfanos. Los soft-deleted conservan sus imágenes.
- CSV no garantiza un snapshot único entre lotes bajo concurrencia; una falla
  durante la transferencia corta la conexión para evitar un éxito falso.
- La búsqueda por substring y paginación offset pueden requerir índices de texto
  especializados y otra estrategia al aumentar el volumen. No se hicieron pruebas de carga.
- El health HTTP no comprueba continuamente PostgreSQL. Quedan como evolución
  métricas, trazas, logs estructurados y alertas; el filtro de errores no es una
  plataforma de observabilidad.
- `npm audit` del backend (2026-09-09) informa cuatro avisos de severidad alta en
  `deepmerge-ts`, `mysql2`, `@prisma/config` y `prisma`, dentro del árbol del CLI.
  No se usa MySQL como base de la aplicación. El CLI está excluido de la imagen
  API runtime, pero permanece en tooling/migraciones. La integración también emite
  deprecación de `pg` por consultas concurrentes. Revisar una actualización compatible
  antes de producción; no se forzaron cambios mayores durante el cierre documental.
  Hay un override acotado de Multer 2.3.0.
- Compose está preparado para evaluación local HTTP, sin TLS, cloud ni CI/CD.
  Esos despliegues, backups automatizados y fijación de imágenes por digest son
  evoluciones futuras. Los tags de imágenes admiten actualizaciones compatibles.
- Los maestros solo tienen lectura y seed; no hay administración de usuarios,
  restauración de libros ni moneda definida para el precio.

La revisión de entrega no requiere cambiar contratos ni añadir funcionalidad.
Los requisitos obligatorios y sus pruebas se conservan.