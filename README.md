# Runyth Order

**Runyth Order** is a deliberately thin Foundry VTT foundation module for homebrew-heavy worlds. It provides one stable gateway through which independent complementary modules can declare character options, automation capabilities, validation rules, source provenance, and controlled migrations.

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
| Diagnose first | The Rules Hub explains missing modules, incompatible systems, missing compendia, stale sources, naming mismatches, and pending migrations. |
| Runyth consistency | ApplicationV2, an English base UI, native Foundry localization through independent language packs, permanent launchers, saved geometry, deterministic dual-ZIP builds, tests, checksums, and release reports. |

## Intended module topology

```text
Runyth Order
├── campaign classes and subclasses module
├── campaign species and backgrounds module
├── campaign feats and spells module
├── campaign equipment module
├── campaign automation module
├── optional integration modules
    ├── D&D 5e 2024 adapter
    ├── Midi-QOL workflows
    └── other system-specific automation
└── optional language-pack modules
    ├── German
    ├── Italian
    └── other Foundry-supported languages
```

A content module may register one or more packs. An automation module may register capabilities and Actor validators without registering content. A migration may be supplied only when provider-owned data genuinely needs transformation.

## Game Master workflow

1. Install and enable **Runyth Order**.
2. Install complementary modules for the homebrew actually used by the world.
3. Optional: install a compatible Runyth Order language pack and select that language through Foundry’s global **Configure Settings** interface.
4. Open **Rules Hub** through any permanent launcher:
   - Configure Settings → Module Settings → Runyth Order → **Open Rules Hub**;
   - the Settings sidebar card;
   - Token Scene Controls;
   - `Ctrl+Shift+R`.
5. Review registered providers, packs, system ranges, dependencies, and capabilities.
6. Run diagnostics after installing or updating a provider.
7. Audit representative player Actors after a class, subclass, or system update.
8. Back up the world before explicitly running pending migrations.

The core never creates or levels a character by itself. Correctly authored complementary content should use the active system's native progression facilities. For D&D 5e, that normally means Items, Activities, Active Effects, Advancement, Scale Values, and compendium UUID references.

## Public API

The API is exposed during Foundry's `init` lifecycle:

