import { Gtk } from "ags/gtk4"
import { For, type Accessor } from "gnim"

// ── Session picker ────────────────────────────────────────────────────────────
// A flat row at the bottom of the column that opens into a list. Login screen
// only: the locker returns you to a session that is already running.

export interface Session {
  id: string // .desktop file name without the extension
  name: string // Name= from the .desktop
  exec: string // Exec=
  desktopNames?: string // DesktopNames= → XDG_CURRENT_DESKTOP
}

export default function SessionPicker(props: {
  sessions: Accessor<Session[]>
  selected: Accessor<Session | null>
  onSelect: (id: string) => void
}) {
  let popover: Gtk.Popover

  // We draw the arrow ourselves (session-arrow); without alwaysShowArrow the
  // MenuButton does not draw one.
  return (
    <menubutton cssName="session-picker" halign={Gtk.Align.START}>
      <box>
        <label cssName="session-glyph" label="󰆍" valign={Gtk.Align.CENTER} />
        <label
          cssName="session-name"
          valign={Gtk.Align.CENTER}
          label={props.selected.as((s) => s?.name ?? "—")}
        />
        <label cssName="session-arrow" label="▾" valign={Gtk.Align.CENTER} />
      </box>
      <popover class="session-list" $={(self) => (popover = self as Gtk.Popover)}>
        <box orientation={Gtk.Orientation.VERTICAL}>
          <For each={props.sessions}>
            {(session: Session) => (
              <button
                cssName="session-item"
                class={props.selected.as((s) => (s?.id === session.id ? "selected" : ""))}
                onClicked={() => {
                  props.onSelect(session.id)
                  popover.popdown()
                }}
              >
                <label halign={Gtk.Align.START} label={session.name} />
              </button>
            )}
          </For>
        </box>
      </popover>
    </menubutton>
  )
}
