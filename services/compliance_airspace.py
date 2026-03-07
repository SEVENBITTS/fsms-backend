from __future__ import annotations

from datetime import datetime, timezone

from services.db import get_conn
from services.terrain import TerrainAdapter
from services.compliance import eval_zone

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

terrain = TerrainAdapter()


def zone_row_to_obj(zone_row, eval_status, lower_m, upper_m):
    if not zone_row:
        return None

    (
        zid, zname, ztype, zsource, zext,
        lower_v, lower_u, lower_ref,
        upper_v, upper_u, upper_ref,
        props
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

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(SQL_ZONE_FOR_POINT, (float(lon), float(lat), float(buffer_m), float(buffer_m)))
        zone_row = cur.fetchone()

    breach, eval_status, lower_m, upper_m = eval_zone(float(alt_amsl_m), alt_agl_m, zone_row)
    zone_obj = zone_row_to_obj(zone_row, eval_status, lower_m, upper_m)

    return {
        "t": float(t_ms),
        "lat": float(lat),
        "lon": float(lon),
        "alt_amsl_m": float(alt_amsl_m),
        "alt_agl_m": alt_agl_m,
        "breach": breach,  # True/False/None
        "breach_unknown": breach is None,
        "eval_status": eval_status,
        "zone": zone_obj,
    }