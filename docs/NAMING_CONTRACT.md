# Runyth Order naming contract

## Core identity

The user-facing name of the foundation module is **Runyth Order**.

Its canonical technical identity is:

| Contract | Stable value |
|---|---|
| Foundry module ID | `runyth-order` |
| Public API lookup | `game.modules.get("runyth-order")?.api` |
| Source flag namespace | `flags.runyth-order.source` |
| Settings namespace | `runyth-order` |
| Hook prefix | `runyth-order.*` |

These identifiers are the permanent pre-publication baseline. Complementary modules must depend on and resolve `runyth-order`; published modules must not rename these identifiers later.

## Complementary display names

New complementary modules use:

```text
Runyth Order: <Category> <Content Name>
```

The category and content name are explicit metadata fields. Runyth Order never guesses where a multiword category ends or a multiword content name begins.

Examples:

| Provider type | Canonical title | Recommended technical ID |
|---|---|---|
| Class | `Runyth Order: Class Example Vanguard` | `runyth-order-class-example-vanguard` |
| Species | `Runyth Order: Species Example Realm` | `runyth-order-species-example-realm` |
| Rules | `Runyth Order: Rules Wound Recovery` | `runyth-order-rules-wound-recovery` |
| Equipment | `Runyth Order: Equipment Example Arsenal` | `runyth-order-equipment-example-arsenal` |
| Setting | `Runyth Order: Setting Example Realm` | `runyth-order-setting-example-realm` |
| Language | `Runyth Order: Language German` | `runyth-order-language-german` |

Technical IDs are permanent after release. Do not rename a published module or provider merely to improve wording. Existing technical IDs remain valid even when they predate this recommendation.

## Manifest metadata

A complementary module declares machine-readable metadata in `module.json`:

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

All four fields are required when `flags.runyth` is present:

| Field | Meaning |
|---|---|
| `orderName` | Must be exactly `Runyth Order`. |
| `moduleKind` | Human-readable category. Multiword values are allowed. |
| `contentName` | Human-readable content name. Multiword values are allowed. |
| `canonicalTitle` | Must equal `<orderName>: <moduleKind> <contentName>`. |

## Provider metadata

The provider descriptor exposes equivalent metadata through `naming`:

```javascript
core.registerProvider({
  id: "runyth-order-class-example-vanguard",
  moduleId: "runyth-order-class-example-vanguard",
  title: "Runyth Order: Class Example Vanguard",
  naming: {
    orderName: "Runyth Order",
    moduleKind: "Class",
    contentName: "Example Vanguard",
    canonicalTitle: "Runyth Order: Class Example Vanguard"
  },
  coreApi: {
    minimum: "1.0.4",
    maximum: "1.0.99"
  }
});
```

Provider metadata is authoritative when both provider and manifest metadata exist. Conflicting metadata is reported, but does not unregister the provider.

## Warning behavior

Runyth Order evaluates naming only after a provider has registered atomically. Naming findings never:

- reject a provider solely because its title differs;
- remove a provider, pack, validator, or migration;
- mutate the provider descriptor or module manifest;
- alter provider registration order or count;
- create a persistent data migration.

The following stable codes are used:

| Code | Severity | Meaning |
|---|---|---|
| `PROVIDER_NAMING_MISMATCH` | Warning | Provider title differs from the canonical title. |
| `MODULE_NAMING_MISMATCH` | Warning | Active module title differs from the canonical title. |
| `NAMING_METADATA_CONFLICT` | Warning | Provider and manifest metadata derive different canonical titles. |
| `NAMING_METADATA_INVALID` | Warning | Manifest `flags.runyth` exists but is malformed. |
| `NAMING_METADATA_MISSING` | Information | A legacy provider supplies no naming metadata. |

Provider-title and module-title mismatches each produce at most one console warning for the same mismatch during a world load. The warning contains provider ID, module ID, both actual titles, expected title, and the required pattern. Rules Hub rerenders and repeated diagnostics do not repeat console warnings.

Naming findings are also available through diagnostics and the provider cards in Rules Hub. UI messages are localized. Console warnings use a stable English sentence and a machine-readable details object.

## Metadata compatibility policy

A provider with neither provider `naming` metadata nor manifest `flags.runyth` is accepted for compatibility:

- registration succeeds;
- no title is guessed;
- no mismatch warning is emitted to the console;
- diagnostics report `NAMING_METADATA_MISSING` as informational guidance.

This policy avoids blocking third-party or in-development providers while giving maintainers a clear update path.

## Core exclusion

The foundation module itself is excluded from complementary naming checks. Its display title is `Runyth Order` and its technical ID is `runyth-order`.
