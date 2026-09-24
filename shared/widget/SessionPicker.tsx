import { Gtk } from "ags/gtk4"
import { For, type Accessor } from "gnim"

// ── Выбор сессии ──────────────────────────────────────────────────────────────
// Плоская строка внизу колонки, раскрывающаяся в список. Только на экране входа:
// блокировщик возвращает в уже запущенную сессию.

export interface Session {
  id: string // имя .desktop-файла без расширения
  name: string // Name= из .desktop
  exec: string // Exec=
}

export default function SessionPicker(props: {
  sessions: Accessor<Session[]>
  selected: Accessor<Session | null>
  onSelect: (id: string) => void
}) {
  let popover: Gtk.Popover

  return (
    <menubutton
      cssName="session-picker"
      halign={Gtk.Align.START}
      $={(self) => {
        // Стрелку рисуем сами (session-arrow), встроенную убираем.
        self.alwaysShowArrow = false
      }}
    >
      <box>
        <label cssName="session-glyph" label="󰆍" valign={Gtk.Align.CENTER} />
        <label
          cssName="session-name"
          valign={Gtk.Align.CENTER}
          label={props.selected.as((s) => s?.name ?? "—")}
        />
        <label cssName="session-arrow" label="▾" valign={Gtk.Align.CENTER} />
      </box>
      <popover class="session-list" $={(self) => (popover = self)}>
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
