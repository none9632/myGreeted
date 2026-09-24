import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createState } from "gnim"
import Screen from "../../shared/widget/Screen"
import Clock from "../../shared/widget/Clock"
import PasswordField from "../../shared/widget/PasswordField"
import UserPicker, { UserLabel, type User } from "../../shared/widget/UserPicker"
import SessionPicker, { type Session } from "../../shared/widget/SessionPicker"

// ── Экран входа ───────────────────────────────────────────────────────────────
// ЭТАП «макет»: данные пока статичные, вход ничего не делает. Списки
// пользователей и сессий, кэш последнего выбора и настоящая аутентификация
// приезжают на следующих этапах.

const USERS: User[] = [
  { name: "none9632", label: "none9632" },
  { name: "alice", label: "alice" },
]

const SESSIONS: Session[] = [
  { id: "hyprland", name: "Hyprland", exec: "Hyprland" },
  { id: "hyprland-uwsm", name: "Hyprland (uwsm)", exec: "uwsm start hyprland.desktop" },
]

export default function GreeterWindow(gdkmonitor: Gdk.Monitor, primary: boolean) {
  const [user, setUser] = createState(USERS[0].name)
  const [session, setSession] = createState<Session>(SESSIONS[0])
  const [busy] = createState(false)
  const [error, setError] = createState("")
  const [users] = createState(USERS)
  const [sessions] = createState(SESSIONS)
  const [layout] = createState("en")

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
      <Screen wallpaper={null} layout={layout}>
        {primary ? (
          <box orientation={Gtk.Orientation.VERTICAL}>
            <Clock />
            {users.get().length > 1 ? (
              <UserPicker users={users} selected={user} onSelect={setUser} />
            ) : (
              <UserLabel user={users.get()[0]} />
            )}
            <PasswordField
              busy={busy}
              error={error}
              onSubmit={() => setError("Вход появится на следующем этапе")}
            />
            <SessionPicker
              sessions={sessions}
              selected={session.as((s) => s)}
              onSelect={(id) => setSession(SESSIONS.find((s) => s.id === id) ?? SESSIONS[0])}
            />
          </box>
        ) : (
          <box />
        )}
      </Screen>
    </window>
  )
}
