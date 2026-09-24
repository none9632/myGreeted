import { Gtk } from "ags/gtk4"
import { For, type Accessor } from "gnim"

// ── Выбор сессии ──────────────────────────────────────────────────────────────
// Плоская строка внизу колонки, раскрывающаяся в список. Только на экране входа:
// блокировщик возвращает в уже запущенную сессию.

export interface Session {
  id: string // имя .desktop-файла без расширения
  name: string // Name= из .desktop
  exec: string // Exec=
  desktopNames?: string // DesktopNames= → XDG_CURRENT_DESKTOP
}

export default function SessionPicker(props: {
  sessions: Accessor<Session[]>
  selected: Accessor<Session | null>
  onSelect: (id: string) => void
}) {
  let popover: Gtk.Popover

  // Стрелку рисуем сами (session-arrow); встроенную MenuButton без
  // alwaysShowArrow и не показывает.
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
