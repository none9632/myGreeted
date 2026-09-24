# my-greeter

Экран входа для [greetd](https://sr.ht/~kennylevinsen/greetd/) и экран блокировки
для Hyprland на [AGS 3](https://github.com/Aylur/ags) + Astal (GTK4).

Оба экрана — одна композиция («рельс»): узкая колонка управления у левого края,
крупная типографика и поле ввода в колонке контента. Стили, виджеты и сервисы
общие, различается только набор блоков.

## Требования

- `aylurs-gtk-shell-git` (AGS 3.x) + `libastal-greetd`, `libastal-auth`
- `gtk4-layer-shell` (даёт и `Gtk4SessionLock`)
- `dart-sass`
- шрифты `inter` и `ttf-iosevka-nerd`

## Структура

```
shared/     общие виджеты, сервисы и стили (в т.ч. colors.scss)
greeter/    экран входа: AstalGreet → greetd
lock/       экран блокировки: AstalAuth → PAM, Gtk4SessionLock
packaging/  шаблон matugen, конфиг Hyprland для greeter-сессии, установка
```

## Запуск в текущей сессии

Оба экрана тестируются обычным `ags run` — ничего системного трогать не нужно.

```bash
ags run ~/Projects/myGreeter/greeter/app.ts          # экран входа, заглушка
MY_LOCK_DEV=1 ags run ~/Projects/myGreeter/lock/app.ts   # блокировка, Escape выходит
```

Без `GREETD_SOCK` экран входа работает на заглушке: верный пароль — `test`,
состояние пишется в `~/.cache/my-greeter/`.
