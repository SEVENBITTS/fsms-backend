from services.db import get_conn


def get_flight_points(flight_id: str):
    sql = """
      SELECT recorded_at, latitude, longitude, COALESCE(altitude_m, 0) AS alt_m
      FROM flight_positions
      WHERE flight_id = %s
      ORDER BY recorded_at ASC;
    """

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(sql, (flight_id,))
        rows = cur.fetchall()

    return [
        {
            "lat": lat,
            "lon": lon,
            "alt_amsl_m": alt_m,
            "t_ms": recorded_at.timestamp() * 1000.0,
        }
        for (recorded_at, lat, lon, alt_m) in rows
    ]