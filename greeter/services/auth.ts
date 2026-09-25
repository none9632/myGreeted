import AstalGreet from "gi://AstalGreet"
import GLib from "gi://GLib"
import { AuthError, verifyStub } from "../../shared/services/auth"
import { GREETER_DEV } from "../../shared/services/env"
import type { Session } from "../../shared/services/sessions"
import type { User } from "../../shared/widget/UserPicker"

// ── Logging in through greetd ─────────────────────────────────────────────────
// AstalGreet.login_with_env performs all three steps of the protocol at once:
// create_session, post_auth with the password, and start_session. If the password
// is wrong the promise rejects and greetd cancels the half-built session itself.
//
// Without GREETD_SOCK there is nothing to connect to, so a stub runs instead: the
// whole screen is testable inside a live session with a plain `ags run`.

export interface GreeterAuth {
  /** Check the password and start the session. Throws AuthError. */
  login(user: User, password: string, session: Session): Promise<void>
  /** A human-readable name for the mode — it goes into the log at startup. */
  readonly kind: string
}

/**
 * The command handed to greetd.
 *
 * Not the session's Exec on its own: greetd runs it directly, with no shell in
 * between, so none of the user's profile is read. That profile is where PATH
 * picks up ~/.local/bin and where variables like ZDOTDIR are set, and without it
 * a session comes up subtly broken — scripts missing from PATH, shells starting
 * without their configuration.
 *
 * So the session is wrapped in the user's own login shell (`-l`), which reads
 * the profile, and `exec` replaces the shell so no extra process is left behind.
 * The XDG variables that describe the session go in front of it through `env`,
 * since they cannot be passed alongside — see createGreeterAuth.
 *
 * AstalGreet splits this string with shell quoting rules, so the inner command
 * survives as a single argument.
 */
function sessionCommand(user: User, session: Session): string {
  const vars = ["XDG_SESSION_TYPE=wayland", `XDG_SESSION_DESKTOP=${session.id}`]
  if (session.desktopNames) vars.push(`XDG_CURRENT_DESKTOP=${session.desktopNames}`)

  const inner = `exec env ${vars.join(" ")} ${session.exec}`
  const shell = user.shell || "/bin/sh"
  return `${shell} -lc ${GLib.shell_quote(inner)}`
}

export function createGreeterAuth(): GreeterAuth {
  if (GREETER_DEV) {
    return {
      kind: "stub (GREETD_SOCK is not set)",
      async login(user, password, session) {
        await verifyStub(password)
        console.log(`login accepted: ${user.name} → ${session.name}`)
        console.log(`would run: ${sessionCommand(user, session)}`)
      },
    }
  }

  return {
    kind: "greetd",
    async login(user, password, session) {
      try {
        // login(), not login_with_env(): the variant taking an environment
        // array marshals it wrongly here — the array arrives at greetd empty,
        // and with some inputs the process dies outright. Its GIR annotations
        // are what mislead gjs, the same sloppiness that makes the callback
        // mandatory below. The variables ride inside the command instead.
        //
        // The callback is not optional, whatever the generated typings suggest:
        // gjs only turns a GIR async function into a promise when the function
        // is annotated with its finish counterpart, and this one is not.
        await new Promise<void>((resolve, reject) => {
          AstalGreet.login(
            user.name,
            password,
            sessionCommand(user, session),
            (_source, res) => {
              try {
                AstalGreet.login_finish(res!)
                resolve()
              } catch (e) {
                reject(e)
              }
            },
          )
        })
      } catch (e) {
        throw new AuthError(greetdMessage(e))
      }
    },
  }
}

/**
 * greetd answers every situation with a single string, and most of the time that
 * string is "Authentication failure". Rewrite the familiar ones and show the rest
 * verbatim — an opaque message beats a swallowed error.
 */
function greetdMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)

  if (/auth/i.test(raw) && /fail|incorrect|invalid/i.test(raw)) return "Wrong password"
  if (/no such user|unknown user/i.test(raw)) return "No such user"
  if (/permission denied/i.test(raw)) return "Login not permitted"

  // Neither of these is about the person typing: they mean the screen is not
  // talking to greetd at all.
  if (/socket not found/i.test(raw)) return "greetd is not running"
  if (/could not connect/i.test(raw)) return "Cannot reach greetd"

  // Anything else is shown as it came, minus the GError type name in front of
  // it — that prefix tells a person nothing, and the rest might.
  return raw.replace(/^[\w.]+:\s*/, "") || "Could not log in"
}
