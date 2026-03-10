import json
from decimal import Decimal

from services.db import get_conn


def _json_default(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def get_cached_flight_compliance(flight_id: str):
    conn = get_conn()

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT payload
            FROM flight_compliance_cache
            WHERE flight_id = %s
            """,
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
            DO UPDATE SET
                payload = EXCLUDED.payload,
                computed_at = now()
            """,
            (flight_id, json.dumps(payload, default=_json_default)),
        )


def clear_cached_flight_compliance(flight_id: str):
    conn = get_conn()

    with conn.cursor() as cur:
        cur.execute(
            """
            DELETE FROM flight_compliance_cache
            WHERE flight_id = %s
            """,
            (flight_id,),
        )