from __future__ import annotations


def smooth_point(prev: dict | None, current: dict, gain: float = 0.2) -> dict:
    """
    Simple Kalman-like exponential smoothing for replay points.

    prev and current should contain:
      - lat
      - lng
      - alt
    """
    if prev is None:
        return {
            "lat": float(current["lat"]),
            "lng": float(current["lng"]),
            "alt": float(current["alt"]),
        }

    k = float(gain)

    return {
        "lat": float(prev["lat"]) + k * (float(current["lat"]) - float(prev["lat"])),
        "lng": float(prev["lng"]) + k * (float(current["lng"]) - float(prev["lng"])),
        "alt": float(prev["alt"]) + k * (float(current["alt"]) - float(prev["alt"])),
    }