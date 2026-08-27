# Logistics Operations Platform — Validation Report

**Validation date:** August 26, 2026  
**Overall result:** **Conditional pass**  
**Reason:** all functional tests and builds passed, but the pinned pnpm 11.2.2 toolchain has published high-severity advisories and should be upgraded before release.

## Scope and environment

Validated areas: backend unit/integration behavior, dashboard components/pages, handheld simulator, PostgreSQL migrations and E2E workflows, Android unit tests/debug build, production dependency audit, and TypeScript/production builds.

| Component | Environment |
| --- | --- |
| Operating system | Windows / PowerShell |
| Node.js | 24.14.1 |
| Repository package manager | pnpm 11.2.2 through Corepack |
| Machine-global pnpm | 9.15.9; not compatible with the repository's multi-document pnpm 11 lockfile |
| Docker | 29.3.1 |
| E2E database | Disposable PostgreSQL 16 on port 55433 |
| Android Java | OpenJDK 17.0.20 LTS |

## Executed validation results

| Validation | Command | Result | Evidence |
| --- | --- | --- | --- |
| Fresh workspace tests | `pnpm exec turbo run test --force` | **PASS** | 73 test files/suites; 218 tests passed; zero failures; cache bypassed |
| Backend tests | Included above | **PASS** | 30 suites; 133 tests |
| Dashboard tests | Included above | **PASS** | 37 files; 65 tests |
| Handheld simulator tests | Included above | **PASS** | 6 files; 20 tests |
| PostgreSQL E2E | `pnpm test:e2e` | **PASS** | 15 suites; 86 tests; zero failures |
| Database migrations | E2E setup: `prisma migrate deploy` | **PASS** | All 26 checked-in migrations applied to an empty PostgreSQL 16 database |
| Fresh pnpm builds | `pnpm exec turbo run build --force` | **PASS with warning** | Shared types, backend, dashboard, and simulator built; cache bypassed |
| Android unit tests | `gradlew testDebugUnitTest --rerun-tasks` | **PASS with warnings** | 4 result files; 7 tests; zero failures/errors/skips |
| Android debug APK | `gradlew testDebugUnitTest assembleDebug` | **PASS** | `app-debug.apk` generated; 48,837,329 bytes |
| Production dependency audit | `corepack pnpm audit --prod --audit-level=moderate` | **FAIL** | 14 findings: 8 high, 6 moderate; all reported through pinned `packageManagerDependencies>pnpm` |

**Total automated tests passed during this validation: 311.**

The E2E runner created an isolated database, applied migrations, ran the suite, and removed the test container and network after completion. It did not reset or clean the development database.

## Functional coverage confirmed

- Authentication, web refresh cookies, token rotation/reuse detection, logout, device enrollment/revocation, and permission enforcement.
- Package, container, trailer, terminal, route, trip, fleet, shipment, tracking, notification, dashboard, report, and search workflows.
- Event creation, snapshot updates, relationship history, cross-domain transaction behavior, projection retry, and snapshot rebuild.
- Dashboard routing, filters, API-client refresh behavior, detail pages, loading/error states, operations commands, public tracking, and reporting.
- Simulator login/enrollment, online and offline capture, validation, ordered synchronization, session selection, and outbox retention.
- Android auth/work repositories, workflow catalogue, Room persistence, offline command behavior, and debug compilation.

The detailed scenario matrix is in [TEST_CASES.md](TEST_CASES.md).

## Findings and recommendations

### VAL-01 — Pinned pnpm security advisories

**Severity:** High  
**Status:** Open

The production audit reported 14 advisories against pnpm 11.2.2: eight high and six moderate. They concern package-manager path traversal, lifecycle/manifest identity, lockfile/config dependency handling, credential binding, integrity, and argument injection. The highest required patched version across the findings is pnpm 11.8.0.

**Recommendation:** update `packageManager`, the lockfile's package-manager dependency, and developer/CI bootstrap to a reviewed pnpm version at or above 11.8.0; regenerate the lockfile; rerun clean install, audit, tests, and builds.

**Important toolchain note:** invoking the machine-global pnpm 9.15.9 reports the pnpm 11 lockfile as broken because it does not understand the newer multi-document format. Use `corepack pnpm` or activate the version declared in `package.json`.

### VAL-02 — Dashboard bundle size

**Severity:** Medium  
**Status:** Open, non-blocking

The dashboard build succeeded, but Vite reported a 907.52 kB minified main JavaScript chunk (263.05 kB gzip), above its 500 kB warning threshold.

**Recommendation:** add route-level lazy loading and separate large vendor/chart modules with dynamic imports or manual chunks.

### VAL-03 — Android deprecations

**Severity:** Medium  
**Status:** Open, non-blocking

Fresh Android compilation succeeded but warned about deprecated `EncryptedSharedPreferences`, `MasterKey`, an icon/lifecycle import, and future Kotlin annotation-target behavior.

**Recommendation:** plan a credential-storage migration supported by current Android guidance, replace deprecated imports, and make annotation targets explicit before upgrading Kotlin/AndroidX.

### VAL-04 — Error log status accuracy

**Severity:** Low  
**Status:** Open

During the passing duplicate-trailer negative E2E test, request logging recorded the underlying Prisma exception as status 500 before the exception filter translated the HTTP response. Functional behavior passed, but operational logs can overcount 500 errors for handled database conflicts.

**Recommendation:** record the final response status after exception-filter translation or normalize known Prisma errors in the logging interceptor.

