# Logistics Operations Platform — Project Context

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