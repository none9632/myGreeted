import { timeout } from "ags/time"

// ── Аутентификация: общее ─────────────────────────────────────────────────────
// Экран входа и блокировщик проверяют пароль по-разному (greetd против PAM), но
// наружу оба отдают одно и то же: вернулся промис — пустили, кинул AuthError —
// показываем текст. Пароль не логируется и нигде не хранится, кроме аргумента
// вызова, — поэтому ни одна функция здесь его не печатает и не сохраняет.

export class AuthError extends Error {}

/** Пароль отладочной заглушки. Настоящая проверка его никогда не видит. */
const STUB_PASSWORD = "test"

/**
 * Заглушка для разработки. Держит искусственную паузу, чтобы состояние
 * «проверяем» реально было видно и его можно было отладить.
 */
export function verifyStub(password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    timeout(600, () => {
      if (password === STUB_PASSWORD) resolve()
      else reject(new AuthError("Неверный пароль"))
    })
  })
}

/** Привести любую ошибку к строке, которую не стыдно показать на экране. */
export function authMessage(error: unknown): string {
  if (error instanceof AuthError) return error.message
  if (error instanceof Error && error.message) return error.message
  return "Не удалось войти"
}
