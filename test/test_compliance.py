from services.compliance import to_meters, is_agl, eval_zone


def test_to_meters_m():
    assert to_meters(100, "m") == 100.0


def test_to_meters_ft():
    assert round(to_meters(100, "ft"), 4) == 30.48


def test_is_agl_true():
    assert is_agl("AGL") is True
    assert is_agl("surface") is True


def test_is_agl_false():
    assert is_agl("AMSL") is False
    assert is_agl(None) is False


def test_eval_zone_no_zone():
    breach, status, lower_m, upper_m = eval_zone(120.0, None, None)

    assert breach is False
    assert status == "NO_ZONE"


def test_eval_zone_upper_breach():
    zone_row = (
        1, "Test Zone", "restricted", "db", "ext",
        None, None, None,
        100, "m", "AMSL",
        {}
    )

    breach, status, lower_m, upper_m = eval_zone(120.0, None, zone_row)

    assert breach is True
    assert status == "BREACH_AMSL"


def test_eval_zone_needs_terrain():
    zone_row = (
        1, "Test Zone", "restricted", "db", "ext",
        None, None, None,
        100, "m", "AGL",
        {}
    )

    breach, status, lower_m, upper_m = eval_zone(120.0, None, zone_row)

    assert breach is None
    assert status == "NEEDS_TERRAIN"