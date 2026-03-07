"""CLI entry point — lumen-sdk serve | sync."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ASSETS_DIR = Path(__file__).parent / "_assets"


def sync() -> None:
    """Copy framework assets (CLAUDE.md, skills) into the current project."""
    # Server docs → CLAUDE.md in cwd
    src_claude = ASSETS_DIR / "CLAUDE.md"
    if src_claude.exists():
        shutil.copy2(src_claude, "CLAUDE.md")

    # Skills → .claude/skills/ relative to project root (parent of server dir)
    project_root = Path.cwd().parent
    claude_dir = project_root / ".claude"
    src_skills = ASSETS_DIR / "skills"
    if src_skills.is_dir():
        dst_skills = claude_dir / "skills"
        for skill_dir in src_skills.iterdir():
            if not skill_dir.is_dir():
                continue
            dst = dst_skills / skill_dir.name
            dst.mkdir(parents=True, exist_ok=True)
            for f in skill_dir.iterdir():
                shutil.copy2(f, dst / f.name)


def serve() -> None:
    """Run modal serve on the framework entry point."""
    import lumen_sdk.serve  # noqa: F401 — ensure module is importable

    serve_path = Path(lumen_sdk.serve.__file__)
    result = subprocess.run(
        [sys.executable, "-m", "modal", "serve", str(serve_path)],
        cwd=Path.cwd(),
    )
    sys.exit(result.returncode)


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: lumen-sdk <serve|sync>", file=sys.stderr)
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "serve":
        serve()
    elif cmd == "sync":
        sync()
        print("Synced framework assets.")
    else:
        print(f"Unknown command: {cmd}", file=sys.stderr)
        sys.exit(1)
