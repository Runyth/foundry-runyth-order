# Troubleshooting

| Symptom | Resolution |
|---|---|
| Rules Hub shows no provider | Confirm the complementary module is active, declares the core dependency, and calls `registerProvider` during `init`. Inspect the browser console for `ProviderValidationError`. |
| Provider rejected as inactive | `moduleId` must exactly match an enabled Foundry module. |
| Custom capability rejected | Prefix it with the provider ID and a dot. |
| Pack missing | Use the global ID `<providerId>.<localPackId>` and register the pack under that provider. |
| Diagnostics reports missing compendium | Correct the provider's Foundry collection ID or include the compendium in its manifest/build. |
| Actor audit cannot run | Select exactly one owned token or assign a user character; check the audit-permission setting. |
| Stale source warning | Use the provider's documented update flow. The core deliberately does not overwrite embedded Items. |
| Migration remains pending | Inspect the migration error, correct the provider, retain the world backup, and rerun. Completion is recorded only after success. |
| Window opens poorly after monitor changes | Version 1.0.1 clamps saved geometry to the current viewport. Use **Reset window** if a browser extension or unusual window manager still interferes. |
| Scene Controls button is visible but does nothing | Confirm version 1.0.1 or newer is installed. Version 1.0.0 used the V12 `onClick` tool callback instead of Foundry V13 `onChange`. |
| Rules Hub reappears after being closed | Update to 1.0.1 or newer. Long-running operations no longer force-render a closed window. |
| Provider is rejected for compatibility data | Use valid numeric Foundry-style versions, keep minimum less than or equal to maximum, keep verified inside the range, and do not duplicate system or dependency IDs. |
| Runyth Order remains English | Confirm the desired language-pack module is installed and active, then select its language through Foundry’s global Configure Settings language control. The Rules Hub intentionally has no selector. |
| Translation keys appear instead of text | The active language pack is missing keys or targets another core version. Update or disable the pack; do not edit the core dictionary in place. |
| A translation is partly English | The language pack does not cover the complete `RO.*` key set for this core version. Report it to the language-pack maintainer. English is the canonical fallback. |


## Naming warning appears

Open Rules Hub → Providers or run diagnostics. Compare the provider title, active module title, provider `naming`, and manifest `flags.runyth` with the canonical title. The required pattern is `Runyth Order: <Category> <Content Name>`.

Naming warnings are non-blocking. Legacy providers without metadata receive `NAMING_METADATA_MISSING` as information and continue to work. Do not rename an already published technical module or provider ID merely to silence a display-name warning.

## Browser reports `ERR_FAILED` for Runyth Order ESM resources

Version 1.0.6 no longer loads editable `src/core/*.mjs` files directly. Verify that `module.json` points to `runtime/v1.0.6/bootstrap.mjs`, then inspect `runtime/v1.0.6/graph.json`. Every recorded runtime file must exist exactly, including case. A clean install and an overlay-upgrade test should both request only the versioned runtime path.

If an emitted dependency is genuinely absent or blocked, the guarded bootstrap reports one fatal initialization error and the core API remains unavailable rather than leaving a partial provider registry. Reinstall the ZIP, clear the browser cache, and reload. Do not patch complementary providers around a missing core runtime resource.
