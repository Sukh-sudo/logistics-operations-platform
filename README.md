<div align="center">

# Logistics Operations Platform

### From the first warehouse scan to final delivery

A full-stack logistics platform that models how packages, containers, trailers,
terminals, routes, and delivery teams work together across a transportation
network.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=111827)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Android](https://img.shields.io/badge/Android-Kotlin-3DDC84?style=for-the-badge&logo=android&logoColor=white)](apps/handheld-android/README.md)

[![Last commit](https://img.shields.io/github/last-commit/Sukh-sudo/logistics-operations-platform?style=flat-square)](https://github.com/Sukh-sudo/logistics-operations-platform/commits)
[![Repository size](https://img.shields.io/github/repo-size/Sukh-sudo/logistics-operations-platform?style=flat-square)](https://github.com/Sukh-sudo/logistics-operations-platform)
![Project status](https://img.shields.io/badge/status-active_development-22c55e?style=flat-square)

[What it does](#what-it-does) | [Architecture](#architecture) | [Applications](#applications) | [Getting started](#getting-started) | [Documentation](#documentation)

</div>

---

## The project

The Logistics Operations Platform is a portfolio-scale transportation and
warehouse management system. It follows freight through terminals and vehicles
while giving operators a live view of where each package is, how it got there,
and what should happen next.

Unlike a basic CRUD application, every meaningful operation creates an
immutable business event. Rebuildable snapshot models provide fast access to
the latest state, giving the platform both a complete audit trail and practical
operational performance.

> This project explores how real logistics software can remain traceable,
> resilient, and understandable as freight moves through many hands and systems.

## What it does

| Capability | What it provides |
| --- | --- |
| Freight operations | Receive, sort, load, unload, dispatch, arrive, and deliver packages |
| Asset management | Track containers, trailers, trucks, drivers, and equipment assignments |
| Transportation | Build terminal routes, schedule trips, and follow stop-by-stop execution |
| Customer visibility | Track multi-package shipments and delivery progress without exposing internal data |
| Operations intelligence | Search assets, review timelines, monitor health, and generate delivery reports |
| Handheld workflows | Scan barcodes, work offline, synchronize commands, and handle delivery exceptions |
| Platform security | Authenticate staff with JWTs and protect actions with roles and permissions |

## A package's journey

```text
Received -> Sorted -> Container / Trailer -> In Transit ->
Arrived -> Out for Delivery -> Delivered
```

At every step, the platform records the business event, updates the relevant
snapshot, preserves relationship history, and makes the new state available to
the dashboard and customer tracking experience.

## Architecture

```mermaid
flowchart LR
    Dashboard[Operations Dashboard]
    Simulator[Handheld Simulator]
    Android[Android Scanner]
    API[NestJS REST API]
    Domains[Logistics Domain Services]
    Events[(Immutable Events)]
    Snapshots[(Snapshot Read Models)]
    Postgres[(PostgreSQL)]
    Kafka[Kafka - Optional]

    Dashboard --> API
    Simulator --> API
    Android --> API
    API --> Domains
    Domains -->|Prisma transaction| Events
    Domains -->|Prisma transaction| Snapshots
    Events --> Postgres
    Snapshots --> Postgres
    Domains -.-> Kafka
```

The main architectural rules are deliberately consistent:

- Business actions create immutable, timestamped events.
- Current state lives in disposable, rebuildable snapshots.
- Related writes commit together inside Prisma transactions.
- Controllers stay thin while services own business behavior.
- Correlation IDs connect activity across modules and logs.
- Kafka publication is optional, so local workflows remain usable without a broker.

## Applications

| Application | Experience | Location |
| --- | --- | --- |
| Operations dashboard | React workspace for dispatchers, supervisors, and administrators | [`apps/dashboard`](apps/dashboard) |
| Backend API | NestJS business services, Prisma persistence, Swagger, and security | [`apps/backend`](apps/backend) |
| Handheld simulator | Browser-based scanner and offline-sync demonstration | [`apps/handheld-simulator`](apps/handheld-simulator) |
| Native handheld | Android scanner built with Compose, Room, WorkManager, CameraX, and ML Kit | [`apps/handheld-android`](apps/handheld-android) |

## Platform highlights

- Package, container, trailer, terminal, route, trip, shipment, and fleet domains
- Event history and current-state snapshots for operational aggregates
- Customer-safe shipment tracking and in-app notifications
- Delivery performance reports with terminal and date filtering
- Offline-first handheld outbox with idempotent synchronization
- Snapshot recovery, health checks, metrics, request tracing, and Swagger docs
- Unit, component, integration, and PostgreSQL-backed end-to-end testing

## Technology

```text
Frontend       React 19 | Vite | React Router | TanStack Query | Recharts
Backend        NestJS 11 | TypeScript | Prisma | Swagger | KafkaJS
Database       PostgreSQL 16
Android        Kotlin | Jetpack Compose | Room | WorkManager | CameraX | ML Kit
Testing        Jest | Supertest | Vitest | Testing Library | Android/JUnit
Workspace      pnpm | Turborepo | Docker Compose
```

## Current status

The core logistics engine and the first four implementation phases are built:

- **Phase 1:** Packages, containers, trailers, dashboard, search, and health
- **Phase 2:** Terminals, routes, trips, shipments, identity, and authorization
- **Phase 3:** Fleet, trucks, drivers, and equipment assignments
- **Phase 4:** Customer tracking, notifications, and delivery reporting

The next phase explores analytics, forecasting, GIS, GPS tracking, and richer
live operational dashboards.

This remains an actively developed portfolio and learning project. It uses
production-oriented patterns, but it requires a dedicated security review,
load testing, and managed infrastructure before real operational use.

## Getting started

<details>
<summary><strong>Open the local development guide</strong></summary>

### Prerequisites

- Node.js
- pnpm 11
- Docker Desktop or another Docker-compatible runtime

### Install and configure

```bash
pnpm install
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

Create `apps/backend/.env`:

```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/logistics_platform?schema=public"
BOOTSTRAP_ADMIN_SECRET="replace-with-a-long-random-bootstrap-secret"
JWT_ACCESS_SECRET="replace-with-a-long-random-jwt-secret"
JWT_ISSUER="logistics-operations-platform"
JWT_AUDIENCE="logistics-platform-clients"
```

`JWT_ACCESS_SECRET` is required in every environment and must contain at least
32 characters. The dashboard keeps access tokens in memory and uses an
`HttpOnly`, `SameSite=Strict` cookie for refresh sessions.

Prepare the database:

```bash
pnpm prisma generate
pnpm prisma migrate deploy
```

### Start the applications

Run each command in a separate terminal:

```bash
# API - http://localhost:3000
pnpm start:dev

# Dashboard - http://localhost:5173
pnpm --filter dashboard dev

# Handheld simulator - http://localhost:5174
pnpm --filter handheld-simulator dev
```

Swagger is available at `http://localhost:3000/api/docs`. Use
`POST /bootstrap/admin` with `BOOTSTRAP_ADMIN_SECRET` to create the first
administrator, then sign in at `http://localhost:5173/login`.

### Verify the workspace

```bash
pnpm test
pnpm test:e2e
pnpm build
```

</details>

## Repository map

```text
logistics-operations-platform/
|-- apps/
|   |-- backend/              NestJS API and Prisma schema
|   |-- dashboard/            React operations dashboard
|   |-- handheld-simulator/   Browser scanner simulator
|   `-- handheld-android/     Native Android handheld
|-- packages/
|   `-- shared-types/         Shared domain and API contracts
|-- infrastructure/docker/    Local PostgreSQL environment
|-- docs/                     Architecture and module documentation
`-- PROJECT_SPEC.md           Master engineering specification
```

## Documentation

- [Master engineering specification](PROJECT_SPEC.md)
- [API reference](docs/04-api/37-api-reference.md)
- [Handheld module](docs/02-modules/handheld-module.md)
- [Android architecture and implementation plan](docs/ANDROID_HANDHELD_ARCHITECTURE_AND_IMPLEMENTATION_PLAN.md)
- [Native Android setup and operator guide](apps/handheld-android/README.md)

## Why I built it

This project demonstrates more than individual framework features. It brings
together domain modeling, event-driven design, transactional consistency,
offline synchronization, customer-facing projections, and multiple client
experiences inside one coherent logistics system.

It is designed to show how a complex business domain can be translated into
software that is auditable, testable, and straightforward to extend.

---

<div align="center">

Built as a hands-on exploration of modern logistics software architecture.

[View the specification](PROJECT_SPEC.md) | [Explore the API](docs/04-api/37-api-reference.md) | [Open an issue](https://github.com/Sukh-sudo/logistics-operations-platform/issues)

</div>
