from services.db import get_conn


def get_replay_payload(flight_id: str):

    conn = get_conn()

    with conn.cursor() as cur:
        cur.execute(
            "SELECT fsms_flight_replay_with_airspace_geojson(%s);",
            (flight_id,),
        )

        row = cur.fetchone()

    return row[0] if row else None