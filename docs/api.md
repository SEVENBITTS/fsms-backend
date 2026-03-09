# FSMS Backend API

Base URL:


http://localhost:5000


---

# Health Check

## GET `/health`

Returns system health status.

### Response


{
"ok": true,
"service": "fsms",
"db": "connected",
"db_error": null,
"ts_utc": "2026-03-07T15:23:58Z"
}


---

# Replay API

## GET `/api/fsms/replay/<flight_id>`

Returns replay data for a flight.

### Example


/api/fsms/replay/3422422e-f6b4-4059-8de4-93145daecddc


### Response


{
"flight_id": "...",
"replay": [
{
"lat": 51.234,
"lon": -1.231,
"altitude_m": 120,
"timestamp": "2026-03-07T12:00:00Z"
}
]
}


---

# Airspace API

## GET `/api/airspace/by-flight/<flight_id>`

Returns GeoJSON of airspace zones intersecting a flight.

### Parameters


buffer_m (optional)


Example:


/api/airspace/by-flight/<flight_id>?buffer_m=5000


### Response


GeoJSON FeatureCollection


---

# Compliance API

## GET `/api/compliance/airspace/eval-point`

Evaluates a single point against airspace.

### Parameters


lat
lon
alt_amsl_m
buffer_m (optional)
t_ms (optional)


### Response


{
"lat": 51.2,
"lon": -1.1,
"alt_amsl_m": 120,
"breach": false,
"eval_status": "OK_AMSL",
"zone": {...}
}


---

## GET `/api/compliance/airspace/by-flight/<flight_id>`

Evaluates an entire flight for airspace compliance.

### Response


{
"items": [
{
"lat": ...,
"lon": ...,
"breach": false,
"zone": {...}
}
]
}


---

# Static Frontend

## GET `/`

Serves the replay interface.


/static/replay.html


This provides:

- Map visualization
- Flight playback
- Mission control HUD
- Feature toggles