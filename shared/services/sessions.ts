import GLib from "gi://GLib"
import Gio from "gi://Gio"
import { SESSION_DIR } from "./paths"
import type { Session } from "../widget/SessionPicker"

export type { Session }

// ── Сессии ────────────────────────────────────────────────────────────────────
// Читаем .desktop-файлы из /usr/share/wayland-sessions штатным парсером GLib: он
// сам разбирает группы, кавычки и локализованные Name[ru].

const GROUP = GLib.KEY_FILE_DESKTOP_GROUP

export function listSessions(): Session[] {
  const dir = Gio.File.new_for_path(SESSION_DIR)

  let entries: Gio.FileEnumerator
  try {
    entries = dir.enumerate_children("standard::name", Gio.FileQueryInfoFlags.NONE, null)
  } catch (e) {
    console.error(`не прочитать ${SESSION_DIR}:`, e)
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

/** Битый или скрытый .desktop — не повод падать: пропускаем только его. */
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
    console.warn(`пропускаю ${path}:`, e)
    return null
  }
}

// g_key_file_has_key в gjs не пробрасывается, а Hidden и DesktopNames в
// сессиях чаще отсутствуют, чем присутствуют. Поэтому просто пробуем прочитать
// и считаем отсутствие ключа нормальным случаем, а не ошибкой.
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
