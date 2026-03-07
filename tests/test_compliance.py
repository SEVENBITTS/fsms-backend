from services.compliance import eval_zone

def test_breach_upper_agl():
    zone_row = (
        "id", "name", "restricted", "source", "ext",
        0, "m", "SFC",
        400, "ft", "AGL",
        {}
    )

    breach, status, lower_m, upper_m = eval_zone(
        point_alt_amsl_m=200,
        point_alt_agl_m=150,
        zone_row=zone_row
    )

    assert breach is True
    assert status == "BREACH_AGL"