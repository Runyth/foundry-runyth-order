import { DATA_SCHEMA_VERSION, MODULE_ID, SETTINGS } from "./constants.mjs";

export function registerSettings({ RulesHub }) {
  game.settings.register(MODULE_ID, SETTINGS.STATE, {
    scope: "world",
    config: false,
    type: Object,
    default: {
      schemaVersion: DATA_SCHEMA_VERSION,
      completedMigrations: {},
    },
  });

  game.settings.register(MODULE_ID, SETTINGS.HUB_POSITION, {
    scope: "client",
    config: false,
    type: Object,
    default: {},
  });

  game.settings.register(MODULE_ID, SETTINGS.HUB_TAB, {
    scope: "client",
    config: false,
    type: String,
    default: "overview",
  });

  game.settings.register(MODULE_ID, SETTINGS.ACTOR_AUDIT_PERMISSION, {
    name: "RRC.Settings.ActorAuditPermission.Name",
    hint: "RRC.Settings.ActorAuditPermission.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      owner: "RRC.Settings.ActorAuditPermission.Owner",
      gm: "RRC.Settings.ActorAuditPermission.GM",
    },
    default: "owner",
  });

  game.settings.register(MODULE_ID, SETTINGS.SHOW_ONBOARDING, {
    name: "RRC.Settings.ShowOnboarding.Name",
    hint: "RRC.Settings.ShowOnboarding.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, SETTINGS.ONBOARDING_VERSION, {
    scope: "world",
    config: false,
    type: String,
    default: "",
  });

  game.settings.registerMenu(MODULE_ID, "openRulesHub", {
    name: "RRC.Settings.OpenHub.Name",
    hint: "RRC.Settings.OpenHub.Hint",
    label: "RRC.Settings.OpenHub.Label",
    icon: "fa-solid fa-diagram-project",
    type: RulesHub,
    restricted: true,
  });
}

export function mayAuditActor(actor) {
  if (!actor || !game.user) return false;
  if (game.user.isGM) return true;
  const permission = game.settings.get(MODULE_ID, SETTINGS.ACTOR_AUDIT_PERMISSION);
  return permission === "owner" && actor.isOwner;
}
