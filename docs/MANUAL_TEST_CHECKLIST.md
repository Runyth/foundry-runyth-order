# Manual test checklist

Test in a cloned Foundry VTT 13.351 world before production use.

## Fresh install

- [ ] For a clean-install test, remove the existing `runyth-order` folder before extracting 1.0.5. Separately perform the overlay-upgrade test described below.

- [ ] Extract the install ZIP and confirm `Data/modules/runyth-order/module.json`.
- [ ] Enable the module without any complementary provider.
- [ ] Confirm no startup error or deprecation warning originates from the core.
- [ ] Confirm the update guidance appears once for the GM.

## Launchers and ApplicationV2

- [ ] Open Rules Hub from Configure Settings.
- [ ] Open it from the Settings sidebar card.
- [ ] Open it from Token Scene Controls and confirm the button responds under the V13 `onChange` contract.
- [ ] Open it with `Ctrl+Shift+R`.
- [ ] Resize and move the window; reload and confirm geometry is restored and remains on-screen.
- [ ] Save the window near an edge, reduce the browser viewport, and confirm it is clamped back into view.
- [ ] Start a deep diagnostic or slow validator, close Rules Hub before it completes, and confirm it stays closed afterward.
- [ ] Open Rules Hub through two different launchers and confirm only one ApplicationV2 instance exists.
- [ ] Reset the window position.
- [ ] Verify ordinary narrow widths do not clip essential controls.
- [ ] Verify the core interface is fully English when no external language pack is active.
- [ ] Confirm Rules Hub contains no language selector.
- [ ] Confirm Runyth Order registers no module-specific language setting in Configure Settings.

## Empty core

- [ ] Overview shows zero providers and packs.
- [ ] Provider and pack tabs show clear empty states.
- [ ] Diagnostics completes without an error.
- [ ] Actor audit runs against an owned character and makes no changes.

## Example provider

- [ ] Install the example provider from the source archive.
- [ ] Confirm exactly one provider, one pack, one validator, and one migration register.
- [ ] Confirm duplicate registration is rejected visibly in the console without duplicate registry rows.
- [ ] Confirm provider, pack, capability, system, and version metadata in Rules Hub.
- [ ] Disable the provider and reload; confirm it is absent.

## Diagnostics

- [ ] Test a missing required dependency and verify an error.
- [ ] Test a missing optional dependency and verify a warning.
- [ ] Test required and optional dependencies declared by an individual pack.
- [ ] Test an unsupported game system.
- [ ] Test a system version outside the provider range.
- [ ] Test a declared missing compendium.
- [ ] Test deep diagnostics with an unresolved UUID.
- [ ] Copy diagnostics JSON and inspect it for expected metadata.

## Actor audits

- [ ] Audit an Actor with no managed Items.
- [ ] Audit an Actor with one correctly tagged provider Item.
- [ ] Test unknown provider, unknown pack, unknown entry, and stale content version findings.
- [ ] Test duplicate managed source Items.
- [ ] Confirm a throwing validator becomes one provider error while other validators continue.
- [ ] Confirm a timed-out validator becomes one provider error.
- [ ] As a player owner, verify the configured owner/GM audit permission.
- [ ] Confirm no Actor or Item update is created by an audit.

## Source metadata

- [ ] Tag a world Item as GM and read the normalized flag.
- [ ] Confirm a player cannot tag a document through the API.
- [ ] Confirm imported timestamps and provider/pack/entry IDs remain stable.

## Migrations

- [ ] Confirm pending migrations are listed but not automatically run.
- [ ] Confirm the Rules Hub displays a backup warning and confirmation.
- [ ] Confirm a player cannot run a migration through the API.
- [ ] Run a successful migration and confirm it is no longer pending.
- [ ] Simulate a failed migration and confirm it remains pending and can be retried.
- [ ] Reload and confirm completion state persists.
- [ ] Trigger two different migrations concurrently and confirm they execute serially.
- [ ] Trigger the same migration twice concurrently and confirm its handler runs only once.

## Compatibility regression

