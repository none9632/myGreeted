import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createState } from "gnim"
import Screen from "../../shared/widget/Screen"
import Clock from "../../shared/widget/Clock"
import PasswordField from "../../shared/widget/PasswordField"
import { UserLabel, type User } from "../../shared/widget/UserPicker"

// ── Экран блокировки ──────────────────────────────────────────────────────────
// Та же композиция, что у входа, минус выбор пользователя и сессии: блокировщик
// всегда возвращает в уже запущенную сессию текущего пользователя.
//
// ЭТАП «макет»: содержимое статично, PAM подключается позже. В боевом режиме
// корневой виджет будет тем же, но окно создаст Gtk4SessionLock.

export function LockContent(props: { user: User }) {
  const [busy] = createState(false)
  const [error, setError] = createState("")
  const [layout] = createState("en")

  return (
    <Screen wallpaper={null} layout={layout}>
      <box orientation={Gtk.Orientation.VERTICAL}>
        <Clock />
        <UserLabel user={props.user} />
        <PasswordField
          busy={busy}
          error={error}
          onSubmit={() => setError("Проверка пароля появится на следующем этапе")}
        />
      </box>
    </Screen>
  )
}

/** Отладочное окно: обычный layer-shell поверх сессии, Escape закрывает. */
export default function LockWindow(gdkmonitor: Gdk.Monitor, user: User) {
  return (
    <window
      visible
      name={`lock-${gdkmonitor.connector ?? "0"}`}
      class="Lock"
      gdkmonitor={gdkmonitor}
      anchor={
        Astal.WindowAnchor.TOP |
        Astal.WindowAnchor.BOTTOM |
        Astal.WindowAnchor.LEFT |
        Astal.WindowAnchor.RIGHT
      }
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.EXCLUSIVE}
      layer={Astal.Layer.OVERLAY}
      application={app}
    >
      <Gtk.EventControllerKey
        propagationPhase={Gtk.PropagationPhase.CAPTURE}
        onKeyPressed={(_self, keyval) => {
          if (keyval === Gdk.KEY_Escape) {
            app.quit()
            return true
          }
          return false
        }}
      />
      <LockContent user={user} />
    </window>
  )
}
