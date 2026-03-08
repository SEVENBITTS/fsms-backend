from flask import Blueprint, jsonify, request
from services.airspace_service import get_airspace_by_flight_geojson

airspace_bp = Blueprint("airspace", __name__)


@airspace_bp.get("/api/airspace/by-flight/<uuid:flight_id>")
def airspace_by_flight(flight_id):
    try:
        buffer_m = float(request.args.get("buffer_m", 5000))
    except ValueError:
        return jsonify({"error": "buffer_m must be numeric"}), 400

    payload = get_airspace_by_flight_geojson(str(flight_id), buffer_m)
    return jsonify(payload)