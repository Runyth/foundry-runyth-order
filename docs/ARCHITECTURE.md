# Architecture

## Responsibility boundary

Runyth Order owns contracts, not campaign rules.

| Core owns | Complementary modules own |
|---|---|
| API lifecycle and version | Classes, subclasses, species, backgrounds, feats, spells, equipment |
| Provider and pack registry | Compendium documents and artwork |
| Capability vocabulary | Activities, effects, macros, and system-specific automation |
| Immutable public descriptors | Import/provisioning UI and content updates |
| Source metadata format | Semantic meaning of provider-owned entries |
| Read-only Actor audit orchestration | Provider-specific validation logic |
| Explicit migration orchestration | Provider-specific migration implementation |
| Diagnostics and Rules Hub | Feature-specific gameplay UI |
| English localization contract and stable `RO.*` keys | Optional language packs and provider-specific content translations |

This split keeps the core installable in worlds that use different systems and prevents a central module from becoming a monolith containing every campaign's rules.

## Lifecycle

```text
Foundry init
  ├─ register core settings and launchers
  ├─ construct registry and services
  ├─ expose game.modules.get("runyth-order").api
  └─ emit runyth-order.apiReady
       └─ complementary modules register providers

Foundry ready
  ├─ resolve API readiness promise
  ├─ emit runyth-order.ready
  └─ allow diagnostics, audits, and migrations
```

A complementary module should normally register during `init` after declaring the core as a required relationship. It may also listen for `runyth-order.apiReady` when load ordering is not guaranteed.

## Registry isolation

The internal registry stores descriptors separately from executable handlers:

- provider, pack, validator, and migration identifiers are globally namespaced;
- duplicate identifiers are rejected;
- provider modules must be active;
- declared API compatibility is structurally validated, range-checked, and checked against the current API;
- duplicate system and dependency declarations are rejected;
- custom capabilities must be provider-namespaced;
- registration is atomic and rolled back if any child contribution fails;
- public reads return deep-frozen copies;
- validator and migration functions remain private to their execution services.

## Data storage

The core stores only:

- its own world schema version;
- completed migration versions;
- client-local Rules Hub geometry and selected tab, with viewport clamping on every new window instance;
- world settings controlling audit permission and onboarding;
- optional source flags explicitly added to Foundry documents.

It does not duplicate provider compendium content into a hidden core database.

## Security model

Foundry modules are trusted code running in a client. Descriptor validation protects registry integrity and diagnostics quality, but cannot sandbox a malicious installed module. Provider modules must be reviewed and installed as independently trusted software.

Players cannot invoke core migration methods successfully because the service checks the current Foundry user. Hiding data in an application or setting is not treated as protection from an adversarial client.

## Foundry V13 UI integration

Rules Hub is an ApplicationV2 instance with a stable application ID. All launchers reuse `foundry.applications.instances`, so opening through Module Settings, the Settings sidebar, Scene Controls, or the keybinding brings forward one shared window instead of creating competing instances.

The Scene Controls launcher follows Foundry V13's record-based `getSceneControlButtons` contract and registers a `SceneControlTool` with explicit `order`, `button`, and `onChange` fields. The former V12 array and `onClick` compatibility branch is intentionally absent.

Long-running audits, diagnostics, and migrations update the UI only while the application remains rendered. Closing the window does not cause a completion callback to reopen it.

## Naming contract boundary

Naming evaluation occurs only after atomic provider registration succeeds. The registry stores findings and deduplicates console warnings for the world load. Diagnostics and Rules Hub read stored findings without re-emitting warnings. No naming check mutates provider data or creates a migration.

## Localization boundary

The foundation module owns one canonical English dictionary and the stable `RO.*` key contract. It does not own German, Italian, or any other translation release. Optional language-pack modules contribute dictionaries through Foundry’s native `languages` manifest field and Foundry’s global language selection.

No language state is stored by Runyth Order, no dashboard language selector is rendered, and no migration is required when a translation pack is installed, removed, or updated. See `LOCALIZATION.md`.

## Browser runtime graph

The repository keeps maintainable modules under `src/`, but the distributed browser runtime is generated under a versioned `runtime/v<module-version>/` directory. Every relative source import is resolved against an exact case-sensitive inventory, rewritten to a neutral emitted module name, and recorded in `graph.json`. The install ZIP does not expose `src/` as browser runtime.

The manifest loads only a guarded `bootstrap.mjs`. The bootstrap dynamically imports the emitted main module, so an unavailable dependency rejects one import boundary that can be reported once. Because ESM linking completes before the imported module evaluates, a missing emitted dependency cannot leave the registry half-constructed. A new patch version uses a new runtime directory, preventing an overlay upgrade or browser cache from satisfying imports with a previous release's files.
