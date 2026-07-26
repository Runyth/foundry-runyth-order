import { RunythRulesApi } from "./api.mjs";
import { HOOKS, MODULE_ID, MODULE_TITLE, SETTINGS } from "./constants.mjs";
import { ActorAuditService } from "./core/audit-service.mjs";
import { DiagnosticsService } from "./core/diagnostics-service.mjs";
import { createLogger } from "./core/logger.mjs";
import { MigrationService } from "./core/migration-service.mjs";
import { ProviderRegistry } from "./core/registry.mjs";
import { registerSettings } from "./settings.mjs";
import { registerLaunchers } from "./ui/launchers.mjs";
import { RulesHub } from "./ui/rules-hub.mjs";

const logger = createLogger();
let api;
let hub;

function getModule(id) {
  return game.modules.get(id) ?? null;
}

function getSystem() {
  return {
    id: game.system.id,
    title: game.system.title,
    version: game.system.version,
  };
}

function openHub(options = {}) {
  const stored = game.settings.get(MODULE_ID, SETTINGS.HUB_POSITION) ?? {};
  if (!hub) {
    hub = new RulesHub({
      ...options,
      position: { ...stored, ...(options.position ?? {}) },
    });
  }
  if (options.activeTab) hub.activeTab = options.activeTab;
  hub.render({ force: true });
  return hub;
}

Hooks.once("init", () => {
  try {
    registerSettings({ RulesHub });
    registerLaunchers();

    const registry = new ProviderRegistry({ getModule });
    const migrationService = new MigrationService({
      registry,
      readState: () => game.settings.get(MODULE_ID, SETTINGS.STATE),
      writeState: (state) => game.settings.set(MODULE_ID, SETTINGS.STATE, state),
      hooks: Hooks,
      logger,
    });
    const auditService = new ActorAuditService({
      registry,
      resolveUuid: (uuid) => globalThis.fromUuid(uuid),
      hooks: Hooks,
      logger,
    });
    const diagnosticsService = new DiagnosticsService({
      registry,
      migrationService,
      getModule,
      getPack: (id) => game.packs.get(id) ?? null,
      getSystem,
      getCoreVersion: () => game.version,
    });

    api = new RunythRulesApi({
      registry,
      auditService,
      diagnosticsService,
      migrationService,
      hooks: Hooks,
      logger,
    });
    api.setHubOpener(openHub);

    const module = game.modules.get(MODULE_ID);
    if (!module) throw new Error(`Module record ${MODULE_ID} is unavailable during init.`);
    module.api = api;
    Hooks.callAll(HOOKS.API_READY, api);
    logger.info(`API ${api.apiVersion} initialized.`);
  } catch (error) {
    console.error(`${MODULE_TITLE} | Initialization failed`, error);
    ui.notifications?.error?.(`${MODULE_TITLE}: ${error.message}`, { permanent: true });
  }
});

Hooks.once("ready", async () => {
  if (!api) return;
  api.markReady();

  const showOnboarding = game.settings.get(MODULE_ID, SETTINGS.SHOW_ONBOARDING);
  const seenVersion = game.settings.get(MODULE_ID, SETTINGS.ONBOARDING_VERSION);
  const version = game.modules.get(MODULE_ID)?.version ?? "0.0.0";
  if (game.user?.isGM && showOnboarding && seenVersion !== version) {
    ui.notifications?.info?.(game.i18n.localize("RRC.Notifications.Onboarding"), {
      permanent: true,
      console: false,
    });
    await game.settings.set(MODULE_ID, SETTINGS.ONBOARDING_VERSION, version);
  }

  logger.info(`Ready with ${api.listProviders().length} registered provider(s).`);
});
