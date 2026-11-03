import { Gtk } from "ags/gtk4"
import GObject from "gi://GObject"
import Graphene from "gi://Graphene"
import Gsk from "gi://Gsk"
import Pango from "gi://Pango"

// ── Ink centring ──────────────────────────────────────────────────────────────
// A layout manager for a disc with a single glyph in it: it puts the middle of
// what the glyph actually paints onto the middle of the disc.
//
// Centring the label itself gets this wrong in two ways at once. GTK centres the
// glyph's advance box rather than its ink, and a Nerd Font icon overhangs its
// advance by several pixels on one side. And it lands that box on whole logical
// pixels, rounding down, so whenever the leftover space is odd the glyph sits
// half a pixel left — which at a fractional scale grows into one or two device
// pixels. Together that put every glyph in this UI visibly off its circle, and
// a hand-tuned margin to pull it back held only until GTK changed its rounding.
//
// Here the offset is measured from the Pango layout instead, in fractions of a
// pixel, and applied as a transform, so it holds for any letter, font or scale.
// The container keeps its own size — the disc — and the label inside it is
// given its natural size and only moved.

// A subclass rather than Gtk.CustomLayout: CustomLayout takes its callbacks with
// no user data to hang them on, so gjs cannot keep them alive and the first
// measure crashes the process.
const InkCentre = GObject.registerClass(
  class InkCentre extends Gtk.LayoutManager {
    vfunc_measure(widget: Gtk.Widget, orientation: Gtk.Orientation, forSize: number) {
      const child = widget.get_first_child()
      if (!child) return [0, 0, -1, -1] as [number, number, number, number]
      const [min, nat] = child.measure(orientation, forSize)
      return [min, nat, -1, -1] as [number, number, number, number]
    }

    vfunc_allocate(widget: Gtk.Widget, width: number, height: number) {
      const label = widget.get_first_child()
      if (!(label instanceof Gtk.Label)) return

      const [, w] = label.measure(Gtk.Orientation.HORIZONTAL, -1)
      const [, h] = label.measure(Gtk.Orientation.VERTICAL, w)
      // At its natural size the label draws its layout at its own origin, so the
      // ink rectangle is already in the label's coordinates.
      const [ink] = label.get_layout().get_extents()
      const x = width / 2 - (ink.x + ink.width / 2) / Pango.SCALE
      const y = height / 2 - (ink.y + ink.height / 2) / Pango.SCALE

      label.allocate(w, h, -1, new Gsk.Transform().translate(new Graphene.Point({ x, y })))
    }
  },
)

export function inkCentre(): Gtk.LayoutManager {
  return new InkCentre()
}
