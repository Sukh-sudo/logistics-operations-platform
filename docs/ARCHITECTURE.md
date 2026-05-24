# System Architecture

## Architecture Style

The platform follows a modular monolith architecture with event-driven analytics.

## High-Level Components

- NestJS backend
- Next.js dashboards
- Android operational app
- PostgreSQL
- Apache Kafka
- WebSocket realtime layer
- Prisma ORM
- Turborepo monorepo

## Core Principles

- Separation of concerns
- Encapsulation
- Modular ownership
- Event-driven workflows
- Operational consistency
- Auditability
- Scalability readiness

## Operational Philosophy

Package-centric architecture.

Packages move through:
- terminals
- sort zones
- trailers
- operational workflows

All operational actions generate immutable events.