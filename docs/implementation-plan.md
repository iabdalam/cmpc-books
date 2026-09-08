# Plan de Implementación

## 1. Objetivo

Implementar la prueba técnica CMPC Books de forma incremental, priorizando:

- requisitos obligatorios;
- calidad arquitectónica;
- testabilidad;
- documentación;
- funcionamiento completo de punta a punta.

La implementación deberá seguir:

- `docs/requirements.md`
- `docs/architecture.md`
- `AGENTS.md`

---

## 2. Principios de trabajo

Cada fase debe:

1. Implementar únicamente el alcance definido para esa fase.
2. Mantener la arquitectura documentada.
3. Agregar pruebas significativas cuando corresponda.
4. Ejecutar las pruebas relevantes.
5. Ejecutar build y lint cuando estén disponibles.
6. Documentar supuestos o desviaciones.
7. Detenerse antes de comenzar automáticamente la siguiente fase.

---

## 3. Fase 0 - Inicialización del proyecto

### Objetivo

Crear las aplicaciones iniciales frontend y backend.

### Backend

Crear:

- aplicación NestJS;
- configuración TypeScript;
- ConfigModule;
- soporte de variables de entorno;
- ValidationPipe global;
- configuración inicial de Swagger/OpenAPI;
- endpoint de health;
- pruebas básicas.

### Frontend

Crear:

- aplicación React;
- TypeScript;
- Vite;
- estructura mínima inicial;
- configuración de pruebas;
- pantalla inicial limpia.

### Verificación

Ejecutar en ambas aplicaciones:

```bash
npm test
npm run build
```

### Estado

Completada.

---

## 4. Fase 1 - PostgreSQL y Prisma

### Objetivo

Implementar persistencia y modelo de datos normalizado.

Implementar:

- Prisma;
- conexión con PostgreSQL;
- PrismaModule;
- PrismaService;
- schema Prisma;
- migraciones;
- seed.

Entidades:

```text
User
Author
Publisher
Genre
Book
AuditLog
```

Agregar:

- relaciones;
- claves foráneas;
- índices;
- timestamps.

Book debe soportar:

```text
deletedAt
```

para eliminación lógica.

Crear configuración segura en:

```text
.env.example
```

Verificar:

- conexión;
- migración;
- seed.

---

## 5. Fase 2 - Autenticación

### Objetivo

Implementar autenticación mediante JWT.

Implementar:

- UsersModule;
- AuthModule;
- DTO de login;
- hashing de contraseñas;
- generación de JWT;
- estrategia JWT con Passport;
- JWT Guard;
- contexto de usuario autenticado;
- usuario demo mediante seed.

Endpoint:

```text
POST /api/auth/login
```

Proteger los endpoints que corresponda.

Agregar pruebas para:

- login válido;
- credenciales inválidas;
- endpoints protegidos;
- validaciones relevantes.

---

## 6. Fase 3 - CRUD principal de libros

### Objetivo

Implementar las operaciones centrales de administración de libros.

Endpoints:

```text
POST   /api/books
GET    /api/books/:id
PATCH  /api/books/:id
DELETE /api/books/:id
```

Crear:

- BooksModule;
- BooksController;
- BooksService;
- DTOs;
- documentación Swagger;
- validaciones.

DELETE debe utilizar eliminación lógica.

Los libros eliminados no deben ser encontrados por consultas normales.

Agregar pruebas para:

- creación;
- obtención;
- actualización;
- eliminación;
- recurso no encontrado;
- validación;
- soft delete.

---

## 7. Fase 4 - Datos maestros

### Objetivo

Proporcionar los datos normalizados requeridos por los formularios y filtros.

Implementar operaciones simples de lectura para:

- autores;
- editoriales;
- géneros.

Ejemplo:

```text
GET /api/authors
GET /api/publishers
GET /api/genres
```

Los datos iniciales serán creados mediante seed.

