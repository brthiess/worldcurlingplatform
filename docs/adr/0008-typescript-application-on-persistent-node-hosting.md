---
status: proposed implementation default under delegated stack choice
date: 2026-11-07
---

# Share TypeScript domain code between a Next.js web app and worker

Use TypeScript/Next.js for the public site, administration, and APIs, with the same domain modules in a persistent worker and PostgreSQL-backed job queue. This favors shared command validation and interactive web development over introducing a second Python application merely because the historical crawler uses Python. Keep historical translation at an import boundary instead of making crawler code a runtime dependency.

Render web/worker/PostgreSQL is the proposed hosting default, with external media and provider adapters. The user delegated framework/hosting choices; these defaults are part of the consolidated plan for shared-understanding review, not a deployed or tested integration. Exact supported versions are pinned during implementation.
