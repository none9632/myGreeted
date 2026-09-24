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
  // Set while we empty the field ourselves, so that programmatic change is not
  // mistaken for the user typing — which would wipe the error we are about to
  // show.
  let clearing = false

  // Focus and error are two independent sources of classes on the same bar.
  const fill = createComputed(() =>
    [focused() ? "focused" : "", props.error() ? "error" : ""].filter(Boolean).join(" "),
  )

  function submit() {
    if (props.busy.get()) return
    // The dots stay in place for the duration of the check — they only dim. The
    // field is emptied once the answer is in, so that on failure the dots go and
    // the message arrives in the same frame instead of leaving a blank pause.
    props.onSubmit(entry.get_text())
  }

  onMount(() => {
    // Focus lands in the field at startup — no need to reach for the mouse.
    entry.grab_focus()

    props.busy.subscribe(() => {
      if (props.busy.get()) return

      // The check is over. The parent has already set the error by now (catch
      // runs before finally), so emptying the field here puts the cleared dots
      // and the message on screen together.
      clearing = true
      entry.set_text("")
      clearing = false

      // Focus also has to be taken back: the field goes insensitive while the
      // check runs and loses it along the way.
      entry.grab_focus()
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
        onNotifyText={() => {
          if (!clearing) props.onInput?.()
        }}
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
