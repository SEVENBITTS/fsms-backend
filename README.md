# FSMS Backend

Flight Safety Monitoring System (FSMS) backend for replaying flight telemetry, detecting airspace violations, and predicting potential breaches.

The system evaluates drone flight paths against airspace restrictions using PostGIS spatial queries and provides a mission-control style replay interface.

---

# Features

### Flight Replay
Replay recorded flights with timeline controls and map visualization.

### Airspace Overlay
Load nearby airspace zones intersecting the flight path.

### Compliance Evaluation
Determine if aircraft altitude violates airspace limits.

### Predictive Breach Alerts
Predict time-to-breach using vertical speed.

### Track Smoothing
Apply Kalman-like smoothing to reduce GPS jitter.

### Modular Backend Architecture
Clean separation between routes, services, models, and database access.

### Automated Tests
Unit tests verify core safety logic.

---

# Technology Stack

Backend

- Python
- Flask
- PostgreSQL
- PostGIS
- psycopg2

Frontend

- MapLibre GL
- JavaScript HUD interface

Testing

- pytest

---

# Project Structure


fsms-backend/
│
├── routes/ # Flask API endpoints
│ health.py
│ replay.py
│ airspace.py
│ compliance.py
│
├── services/ # Business logic
│ db.py
│ replay_service.py
│ airspace_service.py
│ compliance.py
│ compliance_airspace.py
│ prediction_service.py
│ smoothing.py
│ terrain.py
│
├── models/ # Data structures
│ flight.py
│ airspace.py
│ compliance.py
│
├── tests/ # Unit tests
│ test_health.py
│ test_compliance.py
│ test_prediction.py
│ test_smoothing.py
│
├── docs/ # System documentation
│ architecture.md
│ api.md
│ roadmap.md
│ system_diagram.md
│
├── static/ # Frontend UI
│ replay.html
│
└── server.py # Flask application entry point


---

# Running the Backend

Activate the virtual environment:


venv\Scripts\activate


Start the server:


python server.py


Server runs on:


http://127.0.0.1:5000


---

# Running Tests

Run the full test suite:


python -m pytest


Example output:


collected 19 items
19 passed


---

# API Endpoints

### Health


GET /health


Returns backend and database health.

---

### Flight Replay


GET /api/fsms/replay/<flight_id>


Returns telemetry replay data.

---

### Airspace Query


GET /api/airspace/by-flight/<flight_id>?buffer_m=5000


Returns GeoJSON airspace intersecting a flight.

---

### Compliance Evaluation (single point)


GET /api/compliance/airspace/eval-point


Parameters:


lat
lon
alt_amsl_m
buffer_m (optional)


---

### Compliance Evaluation (entire flight)


GET /api/compliance/airspace/by-flight/<flight_id>


Returns compliance evaluation for each flight point.

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

### Phase 5 (future)
Terrain integration and performance optimization.

---

# Future Work

Planned improvements include:

- real terrain elevation integration
- faster batch compliance evaluation
- live telemetry monitoring
- collision prediction
- multi-flight monitoring
- production deployment

---

# License

Internal project – FSMS prototype.