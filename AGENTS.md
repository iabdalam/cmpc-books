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

Critical mutation operations should use transactions when the business operation and its related audit information must remain consistent.

---

## Query Rules

Book listing operations must be executed server-side.

Filtering, searching, pagination, and sorting must be performed by PostgreSQL through Prisma.

Do not:

1. load all books;
2. filter them in application memory;
3. paginate afterward.

Validate sorting fields before constructing Prisma queries.

Support dynamic sorting by multiple fields when required by the documented requirements.

A valid approach may use a format such as:

`sort=title:asc,price:desc`

Do not trust arbitrary field names or sort directions received from the client.

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

Do not expose sensitive internal information through API errors.

---

## Code Language and Comments

Use English for:

- class names;
- method names;
- function names;
- variable names;
- interfaces;
- types;
- DTOs;
- filenames;
- module names;
- API routes;
- database fields;
- technical identifiers.

Write source-code comments and explanatory code documentation in Spanish.

Comments should explain intent, business rules, non-obvious behavior, or important technical decisions.

Do not add comments that merely repeat what the code already says.

Prefer comments for:

- business rules;
- complex validation;
- transactions;
- non-trivial queries;
- security-related decisions;
- architectural decisions;
- behavior that may not be immediately obvious to another developer.

Example:

```ts
/**
 * Obtiene los libros aplicando filtros, paginación y ordenamiento
 * directamente en la base de datos.
 */
async findAll(query: FindBooksQueryDto) {
  // ...
}
```

Avoid unnecessary comments such as:

```ts
// Asigna el título.
book.title = dto.title;
```

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
- multi-field sorting;
- validation;
- critical error cases.

Target overall coverage is 80%.

If the target cannot be achieved within the challenge time, document the remaining gaps rather than adding meaningless tests.

Tests should verify behavior and business rules, not implementation details unnecessarily.

---

## Verification Rules

After relevant changes, run the appropriate checks.

Backend:

```bash
npm test
npm run build
```

Frontend:

```bash
npm test
npm run build
```

Run lint when configured.

If a command fails:

1. investigate the failure;
2. fix issues introduced by the current task;
3. report unrelated pre-existing failures separately.

Do not claim a task is complete if the project does not build unless the blocking issue is explicitly documented.

Do not hide failing tests.

---

## Documentation Rules

Keep documentation aligned with implementation.

Update documentation when:

- architecture changes;
- setup changes;
- environment variables change;
- endpoints change;
- assumptions change;
- limitations are discovered.

Do not document functionality as implemented if it is not actually implemented.

Keep Swagger/OpenAPI synchronized with the actual API behavior.

Document important technical decisions and trade-offs when they affect the solution.

---

## Scope Control

Follow the phases in:

`docs/implementation-plan.md`

Before implementing a phase:

1. inspect existing code;
2. identify files that need modification;
3. identify assumptions;
4. implement only the current phase.

After implementing a phase:

1. summarize changes;
2. list modified files;
3. run relevant verification commands;
4. report test/build results;
5. mention any deviation from the documented architecture;
6. stop and wait for the next instruction.

Do not continue automatically to the next phase.

---

## AI Working Behavior

When receiving an implementation request:

1. Read the relevant project documentation.
2. Inspect the existing repository before modifying files.
3. Briefly state the implementation approach.
4. Make focused changes.
5. Run verification commands.
6. Review the resulting diff.
7. Report:
   - what was implemented;
   - files changed;
   - tests/build executed;
   - unresolved issues;
   - architecture deviations, if any.

Do not assume missing requirements.

If a requirement is ambiguous, prefer the simplest implementation consistent with the existing documentation and explicitly state the assumption.

Do not silently redesign the project.

Do not implement additional features merely because they may be useful.

When a documented requirement conflicts with an implementation convenience, preserve the requirement and explain the trade-off.

---

## Git Rules

Do not execute destructive Git operations unless explicitly requested.

Do not:

- force push;
- reset hard;
- delete branches;
- rewrite history.

Do not commit automatically unless explicitly requested.

Do not push automatically unless explicitly requested.

Before suggesting a commit:

- ensure relevant tests/build checks have passed;
- summarize the changes.

Use Conventional Commit style when proposing commit messages.

Examples:

```text
feat(auth): implement jwt authentication
feat(books): add server-side pagination and filters
test(books): add service unit tests
docs: update architecture decisions
chore: configure docker compose
```

---

## File and Dependency Rules

Do not modify files outside this repository.

Do not install global dependencies unless explicitly requested.

Prefer project-local dependencies.

Do not introduce libraries that duplicate functionality already available in the selected stack.

Before adding a new dependency, verify that it provides clear value for the current requirement.

Keep generated files, build artifacts, secrets, and local uploads out of Git when appropriate.

---

## Priority Rule

If there is tension between completeness and quality, prioritize:

1. Correctness.
2. Mandatory challenge requirements.
3. Architecture quality.
4. Testability.
5. Documentation.
6. Secondary features.
7. Visual polish.

Do not sacrifice core functionality or maintainability to implement optional refinements.

The following challenge features are considered mandatory targets and should not be treated as optional by default:

- authentication;
- book CRUD;
- server-side filtering;
- server-side pagination;
- multi-field sorting;
- debounced search;
- soft delete;
- CSV export;
- image upload;
- error handling;
- audit/logging;
- Swagger/OpenAPI;
- Docker Compose;
- tests.

If time prevents completing one of these, explicitly document what remains and how it would be implemented.