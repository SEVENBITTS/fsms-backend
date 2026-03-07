# server.py
from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from routes.health import health_bp

# Prefer your shared DB connector if present
try:
    from services.db import get_conn  # type: ignore
except Exception:
    get_conn = None  # fallback below


# ============================================================
# 0) Flask App
# ============================================================
app = Flask(__name__, static_folder="static")
CORS(app)
app.register_blueprint(health_bp)

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
    
# ============================================================
# 1) DB Connection
# ============================================================
def _connect_fallback():
    import psycopg2  # local import to avoid import errors in linting

    conn = psycopg2.connect(
        dbname=os.getenv("PGDATABASE", "fsms_drone_ops"),
        user=os.getenv("PGUSER", "postgres"),
        password=os.getenv("PGPASSWORD", "QRa881tt5"),
        host=os.getenv("PGHOST", "localhost"),
        port=int(os.getenv("PGPORT", "5432")),
    )
    conn.autocommit = True
    return conn


conn = get_conn() if callable(get_conn) else _connect_fallback()

# Print once (avoid double-print on Flask reloader)
if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or not app.debug:
    try:
        p = conn.get_dsn_parameters()
        print(
            f"✅ DB connected: db={p.get('dbname')} host={p.get('host')} port={p.get('port')} user={p.get('user')}"
        )
    except Exception:
        print("✅ DB connected")


# ============================================================
# 2) Terrain Adapter (stub)
# ============================================================
class TerrainAdapter:
    """
    v0.4 stub:
      - Return None => terrain unknown (AGL cannot be computed)
      - OPTIONAL: set TERRAIN_STUB_ELEVATION_M env var to a number (e.g. 50)
        to make AGL deterministic for testing.

    PowerShell example:
      $env:TERRAIN_STUB_ELEVATION_M="50"
      python server.py
    """

    def __init__(self):
        raw = os.getenv("TERRAIN_STUB_ELEVATION_M", "").strip()
        self._stub = float(raw) if raw not in ("", None) else None

    def get_elevation_m_amsl(self, lat: float, lon: float) -> float | None:
        return self._stub


terrain = TerrainAdapter()


# ============================================================
# 3) SQL (shared)
# ============================================================
SQL_ZONE_FOR_POINT = """
  WITH p AS (
    SELECT ST_SetSRID(ST_MakePoint(%s, %s), 4326) AS pt
  ),
  pbuf AS (
    SELECT CASE WHEN %s > 0
      THEN ST_Buffer(pt::geography, %s)::geometry
      ELSE pt
    END AS g
    FROM p
  )
  SELECT
    az.id,
    az.name,
    az.zone_type,
    az.source,
    az.external_id,
    az.lower_value, az.lower_unit, az.lower_ref,
    az.upper_value, az.upper_unit, az.upper_ref,
    az.properties
  FROM airspace_zones az, pbuf
  WHERE az.geometry IS NOT NULL
    AND ST_Intersects(az.geometry::geometry, pbuf.g)
  ORDER BY az.updated_at DESC
  LIMIT 1;
"""


# ============================================================
# 4) Helpers
# ============================================================
def _float_arg(name: str, default: float | None = None) -> float:
    """
    Read a query arg as float. Raises KeyError if missing and default is None.
    Raises ValueError if not numeric.
    """
    raw = request.args.get(name, None)
    if raw is None or raw == "":
        if default is None:
            raise KeyError(name)
        return float(default)
    return float(raw)


def to_meters(value, unit):
    """Best-effort unit conversion to meters."""
    if value is None:
        return None
    if unit is None:
        return float(value)

    u = str(unit).strip().lower()
    if u in ("m", "meter", "meters", "metre", "metres"):
        return float(value)
    if u in ("ft", "feet"):
        return float(value) * 0.3048
    if u in ("fl", "flightlevel"):
        # FL is hundreds of feet AMSL: FL65 => 6500 ft
        return float(value) * 100.0 * 0.3048

    # Unknown -> assume meters
    return float(value)


def is_agl(ref):
    if ref is None:
        return False
    r = str(ref).strip().lower()
    return any(k in r for k in ("agl", "gnd", "ground", "sfc", "surface"))


