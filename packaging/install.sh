#!/usr/bin/env bash
# ── Installing my-greeter ─────────────────────────────────────────────────────
# Lays the login screen out where the `greeter` user can read it (they have no
# home directory, so ~ is out):
#
#   /usr/share/my-greeter/   — the application, its colours and the wallpaper
#   /var/cache/my-greeter/   — the last selected user and session
#   /usr/share/my-greeter/hyprland.lua  — the minimal compositor for logging in
#
# Laying those out touches nothing else. Reaching the wallpaper collection,
# pointing greetd at the greeter and making it the login manager do touch things
# outside, so those three come last, each behind its own question, and none of
# them happens without a clear yes.
#
# The lock screen is barely involved: it runs as the live user straight out of
# the working copy, so nothing of it is copied anywhere. Only its launcher is
# offered a place in that user's PATH, behind a question of its own.

set -euo pipefail

PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REAL_USER="${SUDO_USER:-}"
REAL_HOME=""
if [[ -n "$REAL_USER" ]]; then
  REAL_HOME="$(getent passwd "$REAL_USER" | cut -d: -f6)"
fi
TARGET=/usr/share/my-greeter
CACHE=/var/cache/my-greeter
GREETER_USER=greeter

# ── Colour ────────────────────────────────────────────────────────────────────
# Only when a terminal is watching: this script is piped and logged often enough,
# and escape sequences in a log are worse than no colour at all. NO_COLOR is
# honoured for the same reason. The eight basic colours and nothing else, so the
# output follows whatever palette the terminal already uses.

if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  C_BOLD=$'\e[1m'
  C_DIM=$'\e[2m'
  C_OK=$'\e[32m'
  C_WARN=$'\e[33m'
  C_ERR=$'\e[31m'
  C_OFF=$'\e[0m'
else
  C_BOLD="" C_DIM="" C_OK="" C_WARN="" C_ERR="" C_OFF=""
fi

# Four shapes, and the colour is what tells them apart at a glance: something was
# done, something was not, something is worth knowing, something went wrong.
# Plain prose stays plain — colouring every line would say nothing at all.
step() { printf '%s→%s %s\n' "$C_OK" "$C_OFF" "$*"; }
skip() { printf '%s→%s %s\n' "$C_WARN" "$C_OFF" "$*"; }
warn() { printf '%s%s%s\n' "$C_WARN" "$*" "$C_OFF"; }
die() {
  printf '%serror:%s %s\n' "$C_ERR" "$C_OFF" "$*" >&2
  exit 1
}

# A question, and the line that sets it up, are what the eye should land on.
title() { printf '%s%s%s\n' "$C_BOLD" "$*" "$C_OFF"; }

# Something to read rather than to act on: a file, a command, a set of
# permissions. Dimmed and indented, so a printed file cannot be taken for the
# script speaking.
quote() { printf '%s    %s%s\n' "$C_DIM" "$*" "$C_OFF"; }
quote_file() {
  printf '%s' "$C_DIM"
  sed 's/^/    /' "$1"
  printf '%s' "$C_OFF"
}

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Root is required, re-running through sudo…"
  exec sudo -E "$0" "$@"
fi

if ! id "$GREETER_USER" >/dev/null 2>&1; then
  die "there is no $GREETER_USER user — install greetd"
fi

for dep in ags sass Hyprland start-hyprland; do
  command -v "$dep" >/dev/null 2>&1 || die "$dep not found"
done

# Ask before anything that reaches outside /usr/share/my-greeter. Default is no,
# so a stray Enter changes nothing. Without a terminal on stdin (piped into a
# shell, run from a hook) the answer is no and the step is skipped.
ask() {
  local reply=""
  [[ -t 0 ]] || return 1
  read -r -p "$C_BOLD$1$C_OFF [y/N] " reply || reply=""
  [[ "$reply" == [Yy] || "$reply" == [Yy][Ee][Ss] ]]
}

