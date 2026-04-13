from services.smoothing import smooth_point


def test_first_point_returns_current():
    current = {"lat": 50.0, "lng": -1.0, "alt": 100.0}

    result = smooth_point(None, current)

    assert result["lat"] == 50.0
    assert result["lng"] == -1.0
    assert result["alt"] == 100.0


def test_smoothing_moves_toward_point():
    prev = {"lat": 50.0, "lng": -1.0, "alt": 100.0}
    current = {"lat": 51.0, "lng": -2.0, "alt": 110.0}

    result = smooth_point(prev, current, gain=0.2)

    assert round(result["lat"], 3) == 50.2
    assert round(result["lng"], 3) == -1.2
    assert round(result["alt"], 3) == 102.0