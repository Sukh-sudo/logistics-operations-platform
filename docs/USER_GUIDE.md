# Logistics Operations Platform — User Guide

**Audience:** administrators, operations managers, dispatchers, terminal staff, handheld operators, and presentation users

## 1. Application access

| Experience | Default local address | Intended user |
| --- | --- | --- |
| Operations dashboard | `http://localhost:5173` | Administrators and operations staff |
| Customer tracking | `http://localhost:5173/tracking` | Customer/public user |
| Handheld simulator | `http://localhost:5174` | Demonstration and workflow testing |
| Backend API/Swagger | `http://localhost:3000/api/docs` | Administrators and developers |
| Native Android app | Emulator or managed device | Warehouse and courier operators |

Dashboard access depends on the authenticated user's permissions. Tracking and health pages are public. The handheld clients require an enrolled device and an active employee with a badge, primary terminal, and authorized role.

## 2. Local startup

Prerequisites are Node.js, Corepack/pnpm 11, Docker, and PostgreSQL through the supplied Compose file.

```powershell
corepack enable
corepack pnpm install
corepack pnpm setup:env
docker compose -f infrastructure/docker/docker-compose.yml up -d
corepack pnpm prisma generate
corepack pnpm prisma migrate deploy
```

Start each application in a separate terminal:

```powershell
corepack pnpm start:dev
corepack pnpm --filter dashboard dev
corepack pnpm --filter handheld-simulator dev
```

For a presentation dataset, use the guarded demo workflow described in the root README. It creates realistic operational data and a local-only default administrator:

```powershell
corepack pnpm prisma migrate reset --force --skip-seed
corepack pnpm demo:seed -- --count=10000
corepack pnpm demo:verify
```

The default demo credentials are `demo.admin@logistics.local` / `DemoAdmin!2026` unless `DEMO_ADMIN_PASSWORD` is set. Never reuse these credentials outside an isolated local demonstration. The reset command is destructive and must target only the local `logistics_platform` database.

Without demo data, create the first administrator through `POST /bootstrap/admin` in Swagger. Supply the `BOOTSTRAP_ADMIN_SECRET` from the local environment, an employee number, name, email, and a password of at least 12 characters. Bootstrap works only when no user exists.

## 3. Sign in and navigation

1. Open `/login`.
2. Enter the administrator or operator email and password.
3. After authentication, the Home page displays workspaces available through the main navigation.
4. Use **Sign out** when finished. The dashboard keeps the short-lived access token in memory and the refresh session in an HttpOnly cookie.

Main workspaces:

- **Dashboard:** current counts, recent activity, terminal/date/status filters, and handheld KPIs.
- **Packages / Containers / Trailers:** filterable snapshot lists and detailed history pages.
- **Transportation:** terminal, route, trip, and shipment read views.
- **Fleet:** truck, driver, and assignment views.
- **Operations:** forms for transactional business commands.
- **Search:** exact package, container, or trailer identifier lookup.
- **Events:** combined package/container/trailer activity timeline.
- **Analytics:** charts derived from current dashboard snapshots.
- **Reports:** shipment delivery totals and filtered detail.
- **Tracking:** public customer shipment progress.
- **Health:** database, Kafka, and process status.

## 4. Reading operational data

### Dashboard and lists

Use the filter bar to narrow data by date, terminal, status, or shipment lane. Filters are sent to backend snapshot queries; clearing a filter reloads the complete permitted view. Select an identifier in a list to open its detail page.

### Detail pages

A detail page separates:

- **Current snapshot:** latest status, terminal, containment, counts, or progress.
- **Relationships:** current packages, containers, trailer contents, stops, or assignments.
- **Timeline:** immutable events in operational order where the module exposes history.

For a package, the location view checks whether it is loose in a trailer or nested inside a container that may itself be in a trailer.

### Search

Enter the exact identifier. Supported examples are:

- Package/container: `MAIL` + 6 digits, `CON` + 7 digits, `NCON` + 6 digits, or `DG` + 8 digits.
- Trailer: `TRLR` + 6 digits.

Search normalizes the value and checks package, container, then trailer snapshots. A missing asset returns a not-found view rather than a partial match.

## 5. Performing operational work

Open **Operations**. A successful command invalidates cached dashboard queries so later reads show the committed state.

### Receive and progress a package

1. Under **Package event**, enter a new valid tracking number.
2. Select `PACKAGE_RECEIVED` and its active terminal.
3. Submit the event. A package's first event must be received.
4. Record later supported events such as sorted, departed, arrived, out for delivery, and delivered.

The backend rejects unsupported status transitions and terminal-ownership mismatches.

### Create and load a container

1. Under **Create handling asset**, select Container, enter its barcode, and owning terminal.
2. Under **Container freight**, provide the container aggregate ID and package tracking number.
3. Load or unload the package.

Package and container identifier prefixes must represent the same freight type. Close a container through the API/handheld workflow before loading it into a trailer.

### Create and load a trailer

1. Create the trailer at its owning terminal.
2. Under **Trailer freight**, provide the trailer aggregate ID.
3. Select container or loose package, choose load/unload, and enter the freight identifier.

The item and trailer must be operationally compatible and at the same terminal. Counts and containment history update only after the transaction succeeds.

