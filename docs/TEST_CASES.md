# Logistics Operations Platform — Test Case Catalogue

**Version:** 1.0  
**Prepared:** August 26, 2026  
**Purpose:** presentation-ready functional, integration, security, and user-acceptance coverage

## Test data and execution rules

- Run automated backend E2E cases only through `pnpm test:e2e`; it creates a disposable PostgreSQL database.
- Use unique identifiers for create cases. Valid examples are `CON0000002` (package), `CON0800001` (container), `TRLR000001` (trailer), and `LMYYC00001` (last-mile truck).
- A package and container must have matching types: `MAIL`, `CON`, `NCON`, or `DG` prefixes.
- Protected cases require an active user with the stated permission. Public cases require no token.
- Verify both the HTTP/UI result and the related event/snapshot records where specified.

Status labels: **Automated** means a checked-in test covers the case; **UAT** means the case is suitable for a presentation or release acceptance walkthrough.

## Authentication and authorization

| ID | Scenario and steps | Expected result | Coverage |
| --- | --- | --- | --- |
| AUTH-01 | Submit valid active-user credentials on `/login`. | Dashboard opens; `/auth/me` returns the user snapshot and permissions. | Automated: auth E2E and dashboard auth context |
| AUTH-02 | Submit an incorrect password or inactive user. | Login is rejected with 401; no protected page opens. | Automated: auth service/E2E |
| AUTH-03 | Call a protected operational endpoint without a bearer token. | 401 standard error response. Public health/tracking routes remain accessible. | Automated: `auth.e2e-spec.ts` |
| AUTH-04 | Let an access token expire and issue concurrent dashboard requests. | One cookie-based refresh rotates the session; queued requests retry with the new access token. | Automated: API client and auth tests |
| AUTH-05 | Replay a previously rotated refresh token. | Token-family reuse is detected; successor sessions are invalidated. | Automated: auth E2E |
| AUTH-06 | Call a route without its required permission. | 403 response; administrator/system-admin access remains valid. | Automated: authorization guard and notification authorization tests |
| AUTH-07 | Revoke an enrolled handheld while its session is active. | Device access and refresh sessions become invalid. | Automated: auth and handheld-device E2E |

## Freight operations

| ID | Scenario and steps | Expected result | Coverage |
| --- | --- | --- | --- |
| PKG-01 | Record `PACKAGE_RECEIVED` for a new valid package at an active terminal. | Package aggregate, event, snapshot, projection-outbox row, and terminal count/event are created. | Automated: package service/E2E |
| PKG-02 | Make a non-received event the first event, or submit lowercase/invalid tracking data. | 400 rejection; no package state is created. | Automated: package E2E and identifier tests |
| PKG-03 | Progress a package through its supported lifecycle to delivery. | Each transition appends history and changes the snapshot to the correct current status. | Automated: package E2E |
| PKG-04 | Attempt an invalid transition such as delivered back to in-transit. | Request is rejected; existing event history and snapshot remain unchanged. | Automated: package service/E2E |
| CON-01 | Create a container at an active terminal. | Container aggregate, `CONTAINER_CREATED` event, open snapshot, and terminal count are created. | Automated: container E2E |
| CON-02 | Create a duplicate or malformed container. | 409 for duplicate or 400 for invalid format; no duplicate snapshot. | Automated: container E2E |
| CON-03 | Load a matching-type package into an open container. | Package/container events, both snapshots, package count, and active containment history update atomically. | Automated: container service/E2E |
| CON-04 | Load a mismatched package type or load the same package twice. | Operation is rejected and no partial relationship is stored. | Automated: container E2E |
| CON-05 | Unload a package from its container. | History receives `unloadedAt`; package returns to the appropriate status/location; container count decrements. | Automated: container E2E |
| TRL-01 | Create a valid trailer at an active terminal. | Trailer aggregate, event, open snapshot, and terminal count are created. | Automated: trailer E2E |
| TRL-02 | Load and unload a closed container from a trailer. | Trailer/container events, snapshots, counts, and `ContainerTrailerHistory` update atomically. | Automated: trailer E2E |
| TRL-03 | Load/unload a loose package. | Package/trailer events and `PackageTrailerHistory` match the trailer manifest. | Automated: trailer service, dashboard/detail tests |
| TRL-04 | Load an already assigned container or unload unrelated freight. | 409 rejection with no count or history corruption. | Automated: trailer E2E |

## Terminal, transportation, fleet, and shipment workflows

