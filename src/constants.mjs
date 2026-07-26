export const MODULE_ID = "runyth-rules-core";
export const MODULE_TITLE = "Runyth Rules Core";
export const API_VERSION = "1.0.0";
export const DATA_SCHEMA_VERSION = 1;

export const SETTINGS = Object.freeze({
  STATE: "state",
  HUB_POSITION: "hubPosition",
  HUB_TAB: "hubTab",
  ACTOR_AUDIT_PERMISSION: "actorAuditPermission",
  SHOW_ONBOARDING: "showOnboarding",
  ONBOARDING_VERSION: "onboardingVersion",
});

export const HOOKS = Object.freeze({
  API_READY: `${MODULE_ID}.apiReady`,
  READY: `${MODULE_ID}.ready`,
  PROVIDER_REGISTERED: `${MODULE_ID}.providerRegistered`,
  PROVIDER_REJECTED: `${MODULE_ID}.providerRejected`,
  PACK_REGISTERED: `${MODULE_ID}.packRegistered`,
  BEFORE_AUDIT_ACTOR: `${MODULE_ID}.beforeAuditActor`,
  AFTER_AUDIT_ACTOR: `${MODULE_ID}.afterAuditActor`,
  BEFORE_MIGRATION: `${MODULE_ID}.beforeMigration`,
  AFTER_MIGRATION: `${MODULE_ID}.afterMigration`,
});

export const STANDARD_CAPABILITIES = Object.freeze([
  "content.backgrounds",
  "content.classes",
  "content.equipment",
  "content.features",
  "content.feats",
  "content.species",
  "content.spells",
  "content.subclasses",
  "automation.activities",
  "automation.advancement",
  "automation.effects",
  "automation.macros",
  "automation.rests",
  "automation.resources",
  "integration.dnd5e",
  "integration.midi-qol",
  "migration.documents",
  "migration.world",
  "validation.actor",
  "validation.content",
]);

export const CONTENT_KINDS = Object.freeze([
  "background",
  "class",
  "equipment",
  "feature",
  "feat",
  "species",
  "spell",
  "subclass",
  "condition",
  "macro",
  "other",
]);

export const AUDIT_SEVERITIES = Object.freeze(["info", "warning", "error"]);
export const PROVIDER_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
export const LOCAL_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
export const CAPABILITY_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
export const MIGRATION_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
export const DEFAULT_VALIDATOR_TIMEOUT_MS = 10_000;
