# AGENTS.md

## Project Context

This repository contains a Full Stack technical challenge for a book inventory management application.

The source of truth for the project is:

- `docs/requirements.md`
- `docs/architecture.md`
- `docs/implementation-plan.md`

Before implementing any task, read those files and follow them.

---

## General Working Rules

1. Work incrementally.
2. Implement only the requested phase or task.
3. Do not implement future phases unless explicitly requested.
4. Do not change the documented architecture without explaining and justifying the change first.
5. Do not remove or weaken requirements to simplify implementation.
6. Prefer simple and maintainable solutions over unnecessary abstraction.
7. Avoid overengineering.
8. Keep changes focused and reviewable.
9. Reuse existing code and abstractions where appropriate.
10. Do not introduce dependencies unless they provide clear value.

---

## Technology Constraints

### Frontend

Use:

- React
- TypeScript
- Vite

### Backend

Use:

- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT authentication

### Testing

Use:

- Jest for backend tests.
- Vitest and React Testing Library for frontend tests.

### Local Deployment

Use:

- Docker
- Docker Compose

Do not introduce alternative frameworks or major technology changes without explicit approval.

---

## Architecture Rules

Follow the architecture defined in:

`docs/architecture.md`

Important principles:

- Use a modular monolith.
- Keep frontend and backend as separate applications in the same repository.
- Controllers must not access the database directly.
- Business logic belongs in services.
- Database access must be performed through Prisma.
- Keep responsibilities clearly separated.
- Follow SOLID principles where they provide practical value.
- Avoid excessive layering or abstractions that do not benefit this project.

---

## Backend Rules

### NestJS

Use NestJS modules to organize features.

Expected modules include:

- auth
- users
- books
- audit
- prisma
- common

### Validation

Use DTOs and `class-validator`.

Enable global validation using NestJS `ValidationPipe`.

Do not rely only on frontend validation.

### Authentication

Use JWT authentication.

Passwords must:

- never be stored in plain text;
- be hashed using bcrypt or an equivalent secure password hashing library.

Secrets must come from environment variables.

### Error Handling

Use consistent error handling.

Do not expose:

- stack traces;
- database implementation details;
- secrets;
- internal exception details.

### API Documentation

Use Swagger/OpenAPI.

Keep documentation synchronized with implemented endpoints and DTOs.

---

## Database Rules

Use Prisma as the ORM.

Use PostgreSQL as the database.

Schema changes must use Prisma migrations.

Do not manually modify the database schema outside migrations.

Soft deletion of books must use a field such as:

`deletedAt`

Normal book queries must exclude soft-deleted records.

Use transactions when multiple database operations must succeed or fail atomically.

---

## Query Rules

Book listing operations must be executed server-side.

Filtering, searching, pagination, and sorting must be performed by PostgreSQL through Prisma.

Do not:

1. load all books;
2. filter them in application memory;
3. paginate afterward.

Validate sorting fields before constructing Prisma queries.

---

## Frontend Rules

Use a feature-oriented structure.

Keep API communication centralized.

Do not call backend endpoints directly from arbitrary UI components when a service abstraction is appropriate.

Implement:

- loading states;
- empty states;
- error states;
- form validation.

Search must use debounce.

Backend validation remains authoritative.

---

## Security Rules

Never commit:

- passwords;
- JWT secrets;
- database credentials;
- API tokens;
- personal access tokens;
- private keys.

Use `.env` files locally.

Provide `.env.example` without real secrets.

Validate file uploads by:

- file type;
- file size.

Do not trust client-provided file metadata without validation.

---

## Testing Rules

For every relevant feature:

1. Identify critical behaviors.
2. Add or update tests where practical.
3. Run the relevant test suite.
4. Do not delete tests simply to make the build pass.

Prioritize coverage for:

- authentication;
- books business logic;
- soft delete;
- filters;
- pagination;
- sorting;
- validation.

Target overall coverage is 80%.

If the target cannot be achieved within the challenge time, document the remaining gaps rather than adding meaningless tests.

---

## Verification Rules

After relevant changes, run the appropriate checks.

Backend:

```bash
npm test
npm run build