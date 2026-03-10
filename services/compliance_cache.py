from services.db import get_conn
import json


def get_cached_flight_compliance(flight_id: str):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT payload FROM flight_compliance_cache WHERE flight_id = %s",
            (flight_id,),
        )
        row = cur.fetchone()
    return row[0] if row else None


def set_cached_flight_compliance(flight_id: str, payload: dict):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO flight_compliance_cache (flight_id, payload)
            VALUES (%s, %s::jsonb)
            ON CONFLICT (flight_id)
            DO UPDATE SET payload = EXCLUDED.payload, computed_at = now()
            """,
            (flight_id, json.dumps(payload)),
        )
        conn.commit()