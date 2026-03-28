from typing import Any, Dict

from src.validation.runner.system_adapter import ValidationSystemAdapter


def capture_snapshot(system: ValidationSystemAdapter, index: int) -> Dict[str, Any]:
    point = system.get_all_points()[index]
    truth = system.get_compliance_truth_for_index(index)
    prediction = system.get_prediction_for_point(index)

    four_d_truth = None
    four_d_prediction = None
    envelope_truth = None
    envelope_prediction = None

    if hasattr(system, "get_four_d_truth_for_index"):
        four_d_truth = system.get_four_d_truth_for_index(index)

    if hasattr(system, "get_four_d_prediction_for_index"):
        four_d_prediction = system.get_four_d_prediction_for_index(index)

    if hasattr(system, "get_envelope_truth_for_index"):
        envelope_truth = system.get_envelope_truth_for_index(index)

    if hasattr(system, "get_envelope_prediction_for_index"):
        envelope_prediction = system.get_envelope_prediction_for_index(index)

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
        "four_d_truth": four_d_truth,
        "four_d_prediction": four_d_prediction,
        "envelope_truth": envelope_truth,
        "envelope_prediction": envelope_prediction,
    }