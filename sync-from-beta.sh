#!/usr/bin/env bash
#
# sync-from-beta.sh  (run this ON THE OTHER DESKTOP, inside the project folder)
# ----------------------------------------------------------------------------
# Overlay-update a project folder to the LATEST origin/beta WITHOUT:
#   - adding files that don't already exist in the folder
#   - deleting / overwriting extra files the folder has beyond beta
#   - touching ignored stuff (.env, node_modules, .next, out, ...)
#
# Only files that exist in BOTH the folder and origin/beta are updated.
#
# USAGE:
#   ./sync-from-beta.sh                 # dry-run preview (safe, no writes)
#   ./sync-from-beta.sh --apply         # actually copy shared files
#   ./sync-from-beta.sh --apply <repo-url>   # if CWD is not a git repo,
#                                            clone <repo-url> @ beta to temp first
#
# Optional env:
#   GIT_URL   repo URL to clone when CWD is not a git repo
#   REF       branch/ref to sync (default: origin/beta)
# ----------------------------------------------------------------------------
set -euo pipefail

APPLY=0
REPO_URL="${GIT_URL:-https://github.com/OM4Acier/Acier-Steel-Pvt-Ltd-Front-End.git}"
REF="${REF:-origin/beta}"

for a in "$@"; do
  case "$a" in
    --apply) APPLY=1 ;;
    --dry-run) APPLY=0 ;;
    http*://*) REPO_URL="$a" ;;
    *) REF="$a" ;;
  esac
done

TARGET="$(pwd)"
TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

echo ">> Resolving $REF ..."
if [ -d "$TARGET/.git" ]; then
  ( cd "$TARGET" && git fetch origin --quiet )
  SRC="$TARGET"
  ( cd "$SRC" && git archive "$REF" ) | tar -x -C "$TMP"
else
  echo "   CWD is not a git repo -> shallow-cloning $REPO_URL @ beta"
  git clone --depth 1 --branch beta "$REPO_URL" "$TMP/repo" --quiet
  REF="beta"
  # move clone contents up so find sees top-level files
  mv "$TMP/repo"/* "$TMP"/ 2>/dev/null || true
  # also hidden files
  shopt -s dotglob
  for x in "$TMP/repo"/.[!.]*; do [ -e "$x" ] && mv "$x" "$TMP"/; done
  shopt -u dotglob
  rm -rf "$TMP/repo"
fi

# Files present in the target folder (exclude build/ignored dirs).
mapfile -t LOCAL < <(
  cd "$TARGET"
  find . -type f \
    -not -path './.git/*' \
    -not -path './node_modules/*' \
    -not -path './.next/*' \
    -not -path './out/*' \
    | sed 's#^\./##' | sort -u
)

# Files present in the beta source.
mapfile -t BETA < <(
  cd "$TMP"
  find . -type f \
    -not -path './node_modules/*' \
    | sed 's#^\./##' | sort -u
)

UPDATED=0
SKIPPED_NEW=0
PRESERVED_EXTRA=0

echo ">> Plan:"
for f in "${LOCAL[@]}"; do
  if [ -f "$TMP/$f" ]; then
    if [ $APPLY -eq 1 ]; then
      mkdir -p "$TARGET/$(dirname "$f")"
      cp -f "$TMP/$f" "$TARGET/$f"
    fi
    echo "   UPDATE  $f"
    UPDATED=$((UPDATED+1))
  else
    echo "   KEEP    $f   (extra in folder, not in beta)"
    PRESERVED_EXTRA=$((PRESERVED_EXTRA+1))
  fi
done

echo ">> In beta but ABSENT from folder (will NOT be added):"
for f in "${BETA[@]}"; do
  if [ ! -f "$TARGET/$f" ]; then
    echo "   SKIP    $f"
    SKIPPED_NEW=$((SKIPPED_NEW+1))
  fi
done

echo
echo "================ SYNC SUMMARY ================"
echo "Updated (common files):     $UPDATED"
echo "Preserved (extra in folder): $PRESERVED_EXTRA"
echo "Skipped new (beta only):     $SKIPPED_NEW"
echo "=============================================="
if [ $APPLY -eq 0 ]; then
  echo "DRY-RUN only. Re-run with --apply to write the shared files."
else
  echo "Folder aligned to $REF for all shared files. Extras preserved."
fi
