# my-greeter

A login screen for [greetd](https://sr.ht/~kennylevinsen/greetd/) and a lock
screen for Hyprland, built on [AGS 3](https://github.com/Aylur/ags) + Astal
(GTK4).

Both screens share one composition, **the rail**: a narrow column of controls at
the left edge (power, keyboard layout), with large type and the input in the
content column. Nothing is centred; the grid is set by a short accent rule under
the date. The password field is not a box but a line whose underline fills with
the accent on focus and turns red on a wrong password.

Neither screen simply appears. The wallpaper settles out of a slight zoom, the
rail slides in from the left edge, and the blocks of the column rise one after
another — about 0.8s from the first frame to the last block, with the password
field focused throughout, so it can be typed into while the rest is still
arriving. The whole choreography is one section of `shared/style/_base.scss`.

Two things in [Screen.tsx](shared/widget/Screen.tsx) are there to make it
watchable rather than merely correct, and both were found by measuring frames on
this panel (2520x1680 at 10 bpc):

- **The wallpaper is blurred once, not per frame.** `filter: blur()` in CSS
  makes GTK render the full-screen picture into an offscreen and blur it again
  every time anything above it moves, which held the entrance to 10-25 frames a
  second — all of it on screen, in half a dozen jumps. The file is now decoded
  small and blurred once on the GPU, and the same entrance runs at 60.
- **It starts on the first frame that arrives at full speed**, not on a timer
  and not on the first frame. Early frames come tens of milliseconds apart —
  textures uploaded, shaders built — and a transition started on one of them is
  a third over before the screen has drawn twice.

The lock screen leaves the same way, in a third of the time: once the password
is accepted the column and the rail sweep out and the dimming lifts, and only
then is the session unlocked — the compositor holds the lock for every
millisecond of it, which is the whole budget. The wallpaper itself does not
fade: behind a session-lock surface there is nothing to fade to, so a screen
that dissolved would black out and the session would appear out of the dark.
Instead the lights come up on it. Escape does the same thing in `MY_LOCK_DEV=1`
— without a password there is no other way to watch the exit.

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
packaging/    the installer, the Hyprland config for the greeter session, the lock launcher
```

Colour lives **only** in `shared/style/colors.scss` — a flat list of
`$name: #hex`, kept free of rgba() and computation so the whole palette can be
swapped in one place. Everything else (opacity, gradients, shadows, animation
curves) is assembled from it in `_tokens.scss`.

## Running inside the current session

Both screens are testable with a plain `ags run`; nothing system-wide has to be
touched.

```bash
# The login screen. Without GREETD_SOCK it runs on a stub: the correct password
# is "test", the last choice is written to ~/.cache/my-greeter/, and the power
# buttons only log. Escape quits.
GDK_DEBUG=high-depth ags run ~/Projects/myGreeter/greeter/app.ts

# The lock screen. MY_LOCK_DEV=1 draws an ordinary window over the session
# (Escape quits) instead of a real ext-session-lock. The password is checked by
# honest PAM either way.
GDK_DEBUG=high-depth MY_LOCK_DEV=1 ags run ~/Projects/myGreeter/lock/app.ts
```

`GDK_DEBUG=high-depth` asks GTK to render at more than 8 bits per channel. The
scrim is a gradient spanning the whole screen; in 8 bits it crosses only about
fifty levels, so each one covers a band some 40px wide with a dead-straight
edge, and those edges read as a grid against the smooth blurred wallpaper. In
production the flag is set for you — in `packaging/hypr/greeter.lua` for the
login screen and in `packaging/my-lock` for the locker.

Both use their own instance names (`my-greeter`, `my-lock`), so they run happily
alongside the main shell. To stop one: `ags quit -i my-greeter`.

## Installing the login screen

```bash
./packaging/install.sh
```

The script lays the application out in `/usr/share/my-greeter/`, creates
`/var/cache/my-greeter/` for the `greeter` user and installs a minimal Hyprland
config. None of that reaches outside those two directories.

Then it asks five questions. The last four default to no:

1. **Which directory do wallpapers come from?** Enter takes the default,
   `~/Pictures/wallpapers`; `-` skips wallpapers altogether. The answer is
   written into the installed Hyprland config as `env = WALLPAPER_DIR,…`.
2. **Let `greeter` reach it?** Home directories are `0700`, which stops the
   greeter at the first component of the path. It names the directories that
   actually block the way and grants search on those with an ACL — narrower
   than `chmod 0711`, which would open the way for everyone.
3. **Write `/etc/greetd/config.toml`?** It prints the file first. An existing
   config that differs is copied aside with a timestamp before being replaced.
4. **Make greetd the login manager?** It names the one currently enabled and
   shows the two `systemctl` lines it would run. The running session is not
   touched; the switch takes effect on the next boot.
5. **Install the lock screen's launcher?** The one question that is not about
   the login screen: it puts `packaging/my-lock` in your own `~/.local/bin/`.
   Nothing else of the locker is installed — it runs out of the working copy, so
   if this copy sits anywhere but `~/Projects/myGreeter` the path is written
   into the launcher as it is copied.

Answering no to any of them is fine — whatever was skipped is printed at the end
as a command to run by hand. Re-running the script is safe: steps already done
are reported as such and nothing is rewritten. With no terminal on stdin (piped
into a shell) every question counts as no.

Nothing is copied out of the wallpaper directory except one fallback picture, so
images added to it later show up at the login screen without reinstalling.

Why it works that way: the greeter runs as the `greeter` user, who has no home
directory. So in production no path leads into `~` — resources live in
`/usr/share/my-greeter/` and mutable state in `/var/cache/my-greeter/`.

The output of anything greetd starts lands on tty1, and scrolls past twice in a
boot: once between the boot messages and the login screen, once more after the
password is accepted. Both are redirected to a file instead — the greeter's own
output by `/etc/greetd/config.toml` to `/var/cache/my-greeter/session.log`, and
the session's by `sessionCommand()` in `greeter/services/auth.ts` to
`$XDG_RUNTIME_DIR/my-greeter-session.log`. Both are rewritten at every start,
and the first is the file to read when the login screen does not come up.

## The lock screen

`install.sh` offers to put the launcher in place; by hand it is one line:

```bash
install -m 755 packaging/my-lock ~/.local/bin/my-lock
```

Either way the locker itself stays in the working copy — the launcher only
points at it, and `MY_GREETER_DIR` overrides where it looks.

Nothing calls it yet. Replace `hyprlock` in `~/.config/hypr/hyprland.lua`:

```lua
hl.exec_cmd("swayidle -w timeout 600 'my-lock' lock 'my-lock' before-sleep 'my-lock'")
```

A minute after the lock appears the machine suspends itself, the way the lid
switch does: the lock stays underneath and waking up lands on the password
prompt. `-s` changes that minute:

```bash
my-lock -s 300      # five minutes of lock screen first
my-lock -s 0        # sleep as soon as the lock is up
my-lock -s never    # stay awake behind the lock
```

A machine that has just woken up never sleeps again sooner than fifteen
seconds later, however short `-s` is: the key that wakes it goes to the
firmware and not to the locker, so without that floor `-s 0` would put the
machine back down before the password field ever saw a keystroke.

The countdown lives in the locker rather than in swayidle or in the launcher,
and [lock/services/suspend.ts](lock/services/suspend.ts) says why at length.
The short of it: two deadlines, the later one wins. One is the lock appearing
plus the minute, the other is the last key press plus fifteen seconds. So a
brushed touchpad does not postpone anything — it is not a reason to stay
awake — while a password being typed does, and the machine cannot fall asleep
under your hands. An idle daemon cannot draw that distinction: to it any input
resets everything, and one nudge of the mouse would put the sleep a full idle
period away.

Waking up is the firmware's business rather than this repository's. The lid, the
built-in keyboard and the touchpad normally can; an external USB mouse or
keyboard only if its port is allowed to:

```bash
# which devices may wake the machine — "enabled" is the ones that can
grep . /sys/bus/usb/devices/*/power/wakeup
```

## Colours

`colors.scss` holds doom-one — the same palette myBar, rofi and hyprlock use.
Edit that one file to restyle both screens.

## Wallpaper

The login screen picks one at random on every boot from `WALLPAPER_DIR` — the
same variable `update-wall` reads, set for the greeter session by the installer
in `/usr/share/my-greeter/hyprland.lua`. If that directory is missing or
unreachable it falls back to the single file `/usr/share/my-greeter/wallpaper`,
which the installer seeds.

The picture it chose is written to `/var/cache/my-greeter/wallpaper`, and the
session adopts it on login so nothing changes under you at the moment you log
in. That needs two lines outside this repository:

```bash
# ~/.local/bin/update-wall — take an explicit path as the first argument,
# falling back to a random pick when it is empty or gone.

# ~/.config/hypr/hyprland.lua — in the autostart block, instead of update-wall:
hl.exec_cmd([[update-wall "$(cat /var/cache/my-greeter/wallpaper 2>/dev/null)"]])
```

Log in some other way (a TTY, say) and the session adopts the greeter's last
pick rather than a fresh one — the handoff file is only rewritten when the
login screen actually runs.

The lock screen ignores all of this: it asks `awww` what is on screen right now.

## Known small things

- The date comes from the locale. This system runs `en_US.UTF-8`, so the date is
  English. Changing it means generating another locale in `/etc/locale.gen`.
- The GTK theme `Skeuos-Blue-Dark` targets GTK3 and pours
  `Theme parser error: "shade" is not a valid color name` into the log at
  startup. It has no visual effect: every widget uses its own `cssName`, so the
  theme's rules never reach them.
