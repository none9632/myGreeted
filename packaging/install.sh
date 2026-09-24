#!/usr/bin/env bash
# ── Installing my-greeter ─────────────────────────────────────────────────────
# Lays the login screen out where the `greeter` user can read it (they have no
# home directory, so ~ is out):
#
#   /usr/share/my-greeter/   — the application, its colours and the wallpaper
#   /var/cache/my-greeter/   — the last selected user and session
#   /usr/share/my-greeter/hyprland.conf — the minimal compositor for logging in
#
# The script does NOT touch /etc/greetd/config.toml and does not enable any
# services: it prints what is left to do by hand at the end.
#
# The lock screen is not involved here — it runs as the live user straight out of
# the working copy.

set -euo pipefail

PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET=/usr/share/my-greeter
CACHE=/var/cache/my-greeter
GREETER_USER=greeter

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Root is required, re-running through sudo…"
  exec sudo -E "$0" "$@"
fi

if ! id "$GREETER_USER" >/dev/null 2>&1; then
  echo "error: there is no $GREETER_USER user — install greetd" >&2
  exit 1
fi

for dep in ags sass Hyprland; do
  command -v "$dep" >/dev/null 2>&1 || {
    echo "error: $dep not found" >&2
    exit 1
  }
done

echo "→ installing the application into $TARGET"
install -d -m 0755 "$TARGET"
for dir in shared greeter; do
  rm -rf "${TARGET:?}/$dir"
  cp -r "$PROJECT/$dir" "$TARGET/$dir"
done
install -m 0644 "$PROJECT/package.json" "$PROJECT/tsconfig.json" "$PROJECT/env.d.ts" "$TARGET/"

# AGS resolves the "ags" and "gnim" imports through node_modules; in the system
# tree we keep them as symlinks to the packaged library rather than as a copy.
install -d -m 0755 "$TARGET/node_modules"
ln -sfn /usr/share/ags/js "$TARGET/node_modules/ags"
ln -sfn /usr/share/ags/js/node_modules/gnim "$TARGET/node_modules/gnim"

echo "→ installing the Hyprland config for the login screen"
install -m 0644 "$PROJECT/packaging/hypr/greeter.conf" "$TARGET/hyprland.conf"

echo "→ preparing $CACHE for the $GREETER_USER user"
install -d -m 0755 -o "$GREETER_USER" -g "$GREETER_USER" "$CACHE"

# Wallpaper: seed it from the current wallpaper of whoever is installing, unless
# one is already in place. Replacing it later is a plain copy over the same path.
if [[ ! -e "$TARGET/wallpaper" ]]; then
  REAL_USER="${SUDO_USER:-}"
  if [[ -n "$REAL_USER" ]]; then
    REAL_HOME="$(getent passwd "$REAL_USER" | cut -d: -f6)"
    STATE="$REAL_HOME/.cache/current_wallpaper.txt"
    if [[ -f "$STATE" ]]; then
      WALL="$(cat "$STATE")"
      [[ -f "$WALL" ]] && install -m 0644 "$WALL" "$TARGET/wallpaper" &&
        echo "→ wallpaper taken from the current session: $WALL"
    fi
  fi
fi

chmod -R a+rX "$TARGET"

cat <<'NEXT'

Done. The rest is by hand — the installer does not touch system files:

  1. Point greetd at the greeter — /etc/greetd/config.toml:

       [terminal]
       vt = 1

       [default_session]
       command = "Hyprland -c /usr/share/my-greeter/hyprland.conf"
       user = "greeter"

     (a sample sits in packaging/greetd-config.toml)

  2. Switch the login manager over:

       sudo systemctl disable sddm
       sudo systemctl enable greetd

     That takes effect after a reboot. You can check the screen earlier, without
     turning anything off, right inside the current session:

       GDK_DEBUG=high-depth ags run ~/Projects/myGreeter/greeter/app.ts

  3. The login screen's wallpaper is /usr/share/my-greeter/wallpaper, seeded
     just now from your current session. To change it later:

       sudo install -m 0644 /path/to/image /usr/share/my-greeter/wallpaper

NEXT
