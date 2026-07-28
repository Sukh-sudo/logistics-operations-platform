# Handheld module

## Purpose

The handheld module is the mobile workflow boundary for employee and courier
devices. It follows
`docs/ANDROID_HANDHELD_ARCHITECTURE_AND_IMPLEMENTATION_PLAN.md` and delegates
authoritative package, container, and trailer rules to their existing services.

## Implemented server contract

- Badge barcode plus employee-number login and normal JWT issuance.
- Permanent-terminal bootstrap with authorized task categories and thresholds.
- Event-driven task sessions with a rebuildable snapshot and auditable active
  intervals.
- Snapshot-backed package, container, trailer, and route lookups.
- Idempotent single scans and ordered offline batch synchronization.
- Per-command accepted, rejected, duplicate, and reversed results.
- GPS missing and low-accuracy exception flags.
- Compensating reversals for supported load/unload actions.
- Handheld terminal KPI, employee, exception, and unloaded-container queries.

## Transaction boundary

Accepted commands use the existing aggregate service transaction. A transaction
hook appends the `HandheldCommandReceipt`, task-session activity event, and
task-session snapshot update before that transaction commits:

```text
validate clientEventId and task session
  -> existing aggregate service
  -> immutable aggregate event
  -> aggregate snapshot and relationship update
  -> handheld command receipt
  -> task-session event and snapshot
  -> commit
```

Rejected business commands do not create aggregate events. Their durable
receipt is stored separately so an offline client can present an actionable
result. Retrying an accepted `clientEventId` returns `DUPLICATE_ACCEPTED`
without executing the aggregate service again.

## Data ownership

- Domain event tables remain authoritative for package/container/trailer state.
- `HandheldTaskSessionEvent` is authoritative for task-session history.
- `HandheldTaskSessionSnapshot` is the current session read model.
- `HandheldCommandReceipt` is the idempotency and device-accountability record.
- `HandheldTaskInterval` provides reproducible active-time and PPH calculations.

## Operational configuration

- `HANDHELD_INACTIVITY_MINUTES` defaults to `15`.
- `HANDHELD_GPS_ACCURACY_METRES` defaults to `50`.
- Android resolved history retention is eight hours; unresolved outbox work
  must not be purged.

## Browser simulator

`apps/handheld-simulator` is the implemented portfolio and workflow-testing
client for this module. It is a responsive React/Vite application that:

- Authenticates with badge and employee number and caches terminal bootstrap
  context for an already authenticated offline shift.
- Starts, resumes, pauses, and completes server task sessions.
- Presents trailer, container, last-mile, and courier workflows.
- Saves every operational command to a local outbox before attempting network
  delivery.
- Synchronizes queued commands in device-time order and maps durable
  accepted, rejected, duplicate, and reversed results into local history.
- Retains unresolved work indefinitely and purges only resolved history after
  the configured eight-hour window.
- Uses the snapshot lookup endpoints and never derives authoritative aggregate
  state in the browser.

The browser's network control deliberately simulates connectivity loss.
Browser local storage stands in for the Android Room database; it is suitable
for demos but is not presented as secure production device storage.

## Deferred client capabilities

The native Android runtime requires a JDK and Android SDK. CameraX/ML Kit,
Room/WorkManager, Compose screens, encrypted token storage, and device feedback
remain governed by the Android architecture plan and must not move server
business rules into the client.
