# Manual test checklist

Test in a cloned Foundry VTT 13.351 world before production use.

## Fresh install

- [ ] Extract the install ZIP and confirm `Data/modules/runyth-rules-core/module.json`.
- [ ] Enable the module without any complementary provider.
- [ ] Confirm no startup error or deprecation warning originates from the core.
- [ ] Confirm the update guidance appears once for the GM.

## Launchers and ApplicationV2

- [ ] Open Rules Hub from Configure Settings.
- [ ] Open it from the Settings sidebar card.
- [ ] Open it from Token Scene Controls.
- [ ] Open it with `Ctrl+Shift+R`.
- [ ] Resize and move the window; reload and confirm geometry is restored and remains on-screen.
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

## Compatibility regression

- [ ] Test representative D&D 5e character Actors if D&D providers are installed.
- [ ] Test level-up, level-down, rests, activities, effects, and embedded Item updates in the provider module.
- [ ] Test with optional workflow modules both enabled and disabled.
- [ ] Review the browser console for errors after a full client reload.
