import GLib from "gi://GLib"
import { readFile, writeFile } from "ags/file"
import { CACHE_DIR } from "./paths"

// ── Remembering the last choice ───────────────────────────────────────────────
// Who was let in last time, and into what. It lives in /var/cache/my-greeter (or
// ~/.cache/my-greeter in debug): the `greeter` user can write there, and only
// there.
//
// The file is no more than a hint to the interface. No read or write failure may
// stand in the way of logging in, so every operation degrades silently to the
// defaults.

const FILE = `${CACHE_DIR}/last-session.json`

export interface LastChoice {
  user?: string
  session?: string
}

export function readLastChoice(): LastChoice {
  try {
    const raw = readFile(FILE)
    const parsed = JSON.parse(raw) as LastChoice
    return typeof parsed === "object" && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

export function writeLastChoice(choice: LastChoice): void {
  try {
    GLib.mkdir_with_parents(CACHE_DIR, 0o755)
    writeFile(FILE, JSON.stringify(choice))
  } catch (e) {
    console.warn("could not save the last choice:", e)
  }
}
