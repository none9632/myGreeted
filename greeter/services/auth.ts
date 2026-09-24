import AstalGreet from "gi://AstalGreet"
import { AuthError, verifyStub } from "../../shared/services/auth"
import { GREETER_DEV } from "../../shared/services/env"
import type { Session } from "../../shared/services/sessions"

// ── Вход через greetd ─────────────────────────────────────────────────────────
// AstalGreet.login_with_env делает все три шага протокола разом: create_session,
// post_auth с паролем и start_session. Если пароль неверный, промис отклоняется
// и greetd сам отменяет незавершённую сессию.
//
// Без GREETD_SOCK подключаться некуда, поэтому там работает заглушка: экран
// целиком тестируется в живой сессии обычным `ags run`.

export interface GreeterAuth {
  /** Проверить пароль и запустить сессию. Бросает AuthError. */
  login(username: string, password: string, session: Session): Promise<void>
  /** Человекочитаемое имя режима — уходит в лог при старте. */
  readonly kind: string
}

/**
 * Переменные окружения сессии. greetd передаёт их процессу как есть, а из них
 * порталы, XDG-автозапуск и сами приложения понимают, куда они попали.
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
      kind: "заглушка (GREETD_SOCK не задан)",
      async login(username, password, session) {
        await verifyStub(password)
        console.log(`вход разрешён: ${username} → ${session.name}`)
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
 * greetd отвечает одной строкой на все случаи жизни, и чаще всего это
 * «Authentication failure». Переводим знакомые варианты, остальное показываем
 * как есть — лучше непонятный текст, чем проглоченная ошибка.
 */
function greetdMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)

  if (/auth/i.test(raw) && /fail|incorrect|invalid/i.test(raw)) return "Неверный пароль"
  if (/no such user|unknown user/i.test(raw)) return "Такого пользователя нет"
  if (/permission denied/i.test(raw)) return "Вход запрещён"
  return raw || "Не удалось войти"
}
