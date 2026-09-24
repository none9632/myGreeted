import AstalHyprland from "gi://AstalHyprland"
import { createState, type Accessor } from "gnim"

// ── Keyboard layout ───────────────────────────────────────────────────────────
// Both the login screen and the locker run inside a Hyprland session, so the
// state comes straight from it. If Hyprland is unavailable (a different
// compositor, a run from a TTY), the chip freezes on "en" and stops being a
// button.
//
// The query goes through Astal's own IPC rather than `hyprctl … | jq`: the
// greeter's environment is bare, and jq may well not be part of it.

const SHORT: Record<string, string> = {
  "English (US)": "en",
  Russian: "ru",
  "Russian (US, phonetic)": "ru",
}

/** "English (US)" → "en": without a dictionary the first two letters will do. */
function short(layout: string): string {
  return SHORT[layout] ?? layout.slice(0, 2).toLowerCase()
}

interface Device {
  name: string
  main: boolean
  active_keymap: string
}

// Virtual keyboards (on-screen ones, text-injection tools, remote input) are
// named like this by Hyprland, and on connecting they take the `main` flag away
// from the physical keyboard while reporting their layout as "error". Their
// value must not be used — the chip would lie for as long as such a device is
// attached.
const VIRTUAL = /^hl-virtual-keyboard/
const NO_KEYMAP = "error"

export interface Keyboard {
  layout: Accessor<string>
  /** Switch the layout; undefined when Hyprland is unavailable. */
  next: (() => void) | undefined
}

export function createKeyboard(): Keyboard {
  const [layout, setLayout] = createState("en")

  const hypr = AstalHyprland.get_default()
  if (!hypr) {
    console.warn("Hyprland unavailable — not tracking the keyboard layout")
    return { layout, next: undefined }
  }

  // We do not take the value out of the signal: keyboard-layout arrives from any
  // device, and what we want is the physical keyboard's layout. So on every event
  // we re-read the whole state and pick the device ourselves.
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
        console.warn("could not read the current layout:", e)
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
