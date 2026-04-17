from server import app


def test_health():
    client = app.test_client()
    response = client.get("/health")

    assert response.status_code in (200, 500)

    data = response.get_json()
    assert "ok" in data
    assert "service" in data
    assert "db" in data
    assert "ts_utc" in data