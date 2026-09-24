import GLib from "gi://GLib"
import { GREETER_DEV } from "./env"

// ── Пути к ресурсам и состоянию ───────────────────────────────────────────────
// В бою greeter работает от пользователя `greeter`, у которого нет домашней
// папки (`/` в /etc/passwd). Поэтому ни один путь не должен вести в ~: ресурсы
// лежат в /usr/share/my-greeter, изменяемое состояние — в /var/cache/my-greeter
// (каталог создаёт установщик и отдаёт его этому пользователю).
//
// В отладке всё то же самое переезжает в домашние каталоги, чтобы запуск из
// живой сессии ничего не требовал и никуда не писал от root.

export const RESOURCE_DIR = "/usr/share/my-greeter"

export const CACHE_DIR = GREETER_DEV
  ? `${GLib.get_user_cache_dir()}/my-greeter`
  : "/var/cache/my-greeter"

/** Список wayland-сессий. Путь один и тот же в обоих режимах. */
export const SESSION_DIR = "/usr/share/wayland-sessions"

/**
 * Обои экрана входа.
 *
 * В бою это файл, который кладёт post-hook matugen рядом с цветами. В отладке
 * подхватываем текущие обои живой сессии, так что экран выглядит ровно так, как
 * будет выглядеть после установки.
 */
export function greeterWallpaper(): string | null {
  // В отладке экран запускается из живой сессии, поэтому показываем её обои —
  // ровно те же, что окажутся в /usr/share/my-greeter после matugen.
  if (GREETER_DEV) return currentWallpaper()

  return firstExisting([
    `${RESOURCE_DIR}/wallpaper`,
    `${RESOURCE_DIR}/wallpaper.jpg`,
    `${RESOURCE_DIR}/wallpaper.png`,
  ])
}

/**
 * Обои живой сессии — их и показывает блокировщик. Путь пишет в кэш скрипт
 * update-wall при каждой смене картинки.
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
