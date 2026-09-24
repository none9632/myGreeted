# my-greeter

Экран входа для [greetd](https://sr.ht/~kennylevinsen/greetd/) и экран блокировки
для Hyprland на [AGS 3](https://github.com/Aylur/ags) + Astal (GTK4).

Оба экрана — одна композиция, **«рельс»**: узкая колонка управления у левого
края (питание, раскладка), крупная типографика и ввод — в колонке контента.
Ничего не центрировано; сетку задаёт короткий акцентный штрих под датой.
Поле пароля — не рамка, а строка с подчёркиванием, которое наливается акцентом
при фокусе и краснеет при неверном пароле.

Стили, виджеты и сервисы общие; различается только набор блоков в колонке:

| | вход | блокировка |
|---|---|---|
| часы и дата | ✓ | ✓ |
| выбор пользователя | ✓ (скрыт, если он один) | — имя текущего |
| выбор сессии | ✓ | — |
| питание, раскладка | ✓ | ✓ |
| проверка пароля | greetd (AstalGreet) | PAM (AstalAuth) |
| поверхность | layer-shell | ext-session-lock |

## Требования

- `aylurs-gtk-shell-git` (AGS 3.x), `libastal-greetd`, `libastal-auth`, `libastal-hyprland`
- `gtk4-layer-shell` (даёт и `Gtk4SessionLock`)
- `dart-sass` — SCSS собирается при каждом запуске
- шрифты `inter` и `ttf-iosevka-nerd`
- `greetd` и системный пользователь `greeter` (для экрана входа)

## Структура

```
shared/
  style/      colors.scss (цвета) + _tokens.scss (всё остальное) + партиалы
  widget/     Screen, Rail, Clock, PasswordField, UserPicker, SessionPicker
  services/   env, paths, users, sessions, state, keyboard, power, auth
greeter/      экран входа: свой app.ts, style.scss и services/auth.ts (greetd)
lock/         экран блокировки: свой app.ts, style.scss и services/auth.ts (PAM)
packaging/    matugen, конфиг Hyprland для greeter-сессии, установщик
```

Цвета живут **только** в `shared/style/colors.scss` — плоский список `$имя: #hex`,
который целиком перегенерируется шаблоном matugen. Всё остальное (прозрачность,
градиенты, тени, кривые анимаций) собирается из них в `_tokens.scss`.

## Запуск в текущей сессии

Оба экрана тестируются обычным `ags run`, ничего системного трогать не нужно.

```bash
# Экран входа. Без GREETD_SOCK работает заглушка: верный пароль — test,
# последний выбор пишется в ~/.cache/my-greeter/, кнопки питания только логируют.
ags run ~/Projects/myGreeter/greeter/app.ts

# Экран блокировки. MY_LOCK_DEV=1 рисует обычное окно поверх сессии (Escape
# закрывает) вместо настоящего ext-session-lock. Пароль проверяет честный PAM.
MY_LOCK_DEV=1 ags run ~/Projects/myGreeter/lock/app.ts
```

Оба используют свои имена инстансов (`my-greeter`, `my-lock`), поэтому работают
одновременно с основным шеллом. Погасить: `ags quit -i my-greeter`.

## Установка экрана входа

```bash
./packaging/install.sh
```

Скрипт раскладывает приложение в `/usr/share/my-greeter/`, создаёт
`/var/cache/my-greeter/` для пользователя `greeter` и ставит минимальный конфиг
Hyprland. Системные файлы и службы он **не трогает** — в конце печатает, что
осталось сделать руками (прописать `/etc/greetd/config.toml`, переключить
`sddm` → `greetd`).

Почему так: greeter работает от пользователя `greeter`, у которого нет домашней
папки. Поэтому в боевом режиме ни один путь не ведёт в `~` — ресурсы лежат в
`/usr/share/my-greeter/`, изменяемое состояние в `/var/cache/my-greeter/`.

## Экран блокировки

```bash
install -m 755 packaging/my-lock ~/.local/bin/my-lock
```

Затем заменить `hyprlock` в `~/.config/hypr/hyprland.lua`:

```lua
hl.exec_cmd("swayidle -w before-sleep 'my-lock'")
```

## Цвета из matugen

Сейчас `colors.scss` содержит doom-one — ту же палитру, что myBar, rofi и
hyprlock. Чтобы цвета шли за обоями, допишите в `~/.config/matugen/config.toml`
блок из `packaging/matugen/config.toml` и запускайте:

```bash
matugen image /путь/к/обоям
```

Шаблон перезапишет `shared/style/colors.scss`, а post-hook скопирует цвета и
сами обои в `/usr/share/my-greeter/`, где их ждёт боевой greeter.

## Известные мелочи

- Дата берётся из локали. Система стоит на `en_US.UTF-8`, поэтому дата
  английская, а подписи русские. Лечится генерацией `ru_RU.UTF-8` в
  `/etc/locale.gen` или сменой подписей.
- Тема GTK `Skeuos-Blue-Dark` рассчитана на GTK3 и при старте сыплет в лог
  `Theme parser error: "shade" is not a valid color name`. На вид не влияет:
  все виджеты используют свои `cssName`, и правила темы до них не достают.
