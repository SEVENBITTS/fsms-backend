from copy import deepcopy


def make_four_d_conflict_variant(points):
    ownship = deepcopy(points)

    intruder = []
    for i, p in enumerate(points):
        intruder.append({
            "lat": p["lat"] + 0.0008 - (i * 0.00015),
            "lon": p["lon"] - 0.0008 + (i * 0.00015),
            "altitude_m": p["altitude_m"],
            "timestamp": p["timestamp"],
        })

    return {
        "ownship": ownship,
        "intruder": intruder,
    }