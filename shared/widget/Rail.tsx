import { Gtk } from "ags/gtk4"
import type { Accessor } from "gnim"

// ── Рельс ─────────────────────────────────────────────────────────────────────
// Колонка у левого края, одинаковая на обоих экранах: питание сверху, чип
// раскладки снизу. Всё, что не является вводом, живёт здесь — так колонка
// контента остаётся чистой типографикой.

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
