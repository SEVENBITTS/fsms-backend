from __future__ import annotations

from datetime import datetime, timezone

from services.db import get_conn
from services.terrain import TerrainAdapter
from services.compliance import eval_zone

# Experimental performance helper.
# Not yet geometrically exact for per-point zone selection.
# Intended for future batch evaluation optimization.

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

SQL_ZONE_FOR_POINT_WITH_DISTANCE = """
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
    az.properties,
    ST_Distance(
      az.geometry::geography,
      (SELECT pt::geography FROM p)
    ) AS boundary_distance_m,
    ST_Contains(
      az.geometry::geometry,
      (SELECT pt FROM p)
    ) AS inside_zone
  FROM airspace_zones az, pbuf
  WHERE az.geometry IS NOT NULL
    AND ST_Intersects(az.geometry::geometry, pbuf.g)
  ORDER BY az.updated_at DESC
  LIMIT 1;
"""

terrain = TerrainAdapter()


def zone_row_to_obj(
    zone_row,
    eval_status,
    lower_m,
    upper_m,
    boundary_distance_m=None,
    inside_zone=None,
):
    if not zone_row:
        return None

    (
        zid, zname, ztype, zsource, zext,
        lower_v, lower_u, lower_ref,
        upper_v, upper_u, upper_ref,
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
        "boundary_distance_m": boundary_distance_m,
        "inside_zone": inside_zone,
    }


def eval_point(
    lat: float,
    lon: float,
    alt_amsl_m: float,
    buffer_m: float = 0.0,
    t_ms: float | None = None,
):
    if t_ms is None:
        t_ms = datetime.now(timezone.utc).timestamp() * 1000.0

    terrain_amsl = terrain.get_elevation_m_amsl(float(lat), float(lon))
    alt_agl_m = None if terrain_amsl is None else float(alt_amsl_m) - float(terrain_amsl)

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            SQL_ZONE_FOR_POINT_WITH_DISTANCE,
            (float(lon), float(lat), float(buffer_m), float(buffer_m)),
        )
        row = cur.fetchone()

    if row:
        zone_row = row[:12]
        boundary_distance_m = float(row[12]) if row[12] is not None else None
        inside_zone = bool(row[13]) if row[13] is not None else None
    else:
        zone_row = None
        boundary_distance_m = None
        inside_zone = None

    breach, eval_status, lower_m, upper_m = eval_zone(
        float(alt_amsl_m),
        alt_agl_m,
        zone_row,
    )

    zone_obj = zone_row_to_obj(
        zone_row,
        eval_status,
        lower_m,
        upper_m,
        boundary_distance_m=boundary_distance_m,
        inside_zone=inside_zone,
    )

    return {
        "t": float(t_ms),
        "lat": float(lat),
        "lon": float(lon),
        "alt_amsl_m": float(alt_amsl_m),
        "alt_agl_m": alt_agl_m,
        "breach": breach,
        "breach_unknown": breach is None,
        "eval_status": eval_status,
        "zone": zone_obj,
    }


def eval_flight_points(points, buffer_m=0.0):
    """
    Evaluate a list of flight points for airspace compliance.

    Each point should contain:
      - lat
      - lon
      - alt_amsl_m
      - optional t_ms

    Returns:
      list of eval_point(...) results
    """
    items = []

    for point in points:
        item = eval_point(
            lat=point["lat"],
            lon=point["lon"],
            alt_amsl_m=point["alt_amsl_m"],
            buffer_m=buffer_m,
            t_ms=point.get("t_ms"),
        )
        items.append(item)

    return items


def eval_flight_points_fast(points, candidate_zones):
    """
    Fast in-memory evaluation against already-fetched candidate zones.

    candidate_zones should contain rows compatible with eval_zone(),
    plus geometry in the final column if you later add geometric point checks.
    """
    items = []

    for point in points:
        lat = float(point["lat"])
        lon = float(point["lon"])
        alt_amsl_m = float(point["alt_amsl_m"])
        t_ms = point.get("t_ms")

        terrain_amsl = terrain.get_elevation_m_amsl(lat, lon)
        alt_agl_m = None if terrain_amsl is None else alt_amsl_m - float(terrain_amsl)

        # Temporary simple strategy:
        # choose first candidate zone for now, later refine with geometry checks
        # TODO: replace first-zone shortcut with true per-point geometry membership check
        zone_row = candidate_zones[0][:-1] if candidate_zones else None

        breach, eval_status, lower_m, upper_m = eval_zone(
            alt_amsl_m,
            alt_agl_m,
            zone_row,
        )
        zone_obj = zone_row_to_obj(zone_row, eval_status, lower_m, upper_m)

        items.append({
            "t": float(t_ms) if t_ms is not None else None,
            "lat": lat,
            "lon": lon,
            "alt_amsl_m": alt_amsl_m,
            "alt_agl_m": alt_agl_m,
            "breach": breach,
            "breach_unknown": breach is None,
            "eval_status": eval_status,
            "zone": zone_obj,
        })

    return items