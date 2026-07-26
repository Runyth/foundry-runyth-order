# Runyth Rules Example Homebrew

This directory is a complete minimal complementary-module example. It demonstrates:

- a required relationship on Runyth Rules Core;
- strict provider registration during `init`;
- D&D 5e version declaration;
- standard and custom capabilities;
- a structured content-pack descriptor;
- a non-mutating Actor validator;
- an idempotent explicit migration;
- provider-owned metadata and documentation links.

The example intentionally does not ship actual playable rules or a compiled compendium. Production content modules should put canonical game-system documents in module compendia and reference stable UUIDs from `entries`.

## Try it locally

1. Copy this directory to `Data/modules/runyth-rules-example-homebrew/`.
2. Install and enable Runyth Rules Core.
3. Use a D&D 5e 5.3.3 test world.
4. Enable the example module.
5. Open Rules Hub and inspect the provider, pack, capabilities, validator, migration, and diagnostics.

Do not publish the example as gameplay content. Copy it into a new repository, rename every stable ID, remove the demonstration migration, add real compendia, and implement provider-specific tests.
