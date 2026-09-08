# CMPC Books

Full Stack technical challenge for a book inventory management application.

## Estado

Fase 0: aplicaciones base independientes. No se requiere base de datos todavía.

## Requisitos e instalación

Usar Node.js 24 (>=24.15) y npm. Cada aplicación mantiene su propio lockfile.
En PowerShell, usar `npm.cmd` si la política de ejecución bloquea `npm.ps1`.

Backend, desde `backend/`:

```sh
npm ci
cp .env.example .env
npm run start:dev
```

En PowerShell, copiar el entorno con `Copy-Item .env.example .env`.
`PORT` es opcional, vale 3000 por defecto y debe estar entre 1 y 65535.
Los archivos `.env` están ignorados por Git; el ejemplo no contiene secretos.

- Salud: http://localhost:3000/health devuelve `{"status":"ok"}`.
- Swagger UI: http://localhost:3000/docs
- OpenAPI JSON: http://localhost:3000/docs-json

El endpoint de salud solo indica que la aplicación responde; no verifica servicios externos.

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

Para ejecutar el backend compilado usar `npm run start:prod` desde `backend/`.
Para previsualizar el frontend compilado usar `npm run preview` desde `frontend/`.

## Estructura y decisiones

- `backend/src/`: módulo raíz NestJS, controlador y servicio de salud, configuración
  de entorno y configuración compartida de ValidationPipe y Swagger.
- `backend/test/`: pruebas de configuración e integración HTTP. La ruta de prueba
  de validación solo existe en el entorno de tests.
- `frontend/src/app/`: composición raíz y estilos de React.
- `frontend/src/test/`: preparación de React Testing Library.
- `docs/`: requisitos, arquitectura y plan de implementación.

Se mantiene la arquitectura de monolito modular con aplicaciones separadas.
Los módulos backend y las carpetas frontend por funcionalidad se agregarán al
implementar cada fase. La comunicación HTTP se centralizará cuando sea necesaria.
No se han añadido autenticación, Prisma, entidades, libros, filtros, CSV, imágenes,
auditoría ni Docker Compose.

Se usa un override acotado de Multer 2.3.0 para corregir vulnerabilidades de la
dependencia transitiva fijada por NestJS 11.2.3. Retirarlo cuando NestJS incorpore
la versión corregida. Esto no implementa carga de archivos. Vitest usa la rama 4
con las correcciones de seguridad a partir de 4.1.11.

Los documentos `docs/architecture.md` y `docs/implementation-plan.md` están
incompletos en el repositorio inicial (terminan dentro de bloques de código).
El alcance de esta fase sigue la solicitud explícita de bootstrap; no se modificaron
esos documentos ni se asumieron detalles de las fases futuras.