- [ ] Test representative D&D 5e character Actors if D&D providers are installed.
- [ ] Test level-up, level-down, rests, activities, effects, and embedded Item updates in the provider module.
- [ ] Test with optional workflow modules both enabled and disabled.
- [ ] Review the browser console for errors after a full client reload.


## Runyth Order identity and naming contract

- [ ] Confirm Foundry module management displays **Runyth Order** and the installed folder and module ID are both `runyth-order`.
- [ ] Confirm Module Settings, Settings sidebar, Rules Hub title, notifications, and console prefixes display **Runyth Order**.
- [ ] Enable a conforming provider and confirm no naming mismatch warning appears.
- [ ] Enable a provider whose provider title is wrong and confirm one `PROVIDER_NAMING_MISMATCH` console warning appears with IDs, both actual titles, expected title, and pattern.
- [ ] Enable a provider whose module title is wrong and confirm one `MODULE_NAMING_MISMATCH` warning appears.
- [ ] Rerender Rules Hub and run diagnostics repeatedly; confirm console warnings are not repeated.
- [ ] Confirm naming findings appear in Rules Hub provider cards and diagnostics.
- [ ] Install and enable `Runyth Order: Language German`, switch Foundry to German through the global Configure Settings language control, and confirm naming findings are localized.
- [ ] Disable the German language pack and confirm the Runyth Order core remains usable with its canonical English dictionary.
- [ ] Re-enable the German pack and confirm Rules Hub does not create duplicate controls or require a world migration.
- [ ] Load a provider without naming metadata; confirm it remains registered and receives only an informational `NAMING_METADATA_MISSING` finding.
- [ ] Confirm settings, completed migrations, and managed source metadata use only the `runyth-order` namespace.

## 1.0.5 runtime-package regression

- [ ] Clean install `runyth-order-v1.0.5.zip` on a case-sensitive filesystem and confirm the root folder is exactly `runyth-order/`.
- [ ] Confirm `module.json` loads `runtime/v1.0.5/bootstrap.mjs` and that no `src/` path is listed as a browser entrypoint.
- [ ] Confirm every file listed by `runtime/v1.0.5/graph.json` exists with exact spelling and case.
- [ ] Clear browser cache, load the world, and confirm there are no failed requests for `modules/runyth-order/runtime/v1.0.5/*`.
- [ ] Confirm there are no requests for the former direct runtime paths such as `src/core/registry.mjs`, `src/core/logger.mjs`, or `src/settings.mjs`.
- [ ] Overlay 1.0.5 onto an extracted 1.0.4 folder without deleting old files, clear browser cache, reload, and confirm all active ESM requests still resolve only through `runtime/v1.0.5/`.
- [ ] Temporarily remove one emitted runtime module in a disposable copy. Confirm startup produces one `Runyth Order | Fatal runtime initialization failure` console error and one permanent notification, with no partial provider count or usable registry. Restore the file afterward.
- [ ] Reload repeatedly and confirm no `net::ERR_FAILED`, 404, case mismatch, or stale 1.0.4 runtime request appears.

## Provider regression with a real provider

Use the shipped example provider from the source archive, or any neutral homebrew provider of your own, for the following checks. Companion-module regression checks beyond the example are optional and belong to each provider's own test plan, not to core qualification.

- [ ] Enable Runyth Order and the example provider. Confirm its provider registers normally and Rules Hub reports it exactly once.
- [ ] Reload the world and confirm the provider registers once after every world load without duplicates.
- [ ] Enable a provider that declares compendia and confirm those compendia are available and indexed in the pack tab.
- [ ] Create a disposable Actor eligible for the provider's content and confirm the normal in-game selection flow still works with the core enabled.
- [ ] Open an existing Actor that owns provider-managed Items and confirm their subclasses/features remain intact after the core upgrade.
- [ ] Disable the provider module, reload, and confirm no stale provider remains in Rules Hub. Re-enable, reload, and confirm it registers exactly once.
- [ ] Disable Runyth Order with providers still installed and confirm Foundry reports the dependency state cleanly rather than leaving stale registration. Re-enable Runyth Order and providers, reload, and confirm registration is restored.
