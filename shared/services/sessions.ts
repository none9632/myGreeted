import GLib from "gi://GLib"
import Gio from "gi://Gio"
import { SESSION_DIR } from "./paths"
import type { Session } from "../widget/SessionPicker"

export type { Session }

// ── Sessions ──────────────────────────────────────────────────────────────────
// Read the .desktop files in /usr/share/wayland-sessions with GLib's own parser:
// it handles the groups, the quoting and localised Name[xx] keys for us.

const GROUP = GLib.KEY_FILE_DESKTOP_GROUP

export function listSessions(): Session[] {
  const dir = Gio.File.new_for_path(SESSION_DIR)

  let entries: Gio.FileEnumerator
  try {
    entries = dir.enumerate_children("standard::name", Gio.FileQueryInfoFlags.NONE, null)
  } catch (e) {
    console.error(`could not read ${SESSION_DIR}:`, e)
    return []
  }

  const sessions: Session[] = []
  let info: Gio.FileInfo | null

  while ((info = entries.next_file(null)) !== null) {
    const file = info.get_name()
    if (!file.endsWith(".desktop")) continue

    const session = parse(`${SESSION_DIR}/${file}`, file.replace(/\.desktop$/, ""))
    if (session) sessions.push(session)
  }

  return sessions.sort((a, b) => a.name.localeCompare(b.name))
}

/** A broken or hidden .desktop is no reason to fall over: skip just that one. */
function parse(path: string, id: string): Session | null {
  const kf = new GLib.KeyFile()
  try {
    kf.load_from_file(path, GLib.KeyFileFlags.NONE)
    if (hidden(kf)) return null

    return {
      id,
      name: kf.get_locale_string(GROUP, "Name", null),
      exec: kf.get_string(GROUP, "Exec"),
      desktopNames: optional(kf, "DesktopNames"),
    }
  } catch (e) {
    console.warn(`skipping ${path}:`, e)
    return null
  }
}

// g_key_file_has_key is not exposed in gjs, and Hidden and DesktopNames are more
// often absent than present in session files. So we simply try to read them and
// treat a missing key as the normal case rather than as an error.
function hidden(kf: GLib.KeyFile): boolean {
  try {
    return kf.get_boolean(GROUP, "Hidden")
  } catch {
    return false
  }
}

function optional(kf: GLib.KeyFile, key: string): string | undefined {
  try {
    return kf.get_string(GROUP, key) || undefined
  } catch {
    return undefined
  }
}
