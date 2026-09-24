import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createState } from "gnim"
import { authMessage } from "../../shared/services/auth"
import { createLockAuth } from "../services/auth"
import { createPower } from "../../shared/services/power"
import { createKeyboard } from "../../shared/services/keyboard"
import { currentWallpaper } from "../../shared/services/paths"
import { LOCK_DEV } from "../../shared/services/env"
import Screen from "../../shared/widget/Screen"
import Clock from "../../shared/widget/Clock"
import PasswordField from "../../shared/widget/PasswordField"
import { UserLabel, type User } from "../../shared/widget/UserPicker"

// ── Lock screen ───────────────────────────────────────────────────────────────
// The same composition as the login screen, minus the user and session pickers:
// the locker always returns to the current user's already-running session.
//
// The password is always checked by real PAM — it changes nothing in the system,
// so no stub is needed. Only the window stays a debug affair: a live
// ext-session-lock would genuinely lock the session.

const auth = createLockAuth()
const power = createPower(!LOCK_DEV)
const keyboard = createKeyboard()
const wallpaper = currentWallpaper()

/** The screen's contents: identical for the debug window and for session-lock. */
export function LockContent(props: { user: User; onUnlock: () => void }) {
  const [busy, setBusy] = createState(false)
  const [error, setError] = createState("")

  async function submit(password: string) {
    setBusy(true)
    setError("")
    try {
      await auth.authenticate(password)
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

/** The debug window: a plain layer-shell surface over the session, Escape quits. */
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
          // Debug only: a live locker must not be able to close itself.
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
