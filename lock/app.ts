import app from "ags/gtk4/app"
import { Gtk } from "ags/gtk4"
import Gdk from "gi://Gdk"
import Gtk4SessionLock from "gi://Gtk4SessionLock"
import style from "./style.scss"
import { LOCK_DEV } from "../shared/services/env"
import { currentUser } from "../shared/services/users"
import LockWindow, { LockContent } from "./widget/LockWindow"
import type { User } from "../shared/widget/UserPicker"

// Экран блокировки — отдельный процесс, а не часть шелла: если шелл упадёт или
// будет перезапущен, блокировка должна остаться на экране.
//
// Два режима запуска:
//   MY_LOCK_DEV=1  — обычное layer-shell окно поверх сессии, Escape закрывает;
//                    так экран правится и проверяется без риска запереть себя.
//   по умолчанию   — настоящий ext-session-lock: compositor гасит всё остальное,
//                    и выйти можно только верным паролем.
app.start({
  instanceName: "my-lock",
  css: style,
  main() {
    const user = currentUser()

    if (LOCK_DEV) {
      app.get_monitors().forEach((monitor) => LockWindow(monitor, user))
      return
    }

    lockSession(user)
  },
})

function lockSession(user: User) {
  if (!Gtk4SessionLock.is_supported()) {
    console.error("композитор не умеет ext-session-lock — блокировать нечем")
    app.quit()
    return
  }

  const lock = Gtk4SessionLock.Instance.new()

  // Поверхность на каждый монитор. Сигнал приходит по разу на каждый экран,
  // который существует на момент блокировки, и потом на каждый подключённый;
  // библиотека сама размапит и уничтожит окна, когда блокировка кончится.
  lock.connect("monitor", (_lock, monitor: Gdk.Monitor) => {
    const window = new Gtk.Window({ application: app, name: "lock" })
    window.add_css_class("Lock")
    window.set_child(LockContent({ user, onUnlock: () => lock.unlock() }) as Gtk.Widget)
    lock.assign_window_to_monitor(window, monitor)
  })

  lock.connect("failed", () => {
    console.error("не удалось заблокировать сессию: блокировку держит кто-то ещё")
    app.quit()
  })

  // Разблокировали — нашим паролем или снаружи композитором. В обоих случаях
  // процессу больше нечего делать.
  lock.connect("unlocked", () => app.quit())

  if (!lock.lock()) {
    console.error("не удалось заблокировать сессию")
    app.quit()
  }
}
