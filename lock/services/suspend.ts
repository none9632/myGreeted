import { execAsync } from "ags/process"
import { timeout } from "ags/time"
import GLib from "gi://GLib"

// ── Suspend behind the lock ───────────────────────────────────────────────────
// The machine goes to sleep a while after the lock appears, the way the lid
// switch does. The countdown lives here rather than in an idle daemon or in the
// launcher, because this is the only process that knows both when the lock went
// up and when someone is typing into it.
//
// Two deadlines, the later one wins:
//
//   lock appeared + delay   the plain case — a minute of lock screen and then
//                           sleep, whether or not the mouse was nudged in
//                           between. A moved mouse is not a reason to stay
//                           awake, and an idle daemon cannot tell the
//                           difference: to it any input resets everything, so
//                           one brush against the touchpad would put the sleep
//                           a full idle period away.
//
//   last key + GRACE        someone is at the keyboard, probably halfway
//                           through a password. Suspending under their hands
//                           would sleep a session they are about to unlock —
//                           and on waking they would find a second lock screen
//                           over the first.
//
// The clock is monotonic and so stops while the machine is suspended: after
// waking up the next countdown starts from the beginning, not from whatever
// was left over from before the sleep.

/** How long the last key press keeps the machine awake, in seconds. */
const GRACE = 15

/**
 * The shortest wait between two suspends, in seconds.
 *
 * `-s 0` means sleep as soon as the lock is up, and the first countdown is as
 * short as it was asked to be. Every one after it is at least this long, for
 * two reasons. The machine has to stay unlockable: the key that wakes it up is
 * read by the firmware and never reaches this process, so a zero delay would
 * put the machine back to sleep before the password field saw a single
 * keystroke. And a suspend that does not happen at all — logind inhibited, or
 * not permitted — must not be retried as fast as the main loop turns: that was
 * thousands of `systemctl suspend` a second, with the lock screen starved of
 * the loop it needed to draw itself.
 */
const FLOOR = GRACE

export function createIdleSuspend(opts: { live: boolean; delay: number }) {
  let deadline = 0
  let timer: ReturnType<typeof timeout> | null = null

  /** Seconds, monotonic — unaffected by the clock being set or by a sleep. */
  const now = () => GLib.get_monotonic_time() / 1e6

  function schedule() {
    timer?.cancel()
    timer = timeout(Math.max(0, deadline - now()) * 1000, fire)
  }

  function fire() {
    // A key press may have pushed the deadline out while this timer was
    // waiting. It cannot re-arm a timer from under itself, so it only moves
    // the deadline and leaves the checking here.
    if (deadline - now() > 0.05) {
      schedule()
      return
    }

    if (opts.live) {
      execAsync(["systemctl", "suspend"]).catch((e) =>
        console.error("could not suspend:", e),
      )
    } else {
      console.log("[debug] suspend: systemctl suspend — not running it")
    }

    // Woken up and still locked? Then the same wait starts over — never
    // shorter than FLOOR, so there is time to type the password.
    deadline = now() + Math.max(opts.delay, FLOOR)
    schedule()
  }

  return {
    /** The lock is on screen — start counting. */
    start() {
      deadline = now() + opts.delay
      schedule()
    },

    /** A key went down: do not fall asleep under someone's hands. */
    bump() {
      deadline = Math.max(deadline, now() + GRACE)
      schedule()
    },

    /** Unlocked, or never locked at all. */
    cancel() {
      timer?.cancel()
      timer = null
    },
  }
}
