# API Conventions

## API Style

REST-first architecture.

## Endpoint Rules

Use plural resources.

GOOD:
- /packages
- /trailers
- /employees

BAD:
- /getPackage
- /processTrailer

## Response Standards

Responses should:
- be strongly typed
- use DTOs
- avoid leaking DB entities

## Error Handling

Use consistent HTTP status codes.

Examples:
- 200 OK
- 201 Created
- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found
- 500 Internal Server Error

## Validation

All incoming requests must:
- validate DTOs
- validate permissions
- validate workflow state transitions