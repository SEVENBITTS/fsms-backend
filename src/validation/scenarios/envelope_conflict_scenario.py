from copy import deepcopy


def make_envelope_conflict_variant(points):
    variant = deepcopy(points)

    # 5-second spacing between points in your replay
    # climb rates become:
    # 60 -> 83  = 4.6 m/s   (CAUTION)
    # 83 -> 111 = 5.6 m/s   (WARNING)
    # 111 -> 146 = 7.0 m/s  (BREACH)
    variant[0]["altitude_m"] = 60.0
    variant[1]["altitude_m"] = 83.0
    variant[2]["altitude_m"] = 111.0
    variant[3]["altitude_m"] = 146.0
    variant[4]["altitude_m"] = 126.0
    variant[5]["altitude_m"] = 106.0

    return variant