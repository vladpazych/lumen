"""CLI entry point — lumen-sdk sync."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

ASSETS_DIR = Path(__file__).parent / "_assets"


def sync() -> None:
    """Copy framework assets (serve.py, CLAUDE.md, skills) into the current project."""
    # serve.py → cwd (Modal entry point)
    src_serve = ASSETS_DIR / "serve.py"
    if src_serve.exists():
        shutil.copy2(src_serve, "serve.py")

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


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: lumen-sdk sync", file=sys.stderr)
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "sync":
        sync()
        print("Synced framework assets.")
    else:
        print(f"Unknown command: {cmd}", file=sys.stderr)
        sys.exit(1)
