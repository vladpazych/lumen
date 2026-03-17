from __future__ import annotations

import secrets
from pathlib import Path

auth_path = Path(".authkey")
if not auth_path.exists():
    auth_path.write_text(secrets.token_urlsafe(32))
