# Monorepo Restructure Design

**Date:** 2026-05-14
**Status:** Draft
**Author:** slowdini

## Problem Statement

The superpowers repo currently has a flat structure where core assets (skills, shared docs, assets) are mixed with harness-specific integration code (Claude plugin, Codex plugin, Cursor plugin, OpenCode plugin, Gemini extension). This creates three acute pain points:

1. **Manual version bumping:** Six separate files (`.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, `.cursor-plugin/plugin.json`, `gemini-extension.json`, root `package.json`, `.claude-plugin/marketplace.json`) must be kept in sync via a custom `.version-bump.json` + `scripts/bump-version.sh` workflow.
2. **Lack of isolated testing:** All tests live in a single `tests/` directory. There is no way to run "only the OpenCode tests" or "only the Claude tests" without manually filtering paths.
3. **Navigability:** A new contributor cannot immediately tell which files are core (all harnesses need them) vs. harness-specific. The root directory has 25+ entries, many of which are harness manifests or harness-specific configuration.

This is a permanent fork of `obra/superpowers`. We are free to change the release and publishing model.

## Goals

- Eliminate manual, error-prone version synchronization across harnesses.
- Enable isolated, filterable testing per harness and for core.
- Make the repo structure self-documenting: core vs. harness boundaries are obvious from directory names.
- Support publishing separate artifacts per harness (npm packages for OpenCode/Gemini, marketplace bundles for Claude/Codex/Cursor).
- Preserve all existing top-level documentation at the repo root (README.md, AGENTS.md, CLAUDE.md, GEMINI.md, CODE_OF_CONDUCT.md, RELEASE-NOTES.md).
- Preserve existing `docs/` directory at root level (planning docs for the entire project).

## Non-Goals

- Independent versioning per harness (for now). All packages share a single version.
- Changing skill content or behavior.
- Adding new harnesses.
- Migrating away from Bun as the package manager.

## Proposed Architecture

### Workspace Layout

Convert the repo to a Bun workspace with a flat `packages/` directory. The root remains a private workspace definition.

```
superpowers/                    # root (private workspace)
├── package.json                # workspace definition only
├── bun.lockb                   # single lockfile
├── README.md
├── AGENTS.md
├── CLAUDE.md
├── GEMINI.md
├── CODE_OF_CONDUCT.md
├── LICENSE
├── RELEASE-NOTES.md
├── docs/                       # planning docs for the entire project
│   ├── superpowers/specs/
│   ├── superpowers/plans/
│   ├── testing.md
│   ├── README.opencode.md
│   └── windows/
├── scripts/
│   ├── bump-version.js         # workspace-aware version bump
│   └── sync-to-codex-plugin.sh
├── .github/
├── .gitattributes
├── .gitignore
├── .worktrees/
└── packages/
    ├── core/                   # @slowdini/superpowers-core
    │   ├── package.json
    │   ├── skills/             # all skills
    │   ├── assets/             # icons, logos
    │   └── tests/              # cross-cutting tests
    │       ├── skill-triggering/
    │       ├── explicit-skill-requests/
    │       ├── brainstorm-server/
    │       └── subagent-driven-dev/
    ├── claude/                 # @slowdini/superpowers-claude
    │   ├── plugin.json
    │   ├── marketplace.json
    │   ├── hooks/
    │   │   ├── hooks.json
    │   │   ├── run-hook.cmd
    │   │   └── session-start
    │   ├── tests/
    │   └── package.json
    ├── codex/                  # @slowdini/superpowers-codex
    │   ├── plugin.json
    │   ├── tests/
    │   └── package.json
    ├── cursor/                 # @slowdini/superpowers-cursor
    │   ├── plugin.json
    │   ├── hooks-cursor.json
    │   ├── tests/
    │   └── package.json
    ├── opencode/               # @slowdini/superpowers-opencode
    │   ├── plugins/superpowers.js
    │   ├── package.json
    │   └── tests/
    └── gemini/                 # @slowdini/superpowers-gemini
        ├── extension.json
        ├── tests/
        └── package.json
```

### Root `package.json`

```json
{
  "name": "superpowers",
  "private": true,
  "version": "5.1.0",
  "type": "module",
  "workspaces": ["packages/*"],
  "scripts": {
    "test": "bun run --filter '*' test",
    "test:core": "bun run --filter core test",
    "test:claude": "bun run --filter claude test",
    "test:codex": "bun run --filter codex test",
    "test:cursor": "bun run --filter cursor test",
    "test:opencode": "bun run --filter opencode test",
    "test:gemini": "bun run --filter gemini test",
    "version": "node scripts/bump-version.js",
    "publish:all": "bun run --filter '*' publish --access public"
  }
}
```

### Package Definitions

**Core (`packages/core/package.json`)**

```json
{
  "name": "@slowdini/superpowers-core",
  "version": "5.1.0",
  "description": "Core skills library for superpowers",
  "files": ["skills/", "assets/"],
  "exports": {
    "./skills/*": "./skills/*",
    "./assets/*": "./assets/*"
  }
}
```

Core remains zero-dependency. It publishes a tarball containing skills and assets.

**OpenCode (`packages/opencode/package.json`)**

```json
{
  "name": "@slowdini/superpowers-opencode",
  "version": "5.1.0",
  "type": "module",
  "main": "plugins/superpowers.js",
  "dependencies": {
    "@opencode-ai/plugin": "1.14.29"
  },
  "peerDependencies": {
    "@slowdini/superpowers-core": "workspace:*"
  }
}
```

**Harness packages (claude, codex, cursor, gemini)**

```json
{
  "name": "@slowdini/superpowers-claude",
  "version": "5.1.0",
  "peerDependencies": {
    "@slowdini/superpowers-core": "workspace:*"
  }
}
```

Harness packages declare a peer dependency on core so that workspace resolution works during development. At publish time, the peer dependency is resolved to a real version range.

## Path Resolution Between Packages

The biggest mechanical challenge is that harness manifests and code currently reference relative paths to skills and assets. After the split, these paths must resolve correctly in both workspace and published contexts.

### Current paths that break

| Source | Current path | Becomes |
|--------|-------------|---------|
| `.cursor-plugin/plugin.json` | `"skills": "./skills/"` | needs `../core/skills/` |
| `.codex-plugin/plugin.json` | `"skills": "./skills/"` | needs `../core/skills/` |
| `hooks/session-start` | `${CLAUDE_PLUGIN_ROOT}/skills/` | needs to locate core |
| `.opencode/plugins/superpowers.js` | `path.resolve(__dirname, '../../skills')` | needs `../core/skills/` |

### Resolution strategy

**For OpenCode and Codex (npm-published packages):** Use runtime resolution via Node.js `import.meta.resolve` or `require.resolve('@slowdini/superpowers-core')`. This works correctly whether the package is installed from npm or symlinked in a workspace.

Example for OpenCode plugin:
```javascript
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const corePath = path.dirname(require.resolve('@slowdini/superpowers-core/package.json'));
const skillsDir = path.join(corePath, 'skills');
```

**For Claude, Cursor, and Gemini (marketplace bundles):** Update manifest paths to `../core/skills/` and `../core/assets/`. Marketplace publishing bundles the entire workspace, so relative paths within the bundle remain valid. If a marketplace ever requires a flat tarball, add a build step that inlines core contents.

**For hooks (`session-start`):** The hook script currently resolves skills via `${CLAUDE_PLUGIN_ROOT}/skills/`. After the move, `CLAUDE_PLUGIN_ROOT` will point to `packages/claude/`. Update the script to resolve core via a known relative path: `${CLAUDE_PLUGIN_ROOT}/../core/skills/`.

## Version Management

Replace `.version-bump.json` and `scripts/bump-version.sh` with a single workspace-aware script.

### `scripts/bump-version.js`

```javascript
import { readFileSync, writeFileSync } from 'fs';

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error('Usage: node bump-version.js <version>');
  process.exit(1);
}

