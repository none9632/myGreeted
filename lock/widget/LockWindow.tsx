import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createState } from "gnim"
import { timeout } from "ags/time"
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

// How long the screen takes to leave, in milliseconds. The animation itself is
// the `screen.leaving` section of shared/style/_base.scss — $dur-exit plus
// $exit-step — and this is the same span written again, because the compositor
// has to be told when it is over and CSS cannot say so.
const EXIT_MS = 280

const auth = createLockAuth()
const power = createPower(!LOCK_DEV)
const keyboard = createKeyboard()
const wallpaper = currentWallpaper()

/** The screen's contents: identical for the debug window and for session-lock. */
export function LockContent(props: {
  user: User
  onUnlock: () => void
  /**
   * Handed the way out, for the debug window's Escape: there is no password
   * there, but the exit is worth being able to look at.
   */
  $leave?: (leave: () => void) => void
}) {
  const [busy, setBusy] = createState(false)
  const [error, setError] = createState("")
  const [leaving, setLeaving] = createState(false)

  /**
   * Play the screen out, then unlock.
   *
   * The session stays locked for the whole of it — the compositor only lets go
   * when onUnlock asks — so this is the entire cost of the exit, and the reason
   * it is short.
   */
  function leave() {
    if (leaving.get()) return
    setLeaving(true)
    timeout(EXIT_MS, () => props.onUnlock())
  }

  props.$leave?.(leave)

  async function submit(password: string) {
    setBusy(true)
    setError("")
    try {
      await auth.authenticate(password)
    } catch (e) {
      setError(authMessage(e))
      setBusy(false)
      return
    }

    // Accepted. The field stays busy on the way out: nothing more should be
    // typed into it, and dropping busy would empty it (see PasswordField), so
    // the dots would vanish a moment before the screen does.
    leave()
  }

  return (
    <Screen
      wallpaper={wallpaper}
      leaving={leaving}
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

/** The debug window: a plain layer-shell surface over the session; Escape leaves. */
export default function LockWindow(gdkmonitor: Gdk.Monitor, user: User) {
  let leave: () => void

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
          // Debug only: a live locker must not be able to close itself. It
          // leaves the way the real one does, animation and all — which is the
          // only way to see the exit without knowing the password.
          if (keyval === Gdk.KEY_Escape) {
            leave()
            return true
          }
          return false
        }}
      />
      <LockContent user={user} onUnlock={() => app.quit()} $leave={(fn) => (leave = fn)} />
    </window>
  )
}
