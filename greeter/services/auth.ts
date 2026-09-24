import AstalGreet from "gi://AstalGreet"
import { AuthError, verifyStub } from "../../shared/services/auth"
import { GREETER_DEV } from "../../shared/services/env"
import type { Session } from "../../shared/services/sessions"

// ── Logging in through greetd ─────────────────────────────────────────────────
// AstalGreet.login_with_env performs all three steps of the protocol at once:
// create_session, post_auth with the password, and start_session. If the password
// is wrong the promise rejects and greetd cancels the half-built session itself.
//
// Without GREETD_SOCK there is nothing to connect to, so a stub runs instead: the
// whole screen is testable inside a live session with a plain `ags run`.

export interface GreeterAuth {
  /** Check the password and start the session. Throws AuthError. */
  login(username: string, password: string, session: Session): Promise<void>
  /** A human-readable name for the mode — it goes into the log at startup. */
  readonly kind: string
}

/**
 * The session's environment variables. greetd passes them to the process as-is,
 * and from them the portals, XDG autostart and the applications themselves work
 * out where they have landed.
 */
function sessionEnv(session: Session): string[] {
  const env = [
    "XDG_SESSION_TYPE=wayland",
    `XDG_SESSION_DESKTOP=${session.id}`,
  ]
  if (session.desktopNames) env.push(`XDG_CURRENT_DESKTOP=${session.desktopNames}`)
  return env
}

export function createGreeterAuth(): GreeterAuth {
  if (GREETER_DEV) {
    return {
      kind: "stub (GREETD_SOCK is not set)",
      async login(username, password, session) {
        await verifyStub(password)
        console.log(`login accepted: ${username} → ${session.name}`)
      },
    }
  }

  return {
    kind: "greetd",
    async login(username, password, session) {
      try {
        await AstalGreet.login_with_env(
          username,
          password,
          session.exec,
          sessionEnv(session),
        )
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
  return raw || "Could not log in"
}
