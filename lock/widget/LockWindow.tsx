import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createState } from "gnim"
import { authMessage, stubBackend, type AuthBackend } from "../../shared/services/auth"
import { createPower } from "../../shared/services/power"
import { createKeyboard } from "../../shared/services/keyboard"
import { currentWallpaper } from "../../shared/services/paths"
import { LOCK_DEV } from "../../shared/services/env"
import Screen from "../../shared/widget/Screen"
import Clock from "../../shared/widget/Clock"
import PasswordField from "../../shared/widget/PasswordField"
import { UserLabel, type User } from "../../shared/widget/UserPicker"

// ── Экран блокировки ──────────────────────────────────────────────────────────
// Та же композиция, что у входа, минус выбор пользователя и сессии: блокировщик
// всегда возвращает в уже запущенную сессию текущего пользователя.
//
// ЭТАП «UI с заглушкой»: пароль проверяет та же заглушка (`test`). PAM и
// настоящий ext-session-lock подключаются дальше.

const backend: AuthBackend = stubBackend("заглушка блокировки")
const power = createPower(!LOCK_DEV)
const keyboard = createKeyboard()
const wallpaper = currentWallpaper()

/** Содержимое экрана: одинаково и для отладочного окна, и для session-lock. */
export function LockContent(props: { user: User; onUnlock: () => void }) {
  const [busy, setBusy] = createState(false)
  const [error, setError] = createState("")

  async function submit(password: string) {
    setBusy(true)
    setError("")
    try {
      await backend.authenticate(props.user.name, password)
      props.onUnlock()
    } catch (e) {
      setError(authMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen
      wallpaper={wallpaper}
      layout={keyboard.layout}
      onLayoutClicked={keyboard.next}
      onPoweroff={power.poweroff}
      onReboot={power.reboot}
    >
      <Clock />
      <UserLabel user={props.user} />
      <PasswordField
        busy={busy}
        error={error}
        onInput={() => setError("")}
        onSubmit={submit}
      />
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
          // Только в отладке: боевой блокировщик не должен уметь закрываться.
          if (keyval === Gdk.KEY_Escape) {
            app.quit()
            return true
          }
          return false
        }}
      />
      <LockContent user={user} onUnlock={() => app.quit()} />
    </window>
  )
}
