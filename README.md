# Logistics Operations Platform

> An enterprise-grade, event-driven logistics operations platform built with NestJS, Prisma, PostgreSQL, and TypeScript.

---

## Overview

The Logistics Operations Platform is a backend system designed to model real-world parcel and freight logistics operations. It provides a scalable, event-driven architecture for tracking packages, containers, trailers, terminals, routes, shipments, and operational workflows.

The project is intentionally designed as a portfolio-quality enterprise application that demonstrates modern backend architecture, domain-driven design principles, event sourcing concepts, CQRS-inspired read/write separation, transactional consistency, and production-ready development practices.

The long-term vision is to build a complete logistics platform capable of supporting distribution centers, cross-dock facilities, transportation networks, and operational dashboards.

---

# Current Status

**Project Phase:** Core Logistics Engine

### Implemented

- Package lifecycle engine
- Package event sourcing
- Package snapshots
- Package location tracking
- Package history
- Container management
- Package → Container workflows
- Trailer management
- Container → Trailer workflows
- Loose Package → Trailer workflows
- Operational dashboard
- Unified search
- Health monitoring
- Swagger API documentation
- Correlation IDs
- Integration testing
- PostgreSQL persistence
- Prisma ORM

### Scaffolded

The following modules already exist in the project structure and will be implemented in future development:

- Users
- Authentication
- Analytics
- Terminals
- Routes
- Shipments

---

# Business Domain

The system models the operational hierarchy commonly found in transportation and parcel logistics.

```
Terminal
│
├── Routes
│
├── Trailers
│     │
│     ├── Containers
│     │      │
│     │      └── Packages
│     │
│     └── Loose Packages
│
├── Shipments
│
└── Employees
```

---

# Design Principles

The platform follows several architectural principles.

- Event-driven design
- Immutable operational history
- Snapshot read models
- Modular architecture
- Transactional consistency
- Strong domain boundaries
- Scalable module design
- Comprehensive integration testing

---

# Technology Stack

| Layer | Technology |
|----------|------------|
| Runtime | Node.js |
| Language | TypeScript |
| Framework | NestJS |
| ORM | Prisma |
| Database | PostgreSQL |
| Validation | class-validator |
| API Docs | Swagger |
| Testing | Jest + Supertest |
| Package Manager | pnpm |
| Messaging | Kafka (planned) |
| Containerization | Docker (planned) |

---

# Current Modules

```
src/modules

analytics/
auth/
containers/
dashboard/
health/
packages/
routes/
search/
shipments/
terminals/
trailers/
users/
```

---

# Architecture

The application follows a layered architecture.

```
HTTP Request

↓

Controller

↓

Service

↓

Prisma Transaction

↓

Database

├── Event Tables

├── Snapshot Tables

└── History Tables

↓

HTTP Response
```

Every write operation updates:

- Immutable event log
- Snapshot model
- Relationship history (where applicable)

---

# Core Workflows

Currently implemented workflows include:

### Packages

- Receive package
- Sort package
- Load package into container
- Unload package from container
- Load package directly into trailer
- Unload package from trailer
- Query package location
- View package history

### Containers

- Create container
- Load packages
- Unload packages
- Load container into trailer
- Unload container from trailer
- Query container
- View container history

### Trailers

- Create trailer
- Load containers
- Unload containers
- Load loose packages
- Unload loose packages
- Query trailer
- View trailer history
- View trailer manifest

---

# Planned Modules

The long-term platform includes:

## Users

Authentication

Authorization

Roles

Permissions

Employees

---

## Terminals

Receiving

Sorting

Dispatch

Arrival

Capacity Management

Dock Management

---

## Routes

Origin

Destination

Scheduling

Departure

Arrival

Driver Assignment

Trailer Assignment

---

## Shipments

Shipment Creation

Package Assignment

Customer Tracking

Delivery Confirmation

---

## Analytics

Operational KPIs

Terminal Throughput

Trailer Utilization

Container Utilization

Forecasting

---

# Development

## Install Dependencies

```bash
pnpm install
```

---

## Generate Prisma Client

```bash
pnpm prisma generate
```

---

## Apply Database Migrations

```bash
pnpm prisma migrate dev
```

---

## Start Development Server

```bash
pnpm start:dev
```

---

## Build

```bash
pnpm build
```

---

## Run Tests

```bash
pnpm test
```

---

## Run Integration Tests

```bash
pnpm test:e2e
```

---

# API Documentation

Swagger UI

```
http://localhost:3000/api/docs
```

---

# Repository Structure

```
apps/
    backend/

docs/

README.md

PROJECT_SPEC.md
```

---

# Documentation

Complete engineering documentation is maintained under:

```
docs/
```

Documentation covers:

- System Architecture
- Database Design
- Event Sourcing
- Module Design
- API Reference
- Business Rules
- Testing Strategy
- Production Readiness
- Development Roadmap
- AI Development Guide

---

# Project Goals

This repository is intended to demonstrate:

- Enterprise backend architecture
- Domain-driven design
- Event-driven systems
- Logistics operations modeling
- Modern API development
- Production-ready coding practices
- Scalable software architecture

---

# Future Roadmap

Phase 1

✅ Core Logistics Engine

---

Phase 2

- Users
- Authentication
- Terminals
- Routes
- Shipments

---

Phase 3

- Kafka
- Notifications
- Analytics
- Reporting

---

Phase 4

- React Dashboard
- Mobile Scanner
- GIS Integration
- Machine Learning
- Predictive Analytics

---

# License

This project is intended for educational, portfolio, and professional development purposes.