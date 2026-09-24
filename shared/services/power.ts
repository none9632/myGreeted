import { execAsync } from "ags/process"

// ── Power ─────────────────────────────────────────────────────────────────────
// In debug mode the buttons do nothing: the screen is being tested inside a live
// session, and a stray click must not shut it down.

export function createPower(live: boolean) {
  function run(action: string, cmd: string[]) {
    if (!live) {
      console.log(`[debug] ${action}: ${cmd.join(" ")} — not running it`)
      return
    }
    execAsync(cmd).catch((e) => console.error(`${action} failed:`, e))
  }

  return {
    poweroff: () => run("power off", ["systemctl", "poweroff"]),
    reboot: () => run("reboot", ["systemctl", "reboot"]),
  }
}
