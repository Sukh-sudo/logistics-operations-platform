# Security remediation register

Last reviewed: 2026-08-11

This register records high-priority findings from the defensive repository
review. It intentionally describes remediation status without publishing
exploit instructions or production secrets.

## High-priority findings

| Finding | Status | Resolution or next decision |
| --- | --- | --- |
| Operational APIs lacked function-level authorization | Remediated | JWT and permission guards now run globally in a defined order. Every non-public route must declare permissions or explicitly opt into authenticated self-service access. Security regression tests verify low-privilege 403 responses. |
| Handheld badge plus employee-number login was not strong authentication | Remediated with managed-device proof | Administrators issue a one-time credential for a specific installation ID. The server stores only its hash, Android encrypts it with a Keystore-backed key, device-bound JWT/refresh sessions are independently revocable, and employee login criteria remain badge plus employee number. |
| Administrator bootstrap secret could provision multiple administrators | Remediated | Bootstrap now succeeds only on an empty user store, compares the secret in constant time, and uses a serializable Prisma transaction to prevent concurrent initial administrators. Remove `BOOTSTRAP_ADMIN_SECRET` after provisioning. |
| Android release builds allowed cleartext API traffic | Remediated | Cleartext is disabled in the main manifest and enabled only by the debug manifest. Release builds use an HTTPS endpoint supplied with `handheldApiBaseUrl`. |
| Production dependency advisories | Remediated | Direct packages and narrowly scoped transitive overrides were upgraded. `pnpm audit --prod` reports no known vulnerabilities. Keep the audit as a required CI check. |
| Notification history and resend operations lacked object authorization | Remediated | Authenticated recipients are scoped to notifications whose normalized recipient email matches their current account. Cross-recipient object access returns 404, cross-recipient collection filters return 403, and `system.admin` retains audited management access. Read/resend events record the acting user. |

## Authorization architecture follow-up

The current catalog has granular permissions for packages, containers,
trailers, terminals, users, and roles. Modules without an established policy
(dashboard, fleet, reporting, routes, search, shipments, trips,
metrics, and snapshot recovery) now require `system.admin`.

Before enabling those modules for operational roles, document a permission
matrix and add each permission through the existing role, identity-event, and
user-snapshot flows. Do not bypass snapshot permissions with controller-local
role guesses or business validation.

## Handheld enrollment operations

- Restrict `POST /handheld-devices`, `GET /handheld-devices`, and
  `POST /handheld-devices/:id/revoke` to `system.admin`.
- Transfer the returned enrollment credential to the intended device once; it
  cannot be retrieved from the API later.
- Revoke a lost device immediately. Revocation invalidates its access token at
  the next API request and revokes all device-bound refresh tokens.
- Browser simulator credential storage is for development only. Production
  Android installations use Keystore-backed encrypted preferences and should
  ultimately be distributed and controlled through MDM.

## Verification expectations

- Run `pnpm audit --prod` and fail CI on high or critical advisories.
- Run backend authorization integration tests for every new controller.
- Build and lint both Android debug and release variants.
- Perform deployment-level TLS, secrets, container, cloud IAM, and dynamic API
  testing before describing a release as production-ready.
