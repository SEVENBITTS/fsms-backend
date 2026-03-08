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

    return jsonify(payload)