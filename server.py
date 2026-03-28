# server.py
from __future__ import annotations

import os

from flask import Flask
from flask_cors import CORS

from routes.health import health_bp
from routes.replay import replay_bp
from routes.compliance import compliance_bp
from routes.airspace import airspace_bp
from routes.validation import validation_bp

app = Flask(__name__, static_folder="static")
CORS(app)

app.register_blueprint(health_bp)
app.register_blueprint(replay_bp)
app.register_blueprint(compliance_bp)
app.register_blueprint(airspace_bp)
app.register_blueprint(validation_bp)

if __name__ == "__main__":
    debug = os.getenv("FLASK_DEBUG", "1").strip() not in ("0", "false", "False", "")
    app.run(host="127.0.0.1", port=5000, debug=debug)