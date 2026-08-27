# Logistics Operations Platform — Two-Page Architecture Overview

## Page 1 — Backend structure and module responsibilities

### Overall architecture

The platform is a **modular monolith**: one NestJS backend contains separate business modules, and all modules use one PostgreSQL database through Prisma. The React dashboard, browser handheld simulator, and Android handheld app call the same REST API.

```text
Frontend page / handheld screen
  -> frontend API service
  -> NestJS controller
  -> DTO validation
  -> domain service
  -> Prisma transaction
  -> PostgreSQL events, snapshots, and relationship records
```

The backend starts in `apps/backend/src/main.ts`. It creates the NestJS application from `app.module.ts`, enables CORS, validation, API versioning, response/error envelopes, Swagger, request IDs, authentication, and permissions.

### What the files inside a backend module do

Most modules follow the same structure:

```text
modules/packages/
|-- package.module.ts
|-- controllers/package-events.controller.ts
|-- dto/create-package-event.dto.ts
|-- services/package.service.ts
|-- validators/package-transition.validator.ts
`-- tests/package.service.spec.ts
```

| File type | Responsibility | Example in this project |
| --- | --- | --- |
| `*.module.ts` | Registers controllers, services, dependencies, and exports. | `ContainerModule` imports `PackageModule` because container work changes packages. |
| `controllers/*.controller.ts` | Defines routes, binds request data, applies access rules, and calls a service. | A package GET route delegates to `PackageService.getPackage`. |
| `dto/*.dto.ts` | Runtime-validates incoming request bodies and query parameters. | `CreatePackageEventDto` validates tracking, event, terminal, and employee values. |
| `services/*.service.ts` | Owns business rules, queries, and transactions; writes events, snapshots, and relationships. | `TripService.startTrip` coordinates the trip, fleet, terminal, and freight. |
| `interfaces/*.interface.ts` | Describes internal TypeScript shapes; unlike DTOs, interfaces do not validate runtime input. | `AuthenticatedRequest` adds user and request IDs to Express. |
| `validators/*.validator.ts` | Holds reusable domain rules. | `PackageTransitionValidator` rejects invalid lifecycle changes. |
| `guards/*.guard.ts` | Allows or rejects a request before the controller. | JWT and permission guards verify identity and access. |
| `decorators/*.decorator.ts` | Adds route metadata used by guards. | `@Public()`, `@Permissions(...)`, `@AllowAuthenticated()`. |
| `tests/*.spec.ts` | Tests rules and infrastructure. | Service tests cover transitions and transactions. |

### What each business module owns

| Module | Main responsibility and data relationships |
| --- | --- |
| `packages` | Package lifecycle, immutable `PackageEvent` history, and current `PackageSnapshot`. Package events can update shipment progress and optionally publish to Kafka. |
| `containers` / `trailers` | Creates handling assets and loads/unloads freight. These services update asset and package events/snapshots plus containment history. |
| `terminals` | Terminal details, inventory, transfers, event history, and operational counts. It reads current package/container/trailer ownership from snapshots. |
| `routes` / `trips` / `fleet` | Defines reusable routes, executes time-specific trips, manages trucks/drivers, and retains equipment assignments. Trip execution coordinates all freight and fleet state transactionally. |
| `shipments` / `tracking` / `notifications` | Groups packages into shipments, derives delivery progress, creates in-app notifications, and exposes a restricted public tracking view. |
| `auth` / `authorization` / `users` | Login, JWTs, rotating refresh tokens, password hashing, users, roles, permissions, and terminal assignments. |
| `handheld` | Device enrollment, employee sessions, scan commands, offline synchronization receipts, duplicate detection, and reversals. It delegates accepted scans to package/container/trailer services. |
| `dashboard` / `search` / `reporting` | Read-oriented queries over snapshots and events for KPIs, asset lookup, filters, and delivery reports. |
| `snapshots` | Rebuilds package, container, and trailer read models from event and relationship history. |
| `health` / `observability` | Database/Kafka health, request logging, request/correlation IDs, latency/error metrics, and operational metrics. |

### How data is stored

`apps/backend/prisma/schema.prisma` is the database source of truth. Migrations in `prisma/migrations` create and evolve the PostgreSQL tables.

- Aggregate tables such as `Package`, `Container`, and `Trip` provide stable identity.
- `*Event` tables record what happened and form the audit timeline.
- `*Snapshot` tables store current state for fast frontend reads.
- History tables record changing relationships, such as when a package entered or left a container.

A service normally writes the event, snapshot, and relationship changes in one Prisma transaction. The dashboard therefore does not replay all events to find current state; it reads snapshots and requests event history separately when a timeline is needed.

<div style="page-break-after: always;"></div>

## Page 2 — Frontend structure and how the files connect

### Dashboard construction

The operations dashboard is a React 19 single-page application in `apps/dashboard`.

```text
main.tsx
  -> AppProviders
      -> QueryClientProvider
      -> AuthProvider
  -> App
      -> router.tsx
          -> layout
          -> page
              -> hook or services/*.api.ts
                  -> apiClient.ts
                      -> backend REST endpoint
```

| Frontend area | What it does |
| --- | --- |
| `main.tsx` / `providers.tsx` | Mounts React, TanStack Query, and authentication context. |
| `app/router.tsx` | Maps URLs to pages and separates public, login, and protected routes. |
| `layouts/*.tsx` | Supplies shared navigation and authenticated/public page shells. |
| `pages/*.tsx` | Represents a route, requests data, handles states, and composes components. |
| `services/*.api.ts` | Stores each domain's typed endpoint calls. |
| `services/apiClient.ts` | Adds API URL/auth, unwraps responses, and refreshes expired sessions. |
| `hooks/*.ts` | Wraps reusable TanStack Query requests such as dashboard queries. |
| `features/*` | Domain-specific filters, progress, formatting, and timeline conversion. |
| `components/*` | Reusable tables, filters, timelines, badges, and navigation. |
| `@logistics/shared-types` | Compile-time request/response contracts for the dashboard. |

### Where key pages get their data

| Frontend page | Data connection | Backend/database source |
| --- | --- | --- |
| `DashboardPage` | `useDashboard` -> `dashboardApi` | Counts asset snapshots, merges recent event tables, and calculates handheld KPIs from sessions and command receipts. |
| Package/container/trailer list pages | `dashboardApi` | Read filtered snapshot rows; package and asset lane filters follow shipment relationships. |
| `PackageDetailPage` | `packageApi.snapshot`, `.location`, and `.history` in parallel | Reads the package snapshot, related container/trailer snapshots, and immutable package events. |
| Container/trailer detail pages | `containerApi` / `trailerApi` | Combine the asset snapshot, current freight relationships, and immutable history. |
| `TransportationPage` | `transportationApi` | Loads terminals, routes, trips, and shipments from four backend collection endpoints. |
| `TerminalDetailPage` | `terminalApi` | Combines terminal detail/snapshot, current asset inventory, operational counts, and terminal events. |
| `RouteDetailPage` / `TripDetailPage` | `routeApi` / `tripApi` | Reads route stops and route snapshot, or time-specific trip stops and trip progress snapshot. |
| `ShipmentDetailPage` | `shipmentApi` | Combines shipment snapshot, package membership, terminal information, and shipment events. |
| `FleetPage` | `fleetApi` | Reads trucks, drivers, assignments, and their current snapshots. |
| Search/reports/tracking pages | `searchApi` / `reportingApi` / `trackingApi` | Search reads asset snapshots; reports aggregate shipment snapshots; public tracking returns a restricted shipment projection. |
| `OperationsPage` | Multiple domain API files | Sends commands that create events and update snapshots; after success it invalidates cached queries so screens reload current data. |

### Example: how one screen connects through the system

For the package detail URL `/packages/CON1234567`:

1. `router.tsx` renders `PackageDetailPage.tsx` and the page reads `trackingNumber` from the URL.
2. The page calls snapshot, location, and history functions in `package.api.ts`.
3. `apiClient.ts` adds authentication and calls `PackageEventsController`.
4. The controller calls `PackageService`, which reads `PackageSnapshot`, `PackageEvent`, and related asset snapshots through Prisma.
5. The client unwraps and caches the response; the page renders current state separately from history.

### Handheld frontend connections

The simulator uses `App.tsx` -> screens -> `handheldApi.ts` -> `/api/mobile/v1`, with a demonstration outbox in `localStorage`. Android uses `MainActivity` -> Compose -> `HandheldViewModel` -> repositories. Retrofit calls the API; Room stores sessions/cache/outbox; WorkManager syncs pending commands; Keystore-backed stores protect credentials.

Both handheld clients submit commands; the backend remains authoritative. The server validates the command, stores a unique receipt for duplicate protection, invokes the relevant domain service, and returns an accepted, rejected, duplicate, or reversed result.

### Technology summary

- **Backend:** NestJS, TypeScript, Prisma, PostgreSQL, JWT, Swagger, optional KafkaJS.
- **Dashboard:** React, React Router, TanStack Query, Axios, Tailwind CSS, Recharts, Vite.
- **Simulator:** React, native fetch, Vite, browser storage.
- **Android:** Kotlin, Jetpack Compose, Hilt, Room, WorkManager, Retrofit/OkHttp, CameraX, ML Kit.
- **Testing/build:** Jest, Supertest, Vitest, Testing Library, Android/JUnit, pnpm, Turborepo, Docker Compose.
