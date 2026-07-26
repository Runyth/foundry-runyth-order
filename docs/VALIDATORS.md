# Actor validators

Actor validators extend the Rules Hub's read-only character audit.

## Contract

```javascript
{
  id: "progression",
  title: "Progression validation",
  description: "Checks required homebrew choices.",
  scope: "actor",
  timeoutMs: 5000,
  async run(context) {
    return [];
  }
}
```

Context:

```javascript
{
  actor,
  options,
  provider,
  packs,
  coreApi
}
```

Return zero or more issues:

```javascript
{
  severity: "warning",
  code: "choice-missing",
  title: "Choice missing",
  message: "A required choice is missing.",
  remediation: "Reopen Advancement and select one option.",
  documentUuid: actor.uuid,
  data: {}
}
```

Allowed severities: `info`, `warning`, `error`.

## Purity requirement

A validator must not mutate the Actor or world. Specifically, it must not call update/create/delete methods, consume resources, post chat messages, open UI, request rolls, or make remote network requests.

The core cannot technically sandbox trusted module code, so this rule is enforced through provider review and tests. Validators that time out or throw are converted into visible audit errors rather than aborting all other validators.

## Stable findings

Use stable machine-readable codes. The message may be localized or improved between releases, but support tools and tests should be able to rely on the code.

Recommended code style:

```text
subclass-missing
invalid-feature-level
orphaned-managed-item
resource-maximum-mismatch
unsupported-multiclass-combination
```
