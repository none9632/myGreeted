import app from "ags/gtk4/app"
import style from "./style.scss"
import { LOCK_DEV, USER } from "../shared/services/env"
import LockWindow from "./widget/LockWindow"

// Экран блокировки — отдельный процесс, а не часть шелла: если шелл упадёт или
// будет перезапущен, блокировка должна остаться на экране.
//
// ЭТАП «макет»: пока только отладочный режим (layer-shell поверх сессии).
// Боевой путь через Gtk4SessionLock подключается на этапе «реальный вход».
app.start({
  instanceName: "my-lock",
  css: style,
  main() {
    const user = { name: USER, label: USER }

    if (!LOCK_DEV) {
      console.warn("боевой режим ещё не подключён, запускаюсь как отладочное окно")
    }

    app.get_monitors().forEach((monitor) => LockWindow(monitor, user))
  },
})
