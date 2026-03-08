from services.db import get_conn


def get_replay_payload(flight_id: str):

    conn = get_conn()

    sql = """
    SELECT
        latitude,
        longitude,
        altitude_m,
        recorded_at
    FROM flight_positions
    WHERE flight_id = %s
    ORDER BY recorded_at
    """

    with conn.cursor() as cur:
        cur.execute(sql, (flight_id,))
        rows = cur.fetchall()

    if not rows:
        return None

    replay = []

    for lat, lon, alt, ts in rows:
        replay.append({
            "lat": lat,
            "lon": lon,
            "altitude_m": alt,
            "timestamp": ts.isoformat()
        })

    return {
        "flight_id": flight_id,
        "replay": replay
    }