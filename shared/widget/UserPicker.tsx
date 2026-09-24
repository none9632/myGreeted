import { Gtk } from "ags/gtk4"
import { For, type Accessor } from "gnim"
import Monogram from "./Monogram"

// ── Выбор пользователя ────────────────────────────────────────────────────────
// Ряд монограмм над полем пароля. Если пользователь один (а также на экране
// блокировки) ряд не рисуется — вместо него статичное имя.

export interface User {
  name: string // логин
  label: string // полное имя из GECOS, либо логин
}

export function UserLabel({ user }: { user: User }) {
  return (
    <box cssName="user-single" halign={Gtk.Align.START}>
      <Monogram name={user.label} />
      <label cssName="user-name" valign={Gtk.Align.CENTER} label={user.label} />
    </box>
  )
}

export default function UserPicker(props: {
  users: Accessor<User[]>
  selected: Accessor<string>
  onSelect: (name: string) => void
}) {
  return (
    <box cssName="user-row" halign={Gtk.Align.START} spacing={6}>
      <For each={props.users}>
        {(user: User) => (
          <button
            cssName="user-chip"
            class={props.selected.as((s) => (s === user.name ? "selected" : ""))}
            onClicked={() => props.onSelect(user.name)}
          >
            <box>
              <Monogram name={user.label} />
              <label cssName="user-name" valign={Gtk.Align.CENTER} label={user.label} />
            </box>
          </button>
        )}
      </For>
    </box>
  )
}