def eval_zone(point_alt_amsl_m, point_alt_agl_m, zone_row):
    """
    Returns:
      (breach: bool|None, eval_status: str, lower_m, upper_m)

    breach meanings:
      - False: evaluated, no breach (or NO_ZONE)
      - True: evaluated, breach
      - None: cannot evaluate (e.g. NEEDS_TERRAIN / UNKNOWN_LIMITS)
    """
    if zone_row is None:
        return False, "NO_ZONE", None, None

    (
        _zid,
        _zname,
        _ztype,
        _zsource,
        _zext,
        lower_v,
        lower_u,
        lower_ref,
        upper_v,
        upper_u,
        upper_ref,
        _props,
    ) = zone_row

    lower_m = to_meters(lower_v, lower_u)
    upper_m = to_meters(upper_v, upper_u)

    use_agl = is_agl(lower_ref) or is_agl(upper_ref)

    # Defensive: if a zone exists, it must have at least one vertical limit.
    if lower_m is None and upper_m is None:
        return None, "UNKNOWN_LIMITS", None, None

    if use_agl and point_alt_agl_m is None:
        return None, "NEEDS_TERRAIN", lower_m, upper_m

    alt = point_alt_agl_m if use_agl else point_alt_amsl_m
    basis = "AGL" if use_agl else "AMSL"

    breach = False
    if lower_m is not None and alt < lower_m:
        breach = True
    if upper_m is not None and alt > upper_m:
        breach = True

    return breach, (f"BREACH_{basis}" if breach else f"OK_{basis}"), lower_m, upper_m


def zone_row_to_obj(zone_row, eval_status, lower_m, upper_m):
    if not zone_row:
        return None

    (
        zid,
        zname,
        ztype,
        zsource,
        zext,
        lower_v,
        lower_u,
        lower_ref,
        upper_v,
        upper_u,
        upper_ref,
        props,
    ) = zone_row

    return {
        "id": str(zid),
        "name": zname,
        "zone_type": ztype,
        "source": zsource,
        "external_id": zext,
        "lower_raw": {"value": lower_v, "unit": lower_u, "ref": lower_ref},
        "upper_raw": {"value": upper_v, "unit": upper_u, "ref": upper_ref},
        "lower_m": lower_m,
        "upper_m": upper_m,
        "eval_status": eval_status,
        "properties": props or {},
    }


def eval_point(lat, lon, alt_amsl_m, buffer_m=0.0, t_ms=None):
    if t_ms is None:
        t_ms = datetime.now(timezone.utc).timestamp() * 1000.0

    terrain_amsl = terrain.get_elevation_m_amsl(float(lat), float(lon))
    alt_agl_m = None if terrain_amsl is None else float(alt_amsl_m) - float(terrain_amsl)

    with conn.cursor() as cur:
        cur.execute(
            SQL_ZONE_FOR_POINT, (float(lon), float(lat), float(buffer_m), float(buffer_m))
        )
        zone_row = cur.fetchone()

    breach, eval_status, lower_m, upper_m = eval_zone(float(alt_amsl_m), alt_agl_m, zone_row)
    zone_obj = zone_row_to_obj(zone_row, eval_status, lower_m, upper_m)

    return {
        "t": float(t_ms),
        "lat": float(lat),
        "lon": float(lon),
        "alt_amsl_m": float(alt_amsl_m),
        "alt_agl_m": alt_agl_m,
        "breach": breach,  # keep True/False/None
        "breach_unknown": breach is None,
        "eval_status": eval_status,
        "zone": zone_obj,
    }


# ============================================================
# 5) Routes
# ============================================================

@app.get("/", endpoint="index")
def index():
    # Serve static/replay.html if present; otherwise show a helpful message
    static_dir = Path(app.static_folder or "static")
    replay_path = static_dir / "replay.html"
    if replay_path.exists():
        return send_from_directory(app.static_folder, "replay.html")
    return (
        jsonify(
            {
                "ok": True,
                "message": "replay.html not found in ./static. Put it at static/replay.html",
            }
        ),
        200,
    )


@app.get("/favicon.ico", endpoint="favicon")
def favicon():
    # Avoid noisy 404s if favicon is missing
    static_dir = Path(app.static_folder or "static")
    ico = static_dir / "favicon.ico"
    if ico.exists():
        return send_from_directory(app.static_folder, "favicon.ico")
    return ("", 204)


