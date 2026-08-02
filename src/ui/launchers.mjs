import { MODULE_ID, MODULE_TITLE } from "../constants.mjs";

function openHub(activeTab = "overview") {
  const promise = game.modules.get(MODULE_ID)?.api?.openHub({ activeTab });
  promise?.catch?.((error) => {
    console.error(`${MODULE_TITLE} | Could not open Rules Hub`, error);
    ui.notifications?.error?.(
      game.i18n.format("RRC.Notifications.OperationFailed", { message: error.message }),
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
    title: "RRC.Launcher.Open",
    icon: "fa-solid fa-diagram-project",
    order,
    button: true,
    visible: true,
    onChange: () => {
      void openHub();
    },
  };
}

export function registerLaunchers() {
  game.keybindings.register(MODULE_ID, "openRulesHub", {
    name: "RRC.Keybindings.OpenHub.Name",
    hint: "RRC.Keybindings.OpenHub.Hint",
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

    const card = document.createElement("section");
    card.className = `${MODULE_ID}-launcher`;
    card.innerHTML = `
      <h3><i class="fa-solid fa-diagram-project"></i> ${game.i18n.localize("RRC.Title")}</h3>
      <p>${game.i18n.localize("RRC.Launcher.Summary")}</p>
      <button type="button" data-action="open-rules-hub">
        <i class="fa-solid fa-arrow-up-right-from-square"></i>
        <span>${game.i18n.localize("RRC.Launcher.Open")}</span>
      </button>
    `;
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
