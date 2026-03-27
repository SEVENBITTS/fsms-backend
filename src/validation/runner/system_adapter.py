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