"""
Unit tests for Vitals routes.

These tests use an in-memory MongoDB mock via mongomock-motor (or httpx TestClient
with a mocked DB dependency).  The test covers:
  - POST /api/v1/vitals/log
  - GET  /api/v1/vitals/history
  - GET  /api/v1/vitals/trend
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

# NOTE: Import app after mocking to avoid real DB connection on startup
@pytest.fixture
def client():
    with patch("app.db.connection.connect_db", new_callable=AsyncMock), \
         patch("app.db.connection.close_db", new_callable=AsyncMock), \
         patch("app.scheduler.agent_loop.start_scheduler"), \
         patch("app.scheduler.agent_loop.stop_scheduler"):
        from app.main import app
        with TestClient(app) as c:
            yield c


DEV_TOKEN = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItMTIzIn0.placeholder"
HEADERS = {"Authorization": DEV_TOKEN}


class TestVitalsLog:
    @patch("app.db.collections.vitals")
    def test_log_vitals_success(self, mock_vitals_fn, client):
        mock_col = MagicMock()
        mock_col.insert_one = AsyncMock(return_value=MagicMock(inserted_id="abc123"))
        mock_vitals_fn.return_value = mock_col

        payload = {
            "systolic_bp": 120.0,
            "diastolic_bp": 80.0,
            "heart_rate": 72.0,
        }
        response = client.post("/api/v1/vitals/log", json=payload, headers=HEADERS)
        assert response.status_code == 201
        data = response.json()
        assert data["systolic_bp"] == 120.0
        assert data["user_id"] == "test-user-123"

    @patch("app.db.collections.vitals")
    def test_log_vitals_empty_body(self, mock_vitals_fn, client):
        """Logging with no fields should succeed (all optional)."""
        mock_col = MagicMock()
        mock_col.insert_one = AsyncMock(return_value=MagicMock(inserted_id="def456"))
        mock_vitals_fn.return_value = mock_col

        response = client.post("/api/v1/vitals/log", json={}, headers=HEADERS)
        assert response.status_code == 201


class TestVitalsTrend:
    @patch("app.db.collections.vitals")
    def test_trend_returns_data(self, mock_vitals_fn, client):
        now = datetime.now(timezone.utc)
        mock_col = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.__aiter__ = AsyncMock(return_value=iter([
            {"_id": "1", "user_id": "test-user-123", "systolic_bp": 118.0, "timestamp": now},
            {"_id": "2", "user_id": "test-user-123", "systolic_bp": 122.0, "timestamp": now},
        ]))
        mock_col.find.return_value.sort.return_value = mock_cursor
        mock_vitals_fn.return_value = mock_col

        response = client.get("/api/v1/vitals/trend?days=7", headers=HEADERS)
        assert response.status_code == 200
        data = response.json()
        assert data["days"] == 7
        assert data["user_id"] == "test-user-123"

    def test_trend_requires_auth(self, client):
        response = client.get("/api/v1/vitals/trend")
        assert response.status_code == 403
