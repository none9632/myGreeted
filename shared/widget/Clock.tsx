import GLib from "gi://GLib"
import { Gtk } from "ags/gtk4"
import { createPoll } from "ags/time"

// ── Часы и дата ───────────────────────────────────────────────────────────────
// Верх колонки на обоих экранах. Формат даты берётся из локали (GLib.DateTime
// уважает LC_TIME); в продакшне локаль задаётся в конфиге greeter-сессии, иначе
// Hyprland стартует в C и дата выйдет английской.

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
