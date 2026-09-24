import { timeout } from "ags/time"

// ── Authentication: the shared parts ──────────────────────────────────────────
// The login screen and the locker check passwords differently (greetd versus
// PAM), but both hand out the same thing: a promise that resolves means you are
// in, an AuthError means we show its text. The password is never logged and
// never stored anywhere but the call argument — which is why nothing here prints
// or keeps it.

export class AuthError extends Error {}

/** The debug stub's password. The real check never sees it. */
const STUB_PASSWORD = "test"

/**
 * The development stub. It holds an artificial pause so the "checking" state is
 * actually visible and can be worked on.
 */
export function verifyStub(password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    timeout(600, () => {
      if (password === STUB_PASSWORD) resolve()
      else reject(new AuthError("Wrong password"))
    })
  })
}

/** Reduce any error to a string that is fit to put on screen. */
export function authMessage(error: unknown): string {
  if (error instanceof AuthError) return error.message
  if (error instanceof Error && error.message) return error.message
  return "Could not log in"
}
