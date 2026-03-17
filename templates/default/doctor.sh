#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'
ROOT="$(cd "${0%/*}" 2>/dev/null && pwd)"
SERVER_DIR="$ROOT/assets/server"

ok=0
fail=0
warn=0

pass() {
  printf "  ${GREEN}OK${NC}  %s\n" "$1"
  ok=$((ok + 1))
}

fail() {
  printf "  ${RED}NO${NC}  %s — %s\n" "$1" "$2"
  fail=$((fail + 1))
}

skip() {
  printf "  ${YELLOW}--${NC}  %s — %s\n" "$1" "$2"
  warn=$((warn + 1))
}

echo ""
echo "${BOLD}Lumen Doctor${NC}"
echo ""

# --- Python ---
if command -v python3 &>/dev/null; then
  py_ver=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
  if python3 -c 'import sys; exit(0 if sys.version_info >= (3, 12) else 1)' 2>/dev/null; then
    pass "Python $py_ver"
  else
    fail "Python $py_ver" "3.12+ required (https://python.org)"
  fi
else
  fail "Python" "not found (https://python.org)"
fi

# --- uv ---
if command -v uv &>/dev/null; then
  uv_ver=$(uv --version 2>/dev/null | head -1)
  pass "uv ($uv_ver)"
else
  fail "uv" "curl -LsSf https://astral.sh/uv/install.sh | sh"
fi

# --- Modal ---
if command -v modal &>/dev/null; then
  pass "Modal CLI"
else
  fail "Modal CLI" "uv tool install modal"
fi

# --- VS Code ---
if command -v code &>/dev/null; then
  pass "VS Code"
else
  skip "VS Code" "optional, https://code.visualstudio.com"
fi

# --- Summary ---
echo ""
if [[ $fail -eq 0 ]]; then
  echo "${GREEN}All checks passed.${NC}"
  echo ""

  if [[ -d "$SERVER_DIR" ]]; then
    echo "Bootstrapping server..."
    (
      cd "$SERVER_DIR"
      uv sync
    )
    echo ""
  fi

  echo "Ready."
  echo "  1. Open this folder in VS Code"
  echo "  2. Open lumen.config.json"
  echo "  3. Start the server from the Lumen workspace home"
else
  echo "${RED}$fail check(s) failed.${NC} Install missing dependencies and re-run:"
  echo "  bash doctor.sh"
fi
