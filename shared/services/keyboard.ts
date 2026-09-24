import AstalHyprland from "gi://AstalHyprland"
import { createState, type Accessor } from "gnim"

// ── Раскладка клавиатуры ──────────────────────────────────────────────────────
// И экран входа, и блокировщик работают внутри сессии Hyprland, так что
// состояние берётся прямо у него: начальное значение — разовый запрос devices,
// дальше сигнал keyboard-layout. Если Hyprland недоступен (другой композитор,
// запуск из TTY), чип замирает на "en" и перестаёт быть кнопкой.
//
// Запрос идёт через IPC самого Astal, а не через `hyprctl … | jq`: у greeter'а
// окружение голое, и лишней зависимости на jq там может не оказаться.

const SHORT: Record<string, string> = {
  "English (US)": "en",
  Russian: "ru",
  "Russian (US, phonetic)": "ru",
}

/** «English (US)» → «en»: без словаря сгодятся первые две буквы языка. */
function short(layout: string): string {
  return SHORT[layout] ?? layout.slice(0, 2).toLowerCase()
}

interface Device {
  main: boolean
  active_keymap: string
}

export interface Keyboard {
  layout: Accessor<string>
  /** Переключить раскладку; undefined, если Hyprland недоступен. */
  next: (() => void) | undefined
}

export function createKeyboard(): Keyboard {
  const [layout, setLayout] = createState("en")

  const hypr = AstalHyprland.get_default()
  if (!hypr) {
    console.warn("Hyprland недоступен — раскладка не отслеживается")
    return { layout, next: undefined }
  }

  hypr.message_async("j/devices", (_source, res) => {
    try {
      const { keyboards } = JSON.parse(hypr.message_finish(res)) as { keyboards: Device[] }
      const main = keyboards.find((k) => k.main) ?? keyboards[0]
      if (main) setLayout(short(main.active_keymap))
    } catch (e) {
      console.warn("не прочитать текущую раскладку:", e)
    }
  })

  hypr.connect("keyboard-layout", (_hypr, _keyboard, name: string) => setLayout(short(name)))

  return {
    layout,
    next: () => hypr.dispatch("switchxkblayout", "all next"),
  }
}
