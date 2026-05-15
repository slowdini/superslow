# OpenCode Git Install Design

**Status:** Draft
**Date:** 2026-05-15
**Author:** Max Haarhaus

## Summary

This spec moves the OpenCode harness from an npm-published package model to a
direct GitHub install model using the exact OpenCode plugin entry:

```json
{
  "plugin": ["@slowdini/superslow-opencode@git+https://github.com/slowdini/superslow.git"]
}
```

The repository root becomes the Git-installable package surface for OpenCode.
The plugin code stays in `packages/opencode/`, bundled skills stay in
`packages/core/skills/`, and all workspace packages become private internal
implementation details. Runtime resolution switches from package-based core
imports to repo-relative paths so the Git-installed checkout works without npm
publishing or workspace dependency resolution.

## Goals

1. Support direct OpenCode installation from
   `@slowdini/superslow-opencode@git+https://github.com/slowdini/superslow.git`.
2. Remove all npm publishing requirements from the project.
3. Keep `packages/opencode/` and `packages/core/` as the source of truth for
   code and skills.
4. Ship a minimal install artifact that contains only the OpenCode runtime
   files it needs.
5. Preserve the current local development workflow in this monorepo.

## Non-Goals

- Support or preserve the current npm install path for OpenCode.
- Publish `@slowdini/superslow-opencode` or `@slowdini/superslow-core` to npm.
- Restructure the non-OpenCode harnesses beyond making their workspace packages
  private.
- Resolve Gemini CLI extension packaging or installation issues as part of this
  change. Gemini should be evaluated separately as its own harness-specific
  follow-up.
- Change skill behavior, naming, or bootstrap content.

## Current State

The repo currently has two competing distribution models for OpenCode:

- `packages/opencode/INSTALL.md` documents npm installation of
  `@slowdini/superslow-opencode@1.0.0`.
- `docs/README.opencode.md` and older planning docs document the upstream-style
  Git install flow from the repository.

The current packaging layout does not cleanly support the Git install flow:

- The repo root `package.json` is a private Bun workspace definition named
  `superslow`, not the OpenCode package surface.
- `packages/opencode/package.json` is the published package today, but the user
  wants OpenCode to install from the repo root Git URL instead.
- Git-installing the monorepo root currently pulls in workspace-only dependency
  declarations such as `workspace:*`, which fail outside the workspace.
- `npm pack --dry-run` from the repo root currently includes a large portion of
  the monorepo, far more than the OpenCode plugin needs at runtime.
- The root `prepare` script is developer-only Husky setup. Git dependency
  installation should not run contributor hook bootstrap as part of end-user
  install.

## Design

### 1. Distribution Surface

The repository root becomes the only Git-installable package surface for the
OpenCode harness.

- The supported OpenCode install string is:

  ```json
  {
    "plugin": ["@slowdini/superslow-opencode@git+https://github.com/slowdini/superslow.git"]
  }
  ```

- The pinned-tag variant is:

  ```json
  {
    "plugin": ["@slowdini/superslow-opencode@git+https://github.com/slowdini/superslow.git#v1.0.0"]
  }
  ```

- No npm package publication remains in the release model.
- The root package stays `private: true`; privacy prevents publishing, not Git
  installation.

### 2. Package Layout

The source layout stays where it is today.

- `packages/opencode/plugins/superpowers.js` remains the plugin entrypoint.
- `packages/core/skills/` remains the source of truth for bundled skills.
- `packages/opencode/INSTALL.md` remains the OpenCode-specific install guide.

The packaging contract changes:

- Root `package.json` becomes the install contract OpenCode resolves from the
  Git URL.
- The root package adds the plugin-facing fields OpenCode and Bun need:
  - plugin package metadata for the Git install surface
  - `exports["./server"]` pointing at `./packages/opencode/plugins/superpowers.js`
  - a tight `files` allowlist for runtime content only
- Do not repurpose the root `main` field for OpenCode. Other harnesses do not
  use it today, and OpenCode's plugin loader can resolve a dedicated server
  export without taking over the repo's default Node entrypoint.
- All workspace packages under `packages/*` become `private: true`.
- `packages/opencode/package.json` stops being a user-facing distribution
  contract.
- `packages/core/package.json` also becomes private. It remains an internal
  workspace boundary for tests and development, not a published dependency.
- Remove all internal `workspace:*` dependency and peer dependency links from
  `packages/*/package.json` files so a Git-installed repo checkout does not hit
  unsupported workspace resolution during dependency preparation.

### 3. Runtime Layout And Path Resolution

The Git-installed runtime should work by loading files from the installed repo
checkout, not by resolving separately installed workspace packages.

The stable runtime layout is:

```text
<installed package root>/
├── package.json
└── packages/
    ├── core/
    │   └── skills/
    │       └── using-superpowers/SKILL.md
    └── opencode/
        └── plugins/superpowers.js
```

`packages/opencode/plugins/superpowers.js` should resolve its runtime assets
relative to its own file location.

- Repo root resolves from the plugin file path.
- Bundled skills resolve from `packages/core/skills` under that root.
- `using-superpowers/SKILL.md` resolves from that same repo-relative skills
  directory.

