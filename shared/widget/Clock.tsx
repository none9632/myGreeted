import GLib from "gi://GLib"
import { Gtk } from "ags/gtk4"
import { createPoll } from "ags/time"

// ── Clock and date ────────────────────────────────────────────────────────────
// The top of the column on both screens. The date format comes from the locale
// (GLib.DateTime honours LC_TIME); in production the locale is set by the greeter
// session config, otherwise Hyprland starts under C and the date comes out plain.

const fmt = (pattern: string) => GLib.DateTime.new_now_local().format(pattern) ?? ""

export default function Clock() {
  const time = createPoll(fmt("%H:%M"), 1000, () => fmt("%H:%M"))
  const date = createPoll(fmt("%A, %-d %B"), 30_000, () => fmt("%A, %-d %B"))

  return (
    <box orientation={Gtk.Orientation.VERTICAL} halign={Gtk.Align.START}>
      <label cssName="clock-time" halign={Gtk.Align.START} label={time} />
      <label cssName="clock-date" halign={Gtk.Align.START} label={date} />
      <box cssName="accent-rule" halign={Gtk.Align.START} />
    </box>
  )
}
