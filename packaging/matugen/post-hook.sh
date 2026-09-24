#!/usr/bin/env bash
# Distributes fresh colours and wallpaper to where the production greeter reads
# them from.
#
# matugen calls this after rendering the template, passing the path to the image
# as the first argument. It copies both resources into /usr/share/my-greeter;
# that directory is system-owned, so the step goes through sudo. matugen does
# everything else itself.
#
# The lock screen does not look here: it runs as the live user and reads the
# wallpaper straight out of the session.

set -euo pipefail

WALLPAPER="${1:-}"
PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COLORS="$PROJECT/shared/style/colors.scss"
TARGET=/usr/share/my-greeter

if [[ ! -d "$TARGET" ]]; then
  echo "post-hook: $TARGET does not exist — run packaging/install.sh first" >&2
  exit 0
fi

# The colours go into the installed project tree rather than next to it: AGS
# compiles the SCSS on every startup and reads exactly this file.
sudo install -m 0644 "$COLORS" "$TARGET/shared/style/colors.scss"

if [[ -n "$WALLPAPER" && -f "$WALLPAPER" ]]; then
  sudo install -m 0644 "$WALLPAPER" "$TARGET/wallpaper"
fi

echo "post-hook: colours and wallpaper updated in $TARGET"