This replaces the current package-resolution-first approach that tries:

- `import("@slowdini/superslow-core/paths")`
- `workspaceRequire("@slowdini/superslow-core/paths")`
- local fallback paths

The new model should use repo-relative paths as the primary and normal runtime
path in both environments:

- local workspace development
- Git-installed OpenCode package from the repo root

This removes the runtime dependency on separately installed
`@slowdini/superslow-core` package exports.

### 4. Root Package Contents

The root install artifact must be intentionally small.

Root `package.json` should use a `files` allowlist that includes only the
OpenCode runtime surface and standard package metadata.

Required contents:

- `package.json`
- `README.md`
- `LICENSE`
- `packages/opencode/plugins/`
- `packages/core/skills/`

Excluded contents:

- tests
- plans and specs
- other harness packages
- contributor-only scripts that are irrelevant to OpenCode runtime
- release metadata that does not affect plugin execution

This keeps Git installation focused on the OpenCode runtime contract instead of
shipping the whole monorepo as an accidental artifact.

### 5. Developer Scripts And Workspace Metadata

Because the repo root becomes an installable Git package, it must not run
developer-only lifecycle work during dependency installation.

- Remove the root `publish:all` script.
- Remove npm publish instructions from release docs and plans.
- Remove or replace the root `prepare` script so Git dependency installation
  does not run Husky setup.
- Keep lockstep versioning and `scripts/bump-version.js`.
- Keep Bun workspace support for local development and test filtering.

The development workflow remains a monorepo workflow. The user-facing install
workflow becomes a Git package workflow.

### 6. Documentation Changes

OpenCode docs should describe only the Git install flow.

Update `packages/opencode/INSTALL.md` to cover:

- direct install from GitHub
- pinned tag install
- removal of npm-based installation guidance
- removal of npm-based upgrade guidance
- optional note about old symlink/manual clone cleanup, if still useful

Update `docs/README.opencode.md` to match the same model.

Update project-level docs that describe distribution and release behavior so
they no longer claim that OpenCode or core ship through npm.

Add a short note in the spec and implementation work that Gemini remains a
separate harness validation task. Gemini installs from a repository URL and its
extension tooling expects a root-level extension manifest, so any Gemini fixes
should be handled independently rather than folded into the OpenCode packaging
change.

### 7. Release Process

Release no longer includes npm publication.

The release flow becomes:

1. Bump versions.
2. Update changelog and release notes.
3. Tag the repo.
4. Create the GitHub release.
5. Run the OpenCode Git-install smoke tests.

All `packages/*` remain private internal packages. The Git tag is the release
boundary users install from.

## Verification

Verification should target the actual Git install contract, not the retired npm
package model.

### Packaging Verification

- `npm pack --dry-run` at the repo root shows only the intended runtime files.
- The packed artifact contains the plugin entry and bundled skills.
- The packed artifact does not contain tests, plans, or unrelated harness code.

### Runtime Verification

- The OpenCode plugin loads correctly from the root Git-installed package.
- Bootstrap injection still works.
- Skills are discovered correctly from `packages/core/skills`.
- No runtime path depends on `@slowdini/superslow-core` package exports.
- OpenCode detects the package via `exports["./server"]` without relying on a
  root `main` entry.
- Local workspace execution still works from the repo checkout.

### Install Verification

- OpenCode installs successfully with the exact user-facing spec:

  ```json
  {
    "plugin": ["@slowdini/superslow-opencode@git+https://github.com/slowdini/superslow.git"]
  }
  ```

- The pinned tag form installs successfully.
- Restarting OpenCode after adding the plugin picks up the installed package
  and exposes the bundled skills.

### Test Updates

OpenCode tests should stop assuming a manually assembled package layout.

- Update the OpenCode test setup to exercise the root install artifact shape,
  not only copied source files.
- Keep plugin loading, bootstrap caching, priority, and native skill loading
  coverage.
- Add a regression assertion that the runtime no longer imports
  `@slowdini/superslow-core/paths`.

## Risks And Mitigations

### Risk: Root artifact still ships too much

Mitigation: verify with `npm pack --dry-run` and keep the root `files`
allowlist intentionally narrow.

### Risk: Bun/OpenCode Git resolution behaves differently from local package
tests or expects different package metadata than local alias tests

Mitigation: smoke test the exact OpenCode config entry against a real GitHub
URL and against a pinned tag before considering the migration complete. If Bun
or OpenCode requires the installed repo root package name to match
`@slowdini/superslow-opencode`, rename the root package during implementation;
otherwise keep the existing root package identity and rely on the Git alias in
the plugin spec.

### Risk: OpenCode packaging work leaks into Gemini assumptions

Mitigation: keep Gemini out of scope for this change. Track Gemini validation
and any required root-manifest/layout adjustments as a separate harness task.

### Risk: Git dependency install runs contributor lifecycle scripts

Mitigation: remove or neutralize root lifecycle scripts that are only useful
for maintainers, especially Husky bootstrap.

## Decision

Superslow will stop publishing OpenCode and core to npm. OpenCode will install
from the repository Git URL, with the repo root acting as a minimal,
Git-installable package surface for the existing `packages/opencode` plugin and
`packages/core` skills.
