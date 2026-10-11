// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import { MODULE_ID, MODULE_TITLE } from "./m01.mjs";

function openHub(activeTab = "overview") {
  const promise = game.modules.get(MODULE_ID)?.api?.openHub({ activeTab });
  promise?.catch?.((error) => {
    console.error(`${MODULE_TITLE} | Could not open Rules Hub`, error);
    ui.notifications?.error?.(
      game.i18n.format("RO.Notifications.OperationFailed", { message: error.message }),
    );
  });
  return promise;
}

function htmlRoot(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  return null;
}

function settingsLauncherTarget(root) {
  if (root.matches?.(".settings-sidebar, .directory-list")) return root;
  return root.querySelector(".settings-sidebar, .directory-list");
}

export function createSceneControlTool(tools) {
  const orders = Object.values(tools ?? {})
    .map((tool) => Number(tool?.order))
    .filter(Number.isFinite);
  const order = orders.length ? Math.max(...orders) + 1 : Object.keys(tools ?? {}).length;

  return {
    name: `${MODULE_ID}-hub`,
    title: "RO.Launcher.Open",
    icon: "fa-solid fa-diagram-project",
    order,
    button: true,
    visible: true,
    onChange: () => {
      void openHub();
    },
  };
}

// Installed language providers contribute localized strings, so launcher text is
// always inserted as text nodes: markup comes from string literals only and no
// localized value is ever parsed as HTML.
export function buildLauncherCard(document, localized) {
  const card = document.createElement("section");
  card.className = `${MODULE_ID}-launcher`;
  const heading = document.createElement("h3");
  const headingIcon = document.createElement("i");
  headingIcon.className = "fa-solid fa-diagram-project";
  heading.append(headingIcon, document.createTextNode(localized.title));
  const summary = document.createElement("p");
  summary.textContent = localized.summary;
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = "open-rules-hub";
  const buttonIcon = document.createElement("i");
  buttonIcon.className = "fa-solid fa-arrow-up-right-from-square";
  const label = document.createElement("span");
  label.textContent = localized.label;
  button.append(buttonIcon, label);
  card.append(heading, summary, button);
  return card;
}

export function registerLaunchers() {
  game.keybindings.register(MODULE_ID, "openRulesHub", {
    name: "RO.Keybindings.OpenHub.Name",
    hint: "RO.Keybindings.OpenHub.Hint",
    editable: [{ key: "KeyR", modifiers: ["Control", "Shift"] }],
    onDown: () => {
      void openHub();
      return true;
    },
    restricted: false,
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
  });

  Hooks.on("renderSettings", (_application, html) => {
    const root = htmlRoot(html);
    if (!root || root.querySelector(`.${MODULE_ID}-launcher`)) return;
    const target = settingsLauncherTarget(root);
    if (!target) return;

    const card = buildLauncherCard(document, {
      title: game.i18n.localize("RO.Title"),
      summary: game.i18n.localize("RO.Launcher.Summary"),
      label: game.i18n.localize("RO.Launcher.Open"),
    });
    card.querySelector("button")?.addEventListener("click", () => void openHub());
    target.prepend(card);
  });

  Hooks.on("getSceneControlButtons", (controls) => {
    const tokenControls = controls?.tokens;
    if (!tokenControls?.tools || typeof tokenControls.tools !== "object") return;
    const toolName = `${MODULE_ID}-hub`;
    tokenControls.tools[toolName] ??= createSceneControlTool(tokenControls.tools);
  });
}
