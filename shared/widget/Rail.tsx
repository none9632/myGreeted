import { Gtk } from "ags/gtk4"
import type { Accessor } from "gnim"

// ── Rail ──────────────────────────────────────────────────────────────────────
// The column at the left edge, identical on both screens: power at the top, the
// keyboard layout chip at the bottom. Everything that is not input lives here, so
// the content column stays pure typography.

export interface RailProps {
  layout: Accessor<string> | string
  onLayoutClicked?: () => void
  onPoweroff?: () => void
  onReboot?: () => void
}

function RailButton(props: { glyph: string; danger?: boolean; onClicked?: () => void }) {
  return (
    <button
      cssName="rail-button"
      class={props.danger ? "danger" : ""}
      halign={Gtk.Align.CENTER}
      onClicked={() => props.onClicked?.()}
    >
      <label cssName="rail-glyph" label={props.glyph} />
    </button>
  )
}

export default function Rail(props: RailProps) {
  return (
    <centerbox cssName="rail" orientation={Gtk.Orientation.VERTICAL}>
      <box $type="start" orientation={Gtk.Orientation.VERTICAL} spacing={8}>
        <RailButton glyph="󰐥" danger onClicked={props.onPoweroff} />
        <RailButton glyph="󰜉" onClicked={props.onReboot} />
      </box>
      <box $type="center" />
      <box $type="end" orientation={Gtk.Orientation.VERTICAL}>
        <button
          cssName="rail-chip"
          halign={Gtk.Align.CENTER}
          onClicked={() => props.onLayoutClicked?.()}
        >
          <label label={props.layout} />
        </button>
      </box>
    </centerbox>
  )
}
