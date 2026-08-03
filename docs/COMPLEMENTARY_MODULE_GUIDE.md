# Complementary Module Developer Guide

This guide describes how to build a homebrew module that uses Runyth Order without coupling unrelated content into the core.

## 1. Choose one responsibility

Prefer small modules with a clear owner and release cadence:

| Module type | Typical contents |
|---|---|
| Character options | Classes, subclasses, species, backgrounds, feats, spells |
| Equipment | Weapons, armor, tools, consumables, treasure |
| Automation | Activities, effects, rest handlers, macros, Midi-QOL workflows |
| Campaign rules | Languages, reputation, cleanliness, luck, downtime |
| Integration | D&D 5e adapter, Midi-QOL bridge, importer bridge |
| Language pack | A translation dictionary for one Runyth Order or provider module |

Do not place every campaign rule in one provider merely because the core permits multiple packs.

## Localization policy

Complementary modules should use English as their canonical interface and content language, assign stable module-owned localization keys to every user-visible UI string, and rely on Foundry’s global language selection. Do not add a language dropdown to a provider dashboard.

Where practical, distribute non-English translations as independent modules named `Runyth Order: Language <Language Name>` or, for provider-specific translations, `Runyth Order: Language <Language Name> — <Provider Name>`. A translation-only module generally needs no scripts and does not need to register as a content provider.

Preserve placeholders and stable source IDs. See [Localization Contract](LOCALIZATION.md).

## 2. Declare the core dependency

Add a required module relationship:

```json
{
  "relationships": {
    "requires": [
      {
        "id": "runyth-order",
        "type": "module",
        "compatibility": {
          "minimum": "1.0.0",
          "maximum": "1.0.0"
        }
      }
    ]
  }
}
```

Declare game-system compatibility separately when the module depends on a system.


## 3. Declare Runyth Order naming metadata

Use the canonical display format `Runyth Order: <Category> <Content Name>`. Declare the exact components in the manifest so the core never has to guess multiword boundaries:

```json
{
  "id": "runyth-order-class-example-vanguard",
  "title": "Runyth Order: Class Example Vanguard",
  "flags": {
    "runyth": {
      "orderName": "Runyth Order",
      "moduleKind": "Class",
      "contentName": "Example Vanguard",
      "canonicalTitle": "Runyth Order: Class Example Vanguard"
    }
  }
}
```

Expose the same values through provider `naming`. Published technical IDs are permanent. Legacy providers remain compatible, but new modules should follow `runyth-order-<category-slug>-<content-name-slug>`.

See [Naming Contract](NAMING_CONTRACT.md).

## 4. Register during `init`

```javascript
const PROVIDER_ID = "runyth-order-class-example-vanguard";

Hooks.once("init", () => {
  const core = game.modules.get("runyth-order")?.api;
  if (!core) {
    throw new Error("Runyth Order is required but its API is unavailable.");
  }

  core.registerProvider({
    id: PROVIDER_ID,
    moduleId: PROVIDER_ID,
    title: "Runyth Order: Class Example Vanguard",
    version: game.modules.get(PROVIDER_ID).version,
    naming: {
      orderName: "Runyth Order",
      moduleKind: "Class",
      contentName: "Example Vanguard",
      canonicalTitle: "Runyth Order: Class Example Vanguard"
    },
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
      "content.classes",
      "content.subclasses",
      "content.features",
      "automation.advancement",
      "validation.actor"
    ],
    packs: [createCharacterOptionsPack()],
    validators: [createActorValidator()]
  });
});
```

When load ordering cannot be guaranteed, listen once for `runyth-order.apiReady`, but prevent duplicate registration.

## 5. Keep canonical content in provider compendia

The provider should own canonical Items in module compendia. Use stable document IDs and identifiers where the game system supports them. Reference those documents from pack entries by UUID.

```javascript
function createCharacterOptionsPack() {
  return {
    id: "character-options",
    title: "Runyth Order: Class Example Vanguard",
    version: "1.0.0",
    systemId: "dnd5e",
    contentKinds: ["class", "subclass", "feature", "feat"],
    compendia: [
      "example-character-options.classes",
      "example-character-options.features"
    ],
    entries: [
      {
        id: "example-subclass",
        title: "Example Subclass",
        kind: "subclass",
        uuid: "Compendium.example-character-options.classes.Item.exampleSubcl",
        identifier: "example-subclass",
        version: "1.0.0",
        tags: ["player-option"]
      }
    ]
  };
}
```

Do not copy official proprietary rules text into an open-source module unless the licence explicitly permits redistribution.

