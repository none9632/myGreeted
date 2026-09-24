import { Gtk } from "ags/gtk4"
import { createComputed, createState, onMount, type Accessor } from "gnim"

// ── Password field ────────────────────────────────────────────────────────────
// A line with a filling underline instead of a box: at rest a thin rule, on focus
// an accent bar grows left to right, on failure it turns red.
//
// The password itself is never stored or logged: it is read out of the widget at
// submit time, handed to onSubmit and immediately wiped from the field.

export interface PasswordFieldProps {
  /** A check is in flight: the field locks so a second request cannot escape. */
  busy: Accessor<boolean>
  /** Error text; an empty string hides the line entirely. */
  error: Accessor<string>
  onSubmit: (password: string) => void
  /** The user started editing — the parent clears the stale error. */
  onInput?: () => void
  placeholder?: string
}

export default function PasswordField(props: PasswordFieldProps) {
  const [focused, setFocused] = createState(false)
  let entry: Gtk.Entry

  // Focus and error are two independent sources of classes on the same bar.
  const fill = createComputed(() =>
    [focused() ? "focused" : "", props.error() ? "error" : ""].filter(Boolean).join(" "),
  )

  function submit() {
    if (props.busy.get()) return
    const password = entry.get_text()
    entry.set_text("")
    props.onSubmit(password)
  }

  onMount(() => {
    // Focus lands in the field at startup — no need to reach for the mouse.
    entry.grab_focus()

    // And it comes back after every failed attempt: while a check runs the field
    // goes insensitive, and loses focus along with it.
    props.busy.subscribe(() => {
      if (!props.busy.get()) entry.grab_focus()
    })
  })

  return (
    <box
      cssName="password-row"
      orientation={Gtk.Orientation.VERTICAL}
      halign={Gtk.Align.START}
      class={props.busy.as((b) => (b ? "busy" : ""))}
    >
      <entry
        cssName="password-entry"
        $={(self) => (entry = self as Gtk.Entry)}
        visibility={false}
        hexpand
        placeholderText={props.placeholder ?? "Password"}
        sensitive={props.busy.as((b) => !b)}
        onNotifyText={() => props.onInput?.()}
        onActivate={submit}
      >
        {/* GtkEntry hands focus to an inner GtkText, so its own has-focus is
            always false — the state has to come from a controller. */}
        <Gtk.EventControllerFocus
          onEnter={() => setFocused(true)}
          onLeave={() => setFocused(false)}
        />
      </entry>
      <box cssName="password-rule" halign={Gtk.Align.START}>
        <box cssName="password-rule-fill" halign={Gtk.Align.START} class={fill} />
      </box>
      <label
        cssName="auth-error"
        halign={Gtk.Align.START}
        label={props.error}
        class={props.error.as((e) => (e ? "shown" : ""))}
      />
    </box>
  )
}
