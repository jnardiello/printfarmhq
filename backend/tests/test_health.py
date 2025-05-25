"""
Basic health check test to verify test setup is working.
"""


def test_app_health_check(client):
    """Test that the API is running and responding."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data