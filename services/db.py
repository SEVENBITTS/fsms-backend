import os
import psycopg2

_conn = None

def get_conn():
    """
    Singleton connection (dev-friendly).
    Uses env vars if present, otherwise defaults.
    """
    global _conn
    if _conn is not None:
        return _conn

    _conn = psycopg2.connect(
        dbname=os.getenv("PGDATABASE", "fsms_drone_ops"),
        user=os.getenv("PGUSER", "postgres"),
        password=os.getenv("PGPASSWORD", "QRa881tt5"),
        host=os.getenv("PGHOST", "localhost"),
        port=int(os.getenv("PGPORT", "5432")),
    )
    _conn.autocommit = True
    return _conn