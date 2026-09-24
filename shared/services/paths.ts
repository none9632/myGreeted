import GLib from "gi://GLib"
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
 * In production this is the file matugen's post-hook drops next to the colours.
 */
export function greeterWallpaper(): string | null {
  // In debug the screen runs from a live session, so show that session's
  // wallpaper — exactly the one that will end up in /usr/share/my-greeter after
  // matugen runs.
  if (GREETER_DEV) return currentWallpaper()

  return firstExisting([
    `${RESOURCE_DIR}/wallpaper`,
    `${RESOURCE_DIR}/wallpaper.jpg`,
    `${RESOURCE_DIR}/wallpaper.png`,
  ])
}

/**
 * The live session's wallpaper — what the locker shows. The path is written to
 * the cache by the update-wall script every time the picture changes.
 */
export function currentWallpaper(): string | null {
  const state = `${GLib.get_user_cache_dir()}/current_wallpaper.txt`
  if (!GLib.file_test(state, GLib.FileTest.EXISTS)) return null

  const [ok, bytes] = GLib.file_get_contents(state)
  if (!ok) return null

  const path = new TextDecoder().decode(bytes).trim()
  return path && GLib.file_test(path, GLib.FileTest.EXISTS) ? path : null
}

function firstExisting(candidates: string[]): string | null {
  return candidates.find((p) => GLib.file_test(p, GLib.FileTest.EXISTS)) ?? null
}
