const MODULE_ID = "runyth-order";
const MODULE_TITLE = "Runyth Order";
let reported = false;

try {
  await import("./m09.mjs");
} catch (error) {
  if (!reported) {
    reported = true;
    console.error(`Runyth Order | Fatal runtime initialization failure`, error);
    try {
      const module = globalThis.game?.modules?.get?.(MODULE_ID);
      if (module) module.api = undefined;
    } catch {
      // Do not mask the original runtime loading failure.
    }
    try {
      globalThis.Hooks?.once?.("ready", () => {
        globalThis.ui?.notifications?.error?.(`Runyth Order: required runtime resources failed to load. Reinstall the module and reload the world.`, { permanent: true });
      });
    } catch {
      // Console reporting above is always available.
    }
  }
}
