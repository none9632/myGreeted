import { execAsync } from "ags/process"

// ── Питание ───────────────────────────────────────────────────────────────────
// В отладочном режиме кнопки ничего не делают: экран тестируется в живой сессии,
// и случайное нажатие не должно её выключить.

export function createPower(live: boolean) {
  function run(action: string, cmd: string[]) {
    if (!live) {
      console.log(`[отладка] ${action}: ${cmd.join(" ")} — не выполняю`)
      return
    }
    execAsync(cmd).catch((e) => console.error(`${action} не удалось:`, e))
  }

  return {
    poweroff: () => run("выключение", ["systemctl", "poweroff"]),
    reboot: () => run("перезагрузка", ["systemctl", "reboot"]),
  }
}
