import { Gtk } from "ags/gtk4"
import { For, type Accessor } from "gnim"
import Monogram from "./Monogram"

// ── User picker ───────────────────────────────────────────────────────────────
// A row of monograms above the password field. With a single user — and on the
// lock screen — the row is not drawn at all; a static name takes its place.

export interface User {
  name: string // login
  label: string // full name from GECOS, or the login
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
