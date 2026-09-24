import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createState } from "gnim"
import { authMessage, stubBackend, type AuthBackend } from "../../shared/services/auth"
import { createPower } from "../../shared/services/power"
import { createKeyboard } from "../../shared/services/keyboard"
import { GREETER_DEV } from "../../shared/services/env"
import { greeterWallpaper } from "../../shared/services/paths"
import { listSessions, type Session } from "../../shared/services/sessions"
import { listUsers } from "../../shared/services/users"
import { readLastChoice, writeLastChoice } from "../../shared/services/state"
import Screen from "../../shared/widget/Screen"
import Clock from "../../shared/widget/Clock"
import PasswordField from "../../shared/widget/PasswordField"
import UserPicker, { UserLabel, type User } from "../../shared/widget/UserPicker"
import SessionPicker from "../../shared/widget/SessionPicker"

// ── Экран входа ───────────────────────────────────────────────────────────────
// ЭТАП «данные»: списки читаются из системы, последний выбор запоминается.
// Настоящий вход через AstalGreet подключается на следующем этапе.

// Всё это читается один раз на старте: в greeter'е система не меняется под
// ногами, а перечитывать на каждый монитор незачем.
const USERS: User[] = listUsers()
const SESSIONS: Session[] = listSessions()
const LAST = readLastChoice()

const backend: AuthBackend = stubBackend("заглушка входа")
const power = createPower(!GREETER_DEV)
const keyboard = createKeyboard()
const wallpaper = greeterWallpaper()

/** Прошлый выбор, если он всё ещё существует; иначе первый в списке. */
function initialUser(): string {
  const remembered = USERS.find((u) => u.name === LAST.user)
  return (remembered ?? USERS[0])?.name ?? ""
}

function initialSession(): Session | null {
  const remembered = SESSIONS.find((s) => s.id === LAST.session)
  return remembered ?? SESSIONS[0] ?? null
}

export default function GreeterWindow(gdkmonitor: Gdk.Monitor, primary: boolean) {
  const [users] = createState(USERS)
  const [sessions] = createState(SESSIONS)
  const [user, setUser] = createState(initialUser())
  const [session, setSession] = createState<Session | null>(initialSession())
  const [busy, setBusy] = createState(false)
  const [error, setError] = createState("")

  async function submit(password: string) {
    const chosen = session.get()
    if (!chosen) {
      setError("Не найдено ни одной сессии")
      return
    }

    setBusy(true)
    setError("")
    try {
      await backend.authenticate(user.get(), password)
      writeLastChoice({ user: user.get(), session: chosen.id })
      console.log(`вход разрешён: ${user.get()} → ${chosen.name}`)
    } catch (e) {
      setError(authMessage(e))
    } finally {
      setBusy(false)
    }
  }

  // Выбирать не из чего — ряд монограмм только занимал бы место.
  const single = USERS.length <= 1

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
        wallpaper={wallpaper}
        content={primary}
        layout={keyboard.layout}
        onLayoutClicked={keyboard.next}
        onPoweroff={power.poweroff}
        onReboot={power.reboot}
      >
        <Clock />
        {single ? (
          <UserLabel user={USERS[0] ?? { name: "", label: "?" }} />
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
          selected={session}
          onSelect={(id) => setSession(SESSIONS.find((s) => s.id === id) ?? null)}
        />
      </Screen>
    </window>
  )
}
