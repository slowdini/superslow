# Superslow v1.0.0 Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v1.0.0 of Superslow — a rebranded fork of obra/superpowers at v5.1.0 — installable across all five supported harnesses (Claude Code, Codex, Cursor, OpenCode, Gemini) from `slowdini/superslow` self-hosted distribution.

**Architecture:** Monorepo with one core package + five harness packages. Three harnesses (Claude, Codex, Cursor) get manifest-file moves to match their tool's expected layout; the other two stay structurally as-is. All content (URLs, author, package names, version, displayName) is retargeted from upstream to Superslow. Only `core` and `opencode` are published to npm; the other four ship via git-based marketplace/extension install paths. Release is manual for v1.

**Tech Stack:** Bun workspaces, npm publish for two packages, JSON manifests per harness, Markdown docs, sh install helper for Cursor.

**Spec reference:** `docs/superpowers/specs/2026-05-14-superslow-v1-release-design.md`.

---

## Phase 0: Branch setup

### Task 0: Create release branch

**Files:** none (git operation only).

- [ ] **Step 1: Confirm working tree is clean**

```bash
git status
```

Expected: `nothing to commit, working tree clean` on `main`.

- [ ] **Step 2: Create and switch to the release branch**

```bash
git checkout -b release/v1.0.0
```

Expected: `Switched to a new branch 'release/v1.0.0'`.

---

## Phase 1: Repo restructure

### Task 1: Create root `marketplace.json` for Claude and delete the old one

**Files:**
- Create: `marketplace.json`
- Delete: `packages/claude/marketplace.json`

- [ ] **Step 1: Create root `marketplace.json`**

Write the following to `/Users/maximilianhaarhaus/Projects/superpowers/marketplace.json`:

```json
{
  "name": "superslow",
  "description": "Superslow plugin marketplace for Claude Code",
  "owner": {
    "name": "Max Haarhaus",
    "email": "samiamorwas@gmail.com"
  },
  "plugins": [
    {
      "name": "superpowers",
      "description": "Superslow gives your agent superpowers: planning, TDD, debugging, and collaboration workflows.",
      "version": "5.1.0",
      "source": "./packages/claude/",
      "author": {
        "name": "Max Haarhaus",
        "email": "samiamorwas@gmail.com"
      }
    }
  ]
}
```

Note: The version stays at `5.1.0` for now. Phase 4 bumps every manifest to `1.0.0` in one shot via `scripts/bump-version.js`.

- [ ] **Step 2: Delete the old marketplace file**

```bash
rm packages/claude/marketplace.json
```

- [ ] **Step 3: Verify JSON validity**

