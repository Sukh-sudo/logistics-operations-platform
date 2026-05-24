# Coding Standards

## General Rules

- Prefer readability over clever abstractions
- Keep controllers thin
- Keep business logic in services
- Use explicit naming
- Avoid hidden side effects
- Favor composition over inheritance

## TypeScript Rules

- Use strict typing
- Avoid any
- Prefer interfaces for contracts
- Use enums carefully
- Prefer DTOs over raw objects

## Database Rules

- Repositories only access DB
- No cross-module repository access
- Use transactions intentionally
- Avoid leaking ORM models

## Event Rules

- Events are immutable
- Events represent business occurrences
- Events must support auditability

## Testing Rules

Prioritize:
- service tests
- workflow tests
- integration tests

Focus heavily on:
- lifecycle transitions
- RBAC
- operational correctness