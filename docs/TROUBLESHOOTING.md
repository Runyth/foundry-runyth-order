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
