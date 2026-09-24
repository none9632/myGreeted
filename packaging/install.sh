#!/usr/bin/env bash
# ── Установка my-greeter ──────────────────────────────────────────────────────
# Раскладывает экран входа туда, откуда его может прочитать пользователь
# `greeter` (у него нет домашней папки, так что ~ отпадает):
#
#   /usr/share/my-greeter/   — само приложение, цвета и обои
#   /var/cache/my-greeter/   — последний выбранный пользователь и сессия
#   /usr/share/my-greeter/hyprland.conf — минимальный композитор для входа
#
# Скрипт НЕ трогает /etc/greetd/config.toml и не включает никаких служб: в
# конце он печатает, что осталось сделать руками.
#
# Экран блокировки здесь не участвует — он работает от живого пользователя
# прямо из рабочей копии.

set -euo pipefail

PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET=/usr/share/my-greeter
CACHE=/var/cache/my-greeter
GREETER_USER=greeter

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Нужны права root, перезапускаюсь через sudo…"
  exec sudo -E "$0" "$@"
fi

if ! id "$GREETER_USER" >/dev/null 2>&1; then
  echo "error: пользователя $GREETER_USER нет — установите greetd" >&2
  exit 1
fi

for dep in ags sass Hyprland; do
  command -v "$dep" >/dev/null 2>&1 || {
    echo "error: не найден $dep" >&2
    exit 1
  }
done

echo "→ ставлю приложение в $TARGET"
install -d -m 0755 "$TARGET"
for dir in shared greeter; do
  rm -rf "${TARGET:?}/$dir"
  cp -r "$PROJECT/$dir" "$TARGET/$dir"
done
install -m 0644 "$PROJECT/package.json" "$PROJECT/tsconfig.json" "$PROJECT/env.d.ts" "$TARGET/"

# AGS резолвит импорты "ags" и "gnim" через node_modules; в системном дереве
# держим их симлинками на библиотеку из пакета, а не копией.
install -d -m 0755 "$TARGET/node_modules"
ln -sfn /usr/share/ags/js "$TARGET/node_modules/ags"
ln -sfn /usr/share/ags/js/node_modules/gnim "$TARGET/node_modules/gnim"

echo "→ ставлю конфиг Hyprland для экрана входа"
install -m 0644 "$PROJECT/packaging/hypr/greeter.conf" "$TARGET/hyprland.conf"

echo "→ готовлю $CACHE для пользователя $GREETER_USER"
install -d -m 0755 -o "$GREETER_USER" -g "$GREETER_USER" "$CACHE"

# Обои: если matugen ещё не запускали, берём текущие обои того, кто ставит.
if [[ ! -e "$TARGET/wallpaper" ]]; then
  REAL_USER="${SUDO_USER:-}"
  if [[ -n "$REAL_USER" ]]; then
    REAL_HOME="$(getent passwd "$REAL_USER" | cut -d: -f6)"
    STATE="$REAL_HOME/.cache/current_wallpaper.txt"
    if [[ -f "$STATE" ]]; then
      WALL="$(cat "$STATE")"
      [[ -f "$WALL" ]] && install -m 0644 "$WALL" "$TARGET/wallpaper" &&
        echo "→ обои взяты из текущей сессии: $WALL"
    fi
  fi
fi

chmod -R a+rX "$TARGET"

cat <<'NEXT'

Готово. Дальше — вручную, установщик системные файлы не трогает:

  1. Прописать greeter в greetd — /etc/greetd/config.toml:

       [terminal]
       vt = 1

       [default_session]
       command = "Hyprland -c /usr/share/my-greeter/hyprland.conf"
       user = "greeter"

     (образец лежит в packaging/greetd-config.toml)

  2. Переключить менеджер входа:

       sudo systemctl disable sddm
       sudo systemctl enable greetd

     Переключение вступит в силу после перезагрузки. Проверить экран, ничего
     не выключая, можно и раньше — прямо в текущей сессии:

       ags run ~/Projects/myGreeter/greeter/app.ts

  3. Чтобы цвета и обои экрана входа шли за matugen, дописать в
     ~/.config/matugen/config.toml блок из packaging/matugen/config.toml.

NEXT
