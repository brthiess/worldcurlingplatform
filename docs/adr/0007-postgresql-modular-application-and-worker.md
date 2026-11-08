---
status: accepted
date: 2026-11-07
---

# Use one PostgreSQL-backed modular application with background processing

The user accepted a standalone modular application serving the public website, administration, and APIs with distinct permissions, backed by PostgreSQL and background work for imports, news, and rankings. One domain model and transactional database keep sport records, corrections, and audit evidence consistent while avoiding separate-service coordination in the initial offer. A web process and a worker process can run the same codebase without splitting authoritative ownership into microservices.

The user delegated framework/hosting choices and requires a hosted demonstration on a domain they will purchase. The selected implementation defaults are documented in the technical plan; no deployment was performed by this decision.
