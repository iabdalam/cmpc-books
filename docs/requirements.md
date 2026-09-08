# Requirements

## 1. Project Objective

Build a full stack web application for CMPC Libros to manage book inventory and provide basic data management and analysis capabilities.

Each book must contain:

- Title
- Author
- Publisher
- Price
- Availability
- Genre
- Image

---

## 2. Frontend Requirements

Technology:

- React
- TypeScript

### FR-FE-01 Authentication

The application must provide a login screen.

Acceptance criteria:

- The user can enter credentials.
- Successful authentication grants access to protected application pages.
- Invalid credentials display an appropriate error.
- Authentication state is persisted for the active session.

### FR-FE-02 Book Listing

The application must display a list of books.

The list must support:

- Filtering by genre.
- Filtering by publisher.
- Filtering by author.
- Filtering by availability.
- Sorting by multiple fields.
- Server-side pagination.
- Real-time search using debounce.

### FR-FE-03 Book Create/Edit Form

The application must allow creating and editing books.

The form must support:

- Reactive validation.
- Required field validation.
- Price validation.
- Image upload.

### FR-FE-04 Book Detail

The application must provide a view displaying the available information for a book.

---

## 3. Backend Requirements

Technology:

- NestJS
- TypeScript

### FR-BE-01 Architecture

The backend must use a modular and scalable architecture following SOLID principles.

### FR-BE-02 Authentication

The API must provide JWT-based authentication.

### FR-BE-03 Book CRUD

The API must provide REST endpoints for:

- Create book.
- List books.
- Get book by ID.
- Update book.
- Delete book.

### FR-BE-04 Advanced Listing

The books endpoint must support:

- Pagination.
- Filtering.
- Sorting.
- Text search.

### FR-BE-05 CSV Export

The API must provide an endpoint to export book data in CSV format.

### FR-BE-06 Soft Delete

Deleting a book must not physically remove its record from the database.

### FR-BE-07 Audit Logging

Relevant application operations must be logged for auditing purposes.

---

## 4. Database Requirements

Technology:

- PostgreSQL
- Prisma ORM or Drizzle ORM

Selected ORM:

- Prisma ORM

### FR-DB-01 Data Model

The data model must be normalized and contain appropriate relationships.

### FR-DB-02 Indexes

Indexes must be defined for frequently queried fields where appropriate.

### FR-DB-03 Migrations

Database schema changes must be managed through migrations.

### FR-DB-04 Transactions

Transactions must be used for operations where data integrity requires atomic execution.

---

## 5. Testing Requirements

### FR-TEST-01 Frontend

Implement unit tests for frontend components and services.

### FR-TEST-02 Backend

Implement unit tests for NestJS services and controllers.

### FR-TEST-03 Coverage

Target at least 80% code coverage.

If full coverage cannot be achieved within the available implementation time, prioritize critical business logic and document remaining gaps.

---

## 6. DevOps Requirements

### FR-DEVOPS-01 Docker Compose

Provide a docker-compose.yml capable of running the local application stack.

The expected services are:

- PostgreSQL
- Backend
- Frontend

---

## 7. Documentation Requirements

### FR-DOC-01 README

README.md must include:

- Installation instructions.
- Configuration instructions.
- Application usage guide.
- Architecture description.
- Important design decisions.

### FR-DOC-02 OpenAPI

Backend API must be documented using Swagger/OpenAPI.

### FR-DOC-03 Architecture Diagram

Provide a system architecture diagram.

### FR-DOC-04 Data Model Diagram

Provide a relational database model diagram.

---

## 8. Cross-Cutting Requirements

### NFR-01 Error Handling

Frontend and backend must provide consistent error handling.

### NFR-02 Backend Interceptors

NestJS interceptors must be used for response transformation or other cross-cutting concerns.

### NFR-03 Code Quality

Code should prioritize:

- Readability.
- Maintainability.
- Clear responsibility boundaries.
- Consistent naming.
- SOLID principles.

### NFR-04 Performance

The implementation should avoid loading the full books dataset when pagination or filtering can be handled by PostgreSQL.

### NFR-05 Security

- Protected endpoints require JWT authentication.
- Passwords must not be stored in plain text.
- Secrets must be provided through environment variables.
- Input must be validated.

---

## 9. Delivery

The final delivery must contain:

- Source code in a Git repository.
- Complete project documentation.
- Instructions to run the application locally.

---

## 10. Scope Priorities

### Priority 1

- Application boots successfully.
- PostgreSQL + Prisma.
- Authentication.
- Book CRUD.
- Server-side pagination.
- Filtering.
- Search.
- Sorting.
- Basic frontend.

### Priority 2

- Soft delete.
- Swagger.
- Error handling.
- Logging/audit.
- Docker Compose.
- Tests.

### Priority 3

- CSV export.
- Image upload.
- UI refinement.
- Additional test coverage.