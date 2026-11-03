import app from "ags/gtk4/app"
import { Gtk } from "ags/gtk4"
import style from "./style.scss"
import GreeterWindow from "./widget/GreeterWindow"

// The login screen. Its own bundle and its own instance name: the locker and my
// main shell (myBar, instance "ags") have to be able to run at the same time.
app.start({
  instanceName: "my-greeter",
  css: style,
  main() {
    // GTK rings the bell on Backspace in an empty field, and since 4.24 that
    // bell is an actual sound. A login screen has no use for it.
    Gtk.Settings.get_default()!.gtkErrorBell = false

    const [first, ...rest] = app.get_monitors()
    if (first) GreeterWindow(first, true)
    // On the remaining monitors, background only: input lives on the primary one.
    rest.forEach((monitor) => GreeterWindow(monitor, false))
  },
})
