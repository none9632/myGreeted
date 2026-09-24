import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createState } from "gnim"
import { authMessage, stubBackend, type AuthBackend } from "../../shared/services/auth"
import { createPower } from "../../shared/services/power"
import { GREETER_DEV } from "../../shared/services/env"
import Screen from "../../shared/widget/Screen"
import Clock from "../../shared/widget/Clock"
import PasswordField from "../../shared/widget/PasswordField"
import UserPicker, { UserLabel, type User } from "../../shared/widget/UserPicker"
import SessionPicker, { type Session } from "../../shared/widget/SessionPicker"

// ── Экран входа ───────────────────────────────────────────────────────────────
// ЭТАП «UI с заглушкой»: интерфейс живой целиком, но данные ещё статичные, а
// пароль проверяет заглушка (верный — `test`). Чтение /etc/passwd, сессий и
// настоящий AstalGreet подключаются дальше.

const USERS: User[] = [
  { name: "none9632", label: "none9632" },
  { name: "alice", label: "alice" },
]

const SESSIONS: Session[] = [
  { id: "hyprland", name: "Hyprland", exec: "Hyprland" },
  { id: "hyprland-uwsm", name: "Hyprland (uwsm)", exec: "uwsm start hyprland.desktop" },
]

const backend: AuthBackend = stubBackend("заглушка входа")
const power = createPower(!GREETER_DEV)

export default function GreeterWindow(gdkmonitor: Gdk.Monitor, primary: boolean) {
  const [users] = createState(USERS)
  const [sessions] = createState(SESSIONS)
  const [user, setUser] = createState(USERS[0].name)
  const [session, setSession] = createState<Session>(SESSIONS[0])
  const [layout] = createState("en")
  const [busy, setBusy] = createState(false)
  const [error, setError] = createState("")

  async function submit(password: string) {
    setBusy(true)
    setError("")
    try {
      await backend.authenticate(user.get(), password)
      // Успех: на этом этапе сессию ещё никто не запускает.
      console.log(`вход разрешён: ${user.get()} → ${session.get().name}`)
    } catch (e) {
      setError(authMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const single = users.get().length <= 1

  return (
    <window
      visible
      name={`greeter-${gdkmonitor.connector ?? "0"}`}
      class="Greeter"
      gdkmonitor={gdkmonitor}
      anchor={
        Astal.WindowAnchor.TOP |
        Astal.WindowAnchor.BOTTOM |
        Astal.WindowAnchor.LEFT |
        Astal.WindowAnchor.RIGHT
      }
      exclusivity={Astal.Exclusivity.IGNORE}
      // Ввод забирает только основной монитор: иначе на второй экран уедет
      // второе поле пароля и они начнут драться за фокус.
      keymode={primary ? Astal.Keymode.EXCLUSIVE : Astal.Keymode.NONE}
      layer={Astal.Layer.OVERLAY}
      application={app}
    >
      <Screen
        wallpaper={null}
        layout={layout}
        content={primary}
        onPoweroff={power.poweroff}
        onReboot={power.reboot}
      >
        <Clock />
        {single ? (
          <UserLabel user={users.get()[0]} />
        ) : (
          <UserPicker users={users} selected={user} onSelect={setUser} />
        )}
        <PasswordField
          busy={busy}
          error={error}
          onInput={() => setError("")}
          onSubmit={submit}
        />
        <SessionPicker
          sessions={sessions}
          selected={session.as((s) => s)}
          onSelect={(id) => setSession(SESSIONS.find((s) => s.id === id) ?? SESSIONS[0])}
        />
      </Screen>
    </window>
  )
}
