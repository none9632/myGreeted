import GLib from "gi://GLib"
import Gio from "gi://Gio"
import { exec } from "ags/process"
import { GREETER_DEV } from "./env"

// ── Resource and state paths ──────────────────────────────────────────────────
// In production the greeter runs as the `greeter` user, who has no home
// directory (`/` in /etc/passwd). So no path may lead into ~: resources live in
// /usr/share/my-greeter and mutable state in /var/cache/my-greeter (a directory
// the installer creates and hands to that user).
//
// In debug mode all of it moves into the home directories, so running from a live
// session needs nothing and writes nothing as root.

export const RESOURCE_DIR = "/usr/share/my-greeter"

export const CACHE_DIR = GREETER_DEV
  ? `${GLib.get_user_cache_dir()}/my-greeter`
  : "/var/cache/my-greeter"

/** Where wayland sessions are listed. The same path in both modes. */
export const SESSION_DIR = "/usr/share/wayland-sessions"

/**
 * The directory the login screen picks its wallpaper from.
 *
 * In production the installer asks for it and writes the answer into the
 * greeter session's Hyprland config as `env = WALLPAPER_DIR,…`, so the path is
 * visible in the config rather than hidden in the code. The `greeter` user
 * reaches it through an ACL granting search along the way — a directory inside
 * a home is closed to it otherwise.
 *
 * In debug it falls back to the same default update-wall uses, and the same
 * variable overrides both.
 */
export const WALLPAPER_DIR =
  GLib.getenv("WALLPAPER_DIR") ??
  (GREETER_DEV ? `${GLib.get_home_dir()}/Pictures/wallpapers` : `${RESOURCE_DIR}/wallpapers`)

/** Where the login screen leaves the picture it chose, for the session to adopt. */
export const CHOSEN_WALLPAPER = `${CACHE_DIR}/wallpaper`

/**
 * Pick the login screen's wallpaper and record the choice.
 *
 * A fresh picture every boot, drawn at random from WALLPAPER_DIR — the same
 * thing update-wall does for the session, minus the daemon: the greeter paints
 * its own background, so nothing needs to be handed to a wallpaper daemon.
 *
 * The chosen path is written to CHOSEN_WALLPAPER so the session can adopt it on
 * login and the picture does not jump. Writing is best-effort: a wallpaper is
 * not worth failing a login over.
 *
 * Falls back to the single /usr/share/my-greeter/wallpaper file when the pool is
 * missing or empty, which is what a bare install without the collection gets.
 */
export function chooseGreeterWallpaper(): string | null {
  const chosen = randomFrom(WALLPAPER_DIR) ?? firstExisting([
    `${RESOURCE_DIR}/wallpaper`,
    `${RESOURCE_DIR}/wallpaper.jpg`,
    `${RESOURCE_DIR}/wallpaper.png`,
  ])

  if (chosen) {
    try {
      GLib.mkdir_with_parents(CACHE_DIR, 0o755)
      GLib.file_set_contents(CHOSEN_WALLPAPER, new TextEncoder().encode(`${chosen}\n`))
    } catch (e) {
      console.warn("could not record the chosen wallpaper:", e)
    }
  }

  return chosen
}

const IMAGE = /\.(jpe?g|png|webp|gif)$/i

/**
 * Follow the directory when it is a symlink. Composing paths through a link
 * would work, but the session would then be handed a path that does not match
 * its own collection, and update-wall compares full paths to avoid repeating
 * the picture already on screen.
 */
function resolveDir(dir: string): string {
  try {
    const target = GLib.file_read_link(dir)
    return GLib.path_is_absolute(target) ? target : dir
  } catch {
    return dir // not a symlink, which is the normal case in debug
  }
}

/** One random image out of a directory, or null if there are none to be had. */
function randomFrom(dir: string): string | null {
  const real = resolveDir(dir)

  let entries: Gio.FileEnumerator
  try {
    entries = Gio.File.new_for_path(real).enumerate_children(
      "standard::name",
      Gio.FileQueryInfoFlags.NONE,
      null,
    )
  } catch {
    // No pool installed, or no way through to it — the caller falls back.
    return null
  }

  const images: string[] = []
  let info: Gio.FileInfo | null
  while ((info = entries.next_file(null)) !== null) {
    const name = info.get_name()
    if (IMAGE.test(name)) images.push(`${real}/${name}`)
  }

  if (images.length === 0) return null
  return images[Math.floor(Math.random() * images.length)]
}

/**
 * The live session's wallpaper — what the locker shows.
 *
 * Asked of the wallpaper daemon rather than read from a state file: awww knows
 * what it is actually displaying, so there is nothing to fall out of sync. It
 * answers with one line per output; we take the first, since the locker shows
 * the same picture everywhere.
 */
export function currentWallpaper(): string | null {
  let answer: string
  try {
    answer = exec(["awww", "query"])
  } catch {
    // No daemon, or no awww at all — the screen falls back to a flat background.
    return null
  }

  const match = answer.match(/currently displaying: image: (.+)$/m)
  const path = match?.[1].trim()
  return path && GLib.file_test(path, GLib.FileTest.EXISTS) ? path : null
}

function firstExisting(candidates: string[]): string | null {
  return candidates.find((p) => GLib.file_test(p, GLib.FileTest.EXISTS)) ?? null
}
