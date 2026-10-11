import { Gtk } from "ags/gtk4"
import Gdk from "gi://Gdk"
import GdkPixbuf from "gi://GdkPixbuf"
import Gsk from "gi://Gsk"
import Graphene from "gi://Graphene"
import GLib from "gi://GLib"
import { createComputed, createState, onMount, type Accessor } from "gnim"
import Rail, { type RailProps } from "./Rail"

// ── Screen frame ──────────────────────────────────────────────────────────────
// The shared frame for both screens: wallpaper → dimming → rail → content column.
// Only the column's contents differ, and those come from greeter/ or lock/.

// The wallpaper is blurred by us — Hyprland's layer-rule blur works on whatever
// sits BEHIND a surface, and this picture lives inside ours — and it is blurred
// once, before it is ever shown, rather than by CSS on every frame.
//
// `filter: blur()` looks the same and is paid for continuously: GTK renders the
// full-screen picture into an offscreen and blurs it again whenever anything
// above it moves. Measured on this panel (2520x1680 at 10 bpc) that held the
// entrance to 10-25 frames a second — the animation was all there, it simply
// arrived in half a dozen jumps. Blurring once and handing GTK a finished
// picture costs nothing per frame, and the same entrance runs at a steady 60.
//
// Two steps. The file is decoded small, which is most of the blur and is also
// the cheapest way to the first frame — a JPEG decoder scales as it decodes, so
// the full picture is never in memory. Then the real blur, once, on the GPU.
const WALLPAPER_WIDTH = 480
const WALLPAPER_BLUR = 6
// Edge the blur is given to work with and then cropped away: without it the
// blur samples nothing beyond the picture and leaves a soft dark border.
const WALLPAPER_BLEED = 3 * WALLPAPER_BLUR

// Frame interval, in microseconds, at or below which the renderer counts as up
// to speed — a little over one frame of a 60Hz screen. And the point past which
// the entrance starts whether it is or not.
//
// A second is a long deadline for something measured in frames, and it is long
// on purpose: what it has to sit out is the first drawing of the screen, and the
// first one compiles every shader it needs. With a warm shader cache that is
// around 60ms; with a cold one — the login screen's, on the first boot after
// installing — it is a quarter of a second and more. Up to then the screen is
// flat $bg-deep, which at boot is the black the firmware already left there, so
// waiting costs nothing visible, while starting early costs the whole entrance.
const FRAME_SETTLED = 20_000
const ENTRANCE_DEADLINE = 1_000_000

/**
 * The wallpaper, decoded small and blurred once.
 *
 * A wallpaper that cannot be read is not worth failing over: the screen falls
 * back to the flat background underneath. A blur that cannot be rendered is not
 * worth failing over either — the small picture alone is already soft.
 */
function blurredWallpaper(path: string): Gdk.Texture | null {
  let small: Gdk.Texture
  try {
    small = Gdk.Texture.new_for_pixbuf(
      GdkPixbuf.Pixbuf.new_from_file_at_scale(path, WALLPAPER_WIDTH, -1, true),
    )
  } catch (e) {
    console.error(`wallpaper ${path}: ${e}`)
    return null
  }
  return blur(small) ?? small
}

/** Draws a texture through a blur node and reads the result back as a texture. */
function blur(texture: Gdk.Texture): Gdk.Texture | null {
  const renderer = Gsk.GLRenderer.new()
  try {
    renderer.realize_for_display(Gdk.Display.get_default()!)

    const width = texture.get_width()
    const height = texture.get_height()
    const snapshot = new Gtk.Snapshot()
    snapshot.push_blur(WALLPAPER_BLUR)
    snapshot.append_texture(texture, Graphene.Rect.alloc().init(0, 0, width, height))
    snapshot.pop()

    const node = snapshot.to_node()
    if (!node) return null
    // Cropped by the same fraction on every side, so the picture keeps its
    // proportions and is framed exactly as the uncropped one would be.
    const x = WALLPAPER_BLEED
    const y = (WALLPAPER_BLEED * height) / width
    return renderer.render_texture(
      node,
      Graphene.Rect.alloc().init(x, y, width - 2 * x, height - 2 * y),
    )
  } catch (e) {
    console.error(`wallpaper blur: ${e}`)
    return null
  } finally {
    renderer.unrealize()
  }
}

export interface ScreenProps extends RailProps {
  /** Path to the wallpaper; null leaves the flat dark background. */
  wallpaper: string | null
  /**
   * Whether to draw the rail and the column. On secondary monitors the screen
   * stays plain dimmed wallpaper — the controls live on the primary one.
   */
  content?: boolean
  /**
   * The screen is on its way out: everything that arrived leaves again, faster.
   * Whoever sets this is responsible for waiting the exit out before taking the
   * surface away — see the lock screen, which holds the session locked until it
   * has played.
   */
  leaving?: Accessor<boolean>
  children: JSX.Element | JSX.Element[]
}

export default function Screen(props: ScreenProps) {
  const wallpaper = props.wallpaper ? blurredWallpaper(props.wallpaper) : null
  const [shown, setShown] = createState(false)
  let root: Gtk.Overlay

  // The entrance is driven by a class, and the class has to go on at a moment
  // the screen can actually show.
  //
  // A timer cannot find that moment, and neither can the first frame. Frames
  // arrive late and far apart at first — textures uploaded, shaders built, the
  // window not yet on screen — and a transition started on one of them spends
  // its first third on two or three frames, which reads as the screen simply
  // appearing. So wait for the frame clock to settle: the first frame that
  // follows its predecessor inside a frame's time means the renderer is up to
  // speed and everything after it will be smooth.
  //
  // The deadline is there because a screen nobody can see is worse than a jerky
  // one: if the frames never settle, the entrance starts regardless.
  //
  // This is also the only thing standing between the entrance and the shader
  // compilation of the first drawn frame, and it can only do that because the
  // first frame draws the whole screen — see $entry-hidden in
  // shared/style/_tokens.scss, which is why none of it starts at opacity 0.
  // Were the screen invisible until .shown, the expensive frame would be the
  // entrance's own first one and no amount of waiting here would help.
  onMount(() => {
    let first = 0
    let previous = 0
    root.add_tick_callback((_widget, clock) => {
      const now = clock.get_frame_time()
      if (first === 0) first = now
      const settled = previous !== 0 && now - previous <= FRAME_SETTLED
      previous = now

      if (!settled && now - first < ENTRANCE_DEADLINE) return GLib.SOURCE_CONTINUE
      setShown(true)
      return GLib.SOURCE_REMOVE
    })
  })

  // Two classes on the root drive all of it — wallpaper, scrim, rail and every
  // block of the column key off `screen.shown` and `screen.leaving`, so the whole
  // screen moves on one state rather than each piece carrying its own.
  const state = createComputed(() =>
    [shown() ? "shown" : "", props.leaving?.() ? "leaving" : ""].filter(Boolean).join(" "),
  )

  return (
    <overlay
      cssName="screen"
      class={state}
      $={(self) => (root = self as Gtk.Overlay)}
    >
      {wallpaper ? (
        <Gtk.Picture
          class="screen-bg"
          paintable={wallpaper}
          contentFit={Gtk.ContentFit.COVER}
          canShrink
        />
      ) : (
        <box />
      )}
      <box $type="overlay" cssName="screen-scrim" />
      <box $type="overlay" cssName="screen-body">
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