| ID | Scenario and steps | Expected result | Coverage |
| --- | --- | --- | --- |
| TERM-01 | Create, update, list, and open a terminal. | Stable terminal record, event timeline, and current terminal snapshot are returned. | Automated: terminal E2E |
| TERM-02 | Transfer a package between active terminals. | Source/destination events share a correlation ID; ownership and both terminal counts update. | Automated: terminal E2E |
| TERM-03 | Transfer a trailer containing containers/packages. | Trailer and all carried freight move together in one transaction. | Automated: terminal E2E |
| TERM-04 | Process freight at a closed terminal. | Operation is rejected; inventory is unchanged. | Automated: terminal E2E |
| ROUTE-01 | Create a route, add ordered stops, activate it, and retrieve details. | Route events/snapshot reflect origin, destination, stop order, distance, duration, and active state. | Automated: route E2E |
| ROUTE-02 | Add duplicate stops or modify a retired route. | Invalid operation is rejected; stop sequence/current snapshot remain valid. | Automated: route E2E |
| FLEET-01 | Create truck and driver at a terminal. | Fleet events and current truck/driver snapshots show availability at that terminal. | Automated: fleet E2E |
| FLEET-02 | Assign a truck, driver, and trailer at the route origin to a created trip. | Active immutable assignment is created; resources become assigned. | Automated: fleet E2E |
| TRIP-01 | Start an assigned trip, arrive/depart stops in sequence, then complete it. | Trip/fleet/freight events and snapshots advance; resources and freight arrive at the destination; assignment releases. | Automated: trip and fleet E2E |
| TRIP-02 | Depart a stop before arrival, skip a stop, or start without equipment. | 409 rejection; trip progress remains unchanged. | Automated: trip service/E2E |
| SHIP-01 | Create a shipment with existing unassigned packages. | Shipment, membership rows, creation event, and progress snapshot are created. | Automated: shipment E2E |
| SHIP-02 | Move member packages through transit and delivery. | Shipment status/progress, public tracking, notification, and report data update from package events. | Automated: customer-features E2E |
| SHIP-03 | Complete a shipment before all packages are delivered. | Completion is rejected; shipment remains active. | Automated: shipment E2E |

## Dashboard, search, reporting, and recovery

| ID | Scenario and steps | Expected result | Coverage |
| --- | --- | --- | --- |
| UI-01 | Open Dashboard and apply date, terminal, package-status, and trailer-status filters. | Summary cards, events, and KPI requests use the same selected filters. | Automated: dashboard backend/frontend integration |
| UI-02 | Open package, container, trailer, terminal, route, trip, shipment, truck, and driver details. | Loading/error states resolve to snapshot-based details and available event timelines. | Automated: page integration tests |
| UI-03 | Search exact package, container, and trailer identifiers; then search an unknown value. | Correct type-specific result/link is shown; unknown identifier produces a not-found state. | Automated: search E2E/frontend integration |
| UI-04 | Run a delivery report with date and terminal-lane filters. | Totals, status breakdown, and rows match filtered shipment snapshots; impossible dates are rejected. | Automated: reporting and customer-features tests |
| UI-05 | Track a shipment from the public tracking page. | Only customer-safe progress, packages, terminals, and milestone data appear. | Automated: tracking service/E2E/frontend |
| REC-01 | Retry failed package projections. | Eligible outbox items are claimed idempotently and shipment projection state becomes current. | Automated: package service tests; UAT via Operations page |
| REC-02 | Rebuild package/container/trailer snapshots after recording their expected values. | Rebuilt snapshots match the event/relationship-derived state. | Automated: snapshot-rebuild tests; UAT via Operations page |

## Handheld workflows

| ID | Scenario and steps | Expected result | Coverage |
| --- | --- | --- | --- |
| HH-01 | Enroll a device and sign in with matching badge, employee number, device ID, and credential. | Tokens and bootstrap return authorized tasks, terminal, and active sessions. | Automated: handheld/auth E2E and Android repository tests |
| HH-02 | Start a task, set trailer or route/truck context, and scan valid freight online. | Command receipt, domain event, snapshot, and accepted result are stored; operator receives success feedback. | Automated: handheld E2E/simulator/Android tests |
| HH-03 | Capture a valid scan offline and reconnect. | Command is persisted before feedback, syncs in capture order, and receives the server's authoritative result. | Automated: simulator and Android repository tests |
| HH-04 | Submit the same `clientEventId` twice. | Second request is duplicate-accepted without duplicating the business event; duplicate count increases. | Automated: handheld service/E2E |
| HH-05 | Reverse an accepted reversible command. | A compensating receipt/event is created and the original is marked reversed; no history is deleted. | Automated: handheld E2E/service tests |
| HH-06 | Attempt to complete a session with pending commands. | Client blocks completion until synchronization; server state remains active. | Automated: simulator/Android repository tests |

## Manual release acceptance checklist

- [ ] Start with an empty disposable database and apply all migrations.
- [ ] Create or seed an administrator and sign in through the dashboard.
- [ ] Complete one terminal-to-terminal package journey, including container/trailer handling.
- [ ] Execute one fully assigned trip and confirm freight at its destination.
- [ ] Deliver a shipment and verify dashboard, tracking, notification, and report views.
- [ ] Perform one offline handheld capture, reconnect, synchronize, and reverse it.
- [ ] Confirm protected routes reject an anonymous and under-permissioned caller.
- [ ] Confirm health/readiness and request/correlation IDs are visible.
- [ ] Confirm no unresolved projection rows or pending handheld commands remain.
