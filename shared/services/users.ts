import GLib from "gi://GLib"
import { readFile } from "ags/file"
import type { User } from "../widget/UserPicker"

export type { User }

// ── Users ─────────────────────────────────────────────────────────────────────
// Read straight out of /etc/passwd: the greeter has neither a D-Bus session nor
// AccountsService, and the file itself is world-readable.
//
// The filter: a UID inside the range of ordinary accounts, and a shell that
// permits logging in. That is enough — system and service accounts fail both.

const UID_MIN = 1000
const UID_MAX = 60000
const NO_LOGIN = /(nologin|\/false|\/sync|\/shutdown|\/halt)$/

export function listUsers(): User[] {
  let passwd: string
  try {
    passwd = readFile("/etc/passwd")
  } catch (e) {
    console.error("could not read /etc/passwd:", e)
    return []
  }

  const users: User[] = []
  for (const line of passwd.split("\n")) {
    const [name, , uidRaw, , gecos, , shell] = line.split(":")
    if (!name || !uidRaw) continue

    const uid = Number(uidRaw)
    if (!Number.isFinite(uid) || uid < UID_MIN || uid > UID_MAX) continue
    if (!shell || NO_LOGIN.test(shell)) continue

    // GECOS is a five-comma field; only its first part is of any interest here.
    const full = (gecos ?? "").split(",")[0].trim()
    users.push({ name, label: full || name, shell })
  }

  return users.sort((a, b) => a.label.localeCompare(b.label))
}

/** The current user — for the lock screen. */
export function currentUser(): User {
  const name = GLib.get_user_name()
  const full = GLib.get_real_name()
  return {
    name,
    label: full && full !== "Unknown" ? full : name,
    shell: GLib.getenv("SHELL") ?? "/bin/sh",
  }
}
