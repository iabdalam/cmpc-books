# Arquitectura

## 1. Visión general

La solución será implementada como una aplicación web Full Stack compuesta por:

- Frontend con React + TypeScript.
- Backend con NestJS + TypeScript.
- Base de datos relacional PostgreSQL.
- Prisma ORM para acceso a datos.
- Docker Compose para la ejecución local de la solución completa.

Flujo general:

```text
React Frontend
      |
      | HTTP / REST / JWT
      v
NestJS Backend
      |
      | Prisma
      v
PostgreSQL
```

---

## 2. Objetivos arquitectónicos

La arquitectura prioriza:

- Separación clara de responsabilidades.
- Mantenibilidad.
- Testabilidad.
- Simplicidad acorde al alcance de una prueba técnica.
- Aplicación práctica de principios SOLID.
- Ejecución local sencilla.
- Contratos de API explícitos.
- Consultas ejecutadas del lado del servidor.
- Seguridad por defecto.
- Documentación clara de decisiones técnicas.

Se evitará introducir complejidad innecesaria como:

- microservicios;
- arquitectura orientada a eventos;
- CQRS;
- message brokers;
- abstracciones excesivas.

El alcance actual no justifica estas soluciones.

---

## 3. Estructura del repositorio

El repositorio tendrá la siguiente estructura general:

```text
/
├── frontend/
├── backend/
├── docs/
│   ├── requirements.md
│   ├── architecture.md
│   └── implementation-plan.md
├── docker-compose.yml
├── AGENTS.md
└── README.md
```

Frontend y backend son aplicaciones independientes dentro del mismo repositorio.

No se utilizará un framework de monorepo como Nx o Turborepo, ya que no es necesario para el alcance de esta prueba.

---

## 4. Arquitectura del backend

El backend utilizará NestJS organizado como un monolito modular.

Módulos esperados:

```text
backend/src/
├── auth/
├── users/
├── books/
├── authors/
├── publishers/
├── genres/
├── audit/
├── prisma/
├── common/
└── config/
```

La estructura exacta podrá ajustarse durante la implementación si existe una justificación técnica.

El flujo principal será:

```text
Controller
    |
    v
Service
    |
    v
Prisma
    |
    v
PostgreSQL
```

### Controllers

Los controladores serán responsables de:

- entrada y salida HTTP;
- integración con DTOs;
- contexto del usuario autenticado;
- códigos HTTP;
- parámetros de ruta y query params.

Los controladores no deben acceder directamente a Prisma.

### Services

Los servicios serán responsables de:

- reglas de negocio;
- lógica de aplicación;
- coordinación de operaciones;
- transacciones;
- interacción con Prisma.

No se agregará una capa Repository adicional de forma automática.

Prisma ya cumple el rol de abstracción de acceso a datos para este proyecto.

Solo se introducirá otra abstracción si aporta un beneficio concreto.

---

## 5. Convenciones de API

El backend utilizará el prefijo:

```text
/api
```

Ejemplos:

```text
POST   /api/auth/login
GET    /api/books
POST   /api/books
GET    /api/books/:id
PATCH  /api/books/:id
DELETE /api/books/:id
GET    /api/books/export
```

Swagger/OpenAPI estará disponible en:

```text
/api/docs
```

También existirá un endpoint de salud.

Por ejemplo:

```text
GET /health
```

o:

```text
GET /api/health
```

La decisión final deberá quedar documentada y ser consistente.

---

## 6. Respuestas de API

Las respuestas deben mantener una estructura consistente.

En endpoints paginados se debe retornar:

- información;
- metadatos de paginación.

Ejemplo:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 0,
    "totalPages": 0
  }
}
```

Se podrán utilizar interceptores de NestJS para resolver preocupaciones transversales cuando aporten valor real.

---

## 7. Autenticación

La autenticación utilizará JWT.

Flujo:

```text
Credenciales
     |
     v
POST /api/auth/login
     |
     v
Validación usuario/contraseña
     |
     v
JWT
     |
     v
