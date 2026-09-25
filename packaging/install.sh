#!/usr/bin/env bash
# ── Installing my-greeter ─────────────────────────────────────────────────────
# Lays the login screen out where the `greeter` user can read it (they have no
# home directory, so ~ is out):
#
#   /usr/share/my-greeter/   — the application, its colours and the wallpaper
#   /var/cache/my-greeter/   — the last selected user and session
#   /usr/share/my-greeter/hyprland.conf — the minimal compositor for logging in
#
# Laying those out touches nothing else. Reaching the wallpaper collection,
# pointing greetd at the greeter and making it the login manager do touch things
# outside, so those three come last, each behind its own question, and none of
# them happens without a clear yes.
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

# Ask before anything that reaches outside /usr/share/my-greeter. Default is no,
# so a stray Enter changes nothing. Without a terminal on stdin (piped into a
# shell, run from a hook) the answer is no and the step is skipped.
ask() {
  local reply=""
  [[ -t 0 ]] || return 1
  read -r -p "$1 [y/N] " reply || reply=""
  [[ "$reply" == [Yy] || "$reply" == [Yy][Ee][Ss] ]]
}

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

# ── Wallpapers ────────────────────────────────────────────────────────────────
# The login screen picks a fresh picture from a pool on every boot. The pool is
# not copied: $TARGET/wallpapers is a symlink to the collection, so pictures
# added later show up at the login screen without reinstalling.
#
# A symlink grants no access of its own, though — the greeter user still has to
# be able to walk the path. That is the question further down.

REAL_USER="${SUDO_USER:-}"
REAL_HOME=""
if [[ -n "$REAL_USER" ]]; then
  REAL_HOME="$(getent passwd "$REAL_USER" | cut -d: -f6)"
fi
COLLECTION="${WALLPAPER_DIR:-${REAL_HOME:+$REAL_HOME/Pictures/wallpapers}}"

if [[ -n "$COLLECTION" && -d "$COLLECTION" ]]; then
  ln -sfn "$COLLECTION" "$TARGET/wallpapers"
  echo "→ wallpaper pool: $TARGET/wallpapers → $COLLECTION"

  # One picture copied in as well, so a bare install still has something to show
  # if the pool turns out to be unreachable.
  if [[ ! -e "$TARGET/wallpaper" ]]; then
    fallback="$(find "$COLLECTION" -type f -iregex '.*\.\(jpe?g\|png\|webp\)$' | shuf -n 1 || true)"
    if [[ -n "$fallback" ]]; then
      install -m 0644 "$fallback" "$TARGET/wallpaper"
      echo "→ fallback picture: $(basename "$fallback")"
    fi
  fi
else
  echo "→ no wallpaper collection found; the screen falls back to $TARGET/wallpaper"
fi

chmod -R a+rX "$TARGET"

# ── Reaching the collection as the greeter user ───────────────────────────────
# A home directory is 0700, and that stops the greeter at the very first
# component of the path: the symlink above resolves somewhere it cannot enter.
# chmod 0711 on the home would work but opens the way for everyone. An ACL is
# narrower — it grants search, not reading and not listing, to this one user on
# the directories that actually block the way.

can_reach() {
  runuser -u "$GREETER_USER" -- test -r "$1" 2>/dev/null &&
    runuser -u "$GREETER_USER" -- test -x "$1" 2>/dev/null
}

acl_ok=yes
acl_needed=no

if [[ -n "$COLLECTION" && -d "$COLLECTION" ]] && ! can_reach "$COLLECTION"; then
  acl_ok=no
  acl_needed=yes

  echo
  echo "$GREETER_USER cannot reach $COLLECTION — something on the way is closed:"
  # Judge each component by its own permissions, not by testing it as the
  # greeter: once something up the path denies search, everything below it fails
  # the test too, and granting them all would scatter pointless ACL entries over
  # directories that were never in the way.
  blockers=()
  probe=""
  IFS='/' read -r -a parts <<< "${COLLECTION#/}"
  for part in "${parts[@]}"; do
    probe="$probe/$part"
    mode="$(stat -c %A "$probe")"
    if [[ "${mode: -1}" != x ]]; then
      blockers+=("$probe")
      echo "    $probe  $mode"
    fi
  done

  echo
  echo "Granting search to $GREETER_USER on those, and nothing else, means:"
  for b in "${blockers[@]}"; do
    echo "    setfacl -m u:$GREETER_USER:--x $b"
  done
  echo "Other users are unaffected, and $GREETER_USER still cannot list them."

  if ! command -v setfacl >/dev/null 2>&1; then
    echo "setfacl not found — install the 'acl' package first."
  elif ask "Grant it?"; then
    for b in "${blockers[@]}"; do
      setfacl -m "u:$GREETER_USER:--x" "$b"
    done
    if can_reach "$COLLECTION"; then
      echo "→ $GREETER_USER can now read $COLLECTION"
      acl_ok=yes
    else
      echo "→ still unreachable; the screen will fall back to $TARGET/wallpaper"
    fi
  else
    echo "→ skipped"
  fi
