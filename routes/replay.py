from flask import Blueprint, jsonify, send_from_directory, current_app
from services.replay_service import get_replay_payload

replay_bp = Blueprint("replay", __name__)


@replay_bp.get("/")
def index():
    return send_from_directory(current_app.static_folder, "replay.html")


@replay_bp.get("/api/fsms/replay/<uuid:flight_id>")
def replay(flight_id):
    payload = get_replay_payload(str(flight_id))

    if payload is None:
        return jsonify({"error": "Flight not found"}), 404

    replay_points = payload.get("replay", [])

    if replay_points:
        first_ts = replay_points[0].get("timestamp")
    else:
        first_ts = None

    payload["flight_id"] = payload.get("flight_id") or str(flight_id)
    payload["flight_start_time"] = payload.get("flight_start_time") or first_ts
    payload["created_at"] = payload.get("created_at")
    payload["events"] = payload.get("events", [])

    return jsonify(payload)