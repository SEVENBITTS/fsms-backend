from __future__ import annotations


def predict_ttb(margin_m: float | None, vertical_speed_mps: float | None) -> float | None:
    """
    Predict time-to-breach in seconds for an upper-limit breach.

    Returns:
      - None if prediction cannot be made
      - 0 if already breached
      - positive seconds otherwise
    """
    if margin_m is None:
        return None

    if vertical_speed_mps is None:
        return None

    if vertical_speed_mps <= 0:
        return None

    if margin_m <= 0:
        return 0.0

    return float(margin_m) / float(vertical_speed_mps)


def predict_breach_time_ms(
    current_t_ms: float | None,
    margin_m: float | None,
    vertical_speed_mps: float | None,
) -> float | None:
    """
    Predict breach timestamp in epoch milliseconds.
    """
    ttb = predict_ttb(margin_m, vertical_speed_mps)

    if ttb is None:
        return None

    if current_t_ms is None:
        return None

    return float(current_t_ms) + (ttb * 1000.0)


def classify_prediction(margin_m: float | None, ttb_s: float | None) -> dict:
    """
    Return a simple prediction state for UI / alerting.
    """
    if margin_m is None:
        return {"state": "UNKNOWN", "show_warning": False, "message": ""}

    if margin_m < 0:
        return {
            "state": "BREACH",
            "show_warning": True,
            "message": "BREACH — IMMEDIATE ACTION",
        }

    if ttb_s is not None and ttb_s <= 30:
        return {
            "state": "WARNING",
            "show_warning": True,
            "message": f"PREDICTED BREACH IN {round(ttb_s)}s",
        }

    if margin_m <= 20:
        return {
            "state": "WARNING",
            "show_warning": True,
            "message": "WARNING — LOW MARGIN",
        }

    if margin_m <= 50:
        return {
            "state": "CAUTION",
            "show_warning": True,
            "message": "CAUTION — MARGIN REDUCING",
        }

    return {
        "state": "SAFE",
        "show_warning": False,
        "message": "",
    }