## 6. Use native progression first

A provider should automate only what the active system can represent reliably.

For D&D 5e 2024 content, prefer:

1. Items and Activities;
2. Advancement for granted and selected Items, traits, ASIs, subclass choice, and scale values;
3. transferred Active Effects for persistent numerical changes;
4. Item uses and recovery configuration;
5. optional integration modules for workflow automation;
6. custom macros only for mechanics that cannot be expressed natively.

Keep optional reactions, subjective conditions, and narrative decisions prompted or manual rather than silently resolving them.

## 7. Add a read-only Actor validator

Validators should report actionable issues, not repair the Actor.

```javascript
function createActorValidator() {
  return {
    id: "progression",
    title: "Character-option progression",
    description: "Checks required homebrew selections.",
    scope: "actor",
    timeoutMs: 5000,
    async run({ actor, provider, packs }) {
      if (actor.type !== "character") return [];

      const hasChoice = actor.items.some(
        (item) => item.getFlag(PROVIDER_ID, "discipline") === true
      );
      if (hasChoice) return [];

      return [
        {
          severity: "warning",
          code: "discipline-missing",
          title: "Discipline not selected",
          message: `${actor.name} has no homebrew discipline selection.`,
          remediation: "Reopen the class Advancement flow and select one discipline.",
          documentUuid: actor.uuid
        }
      ];
    }
  };
}
```

Validator requirements:

- return an array;
- do not call `update`, `setFlag`, embedded-document creation, or deletion;
- do not display dialogs or notifications;
- do not depend on selection state or active Scene;
- finish within the configured timeout;
- catch optional integration failures internally when they are not actionable core errors;
- provide stable `code` values and clear remediation.

## 8. Tag imported documents

Source metadata enables audits and controlled update logic:

```javascript
const source = core.normalizeSource({
  providerId: PROVIDER_ID,
  packId: `${PROVIDER_ID}.character-options`,
  entryId: "example-subclass",
  sourceUuid: "Compendium.example-character-options.classes.Item.exampleSubcl",
  contentVersion: "1.0.0",
  checksum: "sha256:..."
});

const itemData = {
  ...sourceItem.toObject(),
  ...await core.tagDocument(null, source, { update: false })
};
```

`tagDocument` requires a document when `update` is true. For document creation, use `normalizeSource` and set the flag directly or call `tagDocument` against a temporary compatible abstraction. See [Source Metadata](SOURCE_METADATA.md) for the exact creation pattern.

Never infer provider ownership from document names.

## 9. Add migrations sparingly

A migration is appropriate when provider-owned world copies or flags cannot continue to function without transformation. It is not a release-notification mechanism.

```javascript
{
  id: "flags-v2",
  title: "Migrate provider flags to schema 2",
  version: "2.0.0",
  scope: "documents",
  requiresBackup: true,
  async run({ game, migration, logger }) {
    let updated = 0;
    for (const actor of game.actors) {
      const oldState = actor.getFlag(PROVIDER_ID, "state");
      if (!oldState || oldState.schemaVersion === 2) continue;
      await actor.setFlag(PROVIDER_ID, "state", convertState(oldState));
      updated += 1;
    }
    logger.info(`${migration.id}: updated ${updated} Actors.`);
    return { updated };
  }
}
```

Make migrations:

- idempotent;
- restartable after interruption;
- scoped to provider-owned data;
- conservative with renamed user documents;
- explicit about backup requirements;
- covered by tests and a manual checklist;
- safe when no matching documents exist.

## 10. Publish diagnostics-friendly metadata

Declare every required and optional module with a supported version range. Do not inspect another module's private implementation when a public API or capability can express the dependency.

Use `hasCapability` for optional cooperation:

```javascript
if (core.hasCapability("integration.midi-qol")) {
  registerOptionalMidiWorkflows();
}
```

A capability announces availability; it does not define another provider's private API. Document any direct provider-to-provider API dependency separately.

## 11. Test provider failure modes

At minimum, test:

- core absent or disabled;
- provider disabled and re-enabled;
- wrong active game system;
- minimum and maximum system versions;
- missing required and optional dependencies;
- duplicate provider and pack IDs;
- missing compendium;
- unresolved UUID;
- fresh Actor and existing Actor copies;
- level-up and level-down where supported;
- short and long rests;
- update from the previous provider release;
- failed migration and safe retry;
- GM and player views;
- core diagnostics and Actor audit output.

Use the complete example under `examples/runyth-order-rules-example-homebrew` as a starting point.