# Read a path, offering a default. Same rule as ask(): with no terminal the
# default stands, so an unattended run still gets something sensible.
ask_path() {
  local prompt="$1" default="$2" reply=""
  if [[ ! -t 0 ]]; then
    printf '%s' "$default"
    return
  fi
  read -r -p "$C_BOLD$prompt$C_OFF $C_DIM[$default]$C_OFF " reply || reply=""
  reply="${reply:-$default}"
  # read does not expand a leading ~, and typing one is the natural thing to do.
  [[ "$reply" == "~/"* ]] && reply="${REAL_HOME}/${reply#\~/}"
  printf '%s' "$reply"
}

step "installing the application into $TARGET"
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

step "installing the Hyprland config for the login screen"
# Lua, not hyprlang: 0.56 warns the old format is going away in 0.57. A config
# left over from an install that predates the switch would only confuse.
rm -f "$TARGET/hyprland.conf"
install -m 0644 "$PROJECT/packaging/hypr/greeter.lua" "$TARGET/hyprland.lua"

step "preparing $CACHE for the $GREETER_USER user"
install -d -m 0755 -o "$GREETER_USER" -g "$GREETER_USER" "$CACHE"

# ── Wallpapers ────────────────────────────────────────────────────────────────
# The login screen picks a fresh picture from a directory on every boot. The
# directory is not copied and not linked: its path is written into the installed
# Hyprland config as WALLPAPER_DIR, so it is visible in the config rather than
# hidden behind a symlink, and pictures added later show up without reinstalling.

COLLECTION=""
echo
title "The login screen picks a random wallpaper from a directory on every boot."
# Enter takes the default, so skipping needs a token of its own — an empty line
# cannot mean both "the default" and "none at all".
for _ in 1 2 3; do
  answer="$(ask_path "Wallpaper directory, or - for none" "$REAL_HOME/Pictures/wallpapers")"
  if [[ "$answer" == "-" ]]; then
    break
  elif [[ -d "$answer" ]]; then
    COLLECTION="$answer"
    break
  fi
  warn "no such directory: $answer"
done

# A stale symlink from an older install would quietly win over the variable.
rm -f "$TARGET/wallpapers"

