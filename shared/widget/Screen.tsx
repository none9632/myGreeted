import { Gtk } from "ags/gtk4"
import Gio from "gi://Gio"
import { createState, onMount, type Accessor } from "gnim"
import { timeout } from "ags/time"
import Rail, { type RailProps } from "./Rail"

// ── Каркас экрана ─────────────────────────────────────────────────────────────
// Общая рама для обоих экранов: обои → затемнение → рельс → колонка контента.
// Различается только содержимое колонки, которое приходит из greeter/ или lock/.

// Задержка перед снятием стартового состояния — примерно один кадр. Сама
// длительность перехода живёт в screen-body (shared/style/_base.scss).
const FRAME_MS = 16

export interface ScreenProps extends RailProps {
  /** Путь к обоям; null — остаётся сплошной тёмный фон. */
  wallpaper: string | null
  /**
   * Рисовать ли рельс и колонку. На дополнительных мониторах экран остаётся
   * просто затемнёнными обоями — управление живёт на основном.
   */
  content?: boolean
  children: JSX.Element | JSX.Element[]
}

export default function Screen(props: ScreenProps) {
  const [shown, setShown] = createState(false)

  // Проявляем на кадр позже карты окна, иначе GTK применит конечное состояние
  // сразу и перехода не будет видно.
  onMount(() => timeout(FRAME_MS, () => setShown(true)))

  return (
    <overlay>
      {props.wallpaper ? (
        <Gtk.Picture
          class="screen-bg"
          file={Gio.File.new_for_path(props.wallpaper)}
          contentFit={Gtk.ContentFit.COVER}
          canShrink
        />
      ) : (
        <box />
      )}
      <box $type="overlay" cssName="screen-scrim" />
      <box
        $type="overlay"
        cssName="screen-body"
        class={shown.as((s) => (s ? "shown" : ""))}
      >
        {props.content === false ? (
          <box />
        ) : (
          <box>
            <Rail
              layout={props.layout}
              onLayoutClicked={props.onLayoutClicked}
              onPoweroff={props.onPoweroff}
              onReboot={props.onReboot}
            />
            <box
              cssName="screen-content"
              orientation={Gtk.Orientation.VERTICAL}
              valign={Gtk.Align.CENTER}
              halign={Gtk.Align.START}
              hexpand
            >
              {props.children}
            </box>
          </box>
        )}
      </box>
    </overlay>
  )
}
