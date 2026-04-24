# VerityAtlas System Architecture Diagram

```mermaid
flowchart TD

    UI[Replay UI<br>MapLibre + HUD]

    subgraph Flask Backend
        SERVER[server.py]

        subgraph Routes
            R1[health.py]
            R2[replay.py]
            R3[airspace.py]
            R4[compliance.py]
        end

        subgraph Services
            S1[db.py]
            S2[replay_service.py]
            S3[airspace_service.py]
            S4[compliance.py]
            S5[compliance_airspace.py]
            S6[prediction_service.py]
            S7[smoothing.py]
            S8[terrain.py]
        end

        subgraph Models
            M1[flight.py]
            M2[airspace.py]
            M3[compliance.py]
        end
    end

    DB[(PostgreSQL + PostGIS)]

    UI --> SERVER

    SERVER --> R1
    SERVER --> R2
    SERVER --> R3
    SERVER --> R4

    R2 --> S2
    R3 --> S3
    R4 --> S5

    S5 --> S4
    S5 --> S6
    S5 --> S8

    S2 --> S1
    S3 --> S1
    S5 --> S1

    S4 --> M3
    S2 --> M1
    S3 --> M2

    S1 --> DB

---

# Step 3 — View the diagram

You can view this in several ways:

### Option A (Best)
Open in **VS Code with Markdown preview**


Ctrl + Shift + V


### Option B
Push to GitHub — GitHub renders Mermaid automatically.

### Option C
Use https://mermaid.live

Paste the diagram there to export PNG/SVG.

---

# What this diagram shows

It visualizes your architecture:


UI
↓
Flask Server
↓
Routes
↓
Services
↓
Models
↓
PostGIS


This is **exactly the layered architecture you built over the last steps**.

---

# Your backend structure now

Your repo should look like this:


fsms-backend/
│
├── routes/
│ health.py
│ replay.py
│ airspace.py
│ compliance.py
│
├── services/
│ db.py
│ replay_service.py
│ airspace_service.py
│ compliance.py
│ compliance_airspace.py
│ prediction_service.py
│ smoothing.py
│ terrain.py
│
├── models/
│ flight.py
│ airspace.py
│ compliance.py
│
├── tests/
│ test_health.py
│ test_compliance.py
│ test_prediction.py
│ test_smoothing.py
│
├── docs/
│ architecture.md
│ api.md
│ roadmap.md
│ system_diagram.md
│
├── static/
│ replay.html
│
└── server.py


That is **a clean production-grade Python backend layout**.

---

# One final optional improvement (very recommended)

Add a **README.md** at the repo root so anyone opening the project understands it immediately