fi

# ── greetd's own config ───────────────────────────────────────────────────────

GREETD_CONF=/etc/greetd/config.toml
SAMPLE="$PROJECT/packaging/greetd-config.toml"
config_ok=no

echo
if [[ -f "$GREETD_CONF" ]] && cmp -s "$SAMPLE" "$GREETD_CONF"; then
  echo "→ $GREETD_CONF already points at this greeter"
  config_ok=yes
else
  echo "greetd has to be told to start this greeter. The file would be:"
  echo
  sed 's/^/    /' "$SAMPLE"
  echo
  if [[ -f "$GREETD_CONF" ]]; then
    echo "$GREETD_CONF exists and differs — it would be copied aside first."
  fi
  if ask "Write $GREETD_CONF?"; then
    install -d -m 0755 "$(dirname "$GREETD_CONF")"
    if [[ -f "$GREETD_CONF" ]]; then
      backup="$GREETD_CONF.$(date +%Y%m%d-%H%M%S).bak"
      cp -a "$GREETD_CONF" "$backup"
      echo "→ previous config kept as $backup"
    fi
    install -m 0644 "$SAMPLE" "$GREETD_CONF"
    echo "→ wrote $GREETD_CONF"
    config_ok=yes
  else
    echo "→ skipped"
  fi
fi

# ── Which login manager runs at boot ──────────────────────────────────────────
# Both greetd and every other display manager claim the same
# display-manager.service alias, so the enabled one is whatever that symlink
# resolves to, and the old one has to be disabled before greetd can take it.

DM_LINK=/etc/systemd/system/display-manager.service
current_dm=""
if [[ -L "$DM_LINK" ]]; then
  current_dm="$(basename "$(readlink -f "$DM_LINK")")"
fi
switched=no

echo
if ! systemctl cat greetd.service >/dev/null 2>&1; then
  echo "greetd.service not found — cannot switch the login manager."
elif [[ "$current_dm" == "greetd.service" ]]; then
  echo "→ greetd is already the login manager"
  switched=yes
else
  if [[ -n "$current_dm" ]]; then
    echo "The login manager is currently ${current_dm%.service}. Switching means:"
    echo "    systemctl disable ${current_dm%.service}"
    echo "    systemctl enable greetd"
  else
    echo "No login manager is enabled. Switching means:"
    echo "    systemctl enable greetd"
  fi
  echo "Nothing happens to the running session; it takes effect on the next boot."
  if ask "Make greetd the login manager?"; then
    if [[ -n "$current_dm" ]]; then
      systemctl disable "$current_dm"
    fi
    systemctl enable greetd.service
    echo "→ greetd will run at the next boot"
    switched=yes
  else
    echo "→ skipped"
  fi
fi

# ── What is left ──────────────────────────────────────────────────────────────

echo
echo "Done."
echo
echo "Try the screen without rebooting, right inside this session:"
echo
echo "    GDK_DEBUG=high-depth ags run $PROJECT/greeter/app.ts"
echo

if [[ "$config_ok" == no || "$switched" == no || "$acl_ok" == no ]]; then
  echo "Still to do by hand:"
  if [[ "$acl_ok" == no ]]; then
    echo "  · let $GREETER_USER reach $COLLECTION (see the setfacl lines above)"
  fi
  if [[ "$config_ok" == no ]]; then
    echo "  · copy packaging/greetd-config.toml to $GREETD_CONF"
  fi
  if [[ "$switched" == no ]]; then
    if [[ -n "$current_dm" && "$current_dm" != "greetd.service" ]]; then
      echo "  · systemctl disable ${current_dm%.service} && systemctl enable greetd"
    else
      echo "  · systemctl enable greetd"
    fi
  fi
  echo
fi

if [[ "$acl_needed" == no && -L "$TARGET/wallpapers" ]]; then
  echo "Wallpapers come from $COLLECTION, one at random on every boot."
  echo
fi
