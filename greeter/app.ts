import app from "ags/gtk4/app"
import style from "./style.scss"
import GreeterWindow from "./widget/GreeterWindow"

// Экран входа. Отдельный бандл и отдельное имя инстанса: блокировщик и мой
// основной шелл (myBar, инстанс "ags") должны уметь работать одновременно.
app.start({
  instanceName: "my-greeter",
  css: style,
  main() {
    const [first, ...rest] = app.get_monitors()
    if (first) GreeterWindow(first, true)
    // На остальных мониторах — только фон: ввод живёт на основном экране.
    rest.forEach((monitor) => GreeterWindow(monitor, false))
  },
})
