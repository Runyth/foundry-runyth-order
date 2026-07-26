# Capability vocabulary

Capabilities answer: “Is at least one active provider claiming this category of functionality?” They do not transfer ownership or define another provider's detailed API.

## Standard capabilities

| Capability | Meaning |
|---|---|
| `content.backgrounds` | Background content |
| `content.classes` | Class content |
| `content.equipment` | Equipment content |
| `content.features` | Features or traits |
| `content.feats` | Feat content |
| `content.species` | Species content |
| `content.spells` | Spell content |
| `content.subclasses` | Subclass content |
| `automation.activities` | Native or provider-defined activity automation |
| `automation.advancement` | Progression/Advancement authoring |
| `automation.effects` | Active Effect automation |
| `automation.macros` | Macro-backed mechanics |
| `automation.rests` | Short/long-rest integration |
| `automation.resources` | Uses, pools, or resource integration |
| `integration.dnd5e` | D&D 5e-specific integration |
| `integration.midi-qol` | Midi-QOL-specific integration |
| `migration.documents` | Provider-owned document migration |
| `migration.world` | Provider-owned world-state migration |
| `validation.actor` | Actor audit rules |
| `validation.content` | Content validation tooling |

## Custom capabilities

A custom capability must be namespaced by provider ID:

```text
example-character-options.language-restrictions
```

Use custom capabilities only when the concept cannot be represented by the standard vocabulary. Document their semantics in the provider repository.

## Discovery example

```javascript
const core = game.modules.get("runyth-rules-core").api;
const hasDndAutomation = core.hasCapability("automation.activities", {
  systemId: "dnd5e"
});
```

Capability discovery is suitable for optional UI and diagnostics. A direct runtime call into another provider still requires that provider's own versioned public API.
