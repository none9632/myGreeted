import { Gtk } from "ags/gtk4"
import Gio from "gi://Gio"
import { createState, onMount, type Accessor } from "gnim"
import { timeout } from "ags/time"
import Rail, { type RailProps } from "./Rail"

// ── Screen frame ──────────────────────────────────────────────────────────────
// The shared frame for both screens: wallpaper → dimming → rail → content column.
// Only the column's contents differ, and those come from greeter/ or lock/.

// Delay before the starting state is dropped — roughly one frame. The transition
// duration itself lives in screen-body (shared/style/_base.scss).
const FRAME_MS = 16

export interface ScreenProps extends RailProps {
  /** Path to the wallpaper; null leaves the flat dark background. */
  wallpaper: string | null
  /**
   * Whether to draw the rail and the column. On secondary monitors the screen
   * stays plain dimmed wallpaper — the controls live on the primary one.
   */
  content?: boolean
  children: JSX.Element | JSX.Element[]
}

export default function Screen(props: ScreenProps) {
  const [shown, setShown] = createState(false)

  // Fade in a frame after the window maps, otherwise GTK applies the final state
  // straight away and the transition is never seen.
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
