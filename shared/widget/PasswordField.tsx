import { Gtk } from "ags/gtk4"
import { createComputed, createState, onMount, type Accessor } from "gnim"

// ── Поле пароля ───────────────────────────────────────────────────────────────
// Строка с наливающимся подчёркиванием вместо рамки: в покое — тонкая линия, при
// фокусе акцентная полоса растёт слева направо, при ошибке краснеет.
//
// Сам пароль нигде не хранится и не логируется: он читается из виджета в момент
// отправки, уходит в onSubmit и тут же затирается в поле.

export interface PasswordFieldProps {
  /** Идёт проверка: поле блокируется, чтобы не улетел второй запрос. */
  busy: Accessor<boolean>
  /** Текст ошибки; пустая строка прячет строку целиком. */
  error: Accessor<string>
  onSubmit: (password: string) => void
  /** Пользователь начал править ввод — родитель гасит старую ошибку. */
  onInput?: () => void
  placeholder?: string
}

export default function PasswordField(props: PasswordFieldProps) {
  const [focused, setFocused] = createState(false)
  let entry: Gtk.Entry

  // Фокус и ошибка — два независимых источника классов у одной полосы.
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
    // Фокус в поле сразу при старте — вводить пароль можно не трогая мышь.
    entry.grab_focus()

    // И возвращаем его после каждой неудачной попытки: на время проверки поле
    // становится нечувствительным, а вместе с этим теряет фокус.
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
        placeholderText={props.placeholder ?? "Пароль"}
        sensitive={props.busy.as((b) => !b)}
        onNotifyText={() => props.onInput?.()}
        onActivate={submit}
      >
        {/* GtkEntry отдаёт фокус внутреннему GtkText, поэтому его собственное
            has-focus всегда false — состояние приходится слушать контроллером. */}
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
