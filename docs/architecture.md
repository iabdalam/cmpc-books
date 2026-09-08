# Architecture

## 1. Overview

The solution will be implemented as a full stack web application composed of:

- React + TypeScript frontend.
- NestJS + TypeScript backend.
- PostgreSQL relational database.
- Prisma ORM for database access.
- Docker Compose for local orchestration.

High-level flow:

React Frontend
    |
    | HTTP / REST / JWT
    v
NestJS Backend
    |
    | Prisma
    v
PostgreSQL

---

## 2. Architectural Goals

The architecture prioritizes:

- Clear separation of responsibilities.
- Maintainability.
- Testability.
- Simplicity appropriate for a technical challenge.
- SOLID principles.
- Easy local execution.
- Explicit API contracts.
- Server-side querying for scalability.

The project will avoid unnecessary complexity such as microservices, event-driven architecture, or excessive abstraction because the current scope does not justify them.

---

## 3. Repository Structure

The repository will use the following structure:

```text
/
├── frontend/
├── backend/
├── docs/
├── docker-compose.yml
├── AGENTS.md
└── README.md