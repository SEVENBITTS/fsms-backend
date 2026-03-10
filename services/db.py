import os
import psycopg2

_conn = None


def get_conn():
    """
    Singleton DB connection.

    Uses environment variables if present.
    Automatically reconnects if connection dropped.
    """
    global _conn

    if _conn is not None:
        try:
            _conn.cursor().execute("SELECT 1;")
            return _conn
        except Exception:
            _conn = None

    _conn = psycopg2.connect(
        dbname=os.getenv("PGDATABASE", "fsms_drone_ops"),
        user=os.getenv("PGUSER", "postgres"),
        password=os.getenv("PGPASSWORD", "QRa881tt5"),
        host=os.getenv("PGHOST", "localhost"),
        port=int(os.getenv("PGPORT", "5432")),
    )

    _conn.autocommit = True
    return _conn