Authorization: Bearer <token>
```

Las contraseñas:

- nunca se almacenarán en texto plano;
- serán almacenadas como hashes seguros.

Para la prueba técnica se podrá crear un usuario demo mediante seed.

El secreto JWT deberá provenir de variables de entorno.

Los endpoints protegidos utilizarán Guards de NestJS.

---

## 8. Modelo de datos

Se utilizará PostgreSQL con Prisma ORM.

Las principales entidades serán:

- User
- Book
- Author
- Publisher
- Genre
- AuditLog

### User

Campos principales:

```text
id
email
passwordHash
createdAt
updatedAt
```

### Author

Campos principales:

```text
id
name
createdAt
updatedAt
```

### Publisher

Campos principales:

```text
id
name
createdAt
updatedAt
```

### Genre

Campos principales:

```text
id
name
createdAt
updatedAt
```

### Book

Campos principales:

```text
id
title
price
available
imageUrl
authorId
publisherId
genreId
createdAt
updatedAt
deletedAt
```

### AuditLog

Campos principales:

```text
id
userId
action
entity
entityId
metadata
createdAt
```

---

## 9. Relaciones

Las relaciones principales serán:

```text
Author      1 ---- N Book
Publisher   1 ---- N Book
Genre       1 ---- N Book
User        1 ---- N AuditLog
```

Autor, editorial y género serán modelados como entidades separadas.

Esto permite:

- normalización;
- reutilización;
- filtrado eficiente;
- integridad referencial;
- evitar duplicación innecesaria.

Las relaciones y claves foráneas se definirán mediante Prisma.

---

## 10. Índices

Se crearán índices asociados a los principales patrones de consulta.

Candidatos:

```text
Book.title
Book.authorId
Book.publisherId
Book.genreId
Book.available
Book.deletedAt
User.email
```

Los índices deben responder a necesidades reales del sistema y no agregarse de forma arbitraria.

---

## 11. Datos maestros

La creación y edición de libros utilizará el modelo relacional normalizado.

El frontend necesitará obtener:

- autores;
- editoriales;
- géneros.

Se podrán exponer endpoints simples de lectura como:

```text
GET /api/authors
GET /api/publishers
GET /api/genres
```

Inicialmente estos datos podrán ser cargados mediante seed.

No se requiere implementar CRUD administrativo completo para estas entidades salvo que resulte necesario.

---

## 12. Listado de libros

El listado debe soportar:

- paginación;
- búsqueda;
- filtro por género;
- filtro por editorial;
- filtro por autor;
- filtro por disponibilidad;
- ordenamiento dinámico por múltiples campos.

Todas estas operaciones deben ejecutarse del lado del servidor.

Ejemplo:

```text
GET /api/books?page=1&limit=10&available=true&sort=title:asc,price:desc
```

Los campos y direcciones de ordenamiento deben validarse antes de construir la consulta Prisma.

Los libros eliminados lógicamente no deben aparecer.

---

## 13. Búsqueda

La búsqueda en tiempo real será iniciada por el frontend.

Se utilizará debounce.

Valor recomendado:

```text
400 ms
```

La búsqueda real se ejecutará en backend/PostgreSQL.

Podrá considerar campos relevantes como:

- título del libro;
- autor;
- editorial.

El comportamiento finalmente implementado deberá quedar documentado.

---

## 14. Eliminación lógica

Los libros utilizarán eliminación lógica mediante:

```text
deletedAt
```

Al eliminar un libro:

- no se eliminará físicamente de la base de datos;
- se establecerá `deletedAt`.

Las consultas normales deberán filtrar:

```text
deletedAt = null
```

Los libros eliminados no deben aparecer en:

- listados;
- detalle;
- exportación CSV.

---

## 15. Transacciones

Se utilizarán transacciones Prisma cuando múltiples operaciones deban completarse de forma atómica.

Un caso relevante será:

```text
Modificación del libro
+
Registro de auditoría
```

Ambas operaciones deberán completar correctamente o revertirse juntas cuando corresponda.

La intención es demostrar uso real de transacciones, no agregarlas artificialmente.

---

## 16. Auditoría y logging

Se diferenciarán dos conceptos.

### Logging técnico

Permitirá registrar:

- errores;
- eventos técnicos relevantes;
- comportamiento de la aplicación.

### Auditoría

Permitirá registrar operaciones de negocio relevantes.

Por ejemplo:

```text
CREATE book
UPDATE book
DELETE book
```

La auditoría debe incluir cuando sea posible:

- usuario;
- acción;
- entidad;
- identificador de entidad;
- fecha;
- metadatos relevantes.

---

## 17. Manejo de errores

El backend debe manejar errores de forma consistente.

No se deben exponer:

- stack traces;
- detalles internos de Prisma;
- detalles internos de PostgreSQL;
- secretos;
- información técnica sensible.

Los errores de validación deben entregar respuestas HTTP comprensibles.

El frontend deberá mostrar mensajes útiles para el usuario.

---

## 18. Interceptores

Se utilizarán interceptores de NestJS cuando resuelvan preocupaciones transversales reales.

Posibles usos:

- estandarización de respuestas;
- logging;
- métricas;
- comportamiento transversal.

La paginación no debe perder sus metadatos debido a transformaciones de respuesta.

---

## 19. Exportación CSV

Se implementará:

```text
GET /api/books/export
```

El endpoint generará un archivo CSV.

Debe utilizar:

- Content-Type apropiado;
- nombre de archivo de descarga apropiado;
- codificación correcta.

Los libros eliminados lógicamente no deben incluirse.

Cuando sea posible, se reutilizará la lógica de filtros para evitar duplicación innecesaria.

---

## 20. Carga de imágenes

Cada libro podrá tener una imagen.

Para esta prueba técnica se utilizará almacenamiento local del backend.

Se validará:

- tipo MIME;
- tamaño máximo permitido;
- nombre seguro de archivo.

Las imágenes serán servidas desde una ruta controlada.

Docker Compose deberá utilizar un volumen para preservar los archivos cargados.

En un entorno productivo, esta implementación debería evolucionar hacia almacenamiento de objetos como:

- Amazon S3;
- Azure Blob Storage.

Este trade-off deberá quedar documentado.

---

## 21. Arquitectura del frontend

El frontend utilizará:

- React;
- TypeScript;
- Vite.

Se utilizará una estructura orientada a funcionalidades.

Ejemplo:

```text
frontend/src/
├── app/
├── features/
│   ├── auth/
│   └── books/
├── components/
├── services/
├── hooks/
├── types/
└── utils/
```

La estructura podrá evolucionar según las necesidades concretas.

---

## 22. Comunicación con backend

La comunicación HTTP estará centralizada.

Los componentes no deben duplicar configuración HTTP.

Se debe manejar de forma consistente:

- URL base;
- token JWT;
- errores;
- cabeceras.

La interfaz debe contemplar:

- estado de carga;
- estado vacío;
- estado de error.

---

## 23. Pantallas

El frontend debe proporcionar al menos:

- Login.
- Listado de libros.
- Creación de libro.
- Edición de libro.
- Detalle de libro.

El listado incluirá:

- filtros;
- búsqueda;
- paginación;
- ordenamiento múltiple.

---

## 24. Formularios

Los formularios de creación y edición deben utilizar validación reactiva.

Se priorizará una solución sencilla y mantenible.

Las validaciones frontend mejoran la experiencia de usuario.

Sin embargo, la validación del backend siempre será la autoridad final.

Para imágenes se utilizará:

```text
multipart/form-data
```

---

## 25. Testing

### Backend

Se utilizará Jest.

Se priorizarán pruebas sobre:

- autenticación;
- servicios;
- controladores;
- validaciones;
- filtros;
- búsqueda;
- paginación;
- ordenamiento múltiple;
- eliminación lógica;
- auditoría;
- manejo de errores.

### Frontend

Se utilizará:

- Vitest;
- React Testing Library.

Se priorizarán pruebas sobre:

- componentes importantes;
- formularios;
- servicios;
- interacciones;
- estados de carga;
- errores.

La meta de cobertura es:

```text
>= 80%
```

Se priorizarán pruebas significativas antes que pruebas creadas únicamente para aumentar la cobertura.

---

## 26. Docker

Docker Compose orquestará:

```text
frontend
backend
postgres
```

También deberá ser posible ejecutar frontend y backend localmente durante el desarrollo.

Las variables de configuración deberán utilizar:

```text
.env
.env.example
```

Se configurarán volúmenes para:

- PostgreSQL;
- imágenes cargadas.

---

## 27. Documentación

El README final deberá contener:

- descripción del proyecto;
- requisitos previos;
- instalación;
- configuración;
- variables de entorno;
- migraciones;
- seed;
- ejecución local;
- ejecución mediante Docker Compose;
- pruebas;
- Swagger;
- credenciales demo;
- decisiones arquitectónicas;
- trade-offs;
- supuestos;
- limitaciones conocidas.

También deberán existir:

- diagrama de arquitectura;
- modelo relacional de base de datos.

---

## 28. Seguridad

La aplicación deberá:

- hashear contraseñas;
- utilizar JWT;
- validar payloads;
- validar archivos;
- validar parámetros de ordenamiento;
- evitar exposición de errores internos;
- evitar secretos dentro del repositorio;
- utilizar variables de entorno.

CORS deberá restringirse al origen configurado para el frontend.

---

## 29. Rendimiento

Las siguientes operaciones se realizarán directamente en PostgreSQL mediante Prisma:

- filtrado;
- búsqueda;
- ordenamiento;
- paginación.

No se cargarán todos los registros para posteriormente procesarlos en memoria.

Se establecerá un límite máximo razonable para la paginación.

Los índices deberán apoyar los principales patrones de consulta.

---

## 30. Decisiones y trade-offs

Se toman de manera intencional las siguientes decisiones:

- Monolito modular en lugar de microservicios.
- Prisma sin agregar por defecto una capa Repository adicional.
- REST en lugar de GraphQL.
- Almacenamiento local de imágenes para la prueba.
- PostgreSQL como base relacional.
- Frontend y backend independientes dentro de un mismo repositorio.
- Sin framework de monorepo.

Estas decisiones priorizan:

- velocidad de implementación;
- claridad;
- mantenibilidad;
- facilidad de evaluación;
- coherencia con el alcance.

---

## 31. Fuera de alcance

Salvo que posteriormente se determine lo contrario, quedan fuera del alcance:

- microservicios;
- Kubernetes;
- message brokers;
- infraestructura cloud;
- login social;
- rotación avanzada de refresh tokens;
- CRUD administrativo completo de autores;
- CRUD administrativo completo de editoriales;
- CRUD administrativo completo de géneros;
- event sourcing;
- CQRS.

La arquitectura debe permitir evolución futura sin implementar anticipadamente estas complejidades.