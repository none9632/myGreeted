# my-greeter

A login screen for [greetd](https://sr.ht/~kennylevinsen/greetd/) and a lock
screen for Hyprland, built on [AGS 3](https://github.com/Aylur/ags) + Astal
(GTK4).

Both screens share one composition, **the rail**: a narrow column of controls at
the left edge (power, keyboard layout), with large type and the input in the
content column. Nothing is centred; the grid is set by a short accent rule under
the date. The password field is not a box but a line whose underline fills with
the accent on focus and turns red on a wrong password.

The styles, widgets and services are shared; only the set of blocks in the column
differs:

| | login | lock |
|---|---|---|
| clock and date | ✓ | ✓ |
| user picker | ✓ (hidden with a single user) | — current user's name |
| session picker | ✓ | — |
| power, keyboard layout | ✓ | ✓ |
| password check | greetd (AstalGreet) | PAM (AstalAuth) |
| surface | layer-shell | ext-session-lock |

## Requirements

- `aylurs-gtk-shell-git` (AGS 3.x), `libastal-greetd`, `libastal-auth`, `libastal-hyprland`
- `gtk4-layer-shell` (it also provides `Gtk4SessionLock`)
- `dart-sass` — the SCSS is compiled on every startup
- the `inter` and `ttf-iosevka-nerd` fonts
- `greetd` and the `greeter` system user (for the login screen)

## Layout

```
shared/
  style/      colors.scss (colours) + _tokens.scss (everything else) + partials
  widget/     Screen, Rail, Clock, PasswordField, UserPicker, SessionPicker
  services/   env, paths, users, sessions, state, keyboard, power, auth
greeter/      login screen: its own app.ts, style.scss and services/auth.ts (greetd)
lock/         lock screen: its own app.ts, style.scss and services/auth.ts (PAM)
packaging/    matugen, the Hyprland config for the greeter session, the installer
```

Colour lives **only** in `shared/style/colors.scss` — a flat list of
`$name: #hex` that the matugen template regenerates wholesale. Everything else
(opacity, gradients, shadows, animation curves) is assembled from it in
`_tokens.scss`.

## Running inside the current session

Both screens are testable with a plain `ags run`; nothing system-wide has to be
touched.

```bash
# The login screen. Without GREETD_SOCK it runs on a stub: the correct password
# is "test", the last choice is written to ~/.cache/my-greeter/, and the power
# buttons only log.
ags run ~/Projects/myGreeter/greeter/app.ts

# The lock screen. MY_LOCK_DEV=1 draws an ordinary window over the session
# (Escape quits) instead of a real ext-session-lock. The password is checked by
# honest PAM either way.
MY_LOCK_DEV=1 ags run ~/Projects/myGreeter/lock/app.ts
```

Both use their own instance names (`my-greeter`, `my-lock`), so they run happily
alongside the main shell. To stop one: `ags quit -i my-greeter`.

## Installing the login screen

```bash
./packaging/install.sh
```

The script lays the application out in `/usr/share/my-greeter/`, creates
`/var/cache/my-greeter/` for the `greeter` user and installs a minimal Hyprland
config. It does **not** touch system files or services — at the end it prints
what is left to do by hand (write `/etc/greetd/config.toml`, switch `sddm` →
`greetd`).

Why it works that way: the greeter runs as the `greeter` user, who has no home
directory. So in production no path leads into `~` — resources live in
`/usr/share/my-greeter/` and mutable state in `/var/cache/my-greeter/`.

## The lock screen

```bash
install -m 755 packaging/my-lock ~/.local/bin/my-lock
```

Then replace `hyprlock` in `~/.config/hypr/hyprland.lua`:

```lua
hl.exec_cmd("swayidle -w before-sleep 'my-lock'")
```

## Colours from matugen

Right now `colors.scss` holds doom-one — the same palette myBar, rofi and
hyprlock use. To make the colours follow the wallpaper, append the block from
`packaging/matugen/config.toml` to `~/.config/matugen/config.toml` and run:

```bash
matugen image /path/to/wallpaper
```

The template overwrites `shared/style/colors.scss`, and the post-hook copies both
the colours and the wallpaper itself into `/usr/share/my-greeter/`, where the
production greeter expects them.

## Known small things

- The date comes from the locale. This system runs `en_US.UTF-8`, so the date is
  English. Changing it means generating another locale in `/etc/locale.gen`.
- The GTK theme `Skeuos-Blue-Dark` targets GTK3 and pours
  `Theme parser error: "shade" is not a valid color name` into the log at
  startup. It has no visual effect: every widget uses its own `cssName`, so the
  theme's rules never reach them.