const files = [
  'package.json',
  'packages/core/package.json',
  'packages/claude/package.json',
  'packages/codex/package.json',
  'packages/cursor/package.json',
  'packages/opencode/package.json',
  'packages/gemini/package.json',
  'packages/claude/plugin.json',
  'packages/claude/marketplace.json',
  'packages/codex/plugin.json',
  'packages/cursor/plugin.json',
  'packages/gemini/extension.json'
];

for (const file of files) {
  const content = JSON.parse(readFileSync(file, 'utf8'));
  content.version = version;
  writeFileSync(file, JSON.stringify(content, null, 2) + '\n');
  console.log(`Bumped ${file}`);
}
```

**Usage:** `bun run version 5.2.0`

This bumps all 12 files in one atomic operation. Remove `.version-bump.json` entirely.

**Future enhancement:** If harnesses ever need independent release cadences, migrate to `changesets` for independent versioning. For now, synchronized versions keep the release process simple and predictable.

## Testing Strategy

### Test relocation

| Current location | New location |
|-----------------|--------------|
| `tests/brainstorm-server/` | `packages/core/tests/brainstorm-server/` |
| `tests/explicit-skill-requests/` | `packages/core/tests/explicit-skill-requests/` |
| `tests/skill-triggering/` | `packages/core/tests/skill-triggering/` |
| `tests/subagent-driven-dev/` | `packages/core/tests/subagent-driven-dev/` |
| `tests/claude-code/` | `packages/claude/tests/` |
| `tests/codex-plugin-sync/` | `packages/codex/tests/` |
| `tests/opencode/` | `packages/opencode/tests/` |

### Test commands

```bash
bun run --filter core test        # cross-cutting tests only
bun run --filter claude test      # claude-specific integration tests
bun run --filter opencode test    # opencode plugin tests
bun run --filter '*' test         # all packages
```

Each package's `package.json` defines its own `test` script, so `--filter` dispatches correctly. Update any test scripts that reference hardcoded paths (e.g., `../../skills/`) to use relative paths from their new location.

### CI integration

Add `.github/workflows/test.yml` that runs `bun run --filter '*' test` on every PR. Add matrix jobs for per-package testing if feedback speed becomes an issue.

## Publishing Model

Each harness publishes a different artifact:

| Harness | Publish Target | Artifact |
|---------|---------------|----------|
| Core | npm registry | `@slowdini/superpowers-core` tarball (skills + assets) |
| Claude | Claude plugin marketplace | Bundle with core symlinked or copied |
| Codex | Codex plugin marketplace | Bundle with core symlinked or copied |
| Cursor | Cursor plugin marketplace | Bundle with core symlinked or copied |
| OpenCode | npm registry | `@slowdini/superpowers-opencode` (plugin + core peer dep) |
| Gemini | npm registry | `@slowdini/superpowers-gemini` (extension + core peer dep) |

### OpenCode installation

```bash
bun add @slowdini/superpowers-opencode
# plugin auto-discovers skills from @slowdini/superpowers-core
```

### Core installation (for custom harness builders)

```bash
bun add @slowdini/superpowers-core
# reference skills from node_modules/@slowdini/superpowers-core/skills/
```

### Marketplace bundles

For Claude, Codex, and Cursor, the marketplace expects a self-contained plugin directory. The publish step copies `packages/core/skills/` and `packages/core/assets/` into the harness package at build time so the bundle is flat. This is a build/pack step, not a runtime dependency:

```bash
# pseudo-build step for claude package
cp -r packages/core/skills packages/claude/skills
cp -r packages/core/assets packages/claude/assets
# then publish packages/claude/ as a flat bundle
```

## Migration Plan

Execute in a single feature branch with one commit per phase. Do not merge until all phases are complete and tests pass.

### Phase 1: Bootstrap workspace structure

1. Create `packages/` and all subdirectories.
2. Move `skills/` → `packages/core/skills/`.
3. Move `assets/` → `packages/core/assets/`.
4. Move harness directories and files:
   - `.claude-plugin/` → `packages/claude/`
   - `.codex-plugin/` → `packages/codex/`
   - `.cursor-plugin/` → `packages/cursor/`
   - `.opencode/plugins/superpowers.js` → `packages/opencode/plugins/superpowers.js`
   - `gemini-extension.json` → `packages/gemini/extension.json`
   - `hooks/` → `packages/claude/hooks/`
   - `hooks/hooks-cursor.json` → `packages/cursor/hooks-cursor.json`
   - Do NOT move `.opencode/node_modules/`, `.opencode/package-lock.json`, or `.opencode/package.json` (old standalone deps); Bun workspace handles dependencies centrally.
5. Move tests per the Testing Strategy table above.
6. Create all `package.json` files.
7. Update root `package.json` to workspace definition.
8. Run `bun install` to generate workspace lockfile.

### Phase 2: Fix path resolution

1. Update harness manifest paths (`plugin.json`, `marketplace.json`, `extension.json`) to reference `../core/skills/` and `../core/assets/`.
2. Update `packages/opencode/plugins/superpowers.js` to resolve core at runtime via `require.resolve('@slowdini/superpowers-core')`.
3. Update `packages/claude/hooks/session-start` and `packages/claude/hooks/hooks.json` to resolve core from the new relative location (`../core/skills/`).
4. Update `scripts/sync-to-codex-plugin.sh` to reference new paths.

### Phase 3: Testing

1. Move all test files per the relocation table.
2. Update any test scripts with hardcoded paths.
3. Run `bun run --filter core test` and fix failures.
4. Run `bun run --filter <each harness> test` and fix failures.
5. Add workspace-level test script aliases to root `package.json`.

### Phase 4: Automation

1. Replace `scripts/bump-version.sh` with `scripts/bump-version.js`.
2. Delete `.version-bump.json`.
3. Update `.github/workflows/` to use `bun run --filter '*' test`.
4. Verify `bun run version X.Y.Z` works end-to-end.

### Phase 5: Publishing setup

1. Configure npm registry auth for `@slowdini` scope.
2. Verify `bun publish` works for `packages/core/`.
3. Verify `bun publish` works for `packages/opencode/`.
4. Document marketplace bundle build steps for Claude/Codex/Cursor.

### Phase 6: Cleanup

1. Remove empty old directories and files from root (`.claude-plugin/`, `.codex-plugin/`, `.cursor-plugin/`, `.opencode/`, `hooks/`, `gemini-extension.json`).
2. Verify no stale references remain (grep for old paths).
3. Update `README.md` installation instructions if any paths changed.
4. Final `git diff --stat` review before merge.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Broken harness paths after move | High | High | Phase 2 includes exhaustive path audit; run integration tests for every harness before merge |
| Marketplace bundles fail if paths wrong | Medium | High | Add a build step that copies core into harness package before publishing; test bundle locally |
| Bun workspace issues with mixed package types | Low | Medium | Start with simple workspace; Bun workspaces are stable for this use case |
| Test scripts break due to moved paths | Medium | Medium | Phase 3 is dedicated to test migration; run full test suite before merge |
| Contributors confused by new structure | Low | Low | Update README with a "Repository Structure" section; directory names are self-documenting |

## Alternatives Considered

**Approach B: Core-at-Root with Harness Workspaces**
Keep root as the core package and only extract harnesses into `packages/`. Rejected because the root serving double duty as workspace root AND published package is confusing. It also means harness packages need brittle relative paths (`../../skills/`) to the root.

**Approach C: Harness-Only Extraction**
Keep the flat structure and only extract OpenCode into a workspace package. Rejected because it does not solve navigability or version-bumping for the other five harnesses. It addresses only the immediate OpenCode packaging need.

## Open Questions

1. Should `hooks/` (session-start, run-hook.cmd, hooks.json) live in `packages/claude/` since they are Claude-specific, or remain at root as shared infrastructure? **Resolved:** Move to `packages/claude/hooks/`. The `hooks-cursor.json` file moves to `packages/cursor/hooks-cursor.json`. These are harness-specific integration points.
2. Should `docs/superpowers/` (specs and plans) move into `packages/core/docs/` or stay at root? **Tentative answer:** Stay at root; these are project-level planning docs, not core package content.

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-14 | Full workspace split (Approach A) | Solves all three pain points; clean separation; supports separate publishing |
| 2026-05-14 | Synchronized versioning | Simplicity; can migrate to changesets later if needed |
| 2026-05-14 | Runtime resolution for OpenCode/Codex | Works in both workspace and npm-installed contexts |
| 2026-05-14 | Relative paths + build-time copy for Claude/Cursor/Gemini | Marketplace bundles need flat or predictable paths |
| 2026-05-14 | Keep root docs and markdown at root | These are project-level, not package-level |
