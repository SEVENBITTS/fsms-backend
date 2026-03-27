from copy import deepcopy


def make_borderline_ceiling_variant(points):
    variant = deepcopy(points)

    # Keep the peak close to the ceiling, but below breach.
    variant[2]["altitude_m"] = 110.0
    variant[3]["altitude_m"] = 118.0
    variant[4]["altitude_m"] = 121.0
    variant[5]["altitude_m"] = 119.0
    variant[6]["altitude_m"] = 112.0

    return variant