from flask import Blueprint, jsonify
from datetime import datetime, timezone
from services.db import get_conn

health_bp = Blueprint("health", __name__)

@health_bp.get("/health")
def health():
    db_ok = True
    db_error = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute("SELECT 1;")
            cur.fetchone()
    except Exception as e:
        db_ok = False
        db_error = str(e)

    return (
        jsonify(
            {
                "ok": True,
                "service": "fsms",
                "db": "connected" if db_ok else "error",
                "db_error": db_error,
                "ts_utc": datetime.now(timezone.utc).isoformat(),
            }
        ),
        200 if db_ok else 500,
    )