if [[ -n "$COLLECTION" ]]; then
  # Placed next to the other hl.env calls rather than appended at the end: the
  # config is copied fresh on every run, so this is always an insert into a
  # clean file, and grouping them keeps the question of ordering from arising
  # at all.
  awk -v dir="$COLLECTION" '
    /^hl\.env\(/ { last = NR }
    { lines[NR] = $0 }
    END {
      for (i = 1; i <= NR; i++) {
        print lines[i]
        if (i == last) {
          print ""
          print "-- Where the login screen takes its wallpapers from. Written by install.sh."
          printf "hl.env(\"WALLPAPER_DIR\", \"%s\")\n", dir
        }
      }
      if (!last) {
        print ""
        print "-- Where the login screen takes its wallpapers from. Written by install.sh."
        printf "hl.env(\"WALLPAPER_DIR\", \"%s\")\n", dir
      }
    }
  ' "$TARGET/hyprland.lua" > "$TARGET/hyprland.lua.new"
  mv "$TARGET/hyprland.lua.new" "$TARGET/hyprland.lua"
  step "wallpapers: $COLLECTION (recorded in $TARGET/hyprland.lua)"

  # One picture copied in as well, so a bare install still has something to show
  # if the directory turns out to be unreachable.
  if [[ ! -e "$TARGET/wallpaper" ]]; then
    fallback="$(find "$COLLECTION" -type f -iregex '.*\.\(jpe?g\|png\|webp\)$' | shuf -n 1 || true)"
    if [[ -n "$fallback" ]]; then
      install -m 0644 "$fallback" "$TARGET/wallpaper"
      step "fallback picture: $(basename "$fallback")"
    fi
  fi
else
  skip "no wallpaper directory; the screen falls back to $TARGET/wallpaper"
fi

# Stamp what was installed. The application is copied, not linked, so a change
# in the working copy does not reach the login screen until this runs again —
# and that is invisible without something to compare against.
{
  echo "installed: $(date -Is)"
  echo "source:    $PROJECT"
  git -C "$PROJECT" rev-parse --short HEAD 2>/dev/null | sed 's/^/commit:    /' || true
} > "$TARGET/.installed"

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
  warn "$GREETER_USER cannot reach $COLLECTION — something on the way is closed:"
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
      quote "$probe  $mode"
    fi
  done

  echo
  title "Granting search to $GREETER_USER on those, and nothing else, means:"
  for b in "${blockers[@]}"; do
    quote "setfacl -m u:$GREETER_USER:--x $b"
  done
  echo "Other users are unaffected, and $GREETER_USER still cannot list them."

  if ! command -v setfacl >/dev/null 2>&1; then
    warn "setfacl not found — install the 'acl' package first."
  elif ask "Grant it?"; then
    for b in "${blockers[@]}"; do
      setfacl -m "u:$GREETER_USER:--x" "$b"
    done
    if can_reach "$COLLECTION"; then
      step "$GREETER_USER can now read $COLLECTION"
      acl_ok=yes
    else
      warn "still unreachable; the screen will fall back to $TARGET/wallpaper"
    fi
  else
    skip "skipped"
  fi
fi

# ── greetd's own config ───────────────────────────────────────────────────────

GREETD_CONF=/etc/greetd/config.toml
SAMPLE="$PROJECT/packaging/greetd-config.toml"
config_ok=no

echo
if [[ -f "$GREETD_CONF" ]] && cmp -s "$SAMPLE" "$GREETD_CONF"; then
  step "$GREETD_CONF already points at this greeter"
  config_ok=yes
else
  title "greetd has to be told to start this greeter. The file would be:"
  echo
  quote_file "$SAMPLE"
  echo
  if [[ -f "$GREETD_CONF" ]]; then
    warn "$GREETD_CONF exists and differs — it would be copied aside first."
  fi
  if ask "Write $GREETD_CONF?"; then
    install -d -m 0755 "$(dirname "$GREETD_CONF")"
    if [[ -f "$GREETD_CONF" ]]; then
      backup="$GREETD_CONF.$(date +%Y%m%d-%H%M%S).bak"
      cp -a "$GREETD_CONF" "$backup"
      step "previous config kept as $backup"
    fi
    install -m 0644 "$SAMPLE" "$GREETD_CONF"
    step "wrote $GREETD_CONF"
    config_ok=yes
  else
    skip "skipped"
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
  warn "greetd.service not found — cannot switch the login manager."
elif [[ "$current_dm" == "greetd.service" ]]; then
  step "greetd is already the login manager"
  switched=yes
else
  if [[ -n "$current_dm" ]]; then
    title "The login manager is currently ${current_dm%.service}. Switching means:"
    quote "systemctl disable ${current_dm%.service}"
    quote "systemctl enable greetd"
  else
    title "No login manager is enabled. Switching means:"
    quote "systemctl enable greetd"
  fi
  echo "Nothing happens to the running session; it takes effect on the next boot."
  if ask "Make greetd the login manager?"; then
    if [[ -n "$current_dm" ]]; then
      systemctl disable "$current_dm"
    fi
    systemctl enable greetd.service
    step "greetd will run at the next boot"
    switched=yes
  else
    skip "skipped"
  fi
fi

# ── The lock screen's launcher ────────────────────────────────────────────────
# Everything above is the login screen. The locker is the other half of the same
# working copy and needs none of that: it runs as the live user, reading the
# sources where they already are. So there is nothing to install but the one
# script that starts it, and it goes into that user's PATH rather than into
# /usr/share.

LOCK_DEST=""
lock_ok=no

echo
if [[ -z "$REAL_HOME" ]]; then
  # Run as root rather than through sudo: there is no one whose ~/.local/bin
  # this could mean, and root's own is not it.
  warn "No SUDO_USER — cannot tell whose ~/.local/bin the lock screen belongs in."
  quote "install -m 755 packaging/my-lock ~/.local/bin/my-lock"
else
  LOCK_DEST="$REAL_HOME/.local/bin/my-lock"
  LOCK_GROUP="$(id -gn "$REAL_USER")"

  # The launcher reads the sources from the working copy, and the path it falls
  # back to is ~/Projects/myGreeter. If this copy sits somewhere else, that path
  # is written in: without it the locker would look for itself in a directory
  # that may hold anything at all.
  launcher="$(mktemp)"
  trap 'rm -f "$launcher"' EXIT

  if [[ "$PROJECT" == "$REAL_HOME/Projects/myGreeter" ]]; then
    cp "$PROJECT/packaging/my-lock" "$launcher"
  else
    awk -v dir="$PROJECT" '
      /^exec ags run/ && !written {
        print "# Where this working copy lives. Written by install.sh."
        printf ": \"${MY_GREETER_DIR:=%s}\"\n", dir
        print ""
        written = 1
      }
      { print }
    ' "$PROJECT/packaging/my-lock" > "$launcher"
  fi

  if [[ -f "$LOCK_DEST" ]] && cmp -s "$launcher" "$LOCK_DEST"; then
    step "$LOCK_DEST is already this launcher"
    lock_ok=yes
  else
    title "The lock screen is started by one small script in your own PATH:"
    echo
    quote_file "$launcher"
    echo
    if [[ -f "$LOCK_DEST" ]]; then
      warn "$LOCK_DEST exists and differs — it would be overwritten."
    fi
    if ask "Install it as $LOCK_DEST?"; then
      # Only created if it is not there: install -d would otherwise reset the
      # mode and owner of a directory that is none of our business.
      if [[ ! -d "$(dirname "$LOCK_DEST")" ]]; then
        install -d -m 0755 -o "$REAL_USER" -g "$LOCK_GROUP" "$(dirname "$LOCK_DEST")"
      fi
      install -m 0755 -o "$REAL_USER" -g "$LOCK_GROUP" "$launcher" "$LOCK_DEST"
      step "wrote $LOCK_DEST"
      lock_ok=yes

      # Whatever starts the locker calls it by name, so the name has to resolve
      # in the login shell — the same shell the session is started through.
      if ! runuser -u "$REAL_USER" -- bash -lc "command -v my-lock" >/dev/null 2>&1; then
        warn "$(dirname "$LOCK_DEST") is not in $REAL_USER's PATH;"
        warn "until it is, the locker has to be called by its full path."
      fi
    else
      skip "skipped"
    fi
  fi
fi

# ── What is left ──────────────────────────────────────────────────────────────

echo
title "Done."
echo
echo "Try the screen without rebooting, right inside this session:"
echo
quote "GDK_DEBUG=high-depth ags run $PROJECT/greeter/app.ts"
echo

if [[ "$config_ok" == no || "$switched" == no || "$acl_ok" == no || "$lock_ok" == no ]]; then
  title "Still to do by hand:"
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
  if [[ "$lock_ok" == no ]]; then
    echo "  · install -m 755 packaging/my-lock ${LOCK_DEST:-~/.local/bin/my-lock}"
  fi
  echo
fi

if [[ "$lock_ok" == yes ]]; then
  title "The lock screen is in place. Nothing calls it yet — that is one line in"
  title "your own Hyprland config, wherever the locker is started:"
  echo
  quote "hl.exec_cmd(\"swayidle -w before-sleep 'my-lock'\")"
  echo
fi

if [[ "$acl_needed" == no && -n "$COLLECTION" ]]; then
  echo "Wallpapers come from $COLLECTION, one at random on every boot."
  echo
fi