No se implementará CRUD administrativo completo salvo que posteriormente sea necesario.

Agregar pruebas relevantes.

---

## 8. Fase 5 - Listado avanzado de libros

### Objetivo

Implementar el endpoint principal de consulta.

Endpoint:

```text
GET /api/books
```

Debe soportar:

- paginación;
- búsqueda;
- filtro por autor;
- filtro por editorial;
- filtro por género;
- filtro por disponibilidad;
- ordenamiento dinámico por múltiples campos.

Ejemplo:

```text
/api/books?page=1&limit=10&available=true&sort=title:asc,price:desc
```

Requisitos:

- filtrar en PostgreSQL;
- ordenar en PostgreSQL;
- paginar en PostgreSQL;
- validar campos de ordenamiento permitidos;
- validar dirección `asc` / `desc`;
- excluir libros eliminados;
- retornar metadatos de paginación.

Agregar pruebas completas de esta funcionalidad.

---

## 9. Fase 6 - Manejo de errores e interceptores

### Objetivo

Implementar comportamiento HTTP transversal consistente.

Agregar:

- manejo global de excepciones cuando corresponda;
- formato consistente de errores;
- interceptor de respuestas cuando aporte valor;
- logging técnico de solicitudes o errores cuando corresponda.

No exponer:

- detalles internos;
- stack traces;
- información de Prisma;
- información de PostgreSQL;
- secretos.

Mantener compatibilidad con Swagger.

Agregar pruebas para los casos de error importantes.

---

## 10. Fase 7 - Auditoría y transacciones

### Objetivo

Registrar cambios relevantes del negocio.

Auditar:

```text
CREATE book
UPDATE book
DELETE book
```

La auditoría debe guardar:

- acción;
- entidad;
- identificador;
- usuario;
- timestamp;
- metadatos útiles cuando corresponda.

Utilizar transacciones Prisma cuando la modificación del libro y la creación del registro de auditoría deban completarse atómicamente.

Agregar pruebas para:

- creación de auditoría;
- asociación con usuario;
- consistencia transaccional cuando sea práctico.

---

## 11. Fase 8 - Exportación CSV

### Objetivo

Permitir exportar los libros.

Endpoint:

```text
GET /api/books/export
```

Debe retornar CSV con:

- Content-Type apropiado;
- nombre de archivo;
- encoding correcto.

Los libros eliminados lógicamente no deben exportarse.

Reutilizar lógica de filtros cuando aporte valor y evite duplicación.

Agregar pruebas sobre:

- contenido;
- headers;
- exclusión de libros eliminados.

---

## 12. Fase 9 - Carga de imágenes

### Objetivo

Permitir una imagen por libro.

Implementar:

- multipart upload;
- validación MIME;
- validación de tamaño;
- almacenamiento local;
- nombres de archivo seguros;
- acceso mediante ruta estática;
- persistencia de `imageUrl`.

Documentar que en producción debería utilizarse object storage.

Docker deberá utilizar volumen persistente para uploads.

Agregar pruebas de validación relevantes.

---

## 13. Fase 10 - Autenticación frontend

### Objetivo

Implementar login y acceso autenticado a la API.

Implementar:

- pantalla de login;
- servicio de autenticación;
- almacenamiento/control del token;
- rutas protegidas;
- logout;
- manejo de errores de autenticación.

Centralizar la configuración HTTP.

Agregar pruebas relevantes.

---

## 14. Fase 11 - Listado frontend

### Objetivo

Construir la pantalla principal del inventario.

Implementar:

- tabla o listado;
- paginación del lado del servidor;
- filtros;
- disponibilidad;
- búsqueda;
- debounce de 400 ms;
- ordenamiento por múltiples campos;
- estado de carga;
- estado vacío;
- estado de error.

Cuando sea práctico, sincronizar los parámetros de consulta con el estado de la interfaz.

Agregar pruebas de componentes y servicios.

---

## 15. Fase 12 - Formulario frontend

