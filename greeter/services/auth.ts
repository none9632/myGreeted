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
 * Where the session's output goes instead of the screen.
 *
 * greetd hands the session the VT as its stdin, stdout and stderr, so
 * everything the compositor prints before it takes over the display scrolls
 * across tty1 — the second time in one boot, right after the password is
 * accepted and the login screen disappears. Hyprland keeps its own full log in
 * $XDG_RUNTIME_DIR/hypr/<instance>/hyprland.log, so nothing is really lost;
 * this file catches the early lines that precede it, and the output of whatever
 * the session starts afterwards.
 *
 * The path is expanded by the shell that runs the session, not by us —
 * XDG_RUNTIME_DIR is set by pam_systemd when greetd opens the session, and both
 * it and the fallback are directories that always exist. A redirection into a
 * missing directory would make the shell exit before the session ever starts,
 * which greetd would show as an instant return to the login screen.
 *
 * Runtime dir, not the home directory: the log belongs to this boot and goes
 * away with the session, like Hyprland's own.
 */
const SESSION_LOG = '"${XDG_RUNTIME_DIR:-/tmp}/my-greeter-session.log"'

/**
 * The command handed to greetd.
 *
 * Not the session's Exec on its own. greetd does put a shell in front of it and
 * will source /etc/profile and ~/.profile first, but only those: a login shell's
 * own files — ~/.bash_profile, ~/.zprofile — are never read. That profile is where PATH
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

  const inner = `exec env ${vars.join(" ")} ${session.exec} >${SESSION_LOG} 2>&1`
  const shell = user.shell || "/bin/sh"
  const line = `${shell} -lc ${GLib.shell_quote(inner)}`

  // Quoted once more, so the whole line arrives as a single argument.
  //
  // greetd takes the argv it is given, joins it back into one command line and
  // hands that to sh(1) — its manual says so outright. Anything spread across
  // several elements therefore loses its quoting on the way: `bash -lc 'exec …'`
  // comes out as `bash -lc exec`, which runs nothing, exits 0 and hands control
  // straight back to greetd. That is an endless succession of login screens,
  // each one looking like a rejected password.
  //
  // One element survives the round trip untouched.
  return GLib.shell_quote(line)
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
 * What PAM says, in words.
 *
 * greetd passes a PAM failure on exactly as libpam reported it: the call that
 * failed, a colon, and the result code — `pam_authenticate: AUTH_ERR` for the
 * ordinary case of a mistyped password, which is nearly every case. That is a
 * line for a log, not for someone standing in front of the screen.
 *
 * Listed here are the codes a login screen can actually produce. The rest keep
 * their code (see greetdMessage): they mean something is wrong with the account
 * or with PAM itself, and then the exact word is the only clue anyone gets.
 */
const PAM_ERRORS: Record<string, string | undefined> = {
  AUTH_ERR: "Wrong password",
  USER_UNKNOWN: "No such user",
  MAXTRIES: "Too many attempts",
  PERM_DENIED: "Login not permitted",
  ACCT_EXPIRED: "Account expired",
  AUTHTOK_EXPIRED: "Password expired",
  NEW_AUTHTOK_REQD: "The password has to be changed",
  AUTHINFO_UNAVAIL: "Cannot check the password",
}

/**
 * greetd answers every situation with a single string. Rewrite the familiar ones
 * and show the rest verbatim — an opaque message beats a swallowed error.
 */
function greetdMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)

  // The code is looked for anywhere in the string rather than at the front: gjs
  // puts the error domain before the message, and which of libpam's functions
  // returned the code is of no interest here.
  const pam = raw.match(/\bpam_\w+:\s*([A-Z][A-Z_]*)/)
  if (pam) return PAM_ERRORS[pam[1]] ?? `Could not log in (${pam[1]})`

  // No code to go by: greetd's own wording, or a PAM module that writes its own
  // message instead of returning one of the codes above.
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
