# Logistics Operations Platform — Project Context

## Project Overview

This project is an event-driven logistics operations intelligence platform focused on terminal-level transportation operations.

The platform tracks:
- package lifecycle events
- trailer workflows
- employee operational actions
- terminal operations
- sort plans
- operational analytics

The system is NOT:
- a route optimization platform
- a microservices-first architecture
- a warehouse management system

---

# Core Architecture

## Architecture Style

- Modular monolith
- Event-driven analytics
- Hybrid realtime architecture
- Extraction-ready modular boundaries

---

# Technology Stack

| Layer | Technology |
|---|---|
| Backend | NestJS + TypeScript |
| Frontend | Next.js |
| Mobile | Android |
| Database | PostgreSQL |
| Event Backbone | Apache Kafka |
| ORM | Prisma |
| Monorepo | Turborepo |
| Infrastructure | Docker |

---

# Core Architectural Rules

## Module Ownership

Each module owns:
- its database schema
- its repositories
- its business logic
- its events

Cross-module access must occur through:
- services
- interfaces
- events

Repositories must NEVER directly access another module's tables.

---

## Layering Rules

Modules follow:

controllers/
services/
repositories/
entities/
dto/
events/
interfaces/
validators/
mappers/

Rules:
- controllers remain thin
- business logic belongs in services
- repositories only handle database access
- validators contain workflow/state validation
- mappers transform entities and DTOs

---

# Event Philosophy

Events represent business occurrences.

GOOD:
- PACKAGE_LOADED
- PACKAGE_SORTED
- TRAILER_DEPARTED

BAD:
- UPDATE_PACKAGE_STATUS
- PROCESS_PACKAGE

Events must be:
- immutable
- timestamped
- auditable

---

# State Strategy

The platform uses:
- snapshot tables for current operational state
- immutable event history for analytics and auditability

Operational writes:
1. update snapshot
2. store immutable event
3. publish Kafka event

---

# Consistency Philosophy

Operational systems prioritize:
- consistency
- correctness
- durability

Analytics systems prioritize:
- scalability
- eventual consistency

---

# Package-Centric Architecture

Packages are the primary operational entity.

Trailers are secondary contextual entities.

All operational workflows should preserve:
- package traceability
- package event ordering
- package lifecycle visibility

---

# Mobile Architecture

Android devices are primary operational clients.

Employees use mobile devices for:
- package scanning
- load/unload workflows
- operational event creation
- package tracking

All mobile actions are authenticated and auditable.

---

# AI Coding Rules

DO NOT:
- collapse module boundaries
- introduce shared mutable state
- place business logic in controllers
- bypass service layers
- directly couple modules
- generate unnecessary abstractions
- introduce premature microservices

PREFER:
- clear service boundaries
- strongly typed DTOs
- event-driven workflows
- modular ownership
- explicit validation
- readable code over clever code

---

# Development Philosophy

The project prioritizes:
- maintainability
- operational correctness
- architectural clarity
- scalability readiness
- auditability
- developer understanding

The goal is to understand the system deeply while building incrementally.