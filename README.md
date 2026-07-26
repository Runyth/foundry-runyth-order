# Runyth Rules Core

**Runyth Rules Core** is a deliberately thin Foundry VTT foundation module for homebrew-heavy worlds. It provides one stable gateway through which independent complementary modules can declare character options, automation capabilities, validation rules, source provenance, and controlled migrations.

It is not a replacement game system, character builder, rules engine, compendium library, or combat-automation suite. The complementary modules own the actual classes, subclasses, species, backgrounds, feats, spells, equipment, activities, effects, macros, and campaign rules.

## Design goals

| Goal | Behaviour |
|---|---|
| Thin core | No campaign-specific content and no dependency on D&D 5e, Midi-QOL, or another automation suite. |
| Stable gateway | One versioned API, capability vocabulary, provider registry, source format, audit format, and migration coordinator. |
| Provider ownership | Complementary modules remain independently versioned and retain their own compendia, code, documentation, and licences. |
| Fail closed | Invalid, duplicate, inactive, incompatible, or partially registered providers are rejected atomically. |
| No silent mutation | Actor audits are read-only. Migrations are GM-only, explicitly confirmed, and never automatic. |
| Traceability | Imported or generated Foundry documents can carry a normalized provider/pack/entry source flag. |
| Diagnose first | The Rules Hub explains missing modules, incompatible systems, missing compendia, stale sources, and pending migrations. |
| Runyth consistency | ApplicationV2, bilingual UI, permanent launchers, saved geometry, deterministic dual-ZIP builds, tests, checksums, and release reports. |

## Intended module topology

```text
Runyth Rules Core
├── campaign classes and subclasses module
├── campaign species and backgrounds module
├── campaign feats and spells module
├── campaign equipment module
├── campaign automation module
└── optional integration modules
    ├── D&D 5e 2024 adapter
    ├── Midi-QOL workflows
    └── other system-specific automation
```

A content module may register one or more packs. An automation module may register capabilities and Actor validators without registering content. A migration may be supplied only when provider-owned data genuinely needs transformation.

## Game Master workflow

1. Install and enable **Runyth Rules Core**.
2. Install complementary modules for the homebrew actually used by the world.
3. Open **Rules Hub** through any permanent launcher:
   - Configure Settings → Module Settings → Runyth Rules Core → **Open Rules Hub**;
   - the Settings sidebar card;
   - Token Scene Controls;
   - `Ctrl+Shift+R`.
4. Review registered providers, packs, system ranges, dependencies, and capabilities.
5. Run diagnostics after installing or updating a provider.
6. Audit representative player Actors after a class, subclass, or system update.
7. Back up the world before explicitly running pending migrations.

The core never creates or levels a character by itself. Correctly authored complementary content should use the active system's native progression facilities. For D&D 5e, that normally means Items, Activities, Active Effects, Advancement, Scale Values, and compendium UUID references.

## Public API

The API is exposed during Foundry's `init` lifecycle:

```javascript
const core = game.modules.get("runyth-rules-core")?.api;

core.registerProvider({
  id: "example-homebrew",
  moduleId: "example-homebrew",
  title: "Example Homebrew",
  version: "1.0.0",
  coreApi: {
    minimum: "1.0.0",
    maximum: "1.0.0"
  },
  systems: [
    {
      id: "dnd5e",
      minimum: "5.3.3",
      maximum: "5.3.3"
    }
  ],
  capabilities: [
    "content.subclasses",
    "automation.advancement",
    "validation.actor"
  ],
  packs: [
    {
      id: "subclasses",
      title: "Example Subclasses",
      version: "1.0.0",
      systemId: "dnd5e",
      contentKinds: ["subclass", "feature"],
      compendia: ["example-homebrew.subclasses"],
      entries: []
    }
  ],
  validators: [
    {
      id: "actor-progression",
      title: "Actor progression",
      scope: "actor",
      async run({ actor }) {
        return [];
      }
    }
  ]
});

await core.whenReady();
```

See:

- [Complementary Module Developer Guide](docs/COMPLEMENTARY_MODULE_GUIDE.md)
- [API Reference](docs/API.md)
- [Provider Schema](docs/PROVIDER_SCHEMA.md)
- [Capability Vocabulary](docs/CAPABILITIES.md)
- [D&D 5e 2024 Guidance](docs/DND5E_2024_GUIDE.md)
- [Example Complementary Module](examples/runyth-rules-example-homebrew/)

## Compatibility

| Component | Support |
|---|---|
| Foundry VTT | Minimum 13.341, verified manifest target 13.351, maximum 13.351 |
| Game system | System-neutral core |
| D&D 5e | Supported by complementary providers; not a runtime dependency of the core |
| External services | None |
| Runtime dependencies | None |
| Socket library | None |

A manifest range is not a substitute for live testing. Complete [the manual test checklist](docs/MANUAL_TEST_CHECKLIST.md) in a cloned world before production use.

## Installation

The install ZIP contains exactly one non-versioned root folder:

```text
runyth-rules-core/
```

Extract it into:

```text
FoundryVTT/Data/modules/
```

Replace the existing folder rather than merging releases. Restart Foundry when required, enable the module in the world, and reload connected clients.

## Development

Node.js `22.13.0` or newer is required.

```text
npm ci --ignore-scripts
npm run check
```

`npm run check` performs formatting verification, repository linting, unit tests, manifest/localization/path/API audits, deterministic dual-ZIP packaging, and release verification.

Build output is written to `dist/`:

- `runyth-rules-core-v1.0.0.zip`
- `runyth-rules-core-source-v1.0.0.zip`
- `runyth-rules-core-v1.0.0-SHA256SUMS.txt`
- `runyth-rules-core-v1.0.0-build-report.json`

## Licence

Runyth Order is released under the **GNU Affero General Public License, version 3 or any later version** (`SPDX-License-Identifier: AGPL-3.0-or-later`). The complete licence text ships in `LICENSE` inside the install and source archives. Complementary modules provide their own code and content and may be distributed under independent licences where their rights and combination permit. Homebrew content exported into a world remains owned by its authors.
