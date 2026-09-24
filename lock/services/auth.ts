import AstalAuth from "gi://AstalAuth"
import { AuthError } from "../../shared/services/auth"

// ── Проверка пароля через PAM ─────────────────────────────────────────────────
// В отличие от экрана входа, здесь заглушка не нужна ни в каком режиме: PAM
// просто проверяет пароль текущего пользователя и ничего в системе не меняет,
// так что блокировщик одинаково честен и в отладке, и в бою.
//
// Сервис по умолчанию — astal-auth; его файл ставит сам libastal-auth
// (/etc/pam.d/astal-auth, включает login). Ничего настраивать не нужно.

export interface LockAuth {
  /** Проверить пароль текущего пользователя. Бросает AuthError. */
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
            // PAM возвращает свой текст («Authentication failure»), и он
            // одинаков для неверного пароля и для заблокированного аккаунта.
            // Показывать его дословно бессмысленно.
            reject(new AuthError(pamMessage(e)))
          }
        })
      })
    },
  }
}

function pamMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  if (/auth|incorrect|failure/i.test(raw)) return "Неверный пароль"
  return raw || "Не удалось разблокировать"
}
