from services.db import get_conn


def get_airspace_by_flight_geojson(flight_id: str, buffer_m: float = 5000.0):
    conn = get_conn()

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
            'upper_ref', az.upper_ref,

            'lower_m', CASE
              WHEN az.lower_value IS NULL THEN NULL
              WHEN lower(trim(coalesce(az.lower_unit, ''))) IN ('m', 'meter', 'meters', 'metre', 'metres')
                THEN az.lower_value::double precision
              WHEN lower(trim(coalesce(az.lower_unit, ''))) IN ('ft', 'feet')
                THEN az.lower_value::double precision * 0.3048
              WHEN lower(trim(coalesce(az.lower_unit, ''))) IN ('fl', 'flightlevel')
                THEN az.lower_value::double precision * 100.0 * 0.3048
              ELSE az.lower_value::double precision
            END,

            'upper_m', CASE
              WHEN az.upper_value IS NULL THEN NULL
              WHEN lower(trim(coalesce(az.upper_unit, ''))) IN ('m', 'meter', 'meters', 'metre', 'metres')
                THEN az.upper_value::double precision
              WHEN lower(trim(coalesce(az.upper_unit, ''))) IN ('ft', 'feet')
                THEN az.upper_value::double precision * 0.3048
              WHEN lower(trim(coalesce(az.upper_unit, ''))) IN ('fl', 'flightlevel')
                THEN az.upper_value::double precision * 100.0 * 0.3048
              ELSE az.upper_value::double precision
            END
          )
        )
      ), '[]'::jsonb)
    ) AS geojson
    FROM airspace_zones az, bbox
    WHERE az.geometry IS NOT NULL
      AND ST_Intersects(az.geometry::geometry, bbox.g);
    """

    with conn.cursor() as cur:
        cur.execute(sql, (flight_id, buffer_m))
        row = cur.fetchone()

    return row[0] if row and row[0] else {"type": "FeatureCollection", "features": []}


def get_candidate_zones_for_flight(flight_id: str, buffer_m: float = 5000.0):
    conn = get_conn()

    sql = """
    WITH fp AS (
      SELECT ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) AS pt
      FROM flight_positions
      WHERE flight_id = %s
    ),
    corridor AS (
      SELECT ST_Buffer(ST_Envelope(ST_Collect(pt))::geography, %s)::geometry AS g
      FROM fp
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
      az.geometry::geometry
    FROM airspace_zones az, corridor
    WHERE az.geometry IS NOT NULL
      AND ST_Intersects(az.geometry::geometry, corridor.g);
    """

    with conn.cursor() as cur:
        cur.execute(sql, (flight_id, buffer_m))
        return cur.fetchall()