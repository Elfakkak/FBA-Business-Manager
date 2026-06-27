#!/bin/bash
# Auto-resize screenshots so they're small enough to read in chat (max 1500px wide).
# macOS `sips` is built-in — no install needed. Resizes in place (keeps PNG/JPG).
#
# Three ways to use it:
#   1) One-off:   bash scripts/shrink-shot.sh ~/Desktop/Screenshot*.png
#   2) Watch a folder (auto on every new shot) — needs fswatch (brew install fswatch):
#        fswatch -0 ~/Desktop | xargs -0 -n1 -I{} bash scripts/shrink-shot.sh "{}"
#   3) Automator Folder Action (no extra installs): see scripts/README-screenshots.md
MAX=${MAX:-1500}
for f in "$@"; do
  [ -f "$f" ] || continue
  case "$f" in
    *.png|*.PNG|*.jpg|*.JPG|*.jpeg|*.JPEG)
      w=$(sips -g pixelWidth "$f" 2>/dev/null | awk '/pixelWidth/{print $2}')
      if [ -n "$w" ] && [ "$w" -gt "$MAX" ]; then
        sips -Z "$MAX" "$f" >/dev/null 2>&1 && echo "shrunk $(basename "$f") ${w}px -> ${MAX}px"
      fi
      ;;
  esac
done
