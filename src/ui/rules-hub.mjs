// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import { MODULE_ID, MODULE_TITLE, SETTINGS, STANDARD_CAPABILITIES } from "../constants.mjs";
import { mayAuditActor } from "../settings.mjs";
import { HUB_POSITION_DEFAULTS, sanitizeHubPosition } from "./window-position.mjs";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

function actorSelection() {
  const controlled = canvas?.tokens?.controlled ?? [];
  const actors = [
    ...new Map(
      controlled
        .map((token) => token.actor)
        .filter(Boolean)
        .map((actor) => [actor.uuid, actor]),
    ).values(),
  ];
  if (actors.length === 1) return { actor: actors[0], reason: null };
  if (actors.length > 1) return { actor: null, reason: "multiple" };
  return { actor: game.user?.character ?? null, reason: null };
}

function severityClass(severity) {
  if (severity === "error") return "danger";
  if (severity === "warning") return "warning";
  return "info";
}

function notification(method, message) {
  ui.notifications?.[method]?.(message);
}

function localizeFinding(finding) {
  if (!finding?.messageKey) return finding;
  return {
    ...finding,
    message: game.i18n.format(finding.messageKey, finding.data ?? {}),
  };
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
    position: HUB_POSITION_DEFAULTS,
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/rules-hub.hbs`,
    },
  };

  constructor(options = {}) {
    const stored = game.settings.get(MODULE_ID, SETTINGS.HUB_POSITION) ?? {};
    const position = sanitizeHubPosition({ ...stored, ...(options.position ?? {}) });
    super({ ...options, position });
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
      namingFindings: [],
    };
    const selection = actorSelection();
    const actor = selection.actor;
    const pendingMigrations = this.api ? await this.api.listPendingMigrations() : [];
    const providerRows = snapshot.providers.map((provider) => {
      const namingFindings = snapshot.namingFindings
        .filter((finding) => finding.providerId === provider.id)
        .map((finding) => ({
          ...localizeFinding(finding),
          cssClass: severityClass(finding.severity),
        }));
      return {
      ...provider,
      namingFindings,
      namingWarningCount: namingFindings.filter((finding) => finding.severity === "warning").length,
      systemSummary: provider.systems.length
        ? provider.systems.map((system) => `${system.id} ${system.minimum ?? "*"}–${system.maximum ?? "*"}`).join(", ")
        : game.i18n.localize("RO.Hub.SystemNeutral"),
      capabilitySummary: provider.capabilities.join(", ") || "—",
      packCount: provider.packIds.length,
      validatorCount: provider.validatorIds.length,
      migrationCount: provider.migrationIds.length,
    };
    });
    const packRows = snapshot.packs.map((pack) => ({
      ...pack,
      kindSummary: pack.contentKinds.join(", ") || "—",
      compendiumSummary: pack.compendia.join(", ") || "—",
      entryCount: pack.entries.length,
    }));
    const visibleAuditReport =
      !this.auditReport || !actor || this.auditReport.actor.uuid === actor.uuid
        ? this.auditReport
        : null;

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
      actorSelectionMessage:
        selection.reason === "multiple"
          ? game.i18n.localize("RO.Audit.MultipleActors")
          : game.i18n.localize("RO.Audit.NoActor"),
      actor: actor
        ? {
            id: actor.id,
            uuid: actor.uuid,
            name: actor.name,
            img: actor.img,
            mayAudit: mayAuditActor(actor),
            auditDisabled: this.busy || !mayAuditActor(actor),
          }
        : null,
      auditReport: visibleAuditReport
        ? {
            ...visibleAuditReport,
            issues: visibleAuditReport.issues.map((issue) => ({
              ...issue,
              cssClass: severityClass(issue.severity),
            })),
          }
        : null,
      diagnosticsReport: this.diagnosticsReport
        ? {
            ...this.diagnosticsReport,
            findings: this.diagnosticsReport.findings.map((finding) => ({
              ...localizeFinding(finding),
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
        if (this.busy) return;
        this.activeTab = event.currentTarget.dataset.tab;
        await game.settings.set(MODULE_ID, SETTINGS.HUB_TAB, this.activeTab);
        await this.render();
      });
    }

    root.querySelector('[data-action="refresh"]')?.addEventListener("click", () => {
      if (!this.busy) void this.render();
    });
    root.querySelector('[data-action="audit"]')?.addEventListener("click", () => void this.#runAudit());
    root
      .querySelector('[data-action="diagnostics"]')
      ?.addEventListener("click", (event) => void this.#runDiagnostics(event.currentTarget.dataset.deep === "true"));
    root
      .querySelector('[data-action="copy-diagnostics"]')
      ?.addEventListener("click", () => void this.#copyDiagnostics({ minimal: true }));
    root
      .querySelector('[data-action="copy-diagnostics-full"]')
      ?.addEventListener("click", () => void this.#copyDiagnostics({ minimal: false }));
    root
      .querySelector('[data-action="run-migrations"]')
      ?.addEventListener("click", () => void this.#runMigrations());
    root.querySelector('[data-action="reset-position"]')?.addEventListener("click", () => {
      void this.#resetPosition();
    });
  }

  _onPosition(position) {
    super._onPosition(position);
    if (!this.rendered) return;
    clearTimeout(this.positionSaveTimer);
    this.positionSaveTimer = setTimeout(() => {
      const safePosition = sanitizeHubPosition(position);
      void game.settings
        .set(MODULE_ID, SETTINGS.HUB_POSITION, safePosition)
        .catch((error) => console.warn(`${MODULE_TITLE} | Could not save Rules Hub position`, error));
    }, 200);
  }

  _onClose(options) {
    clearTimeout(this.positionSaveTimer);
    this.positionSaveTimer = null;
    return super._onClose(options);
  }

  async #renderIfOpen() {
    if (!this.rendered) return;
    await this.render();
  }

  async #resetPosition() {
    if (this.busy) return;
    try {
      const position = sanitizeHubPosition({});
      await game.settings.set(MODULE_ID, SETTINGS.HUB_POSITION, {});
      this.setPosition(position);
    } catch (error) {
      notification("error", game.i18n.format("RO.Notifications.OperationFailed", { message: error.message }));
    }
  }

  async #runAudit() {
    if (this.busy) return;
    const { actor, reason } = actorSelection();
    if (!actor) {
      notification(
        "warn",
        game.i18n.localize(reason === "multiple" ? "RO.Notifications.SelectOneActor" : "RO.Notifications.SelectActor"),
      );
      return;
    }
    if (!mayAuditActor(actor)) {
      notification("error", game.i18n.localize("RO.Notifications.AuditDenied"));
      return;
    }

    this.busy = true;
    await this.#renderIfOpen();
    try {
      this.auditReport = await this.api.auditActor(actor);
      this.activeTab = "audit";
    } catch (error) {
      console.error(`${MODULE_TITLE} | Actor audit failed`, error);
      notification("error", game.i18n.format("RO.Notifications.OperationFailed", { message: error.message }));
    } finally {
      this.busy = false;
      await this.#renderIfOpen();
    }
  }

  async #runDiagnostics(deep) {
    if (this.busy) return;
    this.busy = true;
    await this.#renderIfOpen();
    try {
      this.diagnosticsReport = await this.api.runDiagnostics({ deep });
      this.activeTab = "diagnostics";
    } catch (error) {
      console.error(`${MODULE_TITLE} | Diagnostics failed`, error);
      notification("error", game.i18n.format("RO.Notifications.OperationFailed", { message: error.message }));
    } finally {
      this.busy = false;
      await this.#renderIfOpen();
    }
  }

  async #copyDiagnostics({ minimal = false } = {}) {
    if (!this.diagnosticsReport || this.busy) return;
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error(game.i18n.localize("RO.Notifications.ClipboardUnavailable"));
      }
      const payload = minimal
        ? {
            schemaVersion: this.diagnosticsReport.schemaVersion,
            mode: "minimal-support",
            generatedAt: this.diagnosticsReport.generatedAt,
            core: this.diagnosticsReport.core,
            system: this.diagnosticsReport.system
              ? { id: this.diagnosticsReport.system.id, version: this.diagnosticsReport.system.version }
              : null,
            counts: this.diagnosticsReport.counts,
            findings: this.diagnosticsReport.findings.map((finding) => ({
              severity: finding.severity,
              code: finding.code,
              providerId: finding.providerId,
              packId: finding.packId,
            })),
          }
        : this.diagnosticsReport;
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      notification(
        "info",
        game.i18n.localize(minimal ? "RO.Notifications.SupportCopied" : "RO.Notifications.DiagnosticsCopied"),
      );
    } catch (error) {
      notification("error", game.i18n.format("RO.Notifications.OperationFailed", { message: error.message }));
    }
  }

  async #runMigrations() {
    if (!game.user?.isGM || this.busy) return;
    const pending = await this.api.listPendingMigrations();
    if (!pending.length) {
      notification("info", game.i18n.localize("RO.Notifications.NoMigrations"));
      return;
    }

    const confirmed = await DialogV2.confirm({
      window: { title: game.i18n.localize("RO.Migrations.ConfirmTitle") },
      content: `<p>${game.i18n.localize("RO.Migrations.ConfirmBody")}</p><p><strong>${game.i18n.localize("RO.Migrations.BackupWarning")}</strong></p>`,
      modal: true,
      rejectClose: false,
    });
    if (!confirmed || !this.rendered) return;

    this.busy = true;
    await this.#renderIfOpen();
    try {
      await this.api.runPendingMigrations();
      this.diagnosticsReport = await this.api.runDiagnostics();
      notification("info", game.i18n.localize("RO.Notifications.MigrationsComplete"));
    } catch (error) {
      console.error(`${MODULE_TITLE} | Migration failed`, error);
      notification("error", game.i18n.format("RO.Notifications.OperationFailed", { message: error.message }));
    } finally {
      this.busy = false;
      await this.#renderIfOpen();
    }
  }
}
