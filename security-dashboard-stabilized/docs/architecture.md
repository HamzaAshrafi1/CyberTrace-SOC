# Aegis SOC Platform Architecture

## Overview

Aegis SOC Platform is a multi-tenant AI-powered Security Operations Center (SOC) platform designed to centralize threat detection, incident response, threat hunting, compliance monitoring, attack simulation, and AI-assisted investigations.

The platform follows a modern microservice architecture consisting of a Next.js frontend, FastAPI backend services, PostgreSQL database, ChromaDB vector storage, and AI-powered security analysis.

---

# High-Level Architecture

```text
Users
  │
  ▼
Next.js Frontend (SOC Dashboard)
  │
  ├── Clerk Authentication
  ├── RBAC Authorization
  ├── Threat Dashboard
  ├── Incident Management
  ├── Threat Hunting
  ├── Compliance Center
  ├── Reports Center
  ├── AI Security Copilot
  └── Attack Simulation Lab
  │
  ▼
FastAPI Security Engine
  │
  ├── Detection Engine
  ├── Threat Correlation
  ├── SOAR Automation
  ├── Threat Hunting Engine
  ├── RAG Processing
  ├── Simulation Engine
  └── Realtime Event Processing
  │
  ├──────────────┬──────────────┐
  ▼              ▼              ▼
PostgreSQL    ChromaDB     OpenRouter
(Operational) (Vectors)    (AI Models)
```

---

# Frontend Layer

## Technologies

* Next.js 16
* React
* TypeScript
* Tailwind CSS
* Recharts
* Three.js
* Clerk Authentication

## Responsibilities

* Dashboard visualization
* Threat monitoring
* Incident management
* Threat hunting console
* AI Copilot interface
* Compliance dashboards
* Reports generation
* Attack simulation controls

---

# Backend Layer

## Technologies

* FastAPI
* Python
* SQLAlchemy / Prisma Integration

## Core Services

### Threat Detection Engine

Detects:

* SQL Injection
* Cross-Site Scripting (XSS)
* Command Injection
* Directory Traversal
* Brute Force Attacks

### Threat Hunting Engine

Custom AQL (Aegis Query Language)

Supports:

* Saved Hunts
* Timeline Analysis
* IOC Searches
* Multi-source investigations

### SOAR Automation

Automates:

* Incident creation
* Alert escalation
* Response workflows
* Notification dispatching

### Simulation Engine

Cyber range supporting:

* SQL Injection
* XSS
* Brute Force
* DDoS
* Privilege Escalation
* Command Injection

---

# AI Layer

## OpenRouter

Used for:

* AI Threat Analysis
* Incident Summarization
* Executive Reports
* Threat Hunting Assistance

## RAG Pipeline

Document Flow:

```text
Upload Documents
       │
       ▼
Document Parser
       │
       ▼
Chunking Engine
       │
       ▼
Embeddings
       │
       ▼
ChromaDB
       │
       ▼
AI Retrieval
       │
       ▼
Security Copilot
```

Supported Formats:

* PDF
* DOCX
* TXT

---

# Database Layer

## PostgreSQL

Stores:

* Organizations
* Users
* Roles
* Threat Events
* Incidents
* Compliance Audits
* Reports
* Saved Hunts
* Simulation Runs
* Audit Logs

## Multi-Tenant Isolation

Every database operation is scoped using:

* organizationId
* Clerk Organization ID

Ensuring complete tenant separation.

---

# Security Architecture

## Authentication

Clerk B2B Authentication

## Authorization

RBAC Roles:

### Admin

* Full Access

### Analyst

* Investigation Access
* Threat Management
* Incident Response

### Viewer

* Read Only Access

---

# Compliance Frameworks

Supported Frameworks:

* ISO 27001
* CIS Benchmarks
* OWASP Top 10
* GDPR

---

# Monitoring & Health

## Health Endpoints

* /api/health/live
* /api/health/ready

## Monitoring

* Structured Logging
* Audit Trails
* Security Events
* Real-Time Telemetry

---

# Deployment Architecture

```text
Internet
   │
   ▼
Load Balancer
   │
   ▼
Next.js Container
   │
   ▼
FastAPI Container
   │
   ├── PostgreSQL
   ├── ChromaDB
   └── OpenRouter API
```

Containerized Using:

* Docker
* Docker Compose
* GitHub Actions CI/CD

---

# Testing

Backend

* 22+ Unit Tests
* Security Validation Tests
* Threat Detection Tests
* SOAR Automation Tests

Frontend

* Playwright E2E Tests
* TypeScript Validation
* ESLint Validation

---

# Production Status

Security Audit Score: 97/100

Automated Tests: 22+ Passing

E2E Tests: 9/9 Passing

Status: Production Ready
