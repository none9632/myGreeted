import { timeout } from "ags/time"

// ── Аутентификация: общий контракт ────────────────────────────────────────────
// Экран входа и блокировщик проверяют пароль по-разному (greetd против PAM), но
// виджетам нужна одна и та же форма: вернулся промис — пустили, кинул
// AuthError — показываем текст. Ничего, кроме текста ошибки, наружу не уходит;
// пароль не логируется и не хранится нигде, кроме аргумента вызова.

export class AuthError extends Error {}

export interface AuthBackend {
  /** Проверить пароль и (для входа) запустить сессию. Бросает AuthError. */
  authenticate(username: string, password: string): Promise<void>
  /** Человекочитаемое имя режима — уходит в лог при старте. */
  readonly kind: string
}

const WRONG_PASSWORD = "Неверный пароль"

/**
 * Заглушка для разработки: верный пароль — `test`. Держит искусственную паузу,
 * чтобы состояние «проверяем» реально было видно и его можно было отладить.
 */
export function stubBackend(kind = "заглушка"): AuthBackend {
  return {
    kind,
    authenticate(_username, password) {
      return new Promise((resolve, reject) => {
        timeout(600, () => {
          if (password === "test") resolve()
          else reject(new AuthError(WRONG_PASSWORD))
        })
      })
    },
  }
}

/** Привести любую ошибку к строке, которую не стыдно показать на экране. */
export function authMessage(error: unknown): string {
  if (error instanceof AuthError) return error.message
  if (error instanceof Error && error.message) return error.message
  return "Не удалось войти"
}
