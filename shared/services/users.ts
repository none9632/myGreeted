import GLib from "gi://GLib"
import { readFile } from "ags/file"
import type { User } from "../widget/UserPicker"

export type { User }

// ── Пользователи ──────────────────────────────────────────────────────────────
// Берём из /etc/passwd напрямую: у greeter'а нет ни D-Bus-сессии, ни
// AccountsService, а сам файл читается кем угодно.
//
// Отбор: UID в диапазоне обычных аккаунтов и оболочка, позволяющая войти. Этого
// достаточно — системные и служебные аккаунты отсеиваются обоими условиями.

const UID_MIN = 1000
const UID_MAX = 60000
const NO_LOGIN = /(nologin|\/false|\/sync|\/shutdown|\/halt)$/

export function listUsers(): User[] {
  let passwd: string
  try {
    passwd = readFile("/etc/passwd")
  } catch (e) {
    console.error("не прочитать /etc/passwd:", e)
    return []
  }

  const users: User[] = []
  for (const line of passwd.split("\n")) {
    const [name, , uidRaw, , gecos, , shell] = line.split(":")
    if (!name || !uidRaw) continue

    const uid = Number(uidRaw)
    if (!Number.isFinite(uid) || uid < UID_MIN || uid > UID_MAX) continue
    if (!shell || NO_LOGIN.test(shell)) continue

    // GECOS — поле из пяти запятых, человеку интересна только первая часть.
    const full = (gecos ?? "").split(",")[0].trim()
    users.push({ name, label: full || name })
  }

  return users.sort((a, b) => a.label.localeCompare(b.label))
}

/** Текущий пользователь — для экрана блокировки. */
export function currentUser(): User {
  const name = GLib.get_user_name()
  const full = GLib.get_real_name()
  return { name, label: full && full !== "Unknown" ? full : name }
}
