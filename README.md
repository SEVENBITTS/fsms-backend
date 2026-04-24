# VerityAtlas Backend

VerityAtlas, formerly FSMS, is the backend for replaying flight telemetry, detecting airspace violations, and supporting operator-facing mission review workflows.

The platform evaluates drone flight paths against airspace restrictions, provides mission replay and live-operations surfaces, and is evolving toward a fuller evidence-driven aviation operations platform.

---

# Features

### Flight Replay
Replay recorded flights with timeline controls and map visualization.

### Airspace Overlay
Load nearby airspace zones intersecting the flight path.

### Compliance Evaluation
Determine whether aircraft altitude violates airspace limits.

### Predictive Breach Alerts
Predict time-to-breach using flight dynamics and conflict context.

### Operator Mission Workspace
Review planning state, readiness, blockers, lifecycle actions, and mission evidence.

### Operator Live Operations View
Monitor mission status, alerts, overlays, conflict context, and replay surfaces.

### Modular Backend Architecture
Clean separation between routes, services, repositories, and domain modules.

### Automated Tests
Unit and integration tests cover replay, mission workflow, overlays, and related safety logic.

---

# Technology Stack

Backend

- TypeScript
- Node.js
- Express
- PostgreSQL
- `pg`
- Zod / AJV

Legacy prototype components still present in the repo:

- Python
- Flask
- PostGIS-oriented replay prototype code

Frontend

- HTML
- JavaScript
- Operator-focused static UI surfaces

Testing

- Vitest
- Supertest

---

# Project Structure

```text
fsms-backend/
|-- src/                TypeScript backend and domain modules
|-- static/             Operator UI pages and replay surfaces
|-- docs/               Product and architecture documentation
|-- scripts/            Dev, migration, validation, and seed helpers
|-- sql/                SQL helpers and historical database assets
|-- routes/             Legacy Python/Flask routes
|-- services/           Legacy Python services
|-- models/             Legacy Python models
|-- server.py           Legacy Flask entry point
```

The repo name remains `fsms-backend` for compatibility. This is intentional during the safe rename phase.

---

# Running The Backend

## Current TypeScript dev startup

For the current Express/TypeScript operator UI work, use:

```powershell
npm run dev
```

This dev entrypoint:

- compiles runtime server output into `dist/`
- starts the server with plain `node`
- skips startup migrations in local dev by default so static operator routes can still render when local PostgreSQL credentials are not configured

This is intended for UI rendering and route verification. API-backed mission data still requires a working local database setup.

## Live ops demo seed

To create a mission with replay, alerts, external overlays, and conflict-relevant context for operator UI review, run:

```powershell
npm run seed:liveops-demo
```

The script:

- runs migrations
- creates a mission with planning, approval, and dispatch state
- launches the mission
- records replay telemetry
- creates weather, crewed traffic, and drone traffic overlays
- prints the mission UUID and local review URLs

After the seed finishes, start the app:

```powershell
npm run dev
```

Then open the seeded mission in:

- `/operator/missions/<mission-id>/live-operations`
- `/operator/missions/<mission-id>`

## Legacy Python prototype

The older Python replay prototype is still present for reference.

Activate the virtual environment:

```powershell
venv\Scripts\activate
```

Start the server:

```powershell
python server.py
```

Server runs on:

```text
http://127.0.0.1:5000
```

---

# Running Tests

TypeScript test suite:

```powershell
npm test
```

On this machine, `vitest` has also been successfully run with:

```powershell
npx vitest run --pool=threads
```

Legacy Python test suite:

```powershell
python -m pytest
```

---

# API Notes

Health endpoint:

```text
GET /health
```

Legacy replay route documentation still references:

```text
GET /api/fsms/replay/<flight_id>
```

The `/api/fsms/*` naming is intentionally unchanged during the safe branding pass to avoid compatibility risk.

---

# Development Phases

### Phase 1
Replay interface and airspace detection.

### Phase 2
Backend refactor into modular architecture.

### Phase 3
Prediction and smoothing services.

### Phase 4
Testing and documentation.

### Phase 5
Operator workspace and live-operations surfaces.

### Phase 6
Broader mission-assurance, evidence, and overlay workflows.

---

# Future Work

Planned improvements include:

- deeper terrain integration
- faster batch compliance evaluation
- broader live telemetry monitoring
- richer conflict prediction
- multi-flight monitoring
- production deployment hardening

---

# Product Direction

The current VerityAtlas product direction and prototype boundaries are documented in:

- `docs/FSMS_DIRECTION.md`

The filename remains unchanged for now to avoid unnecessary churn during the safe rename phase.

---

# License

Internal project for VerityAtlas, the aviation operations platform being developed under VerityAir Systems Ltd.
