from flask import Blueprint, jsonify, request

from services.compliance_airspace import eval_point, eval_flight_points
from services.flight_service import get_flight_points

# Future performance path:
# from services.airspace_service import get_candidate_zones_for_flight
# from services.compliance_airspace import eval_flight_points_fast

# Future cache path:
# from services.compliance_cache import (
#     get_cached_flight_compliance,
#     set_cached_flight_compliance,
# )

compliance_bp = Blueprint("compliance", __name__, url_prefix="/api/compliance/airspace")


@compliance_bp.get("/eval-point")
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

    item = eval_point(
        lat=lat,
        lon=lon,
        alt_amsl_m=alt_amsl_m,
        buffer_m=buffer_m,
        t_ms=t_ms,
    )
    return jsonify(item)


@compliance_bp.get("/by-flight/<uuid:flight_id>")
def compliance_airspace_by_flight(flight_id):
    try:
        buffer_m = float(request.args.get("buffer_m", 0))
    except ValueError:
        return jsonify({"error": "buffer_m must be numeric"}), 400

    flight_id_str = str(flight_id)

    # Future cache path:
    # cached = get_cached_flight_compliance(flight_id_str)
    # if cached is not None:
    #     return jsonify(cached)

    points = get_flight_points(flight_id_str)

    # Current production-safe path
    items = eval_flight_points(points, buffer_m=buffer_m)

    # Future fast path:
    # candidate_zones = get_candidate_zones_for_flight(
    #     flight_id_str,
    #     buffer_m=max(buffer_m, 5000),
    # )
    # items = eval_flight_points_fast(points, candidate_zones)

    payload = {"items": items}

    # Future cache path:
    # set_cached_flight_compliance(flight_id_str, payload)

    return jsonify(payload)