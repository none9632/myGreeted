import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createState } from "gnim"
import { authMessage } from "../../shared/services/auth"
import { createGreeterAuth } from "../services/auth"
import { createPower } from "../../shared/services/power"
import { createKeyboard } from "../../shared/services/keyboard"
import { GREETER_DEV } from "../../shared/services/env"
import { chooseGreeterWallpaper } from "../../shared/services/paths"
import { listSessions, type Session } from "../../shared/services/sessions"
import { listUsers } from "../../shared/services/users"
import { readLastChoice, writeLastChoice } from "../../shared/services/state"
import Screen from "../../shared/widget/Screen"
import Clock from "../../shared/widget/Clock"
import PasswordField from "../../shared/widget/PasswordField"
import UserPicker, { UserLabel, type User } from "../../shared/widget/UserPicker"
import SessionPicker from "../../shared/widget/SessionPicker"

// ── Login screen ──────────────────────────────────────────────────────────────
// The rail composition: controls in a column at the left edge, clock and input in
// the content column. Everything to do with greetd hides behind
// createGreeterAuth(), so what is left here is screen state.

// All of this is read once at startup: nothing about the system shifts underfoot
// inside a greeter, and re-reading it per monitor would be pointless.
const USERS: User[] = listUsers()
const SESSIONS: Session[] = listSessions()
const LAST = readLastChoice()

const auth = createGreeterAuth()
const power = createPower(!GREETER_DEV)
const keyboard = createKeyboard()
const wallpaper = chooseGreeterWallpaper()

/** Last time's choice, if it still exists; otherwise the first in the list. */
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
      setError("No sessions found")
      return
    }

    setBusy(true)
    setError("")
    try {
      // Save the choice before logging in: once start_session succeeds greetd
      // puts the greeter out, and there is no time left to write anything.
      writeLastChoice({ user: user.get(), session: chosen.id })

      const who = USERS.find((u) => u.name === user.get())
      if (!who) throw new Error("no such user")
      await auth.login(who, password, chosen)

      // greetd only starts the session once the greeter has exited. So exit;
      // `hyprctl dispatch exit` in the Hyprland config finishes the job. In debug
      // we stay on screen — there is nowhere and no reason to go.
      if (!GREETER_DEV) app.quit()
    } catch (e) {
      setError(authMessage(e))
    } finally {
      setBusy(false)
    }
  }

  // Nothing to choose between — the monogram row would only take up space.
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
      // Only the primary monitor takes input: otherwise a second password field
      // ends up on the second screen and the two fight over focus.
      keymode={primary ? Astal.Keymode.EXCLUSIVE : Astal.Keymode.NONE}
      layer={Astal.Layer.OVERLAY}
      application={app}
    >
      {/* An escape hatch for debugging only. The window takes the keyboard
          exclusively and covers the screen, so without this there is no way to
          reach anything else and shut it down. A live greeter must never be
          dismissible — there, Escape does nothing. */}
      <Gtk.EventControllerKey
        propagationPhase={Gtk.PropagationPhase.CAPTURE}
        onKeyPressed={(_self, keyval) => {
          if (GREETER_DEV && keyval === Gdk.KEY_Escape) {
            app.quit()
            return true
          }
          return false
        }}
      />
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
          <UserLabel user={USERS[0] ?? { name: "", label: "?", shell: "/bin/sh" }} />
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
