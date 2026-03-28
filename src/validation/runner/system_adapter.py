import math
from datetime import datetime
from typing import Any, Dict, List, Optional

from services.replay_service import get_replay_payload
from services.compliance_airspace import eval_flight_points
from services.prediction_service import (
    predict_ttb,
    predict_breach_time_ms,
    classify_prediction,
)


class ValidationSystemAdapter:
    def __init__(self, flight_id: str, replay_override=None):
        self.flight_id = flight_id

        if replay_override is not None:
            self.payload = {"flight_id": flight_id, "replay": replay_override}
        else:
            self.payload = get_replay_payload(flight_id)

        self.replay = self.payload.get("replay", [])
        self._compliance_results = None

    def get_state_at(self, timestamp: str) -> Optional[Dict[str, Any]]:
        for point in self.replay:
            if point.get("timestamp") == timestamp:
                return point
        return None

    def get_all_points(self) -> List[Dict[str, Any]]:
        return self.replay

    def get_compliance_input_points(self) -> List[Dict[str, Any]]:
        normalized = []

        for point in self.replay:
            normalized.append({
                "lat": point.get("lat"),
                "lon": point.get("lon"),
                "alt_amsl_m": point.get("altitude_m"),
                "timestamp": point.get("timestamp"),
            })

        return normalized

    def get_compliance_truth_for_all_points(self):
        if self._compliance_results is None:
            points = self.get_compliance_input_points()
            self._compliance_results = eval_flight_points(points)
        return self._compliance_results

    def get_compliance_truth_for_index(self, index: int) -> Optional[Dict[str, Any]]:
        results = self.get_compliance_truth_for_all_points()
        if index < 0 or index >= len(results):
            return None
        return results[index]

    def compute_vertical_speed(self, prev_point: Dict[str, Any], curr_point: Dict[str, Any]) -> Optional[float]:
        if not prev_point:
            return None

        alt1 = prev_point.get("altitude_m")
        alt2 = curr_point.get("altitude_m")

        t1 = datetime.fromisoformat(prev_point.get("timestamp"))
        t2 = datetime.fromisoformat(curr_point.get("timestamp"))

        dt = (t2 - t1).total_seconds()
        if dt == 0:
            return None

        return (alt2 - alt1) / dt

    def get_prediction_for_point(self, index: int) -> Optional[Dict[str, Any]]:
        if index < 0 or index >= len(self.replay):
            return None

        point = self.replay[index]
        prev_point = self.replay[index - 1] if index > 0 else None
        truth = self.get_compliance_truth_for_index(index)

        vertical_speed_mps = self.compute_vertical_speed(prev_point, point)

        margin_m = None
        if truth:
            alt_agl_m = truth.get("alt_agl_m")
            zone = truth.get("zone") or {}
            upper_m = zone.get("upper_m")

            if alt_agl_m is not None and upper_m is not None:
                margin_m = upper_m - alt_agl_m
        ttb_s = predict_ttb(margin_m, vertical_speed_mps)

        breach_time_ms = None
        point_ts = point.get("timestamp")
        if point_ts is not None:
            point_dt = datetime.fromisoformat(point_ts)
            point_epoch_ms = point_dt.timestamp() * 1000
            breach_time_ms = predict_breach_time_ms(
                point_epoch_ms,
                margin_m,
                vertical_speed_mps,
            )

        prediction = classify_prediction(margin_m, ttb_s)

        return {
            "margin_m": margin_m,
            "vertical_speed_mps": vertical_speed_mps,
            "ttb_s": ttb_s,
            "breach_time_ms": breach_time_ms,
            "classification": prediction,
        }
    
    def set_intruder_track(self, intruder_points):
        self.intruder_track = intruder_points

    def _distance_xy_m(self, p1, p2):
        # simple local approximation, good enough for controlled validation
        lat_scale = 111_320.0
        lon_scale = 111_320.0 * math.cos(math.radians((p1["lat"] + p2["lat"]) / 2.0))

        dlat = (p2["lat"] - p1["lat"]) * lat_scale
        dlon = (p2["lon"] - p1["lon"]) * lon_scale

        return math.sqrt(dlat * dlat + dlon * dlon)

    def get_four_d_truth_for_index(self, index: int):
        if not hasattr(self, "intruder_track"):
            return None

        own = self.replay[index]
        intr = self.intruder_track[index]

        horizontal_m = self._distance_xy_m(own, intr)
        vertical_m = abs(own["altitude_m"] - intr["altitude_m"])

        conflict = horizontal_m < 60.0 and vertical_m < 20.0

        return {
            "horizontal_m": horizontal_m,
            "vertical_m": vertical_m,
            "conflict": conflict,
        }

    def get_four_d_prediction_for_index(self, index: int):
        if not hasattr(self, "intruder_track"):
            return None

        truth = self.get_four_d_truth_for_index(index)
        if truth is None:
            return None

        if truth["conflict"]:
            state = "CONFLICT"
        elif truth["horizontal_m"] < 120.0 and truth["vertical_m"] < 30.0:
            state = "WARNING"
        elif truth["horizontal_m"] < 200.0:
            state = "CAUTION"
        else:
            state = "SAFE"

        return {
            "state": state,
            "horizontal_m": truth["horizontal_m"],
            "vertical_m": truth["vertical_m"],
        }
    
    def get_envelope_truth_for_index(self, index: int):
        point = self.replay[index]
        prev_point = self.replay[index - 1] if index > 0 else None

        vertical_speed_mps = self.compute_vertical_speed(prev_point, point)
        max_climb_rate_mps = 6.0

        violated = (
            vertical_speed_mps is not None and
            vertical_speed_mps > max_climb_rate_mps
        )

        return {
            "vertical_speed_mps": vertical_speed_mps,
            "max_climb_rate_mps": max_climb_rate_mps,
            "violated": violated,
        }

    def get_envelope_prediction_for_index(self, index: int):
        truth = self.get_envelope_truth_for_index(index)
        if truth is None:
            return None

        vs = truth["vertical_speed_mps"]
        limit = truth["max_climb_rate_mps"]

        if vs is None:
            state = "SAFE"
        elif vs > limit:
            state = "BREACH"
        elif vs >= 0.90 * limit:
            state = "WARNING"
        elif vs >= 0.75 * limit:
            state = "CAUTION"
        else:
            state = "SAFE"

        return {
            "state": state,
            "vertical_speed_mps": vs,
            "limit_mps": limit,
        }