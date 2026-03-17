from __future__ import annotations

import os
from pathlib import Path

AUTH_ENV = "LUMEN_AUTH_TOKEN"
AUTH_KEY_FILE = ".authkey"


def read_auth_token() -> str:
    env_token = os.environ.get(AUTH_ENV, "").strip()
    if env_token:
        return env_token

    token_path = Path(AUTH_KEY_FILE)
    if token_path.exists():
        token = token_path.read_text().strip()
        if token:
            return token

    raise RuntimeError(
        f"Auth token not found. Set {AUTH_ENV} or create {AUTH_KEY_FILE}."
    )
