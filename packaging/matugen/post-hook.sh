#!/usr/bin/env bash
# Разносит свежие цвета и обои туда, откуда их читает боевой greeter.
#
# Вызывается matugen'ом после генерации шаблона, первым аргументом получает путь
# к картинке. Копирует оба ресурса в /usr/share/my-greeter — каталог системный,
# поэтому шаг делается через sudo. Всё остальное matugen делает сам.
#
# Экран блокировки сюда не заглядывает: он работает от живого пользователя и
# читает обои прямо из сессии.

set -euo pipefail

WALLPAPER="${1:-}"
PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COLORS="$PROJECT/shared/style/colors.scss"
TARGET=/usr/share/my-greeter

if [[ ! -d "$TARGET" ]]; then
  echo "post-hook: $TARGET не существует — сначала выполните packaging/install.sh" >&2
  exit 0
fi

# Цвета кладутся в установленное дерево проекта, а не рядом с ним: AGS собирает
# SCSS при каждом запуске и читает именно этот файл.
sudo install -m 0644 "$COLORS" "$TARGET/shared/style/colors.scss"

if [[ -n "$WALLPAPER" && -f "$WALLPAPER" ]]; then
  sudo install -m 0644 "$WALLPAPER" "$TARGET/wallpaper"
fi

echo "post-hook: цвета и обои обновлены в $TARGET"
