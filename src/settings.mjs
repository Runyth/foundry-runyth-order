// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
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
    name: "RO.Settings.ActorAuditPermission.Name",
    hint: "RO.Settings.ActorAuditPermission.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      owner: "RO.Settings.ActorAuditPermission.Owner",
      gm: "RO.Settings.ActorAuditPermission.GM",
    },
    default: "owner",
  });

  game.settings.register(MODULE_ID, SETTINGS.SHOW_ONBOARDING, {
    name: "RO.Settings.ShowOnboarding.Name",
    hint: "RO.Settings.ShowOnboarding.Hint",
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
    name: "RO.Settings.OpenHub.Name",
    hint: "RO.Settings.OpenHub.Hint",
    label: "RO.Settings.OpenHub.Label",
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
