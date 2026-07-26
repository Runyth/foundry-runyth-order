import { MODULE_ID } from "../constants.mjs";

function openHub(activeTab = "overview") {
  return game.modules.get(MODULE_ID)?.api?.openHub({ activeTab });
}

function htmlRoot(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  return null;
}

export function registerLaunchers() {
  game.keybindings.register(MODULE_ID, "openRulesHub", {
    name: "RRC.Keybindings.OpenHub.Name",
    hint: "RRC.Keybindings.OpenHub.Hint",
    editable: [{ key: "KeyR", modifiers: ["Control", "Shift"] }],
    onDown: () => {
      openHub();
      return true;
    },
    restricted: false,
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
  });

  Hooks.on("renderSettings", (_application, html) => {
    const root = htmlRoot(html);
    if (!root || root.querySelector(`.${MODULE_ID}-launcher`)) return;
    const target = root.querySelector(".settings-sidebar") ?? root.querySelector(".directory-list") ?? root;
    const card = document.createElement("section");
    card.className = `${MODULE_ID}-launcher`;
    card.innerHTML = `
      <h3><i class="fa-solid fa-diagram-project"></i> ${game.i18n.localize("RRC.Title")}</h3>
      <p>${game.i18n.localize("RRC.Launcher.Summary")}</p>
      <button type="button" data-action="open-rules-hub">
        <i class="fa-solid fa-arrow-up-right-from-square"></i>
        ${game.i18n.localize("RRC.Launcher.Open")}
      </button>
    `;
    card.querySelector("button")?.addEventListener("click", () => openHub());
    target.prepend(card);
  });

  Hooks.on("getSceneControlButtons", (controls) => {
    const tokenControls = Array.isArray(controls)
      ? controls.find((control) => control.name === "token")
      : controls?.tokens ?? controls?.token;
    if (!tokenControls) return;
    const tool = {
      name: `${MODULE_ID}-hub`,
      title: "RRC.Launcher.Open",
      icon: "fa-solid fa-diagram-project",
      button: true,
      visible: true,
      onClick: () => openHub(),
    };
    if (Array.isArray(tokenControls.tools)) {
      if (!tokenControls.tools.some((candidate) => candidate.name === tool.name)) tokenControls.tools.push(tool);
    } else if (tokenControls.tools && typeof tokenControls.tools === "object") {
      tokenControls.tools[tool.name] ??= tool;
    }
  });
}