```javascript
const core = game.modules.get("runyth-order")?.api;

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

- [Complementary Module Developer Guide](https://github.com/Runyth/foundry-runyth-order/blob/master/docs/COMPLEMENTARY_MODULE_GUIDE.md)
- [Runyth Order Naming Contract](https://github.com/Runyth/foundry-runyth-order/blob/master/docs/NAMING_CONTRACT.md)
- [API Reference](https://github.com/Runyth/foundry-runyth-order/blob/master/docs/API.md)
- [Provider Schema](https://github.com/Runyth/foundry-runyth-order/blob/master/docs/PROVIDER_SCHEMA.md)
- [Capability Vocabulary](https://github.com/Runyth/foundry-runyth-order/blob/master/docs/CAPABILITIES.md)
- [D&D 5e 2024 Guidance](https://github.com/Runyth/foundry-runyth-order/blob/master/docs/DND5E_2024_GUIDE.md)
- [Example Complementary Module](https://github.com/Runyth/foundry-runyth-order/tree/master/examples/runyth-order-rules-example-homebrew)
- [Localization Contract](https://github.com/Runyth/foundry-runyth-order/blob/master/docs/LOCALIZATION.md)


## Complementary naming contract

New complementary modules use the display format:

```text
Runyth Order: <Category> <Content Name>
```

They should use technical IDs in the form `runyth-order-<category-slug>-<content-name-slug>` and declare matching metadata in `module.json` under `flags.runyth` and in the provider descriptor under `naming`. Legacy providers without metadata remain registered and receive only an informational diagnostic. Title mismatches are non-blocking, deduplicated, and visible in the console, diagnostics, and Rules Hub.

See [Runyth Order Naming Contract](https://github.com/Runyth/foundry-runyth-order/blob/master/docs/NAMING_CONTRACT.md).


## Localization

Runyth Order 1.0.5 contains only the canonical English runtime dictionary. It uses Foundry VTT’s standard manifest `languages` declaration, `game.i18n.localize`, and Handlebars `localize` helper.

Translations are separate modules such as `Runyth Order: Language German`. After installing and enabling a language pack, select the language through Foundry’s global **Configure Settings** interface. Runyth Order deliberately provides no dashboard language selector and no competing module-specific language setting.

This lets translation maintainers release corrections independently and allows additional languages without modifying the foundation module. See [Localization Contract](https://github.com/Runyth/foundry-runyth-order/blob/master/docs/LOCALIZATION.md).

## Compatibility

| Component | Support |
|---|---|
| Foundry VTT | Minimum 13.341, verified manifest target 13.351, maximum 13.351 |
| Game system | System-neutral core |
| D&D 5e | Supported by complementary providers; not a runtime dependency of the core |
| External services | None |
| Runtime dependencies | None |
| Socket library | None |

A manifest range is not a substitute for live testing. Complete [the manual test checklist](https://github.com/Runyth/foundry-runyth-order/blob/master/docs/MANUAL_TEST_CHECKLIST.md) in a cloned world before production use.

Version 1.0.5 retains Foundry V13's public `SceneControlTool.onChange` contract and API 1.0.0. Its runtime packaging is hardened: editable modules under `src/` are compiled into a deterministic versioned ESM graph under `runtime/v1.0.5/`, and the manifest loads only a guarded bootstrap. This prevents stale or renamed source paths from being fetched by the browser and allows one clear fatal error if a required emitted module cannot load. Provider API, hook, setting, source-flag, and migration contracts are unchanged.


## Runtime packaging

The editable source remains modular under `src/`, but Foundry does not load those filenames directly. `npm run build` deterministically emits a versioned browser graph under `runtime/v1.0.5/`, rewrites all relative ESM edges to exact emitted files, and records the graph in `runtime/v1.0.5/graph.json`. `module.json` loads only `runtime/v1.0.5/bootstrap.mjs`.

The bootstrap dynamically imports the emitted main module and catches linking or fetch failure once. If a required runtime resource is missing, Runyth Order does not construct a partial provider registry; it writes one fatal console error and schedules one permanent GM-visible notification after Foundry reaches `ready`. See [Runtime Packaging Contract](https://github.com/Runyth/foundry-runyth-order/blob/master/docs/RUNTIME_PACKAGING.md).

## Installation

The install ZIP contains exactly one non-versioned root folder:

```text
runyth-order/
```

Extract it into:

```text
FoundryVTT/Data/modules/
```

Replace the existing folder rather than merging releases. Restart Foundry when required, enable the module in the world, and reload connected clients.

When the release is published, the module can also be installed without manual extraction. Paste the following manifest URL into Foundry's

```text
Add-on Modules → Install Module → Manifest URL
```

dialog:

```text
https://github.com/Runyth/foundry-runyth-order/releases/latest/download/module.json
```

## Development

Node.js `22.13.0` or newer is required.

```text
npm ci --ignore-scripts
npm run check
```

`npm run check` performs formatting verification, repository linting, unit tests, manifest/localization/path/API audits, standard schema validation against real runtime output, deterministic dual-ZIP packaging through a credential-free publication staging tree, and release verification of the staged artifacts including baseline signature checks and a clean-extraction rebuild.

Publication builds stage exactly one resolved revision: the release tag when `RUNYTH_RELEASE_REF` is set (public CI sets it), otherwise the checked-out `HEAD`. Tracked uncommitted changes fail the build unless `RUNYTH_ALLOW_UNCOMMITTED=1` is set for local developer builds.

Build output is written to `dist/`:

- `runyth-order-v1.0.5.zip`
- `runyth-order-source-v1.0.5.zip`
- `runyth-order-v1.0.5-SHA256SUMS.txt`
- `runyth-order-v1.0.5-build-report.json`

## Licence
Copyright © 2026  [Daniel Braniewski](https://brani.dev/)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
