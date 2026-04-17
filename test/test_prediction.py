from services.prediction_service import (
    predict_ttb,
    predict_breach_time_ms,
    classify_prediction,
)


def test_predict_ttb_none_margin():
    assert predict_ttb(None, 2.0) is None


def test_predict_ttb_none_vs():
    assert predict_ttb(20.0, None) is None


def test_predict_ttb_descending():
    assert predict_ttb(20.0, -1.0) is None


def test_predict_ttb_breach_now():
    assert predict_ttb(-5.0, 1.0) == 0.0


def test_predict_ttb_normal():
    assert predict_ttb(20.0, 2.0) == 10.0


def test_predict_breach_time_ms():
    assert predict_breach_time_ms(1000.0, 20.0, 2.0) == 11000.0


def test_classify_prediction_breach():
    result = classify_prediction(-1.0, 0.0)
    assert result["state"] == "BREACH"
    assert result["show_warning"] is True


def test_classify_prediction_warning_ttb():
    result = classify_prediction(40.0, 15.0)
    assert result["state"] == "WARNING"


def test_classify_prediction_safe():
    result = classify_prediction(100.0, None)
    assert result["state"] == "SAFE"