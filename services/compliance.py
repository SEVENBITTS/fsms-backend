def to_meters(value, unit):
    if value is None:
        return None

    if unit is None:
        return float(value)

    u = str(unit).strip().lower()

    if u in ("m", "meter", "meters", "metre", "metres"):
        return float(value)

    if u in ("ft", "feet"):
        return float(value) * 0.3048

    if u in ("fl", "flightlevel"):
        return float(value) * 100.0 * 0.3048

    # Unknown unit -> assume meters
    return float(value)


def is_agl(ref):
    if ref is None:
        return False

    r = str(ref).strip().lower()
    return any(k in r for k in ("agl", "gnd", "ground", "sfc", "surface"))


def eval_zone(point_alt_amsl_m, point_alt_agl_m, zone_row):
    """
    Returns:
      (breach: bool|None, eval_status: str, lower_m, upper_m)

    breach:
      - False: evaluated, no breach (or NO_ZONE)
      - True: evaluated, breach
      - None: cannot evaluate (NEEDS_TERRAIN / UNKNOWN_LIMITS)
    """
    if zone_row is None:
        return False, "NO_ZONE", None, None

    (
        _zid, _zname, _ztype, _zsource, _zext,
        lower_v, lower_u, lower_ref,
        upper_v, upper_u, upper_ref,
        _props,
    ) = zone_row

    lower_m = to_meters(lower_v, lower_u)
    upper_m = to_meters(upper_v, upper_u)

    use_agl = is_agl(lower_ref) or is_agl(upper_ref)

    if lower_m is None and upper_m is None:
        return None, "UNKNOWN_LIMITS", None, None

    if use_agl and point_alt_agl_m is None:
        return None, "NEEDS_TERRAIN", lower_m, upper_m

    alt = point_alt_agl_m if use_agl else point_alt_amsl_m
    basis = "AGL" if use_agl else "AMSL"

    breach = False

    if lower_m is not None and alt < lower_m:
        breach = True

    if upper_m is not None and alt > upper_m:
        breach = True

    return breach, (f"BREACH_{basis}" if breach else f"OK_{basis}"), lower_m, upper_m