```bash
node -e "JSON.parse(require('fs').readFileSync('marketplace.json'))" && echo OK
```

Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add marketplace.json packages/claude/marketplace.json
git commit -m "chore(claude): move marketplace.json to repo root"
```

### Task 2: Create `.agents/plugins/marketplace.json` for Codex

**Files:**
- Create: `.agents/plugins/marketplace.json`

- [ ] **Step 1: Make the directory**

```bash
mkdir -p .agents/plugins
```

- [ ] **Step 2: Write the file**

Write the following to `.agents/plugins/marketplace.json`:

```json
{
  "name": "superslow",
  "interface": {
    "displayName": "Superslow"
  },
  "plugins": [
    {
      "name": "superpowers",
      "version": "5.1.0",
      "source": {
        "source": "local",
        "path": "../../packages/codex"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
```

- [ ] **Step 3: Verify JSON validity**

```bash
node -e "JSON.parse(require('fs').readFileSync('.agents/plugins/marketplace.json'))" && echo OK
```

Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add .agents/plugins/marketplace.json
git commit -m "chore(codex): add marketplace.json at .agents/plugins/"
```

### Task 3: Move Cursor `plugin.json` into `.cursor-plugin/`

**Files:**
- Move: `packages/cursor/plugin.json` → `packages/cursor/.cursor-plugin/plugin.json`

- [ ] **Step 1: Make the destination directory**

```bash
mkdir -p packages/cursor/.cursor-plugin
```

- [ ] **Step 2: Move the file using git mv to preserve history**

```bash
git mv packages/cursor/plugin.json packages/cursor/.cursor-plugin/plugin.json
```

- [ ] **Step 3: Verify the file is at the new location**

```bash
test -f packages/cursor/.cursor-plugin/plugin.json && echo OK
```

Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(cursor): move plugin.json into .cursor-plugin/ per Cursor convention"
```

### Task 4: Create Cursor `install.sh` helper

**Files:**
- Create: `packages/cursor/install.sh`

- [ ] **Step 1: Write the install script**

Write the following to `packages/cursor/install.sh`:

```sh
#!/usr/bin/env sh
# Superslow installer for Cursor.
# Clones (or reuses) the Superslow repo and symlinks the Cursor plugin into
# Cursor's local plugin directory.

set -e

REPO_DIR="${SUPERSLOW_DIR:-$HOME/.local/share/superslow}"
mkdir -p "$(dirname "$REPO_DIR")"

if [ -d "$REPO_DIR/.git" ]; then
  echo "Updating existing Superslow checkout at $REPO_DIR..."
  git -C "$REPO_DIR" pull --ff-only
else
  echo "Cloning Superslow into $REPO_DIR..."
  git clone https://github.com/slowdini/superslow "$REPO_DIR"
fi

mkdir -p "$HOME/.cursor/plugins/local"
ln -sfn "$REPO_DIR/packages/cursor" "$HOME/.cursor/plugins/local/superpowers"

echo
echo "Superslow installed for Cursor at:"
echo "  $HOME/.cursor/plugins/local/superpowers -> $REPO_DIR/packages/cursor"
echo
echo "Restart Cursor to load the plugin."
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x packages/cursor/install.sh
```

- [ ] **Step 3: Verify the script is syntactically valid**

```bash
sh -n packages/cursor/install.sh && echo OK
```

Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add packages/cursor/install.sh
git commit -m "feat(cursor): add install.sh helper for local plugin symlink"
```

### Task 5: Rename `RELEASE-NOTES.md` to `UPSTREAM-RELEASE-NOTES.md` and add archive header

**Files:**
- Rename: `RELEASE-NOTES.md` → `UPSTREAM-RELEASE-NOTES.md`
- Modify: `UPSTREAM-RELEASE-NOTES.md` (add header)

- [ ] **Step 1: Rename the file using git mv**

```bash
git mv RELEASE-NOTES.md UPSTREAM-RELEASE-NOTES.md
```

- [ ] **Step 2: Prepend an archive header**

Open `UPSTREAM-RELEASE-NOTES.md`. The first line currently reads:

```
# Superpowers Release Notes
```

Replace that single line with:

```markdown
# Upstream (obra/superpowers) Release Notes — Archive

> Historical release notes from [obra/superpowers](https://github.com/obra/superpowers)
> at v5.1.0 and earlier. These notes describe the upstream project from which
> Superslow was forked. Superslow's own release notes live in
> [`CHANGELOG.md`](./CHANGELOG.md).
```

- [ ] **Step 3: Verify the header is in place**

```bash
head -7 UPSTREAM-RELEASE-NOTES.md
```

Expected: shows the new archive header above.

- [ ] **Step 4: Commit**

```bash
git add UPSTREAM-RELEASE-NOTES.md RELEASE-NOTES.md
git commit -m "docs: archive upstream RELEASE-NOTES.md as UPSTREAM-RELEASE-NOTES.md"
```

### Task 6: Update `scripts/bump-version.js` for restructured manifests and marketplace files

**Files:**
- Modify: `scripts/bump-version.js`

The script needs two changes: (a) the file list, and (b) the logic. The current logic blindly sets `content.version = version` at the top level, which is wrong for `marketplace.json` files — those put `version` on `plugins[]` entries, not at the root. Without this fix, marketplace plugin entries silently drift to a stale version after every bump.

- [ ] **Step 1: Replace the entire script contents**

Replace `scripts/bump-version.js` with:

```javascript
import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error("Usage: node bump-version.js <version>");
  process.exit(1);
}

const files = [
  "package.json",
  "packages/core/package.json",
  "packages/claude/package.json",
  "packages/codex/package.json",
  "packages/cursor/package.json",
  "packages/opencode/package.json",
  "packages/gemini/package.json",
  "packages/claude/plugin.json",
  "packages/codex/plugin.json",
  "packages/cursor/.cursor-plugin/plugin.json",
  "packages/gemini/extension.json",
  "marketplace.json",
  ".agents/plugins/marketplace.json",
];

for (const file of files) {
  const content = JSON.parse(readFileSync(file, "utf8"));
  let updated = false;

  if (content.version !== undefined) {
    content.version = version;
    updated = true;
  }

  if (Array.isArray(content.plugins)) {
    for (const plugin of content.plugins) {
      if (plugin.version !== undefined) {
        plugin.version = version;
        updated = true;
      }
    }
  }

  if (updated) {
    writeFileSync(file, `${JSON.stringify(content, null, 2)}\n`);
    console.log(`Bumped ${file}`);
  } else {
    console.log(`Skipped ${file} (no version field)`);
  }
}
```

The behavior change: only mutate version fields that already exist. This avoids creating stray top-level `version` fields in marketplace files (which schema-wise belong on plugin entries) and correctly bumps the plugin entries inside marketplace files.

- [ ] **Step 2: Verify the script runs cleanly with a no-op dry version**

Run a dry version that re-writes everything to its current version (`5.1.0`):

```bash
node scripts/bump-version.js 5.1.0
```

Expected output: 13 lines. Each one should be `Bumped <file>` (every file now has at least one version field — top-level for package.json/plugin.json/extension.json, or `plugins[0].version` for both marketplace files since Tasks 1 and 2 created them with that field).

- [ ] **Step 3: Verify there are no content diffs from the dry run**

```bash
git diff --stat
```

Expected: empty (or shows only whitespace/newline changes on files the script reformatted to match its own output style — review and accept if so).

- [ ] **Step 4: Commit**

```bash
git add scripts/bump-version.js
git commit -m "chore: update bump-version.js for new manifest paths and marketplace plugin version handling"
```

---

## Phase 2: Manifest content updates

> All package.json/plugin.json/extension.json/marketplace.json content updates happen in this phase. **Version stays at `5.1.0` throughout Phase 2** — Phase 4 bumps every file to `1.0.0` in one shot via the script.

### Task 7: Rename npm packages to `@slowdini/superslow-*` and set privacy flags

**Files:**
- Modify: `packages/core/package.json`
- Modify: `packages/claude/package.json`
- Modify: `packages/codex/package.json`
- Modify: `packages/cursor/package.json`
- Modify: `packages/opencode/package.json`
- Modify: `packages/gemini/package.json`

- [ ] **Step 1: Update `packages/core/package.json`**

Replace its full contents with:

```json
{
  "name": "@slowdini/superslow-core",
  "version": "5.1.0",
  "description": "Core skills library for Superslow",
  "author": {
    "name": "Max Haarhaus",
    "email": "samiamorwas@gmail.com"
  },
  "homepage": "https://github.com/slowdini/superslow",
  "repository": "https://github.com/slowdini/superslow",
  "license": "MIT",
  "files": [
    "skills/",
    "assets/"
  ],
  "exports": {
    "./skills/*": "./skills/*",
    "./assets/*": "./assets/*"
  }
}
```

- [ ] **Step 2: Update `packages/claude/package.json`**

Replace with:

```json
{
  "name": "@slowdini/superslow-claude",
  "version": "5.1.0",
  "description": "Superslow integration for Claude Code",
  "private": true,
  "peerDependencies": {
    "@slowdini/superslow-core": "workspace:*"
  }
}
```

- [ ] **Step 3: Update `packages/codex/package.json`**

Replace with:

```json
{
  "name": "@slowdini/superslow-codex",
  "version": "5.1.0",
  "description": "Superslow integration for OpenAI Codex",
  "private": true,
  "peerDependencies": {
    "@slowdini/superslow-core": "workspace:*"
  }
}
```

- [ ] **Step 4: Update `packages/cursor/package.json`**

Replace with:

```json
{
  "name": "@slowdini/superslow-cursor",
  "version": "5.1.0",
  "description": "Superslow integration for Cursor",
  "private": true,
  "peerDependencies": {
    "@slowdini/superslow-core": "workspace:*"
  }
}
```

- [ ] **Step 5: Update `packages/opencode/package.json`** (also moves core from peerDependencies to dependencies)

Replace with:

```json
{
  "name": "@slowdini/superslow-opencode",
  "version": "5.1.0",
  "description": "Superslow integration for OpenCode",
  "type": "module",
  "main": "plugins/superpowers.js",
  "dependencies": {
    "@opencode-ai/plugin": "1.14.29",
    "@slowdini/superslow-core": "workspace:*"
  }
}
```

- [ ] **Step 6: Update `packages/gemini/package.json`**

Replace with:

```json
{
  "name": "@slowdini/superslow-gemini",
  "version": "5.1.0",
  "description": "Superslow integration for Gemini CLI",
  "private": true,
  "peerDependencies": {
    "@slowdini/superslow-core": "workspace:*"
  }
}
```

- [ ] **Step 7: Run `bun install` to reconcile workspace metadata**

```bash
bun install
```

Expected: completes without error. Lockfile may update — that's fine.

- [ ] **Step 8: Verify workspace resolution still works**

```bash
bun pm ls 2>&1 | head -20
```

Expected: lists all six `@slowdini/superslow-*` packages (`-claude`, `-codex`, `-core`, `-cursor`, `-gemini`, `-opencode`).

- [ ] **Step 9: Commit**

```bash
git add packages/*/package.json bun.lock
git commit -m "chore: rename npm packages to @slowdini/superslow-*, mark git-installed packages private"
```

### Task 8: Update root `package.json`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update name and description**

The current root `package.json` has `"name": "superpowers"`. Replace its full contents with:

```json
{
  "name": "superslow",
  "private": true,
  "version": "5.1.0",
  "description": "Superslow — a fork of obra/superpowers, rebranded as its own product",
  "type": "module",
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "test": "bun run --filter '*' test",
    "test:core": "bun run --filter core test",
    "test:claude": "bun run --filter claude test",
    "test:codex": "bun run --filter codex test",
    "test:cursor": "bun run --filter cursor test",
    "test:opencode": "bun run --filter opencode test",
    "test:gemini": "bun run --filter gemini test",
    "version": "node scripts/bump-version.js",
    "publish:all": "bun run --filter '*' publish --access public",
    "check": "biome check --write . && markdownlint-cli2 --fix '**/*.md' '!**/node_modules/**' '!**/.worktrees/**'",
    "prepare": "husky"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.4.15",
    "husky": "^9.1.7",
    "lint-staged": "^17.0.4",
    "markdownlint-cli2": "^0.22.1"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: rename root package to superslow"
```

### Task 9: Update Claude `plugin.json`

**Files:**
- Modify: `packages/claude/plugin.json`

- [ ] **Step 1: Replace its contents**

```json
{
  "name": "superpowers",
  "description": "Superslow gives your agent superpowers: TDD, debugging, collaboration patterns, and proven techniques",
  "version": "5.1.0",
  "author": {
    "name": "Max Haarhaus",
    "email": "samiamorwas@gmail.com"
  },
  "homepage": "https://github.com/slowdini/superslow",
  "repository": "https://github.com/slowdini/superslow",
  "license": "MIT",
  "keywords": [
    "skills",
    "tdd",
    "debugging",
    "collaboration",
    "best-practices",
    "workflows"
  ],
  "skills": "../core/skills/",
  "agents": "./agents/",
  "commands": "./commands/",
  "hooks": "./hooks/hooks.json"
}
```

Note: `name` stays `"superpowers"` so the skill prefix remains `superpowers:`. This is intentional and documented in the spec.

- [ ] **Step 2: Verify JSON validity**

```bash
node -e "JSON.parse(require('fs').readFileSync('packages/claude/plugin.json'))" && echo OK
```

Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add packages/claude/plugin.json
git commit -m "chore(claude): retarget plugin.json metadata to Superslow"
```

### Task 10: Update Codex `plugin.json`

**Files:**
- Modify: `packages/codex/plugin.json`

- [ ] **Step 1: Replace its contents**

```json
{
  "name": "superpowers",
  "version": "5.1.0",
  "description": "Superslow gives your agent superpowers: planning, TDD, debugging, and collaboration workflows.",
  "author": {
    "name": "Max Haarhaus",
    "email": "samiamorwas@gmail.com",
    "url": "https://github.com/slowdini"
  },
  "homepage": "https://github.com/slowdini/superslow",
  "repository": "https://github.com/slowdini/superslow",
  "license": "MIT",
  "keywords": [
    "brainstorming",
    "subagent-driven-development",
    "skills",
    "planning",
    "tdd",
    "debugging",
    "code-review",
    "workflow"
  ],
  "skills": "../core/skills/",
  "interface": {
    "displayName": "Superslow",
    "shortDescription": "Planning, TDD, debugging, and delivery workflows for coding agents",
    "longDescription": "Use Superslow to guide agent work through brainstorming, implementation planning, test-driven development, systematic debugging, parallel execution, code review, and finish-the-branch workflows.",
    "developerName": "Max Haarhaus",
    "category": "Coding",
    "capabilities": ["Interactive", "Read", "Write"],
    "defaultPrompt": [
      "I've got an idea for something I'd like to build.",
      "Let's add a feature to this project."
    ],
    "websiteURL": "https://github.com/slowdini/superslow",
    "privacyPolicyURL": "https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement",
    "termsOfServiceURL": "https://docs.github.com/en/site-policy/github-terms/github-terms-of-service",
    "brandColor": "#F59E0B",
    "composerIcon": "../core/assets/superpowers-small.svg",
    "logo": "../core/assets/app-icon.png",
    "screenshots": []
  }
}
```

TODO marker for follow-up: the brand color and logo are still upstream's amber + `superpowers-small.svg`. Replace post-v1 once new art exists.

- [ ] **Step 2: Verify JSON validity**

```bash
node -e "JSON.parse(require('fs').readFileSync('packages/codex/plugin.json'))" && echo OK
```

Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add packages/codex/plugin.json
git commit -m "chore(codex): retarget plugin.json metadata to Superslow"
```

### Task 11: Update Cursor `.cursor-plugin/plugin.json` and Gemini `extension.json`

**Files:**
- Modify: `packages/cursor/.cursor-plugin/plugin.json`
- Modify: `packages/gemini/extension.json`

- [ ] **Step 1: Replace `packages/cursor/.cursor-plugin/plugin.json`**

```json
{
  "name": "superpowers",
  "displayName": "Superslow",
  "description": "Superslow gives your agent superpowers: TDD, debugging, collaboration patterns, and proven techniques",
  "version": "5.1.0",
  "author": {
    "name": "Max Haarhaus",
    "email": "samiamorwas@gmail.com"
  },
  "homepage": "https://github.com/slowdini/superslow",
  "repository": "https://github.com/slowdini/superslow",
  "license": "MIT",
  "keywords": [
    "skills",
    "tdd",
    "debugging",
    "collaboration",
    "best-practices",
    "workflows"
  ],
  "skills": "../../core/skills/",
  "agents": "../agents/",
  "commands": "../commands/",
  "hooks": "../hooks/hooks-cursor.json"
}
```

Note: paths now use `../../core/skills/` and `../agents/` etc. because the manifest moved one directory deeper (`.cursor-plugin/`). Verify these resolve during the Phase 5 smoke test; adjust if Cursor demands different path semantics.

- [ ] **Step 2: Replace `packages/gemini/extension.json`**

```json
{
  "name": "superpowers",
  "description": "Superslow gives your agent superpowers: TDD, debugging, collaboration patterns, and proven techniques",
  "version": "5.1.0",
  "contextFileName": "GEMINI.md"
}
```

(Gemini extension manifest is minimal — most metadata lives in the package's GEMINI.md content.)

- [ ] **Step 3: Verify both files**

```bash
node -e "JSON.parse(require('fs').readFileSync('packages/cursor/.cursor-plugin/plugin.json'))" && echo "cursor OK"
node -e "JSON.parse(require('fs').readFileSync('packages/gemini/extension.json'))" && echo "gemini OK"
```

Expected: `cursor OK` then `gemini OK`.

- [ ] **Step 4: Commit**

```bash
git add packages/cursor/.cursor-plugin/plugin.json packages/gemini/extension.json
git commit -m "chore(cursor,gemini): retarget manifests to Superslow"
```

---

## Phase 3: Documentation rewrites

### Task 12: Replace `LICENSE`

**Files:**
- Modify: `LICENSE`

- [ ] **Step 1: Replace contents**

```
MIT License

Copyright (c) 2025 Jesse Vincent
Copyright (c) 2026 Max Haarhaus (Superslow fork)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Commit**

```bash
git add LICENSE
git commit -m "chore: add Superslow fork copyright to LICENSE"
```

### Task 13: Archive upstream `CLAUDE.md` and write a Superslow contributor guide

**Files:**
- Create: `docs/superpowers/upstream-CLAUDE.md` (copy of current `CLAUDE.md`)
- Modify: `CLAUDE.md` (full rewrite)
- `AGENTS.md` already symlinks to `CLAUDE.md`; no change needed there

- [ ] **Step 1: Archive the current CLAUDE.md**

```bash
cp CLAUDE.md docs/superpowers/upstream-CLAUDE.md
```

- [ ] **Step 2: Verify the archive copy exists**

```bash
test -f docs/superpowers/upstream-CLAUDE.md && head -1 docs/superpowers/upstream-CLAUDE.md
```

Expected: `# Superpowers — Contributor Guidelines`.

- [ ] **Step 3: Replace `CLAUDE.md` with the new contributor guide**

```markdown
# Superslow — Contributor Guidelines

Superslow is a fork of [obra/superpowers](https://github.com/obra/superpowers)
that ships as a distinct product with its own release cadence. Upstream's
contributor guidance is preserved at
[`docs/superpowers/upstream-CLAUDE.md`](docs/superpowers/upstream-CLAUDE.md)
for historical reference.

## What lives here

This monorepo ships Superslow across five harnesses:

- `packages/core/` — Skills, assets, and cross-cutting tests (`@slowdini/superslow-core`)
- `packages/claude/` — Claude Code plugin
- `packages/codex/` — OpenAI Codex plugin
- `packages/cursor/` — Cursor plugin
- `packages/opencode/` — OpenCode plugin (`@slowdini/superslow-opencode`)
- `packages/gemini/` — Gemini CLI extension

The skills themselves keep upstream's `superpowers:` prefix and vocabulary
(e.g. `superpowers:brainstorming`, `using-superpowers`). The *product* is
Superslow; the *skills* are still called superpowers.

## Pull Request Requirements

- One problem per PR. Bundled unrelated changes will be split or sent back.
- Read existing skills before proposing changes to skill content. Skill
  prose has been tuned over many iterations upstream and downstream; changes
  to behavior-shaping content (Red Flags tables, rationalization lists,
  "human partner" language) need evidence the change is an improvement.
- Test your change on at least one harness and note which one in the PR
  description. If your change touches harness-specific infrastructure,
  test that harness.

## Skill Changes

If you modify skill content:

- Use `superpowers:writing-skills` to develop and test changes.
- Run adversarial pressure testing across multiple sessions, not just the
  happy path.
- Show before/after eval results in the PR description.

## Local development

```bash
bun install
bun test
bun run check
```

`scripts/bump-version.js <version>` updates every manifest in lockstep.
See `docs/superpowers/specs/` for design history.
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/superpowers/upstream-CLAUDE.md
git commit -m "docs: replace CLAUDE.md with Superslow contributor guide, archive upstream version"
```

### Task 14: Rewrite `README.md`

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace its contents in full**

```markdown
# Superslow

Superslow gives your agent superpowers. It's a complete software development
methodology for coding agents — a set of composable skills plus a bootstrap
that ensures the agent reaches for them at the right moments.

## About this fork

Superslow is a fork of [obra/superpowers](https://github.com/obra/superpowers)
at v5.1.0. The skill content and vocabulary (the `superpowers:` skill
prefix, the `using-superpowers` bootstrap) are preserved verbatim — the
*product* is Superslow, the *skills* are still called superpowers.

Upstream's full release history is archived at
[`UPSTREAM-RELEASE-NOTES.md`](./UPSTREAM-RELEASE-NOTES.md). Superslow's own
release notes live in [`CHANGELOG.md`](./CHANGELOG.md).

## Quickstart

Give your agent Superslow: [Claude Code](#claude-code) · [Codex CLI](#codex-cli) · [Cursor](#cursor) · [OpenCode](#opencode) · [Gemini CLI](#gemini-cli).

## How it works

From the moment you fire up your coding agent, Superslow steps in before
code gets written. It teases out a spec through conversation, presents it
in digestible chunks, then writes an implementation plan clear enough for
a junior engineer to follow. It enforces red/green TDD, YAGNI, and DRY,
and dispatches subagents per task with two-stage review. Skills trigger
automatically — you don't have to invoke them manually.

## Installation

Installation differs by harness. If you use more than one, install
Superslow separately for each.

### Claude Code

```
/plugin marketplace add slowdini/superslow
/plugin install superpowers@superslow
```

### Codex CLI

```bash
codex plugin marketplace add slowdini/superslow
```

Then install the `superpowers` plugin from the `superslow` marketplace
through Codex's plugin interface.

### Cursor

Cursor has no native git-install path. The Superslow installer clones the
repo (or reuses an existing checkout) and symlinks the plugin into Cursor's
local plugin directory.

```bash
curl -fsSL https://raw.githubusercontent.com/slowdini/superslow/main/packages/cursor/install.sh | sh
```

Review the script before running if you prefer:
<https://github.com/slowdini/superslow/blob/main/packages/cursor/install.sh>

Restart Cursor after install.

### OpenCode

Tell OpenCode:

```
Fetch and follow instructions from https://raw.githubusercontent.com/slowdini/superslow/refs/heads/main/packages/opencode/INSTALL.md
```

Detailed docs: [`packages/opencode/INSTALL.md`](packages/opencode/INSTALL.md).

### Gemini CLI

```bash
gemini extensions install https://github.com/slowdini/superslow
```

To update:

```bash
gemini extensions update superpowers
```

## The Basic Workflow

1. **brainstorming** — refines rough ideas through questions, explores
   alternatives, presents the design in sections for validation.
2. **using-git-worktrees** — creates an isolated workspace on a new branch
   after design approval.
3. **writing-plans** — breaks the work into bite-sized tasks with exact
   file paths and complete code.
4. **subagent-driven-development** — dispatches a fresh subagent per task
   with two-stage review (spec compliance, then code quality).
5. **test-driven-development** — enforces RED-GREEN-REFACTOR.
6. **requesting-code-review** — reviews against the plan, reports issues
   by severity; critical issues block progress.
7. **finishing-a-development-branch** — verifies tests, presents options
   (merge, PR, keep, discard), cleans up the worktree.

The agent checks for relevant skills before any task. These are mandatory
workflows, not suggestions.

## What's inside

**Testing** — `test-driven-development`

**Debugging** — `systematic-debugging`, `verification-before-completion`

**Collaboration** — `brainstorming`, `writing-plans`,
`dispatching-parallel-agents`, `requesting-code-review`,
`receiving-code-review`, `using-git-worktrees`,
`finishing-a-development-branch`, `subagent-driven-development`

**Meta** — `writing-skills`, `using-superpowers`

## Philosophy

- Test-Driven Development — write tests first, always
- Systematic over ad-hoc — process over guessing
- Complexity reduction — simplicity as a primary goal
- Evidence over claims — verify before declaring success

## Repository structure

Bun workspaces monorepo:

- `packages/core/` — Skills, assets, cross-cutting tests
- `packages/claude/` — Claude Code plugin
- `packages/codex/` — OpenAI Codex plugin
- `packages/cursor/` — Cursor plugin
- `packages/opencode/` — OpenCode plugin
- `packages/gemini/` — Gemini CLI extension

## Contributing

See [`CLAUDE.md`](./CLAUDE.md) for contributor guidelines. Issues live at
<https://github.com/slowdini/superslow/issues>.

## Updating

| Harness | Update command |
|---|---|
| Claude Code | `/plugin marketplace update superslow` |
| Codex CLI | `codex plugin marketplace upgrade superslow` |
| Cursor | Re-run `install.sh` (it pulls latest into the cloned repo) |
| OpenCode | Re-run the INSTALL.md flow |
| Gemini CLI | `gemini extensions update superpowers` |

## License

MIT — see [`LICENSE`](./LICENSE).
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README for Superslow identity and trimmed harness list"
```

### Task 15: Update `packages/opencode/INSTALL.md`

**Files:**
- Modify: `packages/opencode/INSTALL.md`

- [ ] **Step 1: Replace its contents in full**

```markdown
# Installing Superslow for OpenCode

## Prerequisites

- [OpenCode.ai](https://opencode.ai) installed

## Installation

Add Superslow to the `plugin` array in your `opencode.json` (global or project-level):

```json
{
  "plugin": ["@slowdini/superslow-opencode@git+https://github.com/slowdini/superslow.git"]
}
```

Restart OpenCode. The plugin installs through OpenCode's plugin manager and
registers all skills.

Verify by asking: "Tell me about your superpowers"

OpenCode uses its own plugin install. If you also use Claude Code, Codex, or
another harness, install Superslow separately for each one.

## Migrating from the old symlink-based install

If you previously installed superpowers/superslow using `git clone` and symlinks, remove the old setup:

```bash
# Remove old symlinks
rm -f ~/.config/opencode/plugins/superpowers.js
rm -rf ~/.config/opencode/skills/superpowers

# Optionally remove the cloned repo
rm -rf ~/.config/opencode/superpowers ~/.config/opencode/superslow

# Remove skills.paths from opencode.json if you added one
```

Then follow the installation steps above.

## Usage

Use OpenCode's native `skill` tool:

```
use skill tool to list skills
use skill tool to load superpowers/brainstorming
```

## Updating

OpenCode installs Superslow through a git-backed package spec. Some OpenCode
and Bun versions pin that resolved git dependency in a lockfile or cache, so a
restart may not pick up the newest Superslow commit. If updates do not appear,
clear OpenCode's package cache or reinstall the plugin.

To pin a specific version:

```json
{
  "plugin": ["@slowdini/superslow-opencode@git+https://github.com/slowdini/superslow.git#v1.0.0"]
}
```

## Troubleshooting

### Plugin not loading

1. Check logs: `opencode run --print-logs "hello" 2>&1 | grep -i superpowers`
2. Verify the plugin line in your `opencode.json`
3. Make sure you're running a recent version of OpenCode

### Windows install issues

Some Windows OpenCode builds have upstream installer issues with git-backed
plugin specs, including cache paths for `git+https` URLs and Bun not finding
`git.exe` even when it works in a normal terminal. If OpenCode cannot install
the plugin, try installing with system npm and pointing OpenCode at the local
package:

```powershell
npm install @slowdini/superslow-opencode@git+https://github.com/slowdini/superslow.git --prefix "$HOME\.config\opencode"
```

Then use the installed package path in `opencode.json`:

```json
{
  "plugin": ["~/.config/opencode/node_modules/@slowdini/superslow-opencode"]
}
```

### Skills not found

1. Use `skill` tool to list what's discovered
2. Check that the plugin is loading (see above)

### Tool mapping

When skills reference Claude Code tools:
- `TodoWrite` → `todowrite`
- `Task` with subagents → `@mention` syntax
- `Skill` tool → OpenCode's native `skill` tool
- File operations → your native tools

## Getting Help

- Report issues: https://github.com/slowdini/superslow/issues
- Full documentation: https://github.com/slowdini/superslow/blob/main/docs/README.opencode.md
```

- [ ] **Step 2: Commit**

```bash
git add packages/opencode/INSTALL.md
git commit -m "docs(opencode): retarget INSTALL.md to slowdini/superslow"
```

### Task 16: Create `CHANGELOG.md`

**Files:**
- Create: `CHANGELOG.md`

- [ ] **Step 1: Write the file**

```markdown
# Changelog

All notable changes to Superslow are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-05-14

First release of Superslow. Forked from
[obra/superpowers](https://github.com/obra/superpowers) at v5.1.0
(commit `f2cbfbe`) and rebranded as a product with its own release cadence.

### Added

- Self-hosted Claude marketplace (`marketplace.json` at repo root)
- Self-hosted Codex marketplace (`.agents/plugins/marketplace.json`)
- Cursor install helper at `packages/cursor/install.sh`

### Changed

- npm packages renamed `@slowdini/superpowers-*` → `@slowdini/superslow-*`
- OpenCode core dependency moved from `peerDependencies` to `dependencies`
  so users get core via standard npm resolution
- All upstream-specific URLs, attribution, and marketplace names retargeted
  to `slowdini/superslow`
- README rewritten for Superslow identity and trimmed to the five harnesses
  Superslow ships (Claude, Codex, Cursor, OpenCode, Gemini)
- Cursor manifest moved to `packages/cursor/.cursor-plugin/plugin.json`

### Removed

- Sponsorship and Community sections from README
- Upstream-specific contributor guidance from `CLAUDE.md` (preserved at
  `docs/superpowers/upstream-CLAUDE.md`)
- Factory Droid and GitHub Copilot CLI install sections from README

### Notes

- Skill prefix and vocabulary (`superpowers:`, `using-superpowers`,
  in-skill prose) preserved verbatim from upstream by design.
- Upstream's full release history is archived at
  [`UPSTREAM-RELEASE-NOTES.md`](./UPSTREAM-RELEASE-NOTES.md).
- Branding artwork (logo, brand color) is inherited from upstream as a
  placeholder for v1; replacement art is a post-v1 task.
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: add CHANGELOG.md with v1.0.0 entry"
```

---

## Phase 4: Pre-release verification

### Task 17: Run the pre-release validation suite

**Files:** none (read-only checks).

- [ ] **Step 1: Reconcile workspace**

```bash
bun install
```

Expected: completes without error.

- [ ] **Step 2: Run all tests**

```bash
bun test
```

Expected: all tests pass. If failures appear, fix them on this branch before continuing.

- [ ] **Step 3: Run lint and formatting**

```bash
bun run check
```

Expected: completes without error. If files are modified by Biome/markdownlint, review the diff and commit those changes (`git add -p && git commit -m "chore: apply biome/markdownlint fixes"`).

- [ ] **Step 4: Validate every JSON manifest**

```bash
for f in \
  package.json \
  packages/core/package.json \
  packages/claude/package.json \
  packages/codex/package.json \
  packages/cursor/package.json \
  packages/opencode/package.json \
  packages/gemini/package.json \
  packages/claude/plugin.json \
  packages/codex/plugin.json \
  packages/cursor/.cursor-plugin/plugin.json \
  packages/gemini/extension.json \
  marketplace.json \
  .agents/plugins/marketplace.json; do
  node -e "JSON.parse(require('fs').readFileSync('$f'))" && echo "$f OK" || echo "$f FAILED"
done
```

Expected: every line ends in `OK`. If any line ends in `FAILED`, fix the JSON in that file.

- [ ] **Step 5: Grep for leftover upstream identity strings**

```bash
grep -rE "obra/superpowers|@slowdini/superpowers-|superpowers-dev|jesse@fsck\.com|Jesse Vincent" \
  --include="*.md" --include="*.json" --include="*.js" --include="*.sh" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.worktrees \
  . | grep -v "^./UPSTREAM-RELEASE-NOTES.md:" | grep -v "^./docs/superpowers/upstream-CLAUDE.md:" || echo "CLEAN"
```

Expected: `CLEAN`. The two exclusions (`UPSTREAM-RELEASE-NOTES.md` and `docs/superpowers/upstream-CLAUDE.md`) are legitimate archives of upstream content and may contain those strings.

If any other matches appear, retarget them and recommit before continuing.

- [ ] **Step 6: Confirm no uncommitted changes remain**

```bash
git status
```

Expected: `nothing to commit, working tree clean`.

### Task 18: Bump version to 1.0.0 and verify

**Files:** every file in `scripts/bump-version.js`'s `files` array.

- [ ] **Step 1: Run the version bump**

```bash
node scripts/bump-version.js 1.0.0
```

Expected: 13 `Bumped <file>` lines, one per file in the array.

- [ ] **Step 2: Verify every targeted file now has version 1.0.0**

```bash
for f in \
  package.json \
  packages/core/package.json \
  packages/claude/package.json \
  packages/codex/package.json \
  packages/cursor/package.json \
  packages/opencode/package.json \
  packages/gemini/package.json \
  packages/claude/plugin.json \
  packages/codex/plugin.json \
  packages/cursor/.cursor-plugin/plugin.json \
  packages/gemini/extension.json \
  marketplace.json \
  .agents/plugins/marketplace.json; do
  v=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$f')).version || JSON.parse(require('fs').readFileSync('$f')).plugins?.[0]?.version || 'missing')")
  echo "$f: $v"
done
```

Expected: every line shows `1.0.0` (note: `.agents/plugins/marketplace.json` and root `marketplace.json` have plugins[0].version which the script also updates; the marketplace file itself doesn't have a top-level version field, so its line may say `1.0.0` from the plugin entry — that's correct).

If any line shows a version other than `1.0.0`, investigate which file the script missed and add it to the array.

- [ ] **Step 3: Reconcile workspace one more time**

```bash
bun install
```

- [ ] **Step 4: Re-run tests after the version bump**

```bash
bun test
```

Expected: pass.

- [ ] **Step 5: Commit the version bump**

```bash
git add -A
git commit -m "chore: bump version to 1.0.0"
```

---

## Phase 5: Release execution

### Task 19: Open the release PR and merge to `main`

**Files:** none (git/GitHub operation).

- [ ] **Step 1: Push the release branch**

```bash
git push -u origin release/v1.0.0
```

- [ ] **Step 2: Open a PR**

```bash
gh pr create --title "Release v1.0.0 — Superslow rebrand" --body "$(cat <<'EOF'
## Summary

First release of Superslow, the slowdini fork of obra/superpowers. Rebrands the product from "Superpowers" to "Superslow" while preserving the skill prefix and vocabulary verbatim.

See [`docs/superpowers/specs/2026-05-14-superslow-v1-release-design.md`](./docs/superpowers/specs/2026-05-14-superslow-v1-release-design.md) for the design spec and `CHANGELOG.md` for the v1.0.0 release notes.

## Test plan

- [ ] `bun test` passes locally
- [ ] `bun run check` passes locally
- [ ] All JSON manifests validate
- [ ] Grep for upstream identity strings returns CLEAN
- [ ] Post-merge: smoke test in each of the five harnesses (Claude, Codex, Cursor, OpenCode, Gemini) with the "Let's make a react todo list" acceptance prompt

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Wait for review (human), then merge to `main`**

Human reviews the diff. When approved:

```bash
gh pr merge --squash --delete-branch
```

(Or `--merge` / `--rebase` per your team's preference.)

- [ ] **Step 4: Pull main locally**

```bash
git checkout main
git pull
```

Expected: HEAD is now at the release commit.

### Task 20: Tag the release and push the tag

**Files:** none (git operation).

- [ ] **Step 1: Create the annotated tag**

```bash
git tag -a v1.0.0 -m "Superslow 1.0.0 — first release"
```

- [ ] **Step 2: Push the tag**

```bash
git push origin v1.0.0
```

Expected: `v1.0.0` appears in `git ls-remote --tags origin`.

### Task 21: Publish `core` and `opencode` to npm

**Files:** none (npm publish).

- [ ] **Step 1: Verify npm login is active on the `@slowdini` org**

```bash
npm whoami
npm access list packages @slowdini 2>&1 | head -5
```

Expected: your npm username is shown; you have publish rights on `@slowdini`. If `npm whoami` errors, run `npm login` first.

- [ ] **Step 2: Publish all publishable packages**

```bash
bun run publish:all
```

Expected: `@slowdini/superslow-core@1.0.0` and `@slowdini/superslow-opencode@1.0.0` are published. The other four packages are marked `"private": true` and are skipped.

- [ ] **Step 3: Verify the publish**

```bash
npm view @slowdini/superslow-core version
npm view @slowdini/superslow-opencode version
```

Expected: both report `1.0.0`.

### Task 22: Create the GitHub release

**Files:** none (GitHub operation).

- [ ] **Step 1: Extract the v1.0.0 changelog section to a temporary file**

```bash
awk '/^## \[1\.0\.0\]/,/^## \[/{if (/^## \[/ && !/^## \[1\.0\.0\]/) exit; print}' CHANGELOG.md > /tmp/superslow-release-notes.md
cat /tmp/superslow-release-notes.md
```

Expected: only the `## [1.0.0]` section through (but not including) the next `## [` header.

- [ ] **Step 2: Create the GitHub release**

```bash
gh release create v1.0.0 \
  --title "Superslow 1.0.0" \
  --notes-file /tmp/superslow-release-notes.md
```

Expected: returns a URL to the new release page.

- [ ] **Step 3: Clean up the temp file**

```bash
rm /tmp/superslow-release-notes.md
```

### Task 23: Per-harness smoke tests

**Files:** none (out-of-band testing).

For each harness, in a clean session / fresh environment, run the install command from the README and then send:

> Let's make a react todo list

**Pass criteria:** the agent invokes `superpowers:brainstorming` before writing code or describing implementation. This proves the `using-superpowers` bootstrap loads at session start.

- [ ] **Step 1: Smoke-test Claude Code**

```
/plugin marketplace add slowdini/superslow
/plugin install superpowers@superslow
```

Restart Claude Code. Send the acceptance prompt. Confirm `brainstorming` auto-triggers.

- [ ] **Step 2: Smoke-test Codex**

```bash
codex plugin marketplace add slowdini/superslow
```

Install the `superpowers` plugin from the `superslow` marketplace through Codex's plugin UI. Restart Codex. Send the acceptance prompt. Confirm `brainstorming` auto-triggers.

- [ ] **Step 3: Smoke-test Cursor**

```bash
curl -fsSL https://raw.githubusercontent.com/slowdini/superslow/main/packages/cursor/install.sh | sh
```

Verify the symlink:

```bash
test -L "$HOME/.cursor/plugins/local/superpowers" && \
test -f "$HOME/.cursor/plugins/local/superpowers/.cursor-plugin/plugin.json" && \
echo "symlink resolves"
```

Expected: `symlink resolves`.

Restart Cursor. Send the acceptance prompt. Confirm `brainstorming` auto-triggers.

- [ ] **Step 4: Smoke-test OpenCode**

In a fresh project dir, add to `opencode.json`:

```json
{
  "plugin": ["@slowdini/superslow-opencode@git+https://github.com/slowdini/superslow.git"]
}
```

Restart OpenCode. Send the acceptance prompt. Confirm `brainstorming` auto-triggers.

- [ ] **Step 5: Smoke-test Gemini CLI**

```bash
gemini extensions install https://github.com/slowdini/superslow
```

Start a fresh Gemini session. Send the acceptance prompt. Confirm `brainstorming` auto-triggers.

- [ ] **Step 6: Record results**

For each harness, record pass/fail in a working notes file (or as an issue on `slowdini/superslow`). If any harness fails, prepare a `1.0.1` patch:

1. Branch from `main`: `git checkout -b release/v1.0.1`
2. Fix the issue, commit
3. `node scripts/bump-version.js 1.0.1`
4. Add a `## [1.0.1] — <date>` entry to `CHANGELOG.md`
5. Repeat from Phase 4, Task 17 onward

The user has signaled comfort with several incremental bugfix releases if needed.

---

## Done

When all five harnesses pass the smoke test, v1.0.0 of Superslow is officially released. Open follow-up issues for:

- New branding artwork (logo, brand color) to replace upstream placeholders in `packages/codex/plugin.json` and `packages/core/assets/`
- Submission to upstream-curated marketplaces (Anthropic's `claude-plugins-official`, OpenAI's `plugins`, Cursor's marketplace) — deferred from v1
- GitHub Actions workflow to automate the tag → publish → release flow — deferred from v1
