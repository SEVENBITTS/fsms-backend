from typing import Any, Dict

from src.validation.runner.system_adapter import ValidationSystemAdapter


def capture_snapshot(system: ValidationSystemAdapter, index: int) -> Dict[str, Any]:
    point = system.get_all_points()[index]
    truth = system.get_compliance_truth_for_index(index)
    prediction = system.get_prediction_for_point(index)

    return {
        "index": index,
        "timestamp": point.get("timestamp"),
        "altitude_m": point.get("altitude_m"),

    "truth": {
        "breach": truth.get("breach") if truth else None,
        "status": truth.get("eval_status") if truth else None,
        "alt_agl_m": truth.get("alt_agl_m") if truth else None,
        "alt_amsl_m": truth.get("alt_amsl_m") if truth else None,
        "zone_upper_m": truth.get("zone", {}).get("upper_m") if truth else None,
},

        "prediction": prediction,
    }