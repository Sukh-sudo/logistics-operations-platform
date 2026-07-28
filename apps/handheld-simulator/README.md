# Handheld simulator

The handheld simulator is a browser implementation of the operational client
described in `docs/ANDROID_HANDHELD_ARCHITECTURE_AND_IMPLEMENTATION_PLAN.md`.
It exercises the real `/api/mobile/v1` backend boundary and is intended for
portfolio demos and workflow testing. It does not replace the separately
planned native Android client.

## Run locally

Start PostgreSQL and the backend, then run:

```bash
pnpm --filter handheld-simulator dev
```

Open `http://localhost:5174`. Vite proxies `/api` to
`http://localhost:3000`, so the default backend CORS configuration does not
need a simulator-specific exception.

To target another deployment:

```text
VITE_API_BASE_URL=https://example.test/api/mobile/v1
```

## Implemented workflows

- Badge and employee-number authentication with permanent-terminal bootstrap.
- Authorized task home screen and resumable server task sessions.
- Trailer load/unload and container load/unload.
- Paired package-to-container capture and closed-container-to-trailer capture.
- Last-mile route and truck loading.
- Courier status capture with best-effort browser GPS.
- Persistent installation ID, operational context, credentials, and local
  outbox.
- Ordered batch synchronization, partial accepted/rejected results, duplicate
  outcomes, local rejection dismissal, and compensating reversal requests.
- Online/offline simulation, continuous manual scan entry, audio/vibration
  feedback, package snapshot lookup, and eight-hour resolved-history retention.

The backend remains authoritative. The client performs only required-field
checks and never derives package, container, trailer, or route business state.

## Tests

```bash
pnpm --filter handheld-simulator test
pnpm --filter handheld-simulator build
```

Unit tests cover workflow authorization and outbox retention/result mapping.
Integration tests cover an accepted online trailer load and durable offline
capture.
