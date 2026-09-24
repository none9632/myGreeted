import GLib from "gi://GLib"

// ── Run modes ─────────────────────────────────────────────────────────────────
// Both screens have to start under a plain `ags run` inside a live session
// without breaking it. So each has a production and a debug mode, and they are
// selected by the environment rather than by a build flag.

/**
 * The login screen counts as live only when greetd started it: the socket to it
 * lives in GREETD_SOCK. Without that socket logging in is impossible anyway, so
 * the same condition switches on the stub authentication.
 */
export const GREETER_DEV = GLib.getenv("GREETD_SOCK") === null

/**
 * In debug mode the locker draws itself as an ordinary layer-shell window: a real
 * ext-session-lock would genuinely lock the live session, and the only way out
 * would be the correct password. PAM stays honest in both modes — it merely
 * checks the current user's password and changes nothing.
 */
export const LOCK_DEV = GLib.getenv("MY_LOCK_DEV") !== null

export const USER = GLib.get_user_name()
