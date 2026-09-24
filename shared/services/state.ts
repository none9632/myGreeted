import GLib from "gi://GLib"
import { readFile, writeFile } from "ags/file"
import { CACHE_DIR } from "./paths"

// ── Запоминание последнего выбора ─────────────────────────────────────────────
// Кого и во что пускали в прошлый раз. Лежит в /var/cache/my-greeter (в отладке
// — в ~/.cache/my-greeter): пользователь `greeter` пишет туда, и только туда.
//
// Файл — просто подсказка интерфейсу. Любая ошибка чтения или записи не должна
// мешать входу, поэтому все операции молча деградируют до значений по умолчанию.

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
    console.warn("не сохранить последний выбор:", e)
  }
}
