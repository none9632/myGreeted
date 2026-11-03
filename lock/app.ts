import app from "ags/gtk4/app"
import { Gtk } from "ags/gtk4"
import { timeout } from "ags/time"
import Gdk from "gi://Gdk"
import Gtk4SessionLock from "gi://Gtk4SessionLock"
import style from "./style.scss"
import { LOCK_DEV, LOCK_SUSPEND_DELAY } from "../shared/services/env"
import { createIdleSuspend } from "./services/suspend"
import { currentUser } from "../shared/services/users"
import LockWindow, { LockContent } from "./widget/LockWindow"
import type { User } from "../shared/widget/UserPicker"

// The lock screen is its own process rather than part of the shell: if the shell
// crashes or gets restarted, the lock has to stay on screen.
//
// Two run modes:
//   MY_LOCK_DEV=1  — an ordinary layer-shell window over the session, Escape
//                    quits; this is how the screen is worked on without the risk
//                    of locking yourself out.
//   default        — a real ext-session-lock: the compositor blanks everything
//                    else, and the only way out is the right password.
app.start({
  instanceName: "my-lock",
  css: style,
  main() {
    // GTK rings the bell on Backspace in an empty field, and since 4.24 that
    // bell is an actual sound. A lock screen has no use for it.
    Gtk.Settings.get_default()!.gtkErrorBell = false

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
    console.error("the compositor does not support ext-session-lock — nothing to lock with")
    app.quit()
    return
  }

  const lock = Gtk4SessionLock.Instance.new()
  const idle = createIdleSuspend({ live: true, delay: LOCK_SUSPEND_DELAY ?? 0 })

  // One surface per monitor. The signal fires once for every screen that exists
  // when the lock starts, and then for each one plugged in afterwards; the
  // library unmaps and destroys the windows itself once the lock ends.
  lock.connect("monitor", (_lock, monitor: Gdk.Monitor) => {
    const window = new Gtk.Window({ application: app, name: "lock" })
    window.add_css_class("Lock")
    window.set_child(LockContent({ user, onUnlock: () => lock.unlock() }) as Gtk.Widget)

    // Every key press on every surface holds off the suspend. The controller
    // watches the capture phase and hands the event on untouched: the password
    // field must still receive it, this only needs to know it happened.
    const keys = new Gtk.EventControllerKey()
    keys.set_propagation_phase(Gtk.PropagationPhase.CAPTURE)
    keys.connect("key-pressed", () => {
      idle.bump()
      return false
    })
    window.add_controller(keys)

    lock.assign_window_to_monitor(window, monitor)
  })

  lock.connect("failed", () => {
    console.error("could not lock the session: someone else is holding the lock")
    idle.cancel()
    app.quit()
  })

  // Unlocked — either by our password or from outside by the compositor. Either
  // way the process has nothing left to do, but it must not go away here and
  // now.
  //
  // The signal is emitted from inside unlock(), before the library has sent
  // unlock_and_destroy to the compositor — and app.quit() never returns: AGS
  // ends the process on the spot with System.exit. Quitting from this handler
  // therefore kills the client while the compositor still holds the lock, and
  // the only thing a compositor can read into that is a crashed locker. The
  // screen stays locked and Hyprland puts up its "lockscreen app died" notice.
  //
  // One turn of the main loop later, unlock() has finished: it sends the
  // request and waits out a Wayland roundtrip itself, so by then the lock is
  // well and truly gone and there is nothing left to leave behind.
  lock.connect("unlocked", () => {
    idle.cancel()
    timeout(0, () => app.quit())
  })

  // Only once the lock is really up: a session that could not be locked must
  // not be put to sleep. This is what "really up" means — lock() only starts
  // the acquisition, while this signal is the compositor saying the lock
  // surfaces are on screen. With a delay of zero the difference is the whole
  // story: counting from lock() would suspend the machine while the session
  // was still unlocked.
  lock.connect("locked", () => {
    if (LOCK_SUSPEND_DELAY !== null) idle.start()
  })

  if (!lock.lock()) {
    console.error("could not lock the session")
    app.quit()
    return
  }
}
