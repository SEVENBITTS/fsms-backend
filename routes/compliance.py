from flask import Blueprint, jsonify, request
from services.compliance_airspace import eval_point
from services.db import get_conn

bp = Blueprint("compliance", __name__, url_prefix="/api/compliance/airspace")


@bp.get("/eval-point")
def compliance_eval_point():
    try:
        lat = float(request.args["lat"])
        lon = float(request.args["lon"])
        alt_amsl_m = float(request.args.get("alt_amsl_m", 0))
        buffer_m = float(request.args.get("buffer_m", 0))
    except KeyError as e:
        return jsonify({"error": f"Missing required param: {str(e)}"}), 400
    except ValueError:
        return jsonify({"error": "lat, lon, alt_amsl_m, buffer_m must be numeric"}), 400

    t_ms_raw = request.args.get("t_ms")
    t_ms = None
    if t_ms_raw not in (None, ""):
        try:
            t_ms = float(t_ms_raw)
        except ValueError:
            return jsonify({"error": "t_ms must be numeric epoch ms"}), 400

    return jsonify(eval_point(lat, lon, alt_amsl_m, buffer_m=buffer_m, t_ms=t_ms))


@bp.get("/by-flight/<uuid:flight_id>")
def compliance_airspace_by_flight(flight_id):
    try:
        buffer_m = float(request.args.get("buffer_m", 0))
    except ValueError:
        return jsonify({"error": "buffer_m must be numeric"}), 400

    sql_points = """
      SELECT recorded_at, latitude, longitude, COALESCE(altitude_m, 0) AS alt_m
      FROM flight_positions
      WHERE flight_id = %s
      ORDER BY recorded_at ASC;
    """

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(sql_points, (str(flight_id),))
        points = cur.fetchall()

    items = []
    for (recorded_at, lat, lon, alt_m) in points:
        t_ms = recorded_at.timestamp() * 1000.0
        items.append(eval_point(lat, lon, alt_m, buffer_m=buffer_m, t_ms=t_ms))

    return jsonify({"items": items})