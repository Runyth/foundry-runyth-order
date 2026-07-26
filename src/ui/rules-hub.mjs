import { MODULE_ID, MODULE_TITLE, SETTINGS, STANDARD_CAPABILITIES } from "../constants.mjs";
import { mayAuditActor } from "../settings.mjs";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

function selectedActor() {
  const controlled = canvas?.tokens?.controlled ?? [];
  if (controlled.length === 1) return controlled[0].actor ?? null;
  return game.user?.character ?? null;
}

function severityClass(severity) {
  if (severity === "error") return "danger";
  if (severity === "warning") return "warning";
  return "info";
}

function notification(method, message) {
  ui.notifications?.[method]?.(message);
}

export class RulesHub extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-hub`,
    tag: "section",
    classes: [MODULE_ID, "runyth-rules-hub"],
    window: {
      title: MODULE_TITLE,
      icon: "fa-solid fa-diagram-project",
      resizable: true,
    },
    position: {
      width: 920,
      height: 720,
    },
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/rules-hub.hbs`,
    },
  };

  constructor(options = {}) {
    super(options);
    this.api = game.modules.get(MODULE_ID)?.api ?? null;
    this.activeTab = options.activeTab ?? game.settings.get(MODULE_ID, SETTINGS.HUB_TAB) ?? "overview";
    this.auditReport = null;
    this.diagnosticsReport = null;
    this.busy = false;
    this.positionSaveTimer = null;
  }

  async _prepareContext() {
    const snapshot = this.api?.snapshot?.() ?? {
      providers: [],
      packs: [],
      validators: [],
      migrations: [],
    };
    const actor = selectedActor();
    const pendingMigrations = this.api ? await this.api.listPendingMigrations() : [];
    const providerRows = snapshot.providers.map((provider) => ({
      ...provider,
      systemSummary: provider.systems.length
        ? provider.systems.map((system) => `${system.id} ${system.minimum ?? "*"}–${system.maximum ?? "*"}`).join(", ")
        : game.i18n.localize("RRC.Hub.SystemNeutral"),
      capabilitySummary: provider.capabilities.join(", ") || "—",
      packCount: provider.packIds.length,
      validatorCount: provider.validatorIds.length,
      migrationCount: provider.migrationIds.length,
    }));
    const packRows = snapshot.packs.map((pack) => ({
      ...pack,
      kindSummary: pack.contentKinds.join(", ") || "—",
      compendiumSummary: pack.compendia.join(", ") || "—",
      entryCount: pack.entries.length,
    }));

    return {
      moduleId: MODULE_ID,
      apiVersion: this.api?.apiVersion ?? "—",
      dataSchemaVersion: this.api?.dataSchemaVersion ?? "—",
      activeTab: this.activeTab,
      tabs: {
        overview: this.activeTab === "overview",
        providers: this.activeTab === "providers",
        packs: this.activeTab === "packs",
        audit: this.activeTab === "audit",
        diagnostics: this.activeTab === "diagnostics",
      },
      isGM: game.user?.isGM ?? false,
      busy: this.busy,
      providerRows,
      packRows,
      capabilities: STANDARD_CAPABILITIES.map((id) => ({
        id,
        available: this.api?.hasCapability?.(id) ?? false,
      })),
      providerCount: providerRows.length,
      packCount: packRows.length,
      validatorCount: snapshot.validators.length,
      migrationCount: snapshot.migrations.length,
      pendingMigrationCount: pendingMigrations.length,
      pendingMigrations,
      actor: actor
        ? {
            id: actor.id,
            uuid: actor.uuid,
            name: actor.name,
            img: actor.img,
            mayAudit: mayAuditActor(actor),
          }
        : null,
      auditReport: this.auditReport
        ? {
            ...this.auditReport,
            issues: this.auditReport.issues.map((issue) => ({
              ...issue,
              cssClass: severityClass(issue.severity),
            })),
          }
        : null,
      diagnosticsReport: this.diagnosticsReport
        ? {
            ...this.diagnosticsReport,
            findings: this.diagnosticsReport.findings.map((finding) => ({
              ...finding,
              cssClass: severityClass(finding.severity),
            })),
          }
        : null,
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;
    if (!root) return;

    for (const tab of root.querySelectorAll("[data-tab]")) {
      tab.addEventListener("click", async (event) => {
        event.preventDefault();
        this.activeTab = event.currentTarget.dataset.tab;
        await game.settings.set(MODULE_ID, SETTINGS.HUB_TAB, this.activeTab);
        await this.render({ force: true });
      });
    }

    root.querySelector('[data-action="refresh"]')?.addEventListener("click", () =>
      this.render({ force: true }),
    );
    root.querySelector('[data-action="audit"]')?.addEventListener("click", () => this.#runAudit());
    root
      .querySelector('[data-action="diagnostics"]')
      ?.addEventListener("click", (event) => this.#runDiagnostics(event.currentTarget.dataset.deep === "true"));
    root
      .querySelector('[data-action="copy-diagnostics"]')
      ?.addEventListener("click", () => this.#copyDiagnostics());
    root
      .querySelector('[data-action="run-migrations"]')
      ?.addEventListener("click", () => this.#runMigrations());
    root.querySelector('[data-action="reset-position"]')?.addEventListener("click", () => {
      game.settings.set(MODULE_ID, SETTINGS.HUB_POSITION, {});
      this.setPosition({
        left: Math.max(0, Math.round((window.innerWidth - 920) / 2)),
        top: Math.max(0, Math.round((window.innerHeight - 720) / 2)),
        width: 920,
        height: 720,
      });
    });
  }

  _onPosition(position) {
    super._onPosition(position);
    if (!this.rendered) return;
    clearTimeout(this.positionSaveTimer);
    this.positionSaveTimer = setTimeout(() => {
      game.settings.set(MODULE_ID, SETTINGS.HUB_POSITION, {
        left: position.left,
        top: position.top,
        width: position.width,
        height: position.height,
      });
    }, 200);
  }

  async #runAudit() {
    const actor = selectedActor();
    if (!actor) {
      notification("warn", game.i18n.localize("RRC.Notifications.SelectActor"));
      return;
    }
    if (!mayAuditActor(actor)) {
      notification("error", game.i18n.localize("RRC.Notifications.AuditDenied"));
      return;
    }

    this.busy = true;
    await this.render({ force: true });
    try {
      this.auditReport = await this.api.auditActor(actor);
      this.activeTab = "audit";
    } catch (error) {
      console.error(`${MODULE_TITLE} | Actor audit failed`, error);
      notification("error", game.i18n.format("RRC.Notifications.OperationFailed", { message: error.message }));
    } finally {
      this.busy = false;
      await this.render({ force: true });
    }
  }

  async #runDiagnostics(deep) {
    this.busy = true;
    await this.render({ force: true });
    try {
      this.diagnosticsReport = await this.api.runDiagnostics({ deep });
      this.activeTab = "diagnostics";
    } catch (error) {
      console.error(`${MODULE_TITLE} | Diagnostics failed`, error);
      notification("error", game.i18n.format("RRC.Notifications.OperationFailed", { message: error.message }));
    } finally {
      this.busy = false;
      await this.render({ force: true });
    }
  }

  async #copyDiagnostics() {
    if (!this.diagnosticsReport) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(this.diagnosticsReport, null, 2));
      notification("info", game.i18n.localize("RRC.Notifications.DiagnosticsCopied"));
    } catch (error) {
      notification("error", game.i18n.format("RRC.Notifications.OperationFailed", { message: error.message }));
    }
  }

  async #runMigrations() {
    if (!game.user?.isGM) return;
    const pending = await this.api.listPendingMigrations();
    if (!pending.length) {
      notification("info", game.i18n.localize("RRC.Notifications.NoMigrations"));
      return;
    }

    const confirmed = await DialogV2.confirm({
      window: { title: game.i18n.localize("RRC.Migrations.ConfirmTitle") },
      content: `<p>${game.i18n.localize("RRC.Migrations.ConfirmBody")}</p><p><strong>${game.i18n.localize("RRC.Migrations.BackupWarning")}</strong></p>`,
      modal: true,
      rejectClose: false,
    });
    if (!confirmed) return;

    this.busy = true;
    await this.render({ force: true });
    try {
      await this.api.runPendingMigrations();
      this.diagnosticsReport = await this.api.runDiagnostics();
      notification("info", game.i18n.localize("RRC.Notifications.MigrationsComplete"));
    } catch (error) {
      console.error(`${MODULE_TITLE} | Migration failed`, error);
      notification("error", game.i18n.format("RRC.Notifications.OperationFailed", { message: error.message }));
    } finally {
      this.busy = false;
      await this.render({ force: true });
    }
  }
}
