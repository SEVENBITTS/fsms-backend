from copy import deepcopy   # 👈 put it here (top of file)


def make_vertical_breach_variant(points):
    variant = deepcopy(points)

    variant[2]["altitude_m"] = 120.0
    variant[3]["altitude_m"] = 145.0
    variant[4]["altitude_m"] = 150.0
    variant[5]["altitude_m"] = 140.0

    return variant