### Transfer an asset between terminals

1. Select origin and destination terminals.
2. Select Package, Container, or Trailer.
3. Enter the operational identifier and submit.

Transferring a trailer moves its contained containers and packages atomically. Closed terminals cannot send or receive operational assets.

### Create and execute transportation

Administrative creation is currently performed through Swagger/API:

1. Create origin/destination terminals.
2. Create a route, add any intermediate stops, and activate the route.
3. Create a trip from the active route with an ISO-8601 planned departure.
4. Create a truck and driver at the route origin; ensure an available trailer is also there.

Then use **Operations**:

5. Assign the trip, truck, driver, and trailer under **Fleet assignment**.
6. Start the trip.
7. Arrive at and depart each trip stop in sequence using the stop IDs shown on the trip detail page.
8. Complete the trip after all stops have departed.

Trip start moves the assigned fleet and trailer freight into transit. Completion arrives them at the destination and releases the equipment assignment.

### Create and manage a shipment

1. Ensure all package tracking numbers already exist and do not belong to another shipment.
2. Under **Create shipment**, provide shipment number, origin, destination, package numbers, and optional customer reference/notification email.
3. Use **Update shipment** to change the reference or assign/remove a package.
4. Move packages through their normal lifecycle. Shipment progress updates from package events.
5. Complete only after all packages are delivered, or cancel if appropriate.

Use `/tracking/<shipment-number>` to show the public progress projection. Use **Reports** to filter deliveries by dates and terminal lane.

## 6. Handheld simulator guide

### Enroll the simulator

1. Open the simulator and copy its displayed Device ID.
2. In Swagger, authenticate as an administrator and call `POST /handheld-devices` with that UUID, a display name, and platform `SIMULATOR`.
3. Copy the one-time returned credential into the simulator enrollment screen. Store it securely; the backend stores only its hash.
4. Ensure the employee has a badge barcode, employee number, active status, primary terminal, and a role that authorizes the task.

### Perform work

1. Sign in with badge and employee number.
2. Select an authorized task: trailer load/unload, container load/unload, last-mile loading, or courier delivery.
3. Enter/scan the required trailer or route/truck context.
4. Select the action and scan the package/container.
5. Check **History** for accepted, pending, rejected, duplicate, or reversed results.

Use the connectivity button to demonstrate offline mode. Offline commands remain in the local outbox. Reconnect and select **Sync** to send them in capture order. Resolve or dismiss rejected items, and synchronize all pending items before completing the task or signing out.

The simulator stores credentials/tokens in browser storage for demonstration and is not the secure production handheld client.

## 7. Native Android guide

1. Install the debug APK on an emulator/device or configure a release build with the deployed HTTPS mobile API URL.
2. Give the displayed Device ID to an administrator for enrollment with platform `ANDROID`.
3. Save the one-time credential, then sign in with badge and employee number.
4. Grant camera permission for barcode scanning. Location permission is optional and used for courier events.
5. Select a task and scan continuously. Each command is written to Room before network transport.
6. Open History to synchronize, review results, dismiss rejected work, or issue a compensating reversal.

New sessions and session controls require connectivity; an authenticated open session can continue capturing work offline. WorkManager synchronizes when connectivity returns. Complete the session only after pending commands are resolved.

## 8. Administration and recovery

Swagger currently provides administrative routes not exposed as dashboard forms, including users, roles, permissions, terminals, routes, trips, trucks, drivers, and handheld devices.

- Activate users and assign their terminal/roles before operational use.
- Revoke a lost handheld device immediately; this invalidates its sessions.
- Use **Retry pending projections** after diagnosing package-to-shipment projection lag.
- Use **Rebuild snapshots** only after diagnosis and preferably during a controlled maintenance window. It rebuilds package, container, and trailer snapshots in one transaction.
- Use `/health/ready` for readiness and the protected `/metrics` route for request/business metrics.

## 9. Troubleshooting

| Problem | Resolution |
| --- | --- |
| Login returns 401 | Confirm email/password, active user snapshot, and that the account was not invalidated by refresh-token reuse or password change. |
| Page returns 403 | The user is authenticated but lacks the route's required permission. Assign the correct role/permission. |
| Package transition rejected | Review current snapshot/history; the requested event is not valid from the current status or terminal. |
| Container load rejected | Confirm container is open, package is not already contained, types match, and both belong to the same terminal. |
| Trip cannot start | Confirm route is active and truck, driver, trailer, and assignment are active at the route origin. |
| Handheld cannot sign in | Confirm network, employee badge/terminal/task role, device ID, enrollment credential, and non-revoked device status. |
| Offline work does not sync | Reconnect, open History, retry Sync, and correct any item marked action required. Do not clear browser/app storage while work is pending. |
| Kafka health is degraded | Core database workflows remain available; start/configure the optional broker if event streaming is required. |
| pnpm reports a broken lockfile | Use `corepack pnpm` (the repository's pnpm 11 format), not the machine-global pnpm 9 client. |

See [ARCHITECTURE_REPORT.md](ARCHITECTURE_REPORT.md) for system structure, [TEST_CASES.md](TEST_CASES.md) for acceptance scenarios, and [VALIDATION_REPORT.md](VALIDATION_REPORT.md) for the latest verified results.