### Objetivo

Implementar creación y edición de libros.

Implementar:

- pantalla de creación;
- pantalla de edición;
- validación reactiva;
- título;
- autor;
- editorial;
- género;
- precio;
- disponibilidad;
- imagen;
- mensajes de validación;
- estados de envío;
- manejo de errores.

Reutilizar el formulario entre creación y edición cuando sea práctico.

Agregar pruebas de comportamiento crítico.

---

## 16. Fase 13 - Detalle y eliminación frontend

### Objetivo

Completar el flujo principal de libros.

Implementar:

- página de detalle;
- imagen;
- información del libro;
- navegación a edición;
- acción de eliminar;
- confirmación de eliminación;
- feedback posterior.

Agregar pruebas relevantes.

---

## 17. Fase 14 - Docker Compose

### Objetivo

Ejecutar la solución completa mediante Docker.

Servicios:

```text
postgres
backend
frontend
```

Configurar:

- variables de entorno;
- dependencias entre servicios;
- health checks cuando aporten valor;
- volumen para uploads;
- volumen para PostgreSQL.

Verificar ejecución Full Stack.

---

## 18. Fase 15 - Revisión de cobertura

### Objetivo

Asegurar cobertura automatizada significativa.

Ejecutar cobertura de:

- backend;
- frontend.

Meta:

```text
>= 80%
```

Priorizar:

- autenticación;
- BooksService;
- filtros;
- paginación;
- ordenamiento;
- soft delete;
- validaciones;
- auditoría;
- flujos críticos frontend.

No crear pruebas sin valor únicamente para aumentar porcentajes.

---

## 19. Fase 16 - Documentación

### Objetivo

Preparar el repositorio para evaluación técnica.

Completar README con:

- descripción;
- requisitos previos;
- instalación;
- configuración;
- variables de entorno;
- base de datos;
- migraciones;
- seed;
- ejecución;
- Docker Compose;
- tests;
- Swagger;
- credenciales demo;
- decisiones arquitectónicas;
- trade-offs;
- limitaciones conocidas.

Agregar:

- diagrama de arquitectura;
- modelo relacional.

La documentación debe reflejar únicamente funcionalidades realmente implementadas.

---

## 20. Fase 17 - Revisión final

### Objetivo

Realizar validación técnica completa.

Verificar:

- build backend;
- build frontend;
- tests backend;
- tests frontend;
- cobertura;
- lint;
- Docker Compose;
- autenticación;
- CRUD;
- filtros;
- paginación;
- ordenamiento múltiple;
- búsqueda con debounce;
- CSV;
- imágenes;
- soft delete;
- auditoría;
- Swagger;
- README.

Revisar:

```bash
git status
git diff
```

Eliminar:

- archivos temporales;
- dependencias sin uso;
- código muerto;
- logs de depuración;
- secretos accidentales.

Cualquier requisito pendiente debe quedar documentado explícitamente.

---

## 21. Prioridad de implementación

### Núcleo obligatorio

Priorizar:

- autenticación;
- persistencia normalizada;
- CRUD de libros;
- soft delete;
- listado avanzado;
- filtros;
- paginación;
- ordenamiento múltiple;
- búsqueda con debounce;
- manejo de errores;
- Swagger;
- Docker Compose.

### Otros requisitos obligatorios de la prueba

También deben abordarse:

- carga de imágenes;
- exportación CSV;
- auditoría/logging;
- testing automatizado;
- documentación.

---

## 22. Estrategia si el tiempo es limitado

No omitir requisitos silenciosamente.

Si alguna funcionalidad queda incompleta:

1. Documentar qué falta.
2. Explicar cómo debería implementarse.
3. Explicar el trade-off.
4. Mantener el proyecto compilable.
5. Mantener el proyecto demostrable.

La funcionalidad principal y la calidad arquitectónica tienen prioridad sobre refinamientos visuales secundarios.