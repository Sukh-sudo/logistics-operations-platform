# Native Android handheld

This application is the phone-native client for the logistics handheld API. It
implements the architecture in
[`docs/ANDROID_HANDHELD_ARCHITECTURE_AND_IMPLEMENTATION_PLAN.md`](../../docs/ANDROID_HANDHELD_ARCHITECTURE_AND_IMPLEMENTATION_PLAN.md).

## Implemented workflows

- Online badge and employee-number login with Android Keystore-backed token
  encryption and cached bootstrap context for an authenticated offline shift.
- Authorized trailer load/unload, container load/unload, last-mile loading, and
  courier delivery task sessions.
- CameraX and ML Kit barcode capture behind a scanner interface, continuous
  scanning, and manual entry fallback.
- Room-backed session snapshots, package lookup cache, and durable command
  outbox.
- Ordered WorkManager synchronization with accepted, pending, rejected,
  duplicate, reversed, and dismissed states.
- Best-effort GPS for courier actions, connectivity state, audible/vibration
  feedback, package lookup, reversals, and session controls.

The app never decides authoritative package, container, trailer, or route
state. It persists the operator command locally first and submits it to the
mobile API, whose Prisma transactions create business events and update
snapshots.

## Prerequisites

- JDK 17
- Android SDK platform 36
- Android SDK Build Tools 36
- An Android 6.0 (API 23) or newer emulator/device

## Configure the API

The debug default is `http://10.0.2.2:3000/api/mobile/v1/`, which reaches a
backend running on the emulator host. Override it for a physical device:

```powershell
.\gradlew.bat assembleDebug -PhandheldApiBaseUrl="http://192.168.1.20:3000/api/mobile/v1/"
```

The URL must end in `/`. Cleartext HTTP is enabled for local portfolio demos;
use HTTPS and a network security configuration for production deployment.

## Build and test

From `apps/handheld-android`:

```powershell
.\gradlew.bat testDebugUnitTest assembleDebug
.\gradlew.bat connectedDebugAndroidTest
```

`connectedDebugAndroidTest` requires a running emulator or connected device.
Room schema exports are written to `app/schemas` and must be reviewed whenever
the local database version changes.

## Operator walkthrough

1. Start the backend and sign in by scanning a badge and entering the employee
   number.
2. Select an authorized task. New sessions require connectivity; an existing
   authenticated session can be resumed offline.
3. Establish the trailer or route/truck context shown on the work screen.
4. Choose an action and scan. Paired container workflows scan the package and
   then its container.
5. Continue scanning; every command is saved to Room before transport.
6. Open History to see pending or server-resolved results, retry sync, dismiss
   rejected items, or create a compensating reversal.
7. Synchronize pending work before completing a task session.

The app requests camera permission when scanning and fine-location permission
for courier actions. A declined GPS request does not block capture; the server
records the applicable GPS exception flag.

## API model note

The repository does not currently publish a checked-in mobile OpenAPI
generation task, so the client DTOs are versioned manually against
`/api/mobile/v1`. When contract generation is added, replace those DTOs with
generated models and add schema-drift verification in CI.
