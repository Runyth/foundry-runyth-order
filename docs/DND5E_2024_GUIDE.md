# D&D 5e 2024 complementary-module guidance

Runyth Rules Core remains system-neutral. This document describes the preferred shape of a D&D 5e 2024 provider. Version examples use the explicitly stated example system baseline D&D 5e 5.3.3.

## Content model

Keep canonical options as D&D 5e Items in module compendia:

| Option | Typical Item type |
|---|---|
| Class | `class` |
| Subclass | `subclass` |
| Feature | `feat` or current system feature type |
| Background | `background` |
| Species | `race` or current system species type |
| Feat | `feat` |
| Spell | `spell` |
| Equipment | weapon, equipment, consumable, tool, loot |

Use the exact data model supported by the declared D&D 5e version. Do not claim a broad system version range merely because the module activates.

## Progression priorities

1. Put class/subclass progression in Advancement definitions.
2. Grant mandatory features by stable compendium UUID.
3. Use Item choices for mutually exclusive options.
4. Use Trait advancements for proficiencies, expertise, languages, and similar choices.
5. Use Scale Values for level-dependent dice, uses, and numeric progression.
6. Use ASI/feat advancements where appropriate.
7. Configure Item uses and recovery rather than custom counters.
8. Use Activities for attacks, saves, damage, healing, utility, summons, transformations, and enchantments supported by the system.
9. Use transferred Active Effects for persistent changes.
10. Add a separate optional integration provider for Midi-QOL or another workflow engine.

## Provider split example

```text
runyth-order-class-example-vanguard
  └─ content, Advancement, core Activities, core Effects

runyth-order-class-example-vanguard-midi
  └─ optional Midi-QOL workflows and reactions
```

The content module should remain usable without the automation integration wherever practical.

## Actor audit ideas

A D&D 5e provider can safely check:

- required subclass selection at the correct class level;
- duplicate provider-managed features;
- missing granted features;
- feature source versions;
- resource maximums derived from provider Scale Values;
- incompatible provider-defined choices;
- unsupported multiclass combinations;
- stale embedded copies whose canonical source has a newer provider version.

It should not decide whether a player's narrative or optional rules choice is “wrong” unless the campaign explicitly codifies that rule.

## Upgrade discipline

Pin Foundry, D&D 5e, and automation integrations as one tested stack. Validate in a cloned world with representative Actors before updating the production campaign. A provider migration should repair only provider-owned data and must not attempt a general D&D 5e system migration.
