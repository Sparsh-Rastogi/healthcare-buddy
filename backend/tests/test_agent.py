"""
Unit tests for BayMax AI Agent.

Covers:
  - API key resolution (DB → env fallback)
  - Tool input parsing edge cases (malformed JSON)
  - Alert severity routing
  - run_agent with mocked executor
"""

import json
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch


class TestApiKeyResolution:
    @pytest.mark.asyncio
    async def test_uses_decrypted_db_key(self):
        """Should decrypt and return the stored key when present."""
        from unittest.mock import AsyncMock, patch
        from app.ai.agent import _resolve_api_key

        mock_user = {"user_id": "u1", "groq_api_key": "encrypted_blob"}
        with patch("app.db.collections.users") as mock_col_fn, \
             patch("app.config.decrypt_key", return_value="real-groq-key-123"):
            mock_col = MagicMock()
            mock_col.find_one = AsyncMock(return_value=mock_user)
            mock_col_fn.return_value = mock_col

            key = await _resolve_api_key("u1")
            assert key == "real-groq-key-123"

    @pytest.mark.asyncio
    async def test_falls_back_to_env_key(self):
        """Should fall back to GROQ_API_KEY env var when DB key is absent."""
        import os
        from app.ai.agent import _resolve_api_key

        with patch("app.db.collections.users") as mock_col_fn, \
             patch.dict(os.environ, {"GROQ_API_KEY": "env-fallback-key"}):
            mock_col = MagicMock()
            mock_col.find_one = AsyncMock(return_value={"user_id": "u2"})
            mock_col_fn.return_value = mock_col

            key = await _resolve_api_key("u2")
            assert key == "env-fallback-key"

    @pytest.mark.asyncio
    async def test_returns_empty_when_no_key(self):
        """Should return empty string when neither DB nor env key is available."""
        import os
        from app.ai.agent import _resolve_api_key

        with patch("app.db.collections.users") as mock_col_fn, \
             patch.dict(os.environ, {}, clear=True):
            mock_col = MagicMock()
            mock_col.find_one = AsyncMock(return_value=None)
            mock_col_fn.return_value = mock_col

            # Remove env key if set
            os.environ.pop("GROQ_API_KEY", None)
            key = await _resolve_api_key("u3")
            assert key == ""


class TestToolInputParsing:
    @pytest.mark.asyncio
    async def test_get_vitals_trend_invalid_json(self):
        """Tool should return an ERROR string on bad JSON input."""
        from app.ai.agent import get_vitals_trend
        result = await get_vitals_trend.ainvoke("not valid json at all")
        assert result.startswith("ERROR:")

    @pytest.mark.asyncio
    async def test_send_alert_invalid_severity(self):
        """Tool should reject unknown severity values."""
        from app.ai.agent import send_alert
        payload = json.dumps({"user_id": "u1", "severity": "catastrophic", "message": "test"})
        with patch("app.ai.alert.dispatch_alert", new_callable=AsyncMock):
            result = await send_alert.ainvoke(payload)
            assert "Invalid severity" in result

    @pytest.mark.asyncio
    async def test_log_action_missing_field(self):
        """Tool should return ERROR when required 'action' field is missing."""
        from app.ai.agent import log_action
        payload = json.dumps({"user_id": "u1", "reasoning": "some reasoning"})
        result = await log_action.ainvoke(payload)
        assert result.startswith("ERROR:")


class TestAlertDispatcher:
    @pytest.mark.asyncio
    async def test_info_only_logs(self):
        """Info severity should only log — no email."""
        from app.ai.alert import dispatch_alert

        with patch("app.db.collections.agent_logs") as mock_col_fn, \
             patch("app.db.collections.users") as mock_user_fn:
            mock_col = MagicMock()
            mock_col.insert_one = AsyncMock()
            mock_col_fn.return_value = mock_col

            mock_user_col = MagicMock()
            mock_user_col.find_one = AsyncMock(return_value={"user_id": "u1", "email": "p@test.com"})
            mock_user_fn.return_value = mock_user_col

            result = await dispatch_alert("u1", "info", "Test info message")
            assert "logged_to_db" in result
            assert "emailed" not in result

    @pytest.mark.asyncio
    async def test_critical_emails_both(self):
        """Critical severity should attempt to email patient AND emergency contact."""
        from app.ai.alert import dispatch_alert

        with patch("app.db.collections.agent_logs") as mock_col_fn, \
             patch("app.db.collections.users") as mock_user_fn, \
             patch("app.ai.alert._send_email_stub", new_callable=AsyncMock) as mock_email:
            mock_col = MagicMock()
            mock_col.insert_one = AsyncMock()
            mock_col_fn.return_value = mock_col

            mock_user_col = MagicMock()
            mock_user_col.find_one = AsyncMock(return_value={
                "user_id": "u1",
                "name": "Test Patient",
                "email": "patient@test.com",
                "emergency_contact": "emergency@test.com",
            })
            mock_user_fn.return_value = mock_user_col

            await dispatch_alert("u1", "critical", "Critical vitals breach")
            assert mock_email.call_count == 2  # patient + emergency
