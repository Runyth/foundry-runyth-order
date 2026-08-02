# Manual test checklist

Test in a cloned Foundry VTT 13.351 world before production use.

## Fresh install

- [ ] Remove any earlier unpublished development build before extracting 1.0.3; do not merge module folders.

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
- [ ] Verify English and German UI.

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
- [ ] Switch Foundry to German and confirm naming findings are localized.
- [ ] Load a provider without naming metadata; confirm it remains registered and receives only an informational `NAMING_METADATA_MISSING` finding.
- [ ] Confirm settings, completed migrations, and managed source metadata use only the `runyth-order` namespace.
