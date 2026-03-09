# FSMS Backend Architecture

## Overview

The FSMS backend provides airspace monitoring, compliance evaluation, and replay visualization for flight telemetry.

The system evaluates drone flight paths against airspace restrictions and provides predictive alerts for potential breaches.

The backend is implemented using:

- Python
- Flask
- PostgreSQL
- PostGIS
- MapLibre (frontend visualization)

---

# System Architecture

The backend follows a layered architecture:
Client UI (Replay HUD / Map)
↓
Routes (Flask Blueprints)
↓
Services (Business Logic)
↓
Models (Data Structures)
↓
Database (PostgreSQL + PostGIS)


---

# Component Layers

## Routes Layer (`routes/`)

Handles HTTP requests and responses.

Responsibilities:

- API routing
- Request validation
- Response formatting
- Delegating logic to services

Examples:


routes/
health.py
replay.py
airspace.py
compliance.py


---

## Services Layer (`services/`)

Contains business logic and domain processing.

Examples:


services/
db.py
compliance.py
compliance_airspace.py
replay_service.py
airspace_service.py
prediction_service.py
smoothing.py
terrain.py


Responsibilities:

- flight replay processing
- airspace queries
- compliance evaluation
- breach prediction
- track smoothing
- terrain lookup

---

## Models Layer (`models/`)

Defines structured data objects.


models/
flight.py
airspace.py
compliance.py


These represent:

- flight points
- airspace zones
- compliance results

Models improve:

- code clarity
- testability
- API consistency

---

## Database Layer

PostgreSQL + PostGIS stores flight and airspace data.

Main tables:


flight_positions
airspace_zones


Spatial queries use:

- `ST_Intersects`
- `ST_Buffer`
- `ST_Envelope`
- `ST_Collect`

---

# Key System Features

### Flight Replay
Replays telemetry data over a map with a mission control HUD.

### Airspace Detection
Finds intersecting airspace zones using PostGIS spatial queries.

### Compliance Evaluation
Determines whether aircraft altitude violates zone limits.

### Predictive Breach Alerts
Calculates time-to-breach using vertical speed.

### Smoothing
Applies lightweight Kalman-like smoothing to reduce track jitter.

---

# System Flow


Flight Data
↓
Replay Service
↓
Compliance Engine
↓
Prediction Engine
↓
HUD Visualization


---

# Testing

Unit tests validate core services:


tests/
test_compliance.py
test_prediction.py
test_smoothing.py
test_health.py


Testing uses `pytest`.

---

# Future Improvements

- real terrain integration (SRTM/DEM)
- batch compliance evaluation
- streaming telemetry
- alerting services
- multi-flight monitoring