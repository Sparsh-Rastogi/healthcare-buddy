"""
Supabase JWT authentication middleware.

In DEVELOPMENT_MODE=true the JWT signature check is bypassed — the token is
decoded without verification so you can test any endpoint from Swagger UI
using a dummy JWT payload.  Never deploy with DEVELOPMENT_MODE=true.
"""

import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.config import get_settings

logger = logging.getLogger(__name__)
_bearer = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> str:
    """
    FastAPI dependency that validates a Supabase JWT and returns the user_id (sub claim).

    Usage:
        @router.get("/me")
        async def me(user_id: str = Depends(get_current_user)):
            ...
    """
    settings = get_settings()
    token = credentials.credentials

    if settings.DEVELOPMENT_MODE:
        # ── Dev bypass: decode without signature verification ──────────────
        logger.debug("[Auth] 🛠️  DEVELOPMENT_MODE — skipping JWT signature check.")
        try:
            payload = jwt.get_unverified_claims(token)
        except JWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Cannot parse dev token: {exc}",
            )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is missing the 'sub' (user_id) claim.",
            )
        return user_id

    # ── Production: full HS256 verification against Supabase JWT secret ───
    if not settings.SUPABASE_JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_JWT_SECRET is not configured on the server.",
        )

    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},  # Supabase doesn't always include aud
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing the 'sub' (user_id) claim.",
        )
    return user_id
