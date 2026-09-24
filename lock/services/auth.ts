import AstalAuth from "gi://AstalAuth"
import { AuthError } from "../../shared/services/auth"

// ── Checking the password through PAM ─────────────────────────────────────────
// Unlike the login screen, no stub is needed here in any mode: PAM merely checks
// the current user's password and changes nothing in the system, so the locker is
// equally honest in debug and in production.
//
// The default service is astal-auth; its file ships with libastal-auth itself
// (/etc/pam.d/astal-auth, which includes login). Nothing needs configuring.

export interface LockAuth {
  /** Check the current user's password. Throws AuthError. */
  authenticate(password: string): Promise<void>
  readonly kind: string
}

export function createLockAuth(): LockAuth {
  return {
    kind: "PAM (astal-auth)",
    authenticate(password) {
      return new Promise((resolve, reject) => {
        AstalAuth.Pam.authenticate(password, (_pam, res) => {
          try {
            AstalAuth.Pam.authenticate_finish(res!)
            resolve()
          } catch (e) {
            // PAM returns its own text ("Authentication failure"), and it reads
            // the same for a wrong password and for a locked account. Showing it
            // verbatim would say nothing.
            reject(new AuthError(pamMessage(e)))
          }
        })
      })
    },
  }
}

function pamMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  if (/auth|incorrect|failure/i.test(raw)) return "Wrong password"
  return raw || "Could not unlock"
}
