#!/usr/bin/env bash
set -euo pipefail

REPO="vladpazych/lumen"
BRANCH="main"
TEMPLATE_DIR="templates/default"

# --- Check directory is empty ---
shopt -s dotglob nullglob
files=(*)
shopt -u dotglob nullglob
non_ignored=()
for f in "${files[@]}"; do
  [[ "$f" == ".git" || "$f" == ".DS_Store" ]] && continue
  non_ignored+=("$f")
done
if [[ ${#non_ignored[@]} -gt 0 ]]; then
  echo "Error: directory is not empty. Run this in an empty folder."
  echo "  mkdir my-project && cd my-project && curl -fsSL ... | bash"
  exit 1
fi

echo "Scaffolding Lumen project..."

# --- Download and extract template ---
curl -fsSL "https://github.com/$REPO/archive/$BRANCH.tar.gz" \
  | tar xz --strip-components=2 "lumen-$BRANCH/$TEMPLATE_DIR/"

chmod +x doctor.sh

echo ""
echo "Running doctor to check prerequisites..."
echo ""

# Hand off TTY so interactive prompts work even through pipe
exec bash ./doctor.sh