@app.get("/api/fsms/replay/<uuid:flight_id>", endpoint="replay")
def replay(flight_id):
    with conn.cursor() as cur:
        cur.execute("SELECT fsms_flight_replay_with_airspace_geojson(%s);", (str(flight_id),))
        result = cur.fetchone()

    if result is None:
        return jsonify({"error": "Flight not found"}), 404

    return jsonify(result[0])


@app.get("/api/airspace/by-flight/<uuid:flight_id>", endpoint="airspace_by_flight")
def airspace_by_flight(flight_id):
    try:
        buffer_m = _float_arg("buffer_m", 5000.0)
    except ValueError:
        return jsonify({"error": "buffer_m must be numeric"}), 400

    sql = """
    WITH fp AS (
      SELECT ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) AS pt
      FROM flight_positions
      WHERE flight_id = %s
    ),
    bbox AS (
      SELECT ST_Buffer(ST_Envelope(ST_Collect(pt))::geography, %s)::geometry AS g
      FROM fp
    )
    SELECT jsonb_build_object(
      'type','FeatureCollection',
      'features', COALESCE(jsonb_agg(
        jsonb_build_object(
          'type','Feature',
          'geometry', ST_AsGeoJSON(az.geometry::geometry)::jsonb,
          'properties', jsonb_build_object(
            'id', az.id,
            'name', az.name,
            'zone_type', az.zone_type,
            'source', az.source,
            'external_id', az.external_id,
            'lower_value', az.lower_value,
            'lower_unit', az.lower_unit,
            'lower_ref', az.lower_ref,
            'upper_value', az.upper_value,
            'upper_unit', az.upper_unit,
            'upper_ref', az.upper_ref
          )
        )
      ), '[]'::jsonb)
    ) AS geojson
    FROM airspace_zones az, bbox
    WHERE az.geometry IS NOT NULL
      AND ST_Intersects(az.geometry::geometry, bbox.g);
    """

    with conn.cursor() as cur:
        cur.execute(sql, (str(flight_id), buffer_m))
        row = cur.fetchone()

    return jsonify(row[0] if row and row[0] else {"type": "FeatureCollection", "features": []})


@app.get("/api/compliance/airspace/eval-point", endpoint="compliance_eval_point")
def compliance_eval_point():
    try:
        lat = _float_arg("lat")
        lon = _float_arg("lon")
        alt_amsl_m = _float_arg("alt_amsl_m", 0.0)
        buffer_m = _float_arg("buffer_m", 0.0)
    except KeyError as e:
        return jsonify({"error": f"Missing required param: {str(e)}"}), 400
    except ValueError:
        return jsonify({"error": "lat, lon, alt_amsl_m, buffer_m must be numeric"}), 400

    t_ms_raw = request.args.get("t_ms")
    t_ms = None
    if t_ms_raw not in (None, ""):
        try:
            t_ms = float(t_ms_raw)
        except ValueError:
            return jsonify({"error": "t_ms must be numeric epoch ms"}), 400

    return jsonify(eval_point(lat, lon, alt_amsl_m, buffer_m=buffer_m, t_ms=t_ms))


@app.get("/api/compliance/airspace/by-flight/<uuid:flight_id>", endpoint="compliance_airspace_by_flight")
def compliance_airspace_by_flight(flight_id):
    try:
        buffer_m = _float_arg("buffer_m", 0.0)
    except ValueError:
        return jsonify({"error": "buffer_m must be numeric"}), 400

    sql_points = """
      SELECT recorded_at, latitude, longitude, COALESCE(altitude_m, 0) AS alt_m
      FROM flight_positions
      WHERE flight_id = %s
      ORDER BY recorded_at ASC;
    """

    with conn.cursor() as cur:
        cur.execute(sql_points, (str(flight_id),))
        points = cur.fetchall()

    items = []
    for (recorded_at, lat, lon, alt_m) in points:
        t_ms = recorded_at.timestamp() * 1000.0
        items.append(eval_point(lat, lon, alt_m, buffer_m=buffer_m, t_ms=t_ms))

    return jsonify({"items": items})


# ============================================================
# 6) Run
# ============================================================
if __name__ == "__main__":
    debug = os.getenv("FLASK_DEBUG", "1").strip() not in ("0", "false", "False", "")
    app.run(host="127.0.0.1", port=5000, debug=debug)