import GLib from "gi://GLib"
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
 * The login screen's wallpaper.
 *
 * In production this is a file the installer puts in place; replacing it is a
 * plain copy over the same path.
 */
export function greeterWallpaper(): string | null {
  // In debug the screen runs from a live session, so show that session's
  // wallpaper — the same picture the installer copies into
  // /usr/share/my-greeter.
  if (GREETER_DEV) return currentWallpaper()

  return firstExisting([
    `${RESOURCE_DIR}/wallpaper`,
    `${RESOURCE_DIR}/wallpaper.jpg`,
    `${RESOURCE_DIR}/wallpaper.png`,
  ])
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
