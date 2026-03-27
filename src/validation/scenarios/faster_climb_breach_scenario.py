from copy import deepcopy


def make_faster_climb_breach_variant(points):
    variant = deepcopy(points)

    variant[0]["altitude_m"] = 60.0
    variant[1]["altitude_m"] = 105.0
    variant[2]["altitude_m"] = 145.0
    variant[3]["altitude_m"] = 150.0
    variant[4]["altitude_m"] = 130.0
    variant[5]["altitude_m"] = 105.0

    return variant