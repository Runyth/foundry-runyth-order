# Testing strategy

## Automated gate

```text
npm ci --ignore-scripts
npm run check
```

The gate covers:

- deterministic formatting rules;
- prohibited runtime patterns and basic source linting;
- registry validation, atomic rollback, immutability, capabilities, version ranges;
- source metadata;
- Actor audit normalization and provider failure isolation;
- migration completion and retry behaviour;
- manifest, localization, path, schema, API, and example validation;
- JavaScript syntax with Node;
- deterministic install/source ZIP creation;
- archive root, file allowlist, version, checksum, and reproducibility verification.

## Live qualification

Static and unit tests do not prove browser rendering, Foundry hook signatures, module interaction, document migrations, or a particular game-system data model. Use `MANUAL_TEST_CHECKLIST.md` in the intended stack.

## Provider test doubles

Complementary modules should test their registration against the public API rather than importing core private classes. The included example demonstrates a minimal registration flow.
