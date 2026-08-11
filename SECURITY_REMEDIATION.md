# Security remediation register

Last reviewed: 2026-08-11

This register records high-priority findings from the defensive repository
review. It intentionally describes remediation status without publishing
exploit instructions or production secrets.

## High-priority findings

| Finding | Status | Resolution or next decision |
| --- | --- | --- |
| Operational APIs lacked function-level authorization | Remediated | JWT and permission guards now run globally in a defined order. Every non-public route must declare permissions or explicitly opt into authenticated self-service access. Security regression tests verify low-privilege 403 responses. |
| Handheld badge plus employee-number login was not strong authentication | Contained; design decision pending | The legacy portfolio login now fails closed in production. Choose employee PIN/password for the smaller change, or managed-device enrollment for stronger scanner identity and revocation. |
| Administrator bootstrap secret could provision multiple administrators | Remediated | Bootstrap now succeeds only on an empty user store, compares the secret in constant time, and uses a serializable Prisma transaction to prevent concurrent initial administrators. Remove `BOOTSTRAP_ADMIN_SECRET` after provisioning. |
| Android release builds allowed cleartext API traffic | Remediated | Cleartext is disabled in the main manifest and enabled only by the debug manifest. Release builds use an HTTPS endpoint supplied with `handheldApiBaseUrl`. |
| Production dependency advisories | Remediated | Direct packages and narrowly scoped transitive overrides were upgraded. `pnpm audit --prod` reports no known vulnerabilities. Keep the audit as a required CI check. |
| Notification history and resend operations lacked an authorization boundary | Remediated conservatively | Notification operations currently require `system.admin`. Define a narrower notification permission or recipient-ownership policy before granting non-admin access. |

## Authorization architecture follow-up

The current catalog has granular permissions for packages, containers,
trailers, terminals, users, and roles. Modules without an established policy
(dashboard, fleet, notifications, reporting, routes, search, shipments, trips,
metrics, and snapshot recovery) now require `system.admin`.

Before enabling those modules for operational roles, document a permission
matrix and add each permission through the existing role, identity-event, and
user-snapshot flows. Do not bypass snapshot permissions with controller-local
role guesses or business validation.

## Verification expectations

- Run `pnpm audit --prod` and fail CI on high or critical advisories.
- Run backend authorization integration tests for every new controller.
- Build and lint both Android debug and release variants.
- Perform deployment-level TLS, secrets, container, cloud IAM, and dynamic API
  testing before describing a release as production-ready.
