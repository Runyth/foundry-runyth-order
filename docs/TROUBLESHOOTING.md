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
| Window opens poorly after monitor changes | Use **Reset window** in Rules Hub. |
