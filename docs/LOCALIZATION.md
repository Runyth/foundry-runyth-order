# Localization contract

## Purpose

Runyth Order uses Foundry VTT's native package-localization mechanism. The foundation module contains one canonical English dictionary and no module-specific language selector. Additional translations are distributed as independent language-pack modules.

This keeps the runtime core English-first, prevents unrelated translation updates from forcing a core release, and allows any number of community or campaign language packs to coexist with the same stable `RO.*` localization namespace.

Official Foundry references:

- https://foundryvtt.com/article/localization/
- https://foundryvtt.com/article/module-development/
- https://foundryvtt.com/article/settings/

## Core contract

| Property | Value |
|---|---|
| Base language | English (`en`) |
| Localization namespace | `RO.*` |
| Bundled runtime dictionaries | `lang/en.json` only |
| Language selection | Foundry's global language setting |
| Dashboard selector | None |
| Module-specific language setting | None |
| External language packs | Supported |

The core manifest declares:

```json
{
  "languages": [
    {
      "lang": "en",
      "name": "English",
      "path": "lang/en.json"
    }
  ],
  "flags": {
    "runyth": {
      "localization": {
        "schemaVersion": 1,
        "baseLanguage": "en",
        "namespace": "RO",
        "externalLanguagePacks": true,
        "languageSelection": "foundry"
      }
    }
  }
}
```

All user-visible runtime strings must be represented by `RO.*` keys. English is the authoritative source dictionary. Source code, templates, settings, notifications, prompts, and documentation examples must not require a second built-in language.

## Selecting a language

Runyth Order does not add a language dropdown to Rules Hub and does not register a separate module language setting.

Foundry already provides the appropriate interface. Install and enable the desired language pack, then use Foundry's global Language setting in **Configure Settings**. Foundry loads translation dictionaries for the selected language and merges dictionaries from active modules into the consolidated localization dictionary.

A language choice therefore applies consistently to Foundry core, the active game system, Runyth Order, and other modules that support that language.

## External language-pack module

A language pack is an ordinary Foundry module. It does not need JavaScript, a dashboard, macros, sockets, or a provider registration merely to contribute translations.

Recommended identity:

```text
Title: Runyth Order: Language <Language Name>
ID: runyth-order-language-<language-slug>
```

Example German manifest:

```json
{
  "id": "runyth-order-language-german",
  "title": "Runyth Order: Language German",
  "version": "1.0.0",
  "compatibility": {
    "minimum": "13.341",
    "verified": "13.351",
    "maximum": "13.351"
  },
  "languages": [
    {
      "lang": "de",
      "name": "Deutsch — Runyth Order",
      "path": "lang/de.json"
    }
  ],
  "relationships": {
    "requires": [
      {
        "id": "runyth-order",
        "type": "module",
        "compatibility": {
          "minimum": "1.0.4",
          "verified": "1.0.4",
          "maximum": "1.0.4"
        }
      }
    ]
  },
  "flags": {
    "runyth": {
      "orderName": "Runyth Order",
      "moduleKind": "Language",
      "contentName": "German",
      "canonicalTitle": "Runyth Order: Language German",
      "localization": {
        "schemaVersion": 1,
        "targetModuleId": "runyth-order",
        "targetModuleVersion": "1.0.4",
        "baseLanguage": "en",
        "language": "de",
        "namespace": "RO"
      }
    }
  }
}
```

The translation file contains the same keys as `runyth-order/lang/en.json`:

```json
{
  "RO.Title": "Runyth Order",
  "RO.Actions.Refresh": "Aktualisieren"
}
```

Language packs may translate values but must not rename keys.

## Translation-pack requirements

A release-quality language pack should satisfy all of the following:

1. Depend on the exact compatible Runyth Order release or a deliberately tested range.
2. Declare exactly one target language per pack unless the maintainer explicitly owns a multi-language distribution.
3. Preserve every `RO.*` key exactly.
4. Include no unknown `RO.*` keys unless they target a documented newer core version.
5. Contain non-empty string values.
6. Preserve Foundry interpolation placeholders such as `{count}`, `{message}`, and `{pattern}` exactly.
7. Preserve meaningful punctuation and markup semantics.
8. Avoid scripts when the package only contributes translations.
9. Follow the Runyth Order naming contract.
10. Use `master` as the default branch.

## Placeholder safety

Placeholders are runtime contracts. A translation must retain the same placeholder names as English.

For example:

```json
{
  "RO.Naming.WarningCount": "{count} naming warning(s)"
}
```

A valid translation may move `{count}` to another position but may not rename or remove it.

Translation validation should compare the placeholder set for every key.

## Versioning policy

The core and each language pack are independently versioned.

- A wording correction in a language pack requires only a language-pack patch release.
- A new English key in Runyth Order requires a core release and compatible language-pack updates.
- A missing translation must fall back to the canonical English experience rather than being filled with guessed text.
- A language pack must state the core version against which its key set was validated.

The `flags.runyth.localization.targetModuleVersion` field records that validation target. It is documentation and tooling metadata; it does not replace Foundry's required dependency compatibility declaration.

## Content localization

Runyth Order itself owns no campaign classes, subclasses, spells, equipment, or journals. Complementary content modules remain responsible for their own English source content and localization strategy.

Recommended policy for complementary modules:

- canonical module interface and content are English;
- all interface strings use module-owned localization keys;
- translatable content uses stable source IDs and a documented translation mechanism;
- optional translations live in separate language-pack modules whenever practical;
- no language selector occupies provider dashboards;
- the Foundry global language setting remains authoritative.

## Why there is no custom selector

A custom per-module language selector would create conflicting language state, duplicate Foundry's existing interface, and allow the core UI to disagree with the rest of Foundry. Runyth Order therefore deliberately does not register one.

A custom selector should be considered only if Foundry removes its native global language setting or if a future content-localization requirement cannot be expressed through supported package localization. Such a change would require a separate design review and release.
