import AstalHyprland from "gi://AstalHyprland"
import { createState, type Accessor } from "gnim"

// ── Раскладка клавиатуры ──────────────────────────────────────────────────────
// И экран входа, и блокировщик работают внутри сессии Hyprland, так что
// состояние берётся прямо у него. Если Hyprland недоступен (другой композитор,
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
  name: string
  main: boolean
  active_keymap: string
}

// Виртуальные клавиатуры (экранные, инструменты ввода текста, удалённый ввод)
// Hyprland называет так и при подключении отбирает у физической флаг main, а
// раскладку отдаёт как "error". Брать их значение нельзя — чип врал бы всё
// время, пока такое устройство подключено.
const VIRTUAL = /^hl-virtual-keyboard/
const NO_KEYMAP = "error"

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

  // Значение из сигнала не берём: keyboard-layout прилетает от любого
  // устройства, а нам нужна раскладка физической клавиатуры. Поэтому на каждое
  // событие перечитываем состояние целиком и сами выбираем нужное устройство.
  function refresh() {
    hypr!.message_async("j/devices", (_source, res) => {
      try {
        const { keyboards } = JSON.parse(hypr!.message_finish(res)) as { keyboards: Device[] }
        const real = keyboards.filter((k) => !VIRTUAL.test(k.name))
        const main = real.find((k) => k.main) ?? real[0]

        if (main && main.active_keymap && main.active_keymap !== NO_KEYMAP) {
          setLayout(short(main.active_keymap))
        }
      } catch (e) {
        console.warn("не прочитать текущую раскладку:", e)
      }
    })
  }

  hypr.connect("keyboard-layout", refresh)
  refresh()

  return {
    layout,
    next: () => hypr.dispatch("switchxkblayout", "all next"),
  }
}
