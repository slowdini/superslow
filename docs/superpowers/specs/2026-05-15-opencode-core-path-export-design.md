# OpenCode Core Path Export for Published Plugin Installs

## Problem

The published `@slowdini/superslow-opencode` package is broken for npm/Bun
consumers in two ways:

1. `packages/opencode/package.json` publishes `@slowdini/superslow-core` as
   `workspace:*`, which fails in clean installs.
2. `packages/opencode/plugins/superpowers.js` tries to resolve
   `@slowdini/superpowers-core/package.json`, which uses the old package name
   and depends on a subpath that is not exported.

The current runtime lookup is also too implicit. The OpenCode plugin has to
infer core package layout from a deep file path instead of consuming an
explicit, supported contract from `@slowdini/superslow-core`.

## Design

### 1. Add an explicit core path module

Create `packages/core/paths.js` and export stable path constants for published
consumers:

```js
export const skillsDir = ...
export const usingSuperpowersSkillPath = ...
```

The module derives those paths from its own file location, so the contract is
owned by core rather than reconstructed by each harness.

### 2. Export the module from core

Update `packages/core/package.json` exports to include:

```json
"./paths": "./paths.js"
```

This gives the OpenCode package a supported entrypoint for path discovery
without exporting `package.json` or relying on non-exported package internals.

### 3. Update the OpenCode plugin to use the explicit contract

Replace the current `require.resolve(...package.json)` logic in
`packages/opencode/plugins/superpowers.js` with imports from
`@slowdini/superslow-core/paths`.

Behavior stays the same:

- register the bundled skills directory in `config.skills.paths`
- read `using-superpowers/SKILL.md` for bootstrap injection
- fall back to the local workspace path only when core is unavailable in local
  development

This keeps the OpenCode plugin decoupled from core's internal filesystem
layout while preserving the current runtime behavior.

### 4. Fix published dependency metadata

Update `packages/opencode/package.json` so
`@slowdini/superslow-core` uses a real semver dependency instead of
`workspace:*`.

This is required regardless of the runtime path fix; otherwise npm and Bun both
fail before the plugin code ever runs.

### 5. Add packaging regression coverage

Add a test that exercises the published-consumer path rather than only the
workspace/symlink path. The test should prove:

1. the plugin can import the exported core path module
2. the resolved skill path exists
3. clean install metadata does not depend on `workspace:*`

The test can stay lightweight and repository-local. It does not need a full
OpenCode runtime boot as long as it covers the failing contract directly.

### 6. Update OpenCode install docs

Update `packages/opencode/INSTALL.md` to install the published npm package:

```json
{
  "plugin": ["@slowdini/superslow-opencode@1.0.0"]
}
```

Keep troubleshooting guidance for cache issues and local fallback installs, but
stop advertising the old git-backed install path as the primary flow.

## Why this approach

- Gives OpenCode an explicit, stable API from core instead of relying on deep
  resolution details.
- Avoids `package.json` export issues entirely.
- Keeps the fix small: one new core module, one export, one plugin update, one
  package metadata fix, tests, and docs.
- Does not change behavior for the other harnesses, which do not currently rely
  on a runtime core path module.

## Alternatives considered

### Keep implicit runtime resolution

Resolve an exported skill file directly from the OpenCode plugin and derive the
skills directory from that path.

This would work, but it keeps path ownership in the consumer and preserves an
implicit contract between core layout and plugin behavior.

### Bundle/copy skills into the OpenCode package

Make `@slowdini/superslow-opencode` self-contained.

Rejected because it duplicates published content, increases release coupling,
and is a much larger change than needed for this bug.

## Scope

Files expected to change:

- `packages/core/package.json`
- `packages/core/paths.js`
- `packages/opencode/package.json`
- `packages/opencode/plugins/superpowers.js`
- `packages/opencode/tests/opencode/...`
- `packages/opencode/INSTALL.md`

## Validation

Before calling this fixed, verify:

1. the new regression test fails before the patch and passes after it
2. `npm pack` for `@slowdini/superslow-opencode` no longer contains
   `workspace:*` for core
3. the OpenCode plugin can resolve the exported core path module in a clean
   install context
