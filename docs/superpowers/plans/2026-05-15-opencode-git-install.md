# OpenCode Git Install Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the OpenCode harness to install directly from the Superslow GitHub repo root, remove the npm-publish path for OpenCode/core, and verify the repo-root package surface works without pulling Gemini into scope.

**Architecture:** Keep `packages/opencode/plugins/superpowers.js` and `packages/core/skills/` as the source of truth, but expose them through the repo root package using `exports["./server"]` and a narrow `files` allowlist. Replace package-based core resolution with plugin-relative paths, then update the OpenCode shell tests to unpack the repo-root artifact so they exercise the real Git-install shape.

**Tech Stack:** Bun workspaces, Node.js ESM, OpenCode plugin hooks, shell integration tests, Markdown docs

---

## File Map

- `package.json` — repo-root Git install surface for OpenCode. Keep the root package name `superslow`, add `exports["./server"]`, narrow `files`, remove `publish:all`, remove `prepare`.
- `packages/core/package.json` — private internal workspace metadata for shared skills.
- `packages/opencode/package.json` — private internal workspace metadata for local OpenCode development only.
- `packages/claude/package.json`, `packages/codex/package.json`, `packages/cursor/package.json`, `packages/gemini/package.json` — private internal workspace metadata with no `workspace:*` links.
- `packages/opencode/plugins/superpowers.js` — plugin runtime. Resolve bundled skills from `../../core/skills` relative to the plugin file and cache bootstrap content.
- `packages/opencode/tests/opencode/setup.sh` — unpack a repo-root `npm pack` artifact into an isolated fake install rooted at `~/.config/opencode/superslow`.
- `packages/opencode/tests/opencode/test-core-paths.mjs` and `packages/opencode/tests/opencode/test-core-paths.sh` — assert root package metadata and packed file list.
- `packages/opencode/tests/opencode/test-plugin-loading.sh` — assert the unpacked root artifact layout and plugin symlink registration.
- `packages/opencode/tests/opencode/test-bootstrap-caching.mjs` and `packages/opencode/tests/opencode/test-bootstrap-caching.sh` — assert repo-relative skill registration, bootstrap caching, and missing-file / missing-directory behavior.
- `packages/opencode/INSTALL.md` — user-facing OpenCode install instructions. Git package spec only, plus local-checkout fallback.
- `docs/README.opencode.md` — long-form OpenCode docs aligned with Superslow branding, the current `experimental.chat.messages.transform` hook, and the Git install flow.
- `docs/superpowers/specs/2026-05-14-superslow-v1-release-design.md` — update release assumptions so the doc no longer claims `core` and `opencode` publish to npm.
- `docs/superpowers/plans/2026-05-14-superslow-v1-release.md` — remove npm publication as a release task and keep Gemini explicitly separate.

### Task 1: Expose The Repo Root As The OpenCode Package Surface

**Files:**
- Modify: `package.json`
- Modify: `packages/core/package.json`
- Modify: `packages/opencode/package.json`
- Modify: `packages/claude/package.json`
- Modify: `packages/codex/package.json`
- Modify: `packages/cursor/package.json`
- Modify: `packages/gemini/package.json`
- Test: `packages/opencode/tests/opencode/test-core-paths.mjs`
- Test: `packages/opencode/tests/opencode/test-core-paths.sh`

- [ ] **Step 1: Rewrite the packaging test to assert the repo-root package shape**

Replace `packages/opencode/tests/opencode/test-core-paths.mjs` with:

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const [, , repoRoot, packJsonPath] = process.argv;

if (!repoRoot || !packJsonPath) {
  console.error('Usage: node test-core-paths.mjs REPO_ROOT PACK_JSON_PATH');
  process.exit(2);
}

const rootPackageJson = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
);
const packResult = JSON.parse(fs.readFileSync(packJsonPath, 'utf8'))[0];
const packedFiles = new Set(packResult.files.map((file) => file.path));

assert.equal(rootPackageJson.name, 'superslow', 'root package name should stay superslow');
assert.equal(rootPackageJson.private, true, 'root package should stay private');
assert.equal(
  rootPackageJson.exports?.['./server'],
  './packages/opencode/plugins/superpowers.js',
  'root package should expose an OpenCode server export',
);
assert.equal(
  Object.hasOwn(rootPackageJson.scripts ?? {}, 'publish:all'),
  false,
  'root package should no longer advertise publish:all',
);
assert.equal(
  Object.hasOwn(rootPackageJson.scripts ?? {}, 'prepare'),
  false,
  'root package should not run contributor-only prepare hooks during git install',
);

assert.equal(packedFiles.has('package.json'), true, 'packed root package.json should be present');
assert.equal(packedFiles.has('README.md'), true, 'packed README should be present');
assert.equal(packedFiles.has('LICENSE'), true, 'packed LICENSE should be present');
assert.equal(
  packedFiles.has('packages/opencode/plugins/superpowers.js'),
  true,
  'packed plugin entry should be present',
);
assert.equal(
  packedFiles.has('packages/core/skills/using-superpowers/SKILL.md'),
  true,
  'packed using-superpowers skill should be present',
);
assert.equal(
  packedFiles.has('packages/opencode/package.json'),
  false,
  'internal OpenCode workspace metadata should not ship in the root artifact',
);
assert.equal(
  packedFiles.has('packages/core/package.json'),
  false,
  'internal core workspace metadata should not ship in the root artifact',
);
assert.equal(
  packedFiles.has('packages/gemini/extension.json'),
  false,
  'Gemini files should stay out of the OpenCode root package artifact',
);
assert.equal(
  packedFiles.has('packages/opencode/tests/opencode/test-plugin-loading.sh'),
  false,
  'OpenCode tests should not ship in the root artifact',
);
```

Replace `packages/opencode/tests/opencode/test-core-paths.sh` with:

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
PACK_OUTPUT_FILE="$(mktemp)"

cleanup() {
    rm -f "$PACK_OUTPUT_FILE"
}

trap cleanup EXIT

echo "=== Test: Root OpenCode Package Shape ==="

echo "Test 1: Checking repo-root package metadata and packed file list..."
npm pack --dry-run --json "$REPO_ROOT" > "$PACK_OUTPUT_FILE"
node "$SCRIPT_DIR/test-core-paths.mjs" "$REPO_ROOT" "$PACK_OUTPUT_FILE"
echo "  [PASS] Repo root exposes an OpenCode server export and ships only runtime files"

echo ""
echo "=== Root OpenCode package shape test passed ==="
```

- [ ] **Step 2: Run the packaging test and verify it fails on the current repo**

Run:

```bash
bash packages/opencode/tests/opencode/test-core-paths.sh
```

Expected: FAIL because the current root `package.json` has no `exports["./server"]`, still includes `publish:all`/`prepare`, and `npm pack --dry-run` still includes much more than the OpenCode runtime surface.

- [ ] **Step 3: Update the repo-root package metadata**

Replace `package.json` with:

```json
{
  "name": "superslow",
  "private": true,
  "version": "1.0.0",
  "description": "Superslow — a fork of obra/superpowers, rebranded as its own product",
  "type": "module",
  "workspaces": [
    "packages/*"
  ],
  "exports": {
    "./server": "./packages/opencode/plugins/superpowers.js"
  },
  "files": [
    "README.md",
    "LICENSE",
    "packages/opencode/plugins/",
    "packages/core/skills/"
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
    "check": "biome check --write . && markdownlint-cli2 --fix '**/*.md' '!**/node_modules/**' '!**/.worktrees/**'"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.4.15",
    "husky": "^9.1.7",
    "lint-staged": "^17.0.4",
    "markdownlint-cli2": "^0.22.1"
  }
}
```

- [ ] **Step 4: Mark `core` and `opencode` as private internal workspace packages**

Replace `packages/core/package.json` with:

```json
{
  "name": "@slowdini/superslow-core",
  "version": "1.0.0",
  "description": "Core skills library for Superslow",
  "private": true,
  "author": {
    "name": "Max Haarhaus",
    "email": "samiamorwas@gmail.com"
  },
  "homepage": "https://github.com/slowdini/superslow",
  "repository": "https://github.com/slowdini/superslow",
  "license": "MIT",
  "files": [
    "skills/",
    "assets/",
    "paths.js"
  ],
  "exports": {
    "./skills/*": "./skills/*",
    "./assets/*": "./assets/*",
    "./paths": "./paths.js"
  }
}
```

Replace `packages/opencode/package.json` with:

```json
{
  "name": "@slowdini/superslow-opencode",
  "version": "1.0.0",
  "description": "Superslow integration for OpenCode",
  "private": true,
  "type": "module",
  "main": "plugins/superpowers.js",
  "dependencies": {
    "@opencode-ai/plugin": "1.14.29"
  }
}
```

- [ ] **Step 5: Remove all `workspace:*` links from the remaining harness package manifests**

Replace `packages/claude/package.json` with:

```json
{
  "name": "@slowdini/superslow-claude",
  "version": "1.0.0",
  "description": "Superslow integration for Claude Code",
  "private": true
}
```

Replace `packages/codex/package.json` with:

```json
{
  "name": "@slowdini/superslow-codex",
  "version": "1.0.0",
  "description": "Superslow integration for OpenAI Codex",
  "private": true
}
```

Replace `packages/cursor/package.json` with:

```json
{
  "name": "@slowdini/superslow-cursor",
  "version": "1.0.0",
  "description": "Superslow integration for Cursor",
  "private": true
}
```

Replace `packages/gemini/package.json` with:

```json
{
  "name": "@slowdini/superslow-gemini",
  "version": "1.0.0",
  "description": "Superslow integration for Gemini CLI",
  "private": true
}
```

- [ ] **Step 6: Run the packaging test and verify it passes**

Run:

```bash
bash packages/opencode/tests/opencode/test-core-paths.sh
```

Expected: PASS with `Repo root exposes an OpenCode server export and ships only runtime files`.

- [ ] **Step 7: Commit the package-surface changes**

```bash
git add package.json packages/core/package.json packages/opencode/package.json packages/claude/package.json packages/codex/package.json packages/cursor/package.json packages/gemini/package.json packages/opencode/tests/opencode/test-core-paths.mjs packages/opencode/tests/opencode/test-core-paths.sh
git commit -m "build(opencode): expose git install package surface"
```

### Task 2: Make The OpenCode Test Fixture Use The Packed Root Artifact

**Files:**
- Modify: `packages/opencode/tests/opencode/setup.sh`
- Modify: `packages/opencode/tests/opencode/test-plugin-loading.sh`

- [ ] **Step 1: Tighten the plugin-loading test so it expects the root package layout**

Replace `packages/opencode/tests/opencode/test-plugin-loading.sh` with:

```bash
#!/usr/bin/env bash
# Test: Plugin Loading
# Verifies that the superpowers plugin loads correctly in OpenCode
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Test: Plugin Loading ==="

# Source setup to create isolated environment
source "$SCRIPT_DIR/setup.sh"

# Trap to cleanup on exit
trap cleanup_test_env EXIT

plugin_link="$OPENCODE_CONFIG_DIR/plugins/superpowers.js"

# Test 1: Verify packed root layout exists
echo "Test 1: Checking packed root layout..."
if [ -f "$SUPERPOWERS_PACKAGE_JSON" ]; then
    echo "  [PASS] Packed root package.json exists"
else
    echo "  [FAIL] Packed root package.json not found at $SUPERPOWERS_PACKAGE_JSON"
    exit 1
fi

if [ -d "$SUPERPOWERS_DIR/packages/core/skills" ]; then
    echo "  [PASS] Packed root includes bundled skills"
else
    echo "  [FAIL] Packed root skills directory not found at $SUPERPOWERS_DIR/packages/core/skills"
    exit 1
fi

# Test 2: Verify plugin file exists and is registered
echo "Test 2: Checking plugin registration..."
if [ -L "$plugin_link" ]; then
    echo "  [PASS] Plugin symlink exists"
else
    echo "  [FAIL] Plugin symlink not found at $plugin_link"
    exit 1
fi

if [ -f "$(readlink "$plugin_link")" ]; then
    echo "  [PASS] Plugin symlink target exists"
else
    echo "  [FAIL] Plugin symlink target does not exist"
    exit 1
fi

# Test 3: Verify skills directory is populated
echo "Test 3: Checking skills directory..."
skill_count="$(find "$SUPERPOWERS_SKILLS_DIR" -name "SKILL.md" | wc -l | tr -d ' ')"
if [ "$skill_count" -gt 0 ]; then
    echo "  [PASS] Found $skill_count skills"
else
    echo "  [FAIL] No skills found in $SUPERPOWERS_SKILLS_DIR"
    exit 1
fi

# Test 4: Check using-superpowers skill exists (critical for bootstrap)
echo "Test 4: Checking using-superpowers skill (required for bootstrap)..."
if [ -f "$SUPERPOWERS_SKILLS_DIR/using-superpowers/SKILL.md" ]; then
    echo "  [PASS] using-superpowers skill exists"
else
    echo "  [FAIL] using-superpowers skill not found (required for bootstrap)"
    exit 1
fi

# Test 5: Verify plugin JavaScript syntax
echo "Test 5: Checking plugin JavaScript syntax..."
if node --check "$SUPERPOWERS_PLUGIN_FILE" 2>/dev/null; then
    echo "  [PASS] Plugin JavaScript syntax is valid"
else
    echo "  [FAIL] Plugin has JavaScript syntax errors"
    exit 1
fi

# Test 6: Verify plugin JavaScript does not advertise stale path hints
echo "Test 6: Checking plugin does not advertise stale skills paths..."
if grep -q 'configDir}/skills/superpowers/' "$SUPERPOWERS_PLUGIN_FILE"; then
    echo "  [FAIL] Plugin still references old configDir skills path"
    exit 1
else
    echo "  [PASS] Plugin does not advertise a misleading skills path"
fi

# Test 7: Verify personal test skill was created
echo "Test 7: Checking test fixtures..."
if [ -f "$OPENCODE_CONFIG_DIR/skills/personal-test/SKILL.md" ]; then
    echo "  [PASS] Personal test skill fixture created"
else
    echo "  [FAIL] Personal test skill fixture not found"
    exit 1
fi

echo ""
echo "=== All plugin loading tests passed ==="
```

- [ ] **Step 2: Run the plugin-loading test and verify it fails with the current fixture layout**

Run:

```bash
bash packages/opencode/tests/opencode/test-plugin-loading.sh
```

Expected: FAIL because `setup.sh` currently copies skills into `~/.config/opencode/superpowers/skills` instead of unpacking a root package with `packages/core/skills` and a root `package.json`.

- [ ] **Step 3: Rebuild the fixture setup around the packed repo-root artifact**

Replace `packages/opencode/tests/opencode/setup.sh` with:

```bash
#!/usr/bin/env bash
# Setup script for OpenCode plugin tests
# Creates an isolated test environment using the packed repo-root artifact.
set -euo pipefail

# Get the repository root from this sourced script location.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# Create temp home directory for isolation
export TEST_HOME
TEST_HOME="$(mktemp -d)"
export HOME="$TEST_HOME"
export XDG_CONFIG_HOME="$TEST_HOME/.config"
export OPENCODE_CONFIG_DIR="$TEST_HOME/.config/opencode"

# Packed install layout:
#   $OPENCODE_CONFIG_DIR/superslow/package.json
#   $OPENCODE_CONFIG_DIR/superslow/packages/core/skills/
#   $OPENCODE_CONFIG_DIR/superslow/packages/opencode/plugins/superpowers.js
#   $OPENCODE_CONFIG_DIR/plugins/superpowers.js

SUPERPOWERS_DIR="$OPENCODE_CONFIG_DIR/superslow"
SUPERPOWERS_PACKAGE_JSON="$SUPERPOWERS_DIR/package.json"
SUPERPOWERS_SKILLS_DIR="$SUPERPOWERS_DIR/packages/core/skills"
SUPERPOWERS_PLUGIN_FILE="$SUPERPOWERS_DIR/packages/opencode/plugins/superpowers.js"

PACK_OUTPUT="$(npm pack --json --pack-destination "$TEST_HOME" "$REPO_ROOT")"
PACK_FILE_RELATIVE="$(printf '%s' "$PACK_OUTPUT" | node -e 'const fs = require("node:fs"); const data = JSON.parse(fs.readFileSync(0, "utf8")); process.stdout.write(data[0].filename);')"
PACK_FILE="$TEST_HOME/$PACK_FILE_RELATIVE"
EXTRACT_DIR="$TEST_HOME/extracted-root-package"

mkdir -p "$EXTRACT_DIR"
tar -xzf "$PACK_FILE" -C "$EXTRACT_DIR"
mv "$EXTRACT_DIR/package" "$SUPERPOWERS_DIR"
rm -rf "$EXTRACT_DIR" "$PACK_FILE"

# Register plugin via symlink (what OpenCode actually reads)
mkdir -p "$OPENCODE_CONFIG_DIR/plugins"
ln -sf "$SUPERPOWERS_PLUGIN_FILE" "$OPENCODE_CONFIG_DIR/plugins/superpowers.js"

# Create test skills in different locations for testing
mkdir -p "$OPENCODE_CONFIG_DIR/skills/personal-test"
cat > "$OPENCODE_CONFIG_DIR/skills/personal-test/SKILL.md" <<'EOF'
---
name: personal-test
description: Test personal skill for verification
---
# Personal Test Skill

This is a personal skill used for testing.

PERSONAL_SKILL_MARKER_12345
EOF

mkdir -p "$TEST_HOME/test-project/.opencode/skills/project-test"
cat > "$TEST_HOME/test-project/.opencode/skills/project-test/SKILL.md" <<'EOF'
---
name: project-test
description: Test project skill for verification
---
# Project Test Skill

This is a project skill used for testing.

PROJECT_SKILL_MARKER_67890
EOF

echo "Setup complete: $TEST_HOME"
echo "OPENCODE_CONFIG_DIR:  $OPENCODE_CONFIG_DIR"
echo "Superpowers dir:      $SUPERPOWERS_DIR"
echo "Package manifest:     $SUPERPOWERS_PACKAGE_JSON"
echo "Skills dir:           $SUPERPOWERS_SKILLS_DIR"
echo "Plugin file:          $SUPERPOWERS_PLUGIN_FILE"
echo "Plugin registered at: $OPENCODE_CONFIG_DIR/plugins/superpowers.js"
echo "Test project at:      $TEST_HOME/test-project"

cleanup_test_env() {
    if [ -n "${TEST_HOME:-}" ] && [ -d "$TEST_HOME" ]; then
        rm -rf "$TEST_HOME"
    fi
}

export -f cleanup_test_env
export REPO_ROOT
export SUPERPOWERS_DIR
export SUPERPOWERS_PACKAGE_JSON
export SUPERPOWERS_SKILLS_DIR
export SUPERPOWERS_PLUGIN_FILE
```

- [ ] **Step 4: Run the plugin-loading test and verify it passes with the packed root artifact**

Run:

```bash
bash packages/opencode/tests/opencode/test-plugin-loading.sh
```

Expected: PASS with the new `packed root layout`, `plugin registration`, and `skills directory` checks all succeeding.

- [ ] **Step 5: Commit the fixture-layout changes**

```bash
git add packages/opencode/tests/opencode/setup.sh packages/opencode/tests/opencode/test-plugin-loading.sh
git commit -m "test(opencode): stage fixtures from root package artifact"
```

### Task 3: Switch The OpenCode Plugin To Repo-Relative Skill Resolution

**Files:**
- Modify: `packages/opencode/plugins/superpowers.js`
- Modify: `packages/opencode/tests/opencode/test-bootstrap-caching.sh`
- Modify: `packages/opencode/tests/opencode/test-bootstrap-caching.mjs`

- [ ] **Step 1: Rewrite the bootstrap-caching tests around repo-relative paths**

Replace `packages/opencode/tests/opencode/test-bootstrap-caching.sh` with:

```bash
#!/usr/bin/env bash
# Test: Bootstrap Content Caching
# Verifies the OpenCode transform caches bootstrap content between agent steps.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Test: Bootstrap Content Caching ==="

source "$SCRIPT_DIR/setup.sh"
trap cleanup_test_env EXIT

run_present_check() {
    node "$SCRIPT_DIR/test-bootstrap-caching.mjs" "$SUPERPOWERS_PLUGIN_FILE" present
}

run_missing_file_check() {
    mv "$SUPERPOWERS_SKILLS_DIR/using-superpowers/SKILL.md" "$TEST_HOME/using-superpowers.SKILL.md.bak"
    trap 'mv "$TEST_HOME/using-superpowers.SKILL.md.bak" "$SUPERPOWERS_SKILLS_DIR/using-superpowers/SKILL.md"' RETURN
    node "$SCRIPT_DIR/test-bootstrap-caching.mjs" "$SUPERPOWERS_PLUGIN_FILE" missing-file
}

run_missing_skills_dir_check() {
    mv "$SUPERPOWERS_SKILLS_DIR" "$TEST_HOME/missing-skills-dir"
    trap 'mv "$TEST_HOME/missing-skills-dir" "$SUPERPOWERS_SKILLS_DIR"' RETURN
    node "$SCRIPT_DIR/test-bootstrap-caching.mjs" "$SUPERPOWERS_PLUGIN_FILE" missing-skills-dir
}

echo "Test 1: Caches bootstrap after the first successful transform..."
run_present_check
echo "  [PASS] Bootstrap content is cached while fresh message arrays still receive injection"

echo "Test 2: Caches a missing SKILL.md result..."
run_missing_file_check
echo "  [PASS] Missing bootstrap file is cached and not re-read every transform"

echo "Test 3: Handles a missing bundled skills directory safely..."
run_missing_skills_dir_check
echo "  [PASS] Missing bundled skills directory avoids registration and bootstrap work"

echo ""
echo "=== All bootstrap caching tests passed ==="
```

Replace `packages/opencode/tests/opencode/test-bootstrap-caching.mjs` with:

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [, , pluginPath, scenario] = process.argv;
const validScenarios = new Set(['present', 'missing-file', 'missing-skills-dir']);

if (!pluginPath || !validScenarios.has(scenario)) {
  console.error('Usage: node test-bootstrap-caching.mjs PLUGIN_PATH present|missing-file|missing-skills-dir');
  process.exit(2);
}

const isolatedCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-caching-'));
const expectedSkillsDir = path.resolve(path.dirname(pluginPath), '../../core/skills');
const expectedUsingSuperpowersSkillPath = path.join(
  expectedSkillsDir,
  'using-superpowers',
  'SKILL.md',
);

let existsCount = 0;
let readCount = 0;

const originalExistsSync = fs.existsSync;
const originalReadFileSync = fs.readFileSync;

process.on('exit', () => {
  fs.rmSync(isolatedCwd, { recursive: true, force: true });
});

fs.writeFileSync(
  path.join(isolatedCwd, 'package.json'),
  JSON.stringify({
    name: 'bootstrap-caching-consumer',
    private: true,
  }),
);

process.chdir(isolatedCwd);

fs.existsSync = function (...args) {
  if (normalizePath(args[0]) === normalizePath(expectedUsingSuperpowersSkillPath)) {
    existsCount += 1;
  }
  return originalExistsSync.apply(this, args);
};

fs.readFileSync = function (...args) {
  if (normalizePath(args[0]) === normalizePath(expectedUsingSuperpowersSkillPath)) {
    readCount += 1;
  }
  return originalReadFileSync.apply(this, args);
};

const pluginSource = originalReadFileSync(pluginPath, 'utf8');
assert.equal(
  pluginSource.includes('@slowdini/superslow-core/paths'),
  false,
  'plugin source should not import @slowdini/superslow-core/paths anymore',
);

const mod = await import(pathToFileURL(pluginPath).href);
const plugin = await mod.SuperpowersPlugin({ client: {}, directory: '.' });

const config = {};
await plugin.config(config);

const transform = plugin['experimental.chat.messages.transform'];
const firstOutput = makeOutput(`${scenario} bootstrap first step`);
await transform({}, firstOutput);
const afterFirst = { existsCount, readCount };

const secondOutput = makeOutput(`${scenario} bootstrap second step`);
await transform({}, secondOutput);
const afterSecond = { existsCount, readCount };

const result = {
  scenario,
  registeredSkillsPaths: config.skills?.paths ?? [],
  firstBootstrapParts: countBootstrapParts(firstOutput),
  secondBootstrapParts: countBootstrapParts(secondOutput),
  firstReadCount: afterFirst.readCount,
  secondReadCount: afterSecond.readCount,
  firstExistsCount: afterFirst.existsCount,
  secondExistsCount: afterSecond.existsCount,
};

if (scenario === 'present') {
  assert.deepEqual(result.registeredSkillsPaths, [expectedSkillsDir]);
  assert.equal(result.firstBootstrapParts, 1);
  assert.equal(result.secondBootstrapParts, 1);
  assert.equal(result.firstReadCount, 1);
  assert.equal(result.secondReadCount, result.firstReadCount);
  assert.equal(result.secondExistsCount, result.firstExistsCount);
}

if (scenario === 'missing-file') {
  assert.deepEqual(result.registeredSkillsPaths, [expectedSkillsDir]);
  assert.equal(result.firstBootstrapParts, 0);
  assert.equal(result.secondBootstrapParts, 0);
  assert.equal(result.firstReadCount, 0);
  assert.equal(result.secondReadCount, 0);
  assert.equal(result.firstExistsCount >= 1, true);
  assert.equal(result.secondExistsCount, result.firstExistsCount);
}

if (scenario === 'missing-skills-dir') {
  assert.deepEqual(result.registeredSkillsPaths, []);
  assert.equal(result.firstBootstrapParts, 0);
  assert.equal(result.secondBootstrapParts, 0);
  assert.equal(result.firstReadCount, 0);
  assert.equal(result.secondReadCount, 0);
  assert.equal(result.secondExistsCount, result.firstExistsCount);
}

console.log(JSON.stringify(result, null, 2));

function normalizePath(filePath) {
  return String(filePath).replaceAll('\\', '/');
}

function makeOutput(text) {
  return {
    messages: [
      {
        info: { role: 'user' },
        parts: [{ type: 'text', text }],
      },
    ],
  };
}

function countBootstrapParts(output) {
  return output.messages[0].parts.filter(
    (part) => part.type === 'text' && part.text.includes('EXTREMELY_IMPORTANT'),
  ).length;
}
```

- [ ] **Step 2: Run the bootstrap test and verify it fails before the plugin refactor**

Run:

```bash
bash packages/opencode/tests/opencode/test-bootstrap-caching.sh
```

Expected: FAIL because the current plugin still imports `@slowdini/superslow-core/paths` and still expects package-resolution-based core paths instead of the packed repo-relative layout.

- [ ] **Step 3: Replace the OpenCode plugin runtime with repo-relative path resolution**

Replace `packages/opencode/plugins/superpowers.js` with:

```js
/**
 * Superpowers plugin for OpenCode.ai
 *
 * Injects superpowers bootstrap context via message transform.
 * Auto-registers the bundled skills directory via config hook.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const superpowersSkillsDir = path.resolve(__dirname, '../../core/skills');
const usingSuperpowersSkillPath = path.join(
  superpowersSkillsDir,
  'using-superpowers',
  'SKILL.md',
);

const extractAndStripFrontmatter = (content) => {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, content };

  const frontmatterStr = match[1];
  const body = match[2];
  const frontmatter = {};

  for (const line of frontmatterStr.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line
        .slice(colonIdx + 1)
        .trim()
        .replace(/^["']|["']$/g, '');
      frontmatter[key] = value;
    }
  }

  return { frontmatter, content: body };
};

// undefined = not yet loaded, null = missing bootstrap file
let _bootstrapCache;

export const SuperpowersPlugin = async () => {
  const getBootstrapContent = () => {
    if (_bootstrapCache !== undefined) return _bootstrapCache;

    if (!fs.existsSync(usingSuperpowersSkillPath)) {
      _bootstrapCache = null;
      return null;
    }

    const fullContent = fs.readFileSync(usingSuperpowersSkillPath, 'utf8');
    const { content } = extractAndStripFrontmatter(fullContent);

    const toolMapping = `**Tool Mapping for OpenCode:**
When skills reference tools you don't have, substitute OpenCode equivalents:
- \`TodoWrite\` → \`todowrite\`
- \`Task\` tool with subagents → Use OpenCode's subagent system (@mention)
- \`Skill\` tool → OpenCode's native \`skill\` tool
- \`Read\`, \`Write\`, \`Edit\`, \`Bash\` → Your native tools

Use OpenCode's native \`skill\` tool to list and load skills.`;

    _bootstrapCache = `<EXTREMELY_IMPORTANT>
You have superpowers.

**IMPORTANT: The using-superpowers skill content is included below. It is ALREADY LOADED - you are currently following it. Do NOT use the skill tool to load "using-superpowers" again - that would be redundant.**

${content}

${toolMapping}
</EXTREMELY_IMPORTANT>`;

    return _bootstrapCache;
  };

  return {
    config: async (config) => {
      if (!fs.existsSync(superpowersSkillsDir)) return;

      config.skills = config.skills || {};
      config.skills.paths = config.skills.paths || [];
      if (!config.skills.paths.includes(superpowersSkillsDir)) {
        config.skills.paths.push(superpowersSkillsDir);
      }
    },

    "experimental.chat.messages.transform": async (_input, output) => {
      const bootstrap = getBootstrapContent();
      if (!bootstrap || !output.messages.length) return;

      const firstUser = output.messages.find((message) => message.info.role === 'user');
      if (!firstUser?.parts.length) return;

      if (
        firstUser.parts.some(
          (part) => part.type === 'text' && part.text.includes('EXTREMELY_IMPORTANT'),
        )
      ) {
        return;
      }

      const ref = firstUser.parts[0];
      firstUser.parts.unshift({ ...ref, type: 'text', text: bootstrap });
    },
  };
};
```

- [ ] **Step 4: Run the bootstrap test and the full non-integration OpenCode suite**

Run:

```bash
bash packages/opencode/tests/opencode/test-bootstrap-caching.sh
bash packages/opencode/tests/opencode/run-tests.sh
```

Expected:

- `test-bootstrap-caching.sh` PASS with all three scenarios succeeding.
- `run-tests.sh` PASS with `test-plugin-loading.sh`, `test-bootstrap-caching.sh`, and `test-core-paths.sh` all passing.

- [ ] **Step 5: Commit the runtime-path refactor**

```bash
git add packages/opencode/plugins/superpowers.js packages/opencode/tests/opencode/test-bootstrap-caching.sh packages/opencode/tests/opencode/test-bootstrap-caching.mjs
git commit -m "fix(opencode): resolve bundled skills from repo layout"
```

### Task 4: Rewrite The OpenCode User Docs Around The Git Install Flow

**Files:**
- Modify: `packages/opencode/INSTALL.md`
- Modify: `docs/README.opencode.md`

- [ ] **Step 1: Replace the short OpenCode install guide with Git-only instructions**

Replace `packages/opencode/INSTALL.md` with:

```markdown
# Installing Superslow for OpenCode

## Prerequisites

- [OpenCode.ai](https://opencode.ai) installed
- `git` available in your shell

## Installation

Add Superslow to the `plugin` array in your `opencode.json` (global or project-level):

```json
{
  "plugin": ["@slowdini/superslow-opencode@git+https://github.com/slowdini/superslow.git"]
}
```

Restart OpenCode. The plugin installs from the Superslow GitHub repository and
registers all bundled skills.

Verify by asking: "Tell me about your superpowers"

OpenCode uses its own plugin install. If you also use Claude Code, Codex, or
another harness, install Superslow separately for each one.

## Pinning a release

To pin a specific tag, use the same plugin entry with a ref suffix:

```json
{
  "plugin": ["@slowdini/superslow-opencode@git+https://github.com/slowdini/superslow.git#v1.0.0"]
}
```

## Migrating from the old symlink-based install

If you previously installed superpowers/superslow using `git clone` and
symlinks, remove the old setup:

```bash
rm -f ~/.config/opencode/plugins/superpowers.js
rm -rf ~/.config/opencode/skills/superpowers
rm -rf ~/.config/opencode/superpowers ~/.config/opencode/superslow
```

Then follow the installation steps above.

## Usage

Use OpenCode's native `skill` tool:

```text
use skill tool to list skills
use skill tool to load brainstorming
```

## Updating

OpenCode installs Superslow through a git-backed package spec. To update, point
the plugin entry at a newer tag or restart OpenCode after the tracked ref moves.
Some OpenCode and Bun versions cache git dependencies, so a restart may not
pick up the newest commit immediately. If updates do not appear, clear
OpenCode's package cache or reinstall the plugin.

## Troubleshooting

### Plugin not loading

1. Check logs: `opencode run --print-logs "hello" 2>&1 | grep -i superpowers`
2. Verify the plugin line in your `opencode.json`
3. Make sure you're running a recent version of OpenCode

### Git install issues

If OpenCode cannot install the git spec, clone the repo locally and point
OpenCode at the checkout root instead:

```bash
git clone https://github.com/slowdini/superslow "$HOME/.config/opencode/superslow"
```

Then use the local path in `opencode.json`:

```json
{
  "plugin": ["~/.config/opencode/superslow"]
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

- [ ] **Step 2: Replace the long-form OpenCode README to match the new runtime and install model**

Replace `docs/README.opencode.md` with:

```markdown
# Superslow for OpenCode

Complete guide for using Superslow with [OpenCode.ai](https://opencode.ai).

## Installation

Add Superslow to the `plugin` array in your `opencode.json` (global or
project-level):

```json
{
  "plugin": ["@slowdini/superslow-opencode@git+https://github.com/slowdini/superslow.git"]
}
```

Restart OpenCode. The plugin installs through OpenCode's plugin manager and
registers all bundled skills.

Verify by asking: "Tell me about your superpowers"

OpenCode uses its own plugin install. If you also use Claude Code, Codex, or
another harness, install Superslow separately for each one.

### Migrating from the old symlink-based install

If you previously installed superpowers/superslow using `git clone` and
symlinks, remove the old setup:

```bash
rm -f ~/.config/opencode/plugins/superpowers.js
rm -rf ~/.config/opencode/skills/superpowers
rm -rf ~/.config/opencode/superpowers ~/.config/opencode/superslow
```

Then follow the installation steps above.

## Usage

### Finding skills

Use OpenCode's native `skill` tool to list all available skills:

```text
use skill tool to list skills
```

### Loading a skill

```text
use skill tool to load brainstorming
```

### Personal skills

Create your own skills in `~/.config/opencode/skills/`:

```bash
mkdir -p ~/.config/opencode/skills/my-skill
```

Create `~/.config/opencode/skills/my-skill/SKILL.md`:

```markdown
---
name: my-skill
description: Use when [condition] - [what it does]
---

# My Skill

[Your skill content here]
```

### Project skills

Create project-specific skills in `.opencode/skills/` within your project.

**Skill Priority:** Project skills > Personal skills > Superslow bundled skills

## Updating

OpenCode installs Superslow through a git-backed package spec. Some OpenCode
and Bun versions pin that resolved git dependency in a lockfile or cache, so a
restart may not pick up the newest Superslow commit. If updates do not appear,
clear OpenCode's package cache or reinstall the plugin.

To pin a specific version, use a branch or tag:

```json
{
  "plugin": ["@slowdini/superslow-opencode@git+https://github.com/slowdini/superslow.git#v1.0.0"]
}
```

## How it works

The plugin does two things:

1. **Injects bootstrap context** via the `experimental.chat.messages.transform`
   hook, adding superpowers awareness to the first user message of each agent
   step without duplicating the bootstrap text.
2. **Registers the bundled skills directory** via the `config` hook, so
   OpenCode discovers the shipped skills from the installed repo checkout
   without symlinks or manual `skills.paths` configuration.

### Tool mapping

Skills written for Claude Code are automatically adapted for OpenCode:

- `TodoWrite` → `todowrite`
- `Task` with subagents → OpenCode's `@mention` system
- `Skill` tool → OpenCode's native `skill` tool
- File operations → Native OpenCode tools

## Troubleshooting

### Plugin not loading

1. Check OpenCode logs: `opencode run --print-logs "hello" 2>&1 | grep -i superpowers`
2. Verify the plugin line in your `opencode.json` is correct
3. Make sure you're running a recent version of OpenCode

### Git install issues

Some environments have upstream issues with git-backed plugin specs. If
OpenCode cannot install the plugin from GitHub, clone the repo locally and
point OpenCode at the checkout root:

```bash
git clone https://github.com/slowdini/superslow "$HOME/.config/opencode/superslow"
```

Then use the installed path in `opencode.json`:

```json
{
  "plugin": ["~/.config/opencode/superslow"]
}
```

### Skills not found

1. Use OpenCode's `skill` tool to list available skills
2. Check that the plugin is loading (see above)
3. Each skill needs a `SKILL.md` file with valid YAML frontmatter

### Bootstrap not appearing

1. Check that your OpenCode version supports `experimental.chat.messages.transform`
2. Restart OpenCode after config changes

## Getting Help

- Report issues: https://github.com/slowdini/superslow/issues
- Main documentation: https://github.com/slowdini/superslow
- OpenCode docs: https://opencode.ai/docs/
```

- [ ] **Step 3: Lint the rewritten Markdown files**

Run:

```bash
bunx markdownlint-cli2 "packages/opencode/INSTALL.md" "docs/README.opencode.md"
```

Expected: no output.

- [ ] **Step 4: Commit the OpenCode doc rewrite**

```bash
git add packages/opencode/INSTALL.md docs/README.opencode.md
git commit -m "docs(opencode): switch install docs to git package flow"
```

### Task 5: Remove The Remaining npm-Publish Release Language

**Files:**
- Modify: `docs/superpowers/specs/2026-05-14-superslow-v1-release-design.md`
- Modify: `docs/superpowers/plans/2026-05-14-superslow-v1-release.md`

- [ ] **Step 1: Update the release design doc so it no longer says `core` and `opencode` publish to npm**

In `docs/superpowers/specs/2026-05-14-superslow-v1-release-design.md`, replace the `## Package privacy` section with:

```markdown
## Package privacy

All six workspace packages are private internal metadata. Superslow no longer
publishes `core` or `opencode` to npm; OpenCode installs from the repository
Git URL via the repo root package surface instead. The repo no longer keeps a
`publish:all` script, and the release flow uses Git tags plus GitHub releases.

Gemini remains a separate harness verification task. Do not fold Gemini
extension packaging or root-manifest fixes into the OpenCode package-surface
change.
```

In the same file, replace step 4 of `## Release procedure (manual, v1)` with:

```markdown
4. From `main`:
   - `git tag -a v1.0.0 -m "Superslow 1.0.0"`
   - `git push origin main v1.0.0`
   - `gh release create v1.0.0` with notes drawn from the `CHANGELOG.md`
     v1.0.0 entry.
5. Run the per-harness smoke tests that are in scope. OpenCode uses the repo
   Git install flow. Gemini remains a separate follow-up verification item.
6. If any smoke test fails: fix on a new branch, repeat from step 1 with
   `1.0.1`.
```

- [ ] **Step 2: Update the release plan so npm publication is no longer a task**

In `docs/superpowers/plans/2026-05-14-superslow-v1-release.md`, replace the opening `**Tech Stack:**` line with:

```markdown
**Tech Stack:** Bun workspaces, git-tagged repo releases, JSON manifests per harness, Markdown docs, sh install helper for Cursor.
```

Then replace `### Task 21: Publish \`core\` and \`opencode\` to npm` with:

```markdown
### Task 21: Verify npm publication is no longer part of the release

**Files:** none (verification only).

- [ ] **Step 1: Confirm the repo no longer advertises a publish script**

```bash
node -e 'const fs = require("node:fs"); const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")); if (pkg.scripts["publish:all"]) { process.exit(1); }'
```

Expected: exits successfully with no output.

- [ ] **Step 2: Record that Git tags + GitHub releases are now the release boundary**

No command. Update the surrounding task notes so OpenCode release verification
uses the git-backed plugin install and Gemini remains a separate follow-up.
```

- [ ] **Step 3: Run the final verification commands for the OpenCode package-surface change**

Run:

```bash
bash packages/opencode/tests/opencode/run-tests.sh
npm pack --dry-run --json . > /tmp/opencode-root-pack.json
node -e 'const fs = require("node:fs"); const files = new Set(JSON.parse(fs.readFileSync("/tmp/opencode-root-pack.json", "utf8"))[0].files.map((file) => file.path)); if (!files.has("packages/opencode/plugins/superpowers.js")) process.exit(1); if (!files.has("packages/core/skills/using-superpowers/SKILL.md")) process.exit(1); if (files.has("packages/gemini/extension.json")) process.exit(1); if (files.has("packages/opencode/tests/opencode/test-plugin-loading.sh")) process.exit(1);'
bunx markdownlint-cli2 "packages/opencode/INSTALL.md" "docs/README.opencode.md" "docs/superpowers/specs/2026-05-14-superslow-v1-release-design.md" "docs/superpowers/plans/2026-05-14-superslow-v1-release.md" "docs/superpowers/specs/2026-05-15-opencode-git-install-design.md"
rg "publish:all|npm publish|@slowdini/superslow-opencode@1.0.0" package.json packages/opencode/INSTALL.md docs/README.opencode.md docs/superpowers/specs/2026-05-14-superslow-v1-release-design.md docs/superpowers/plans/2026-05-14-superslow-v1-release.md
```

Expected:

- `run-tests.sh` ends with `STATUS: PASSED`.
- The `node -e` pack check exits successfully.
- `markdownlint-cli2` prints nothing.
- `rg` prints nothing.

- [ ] **Step 4: Commit the release-doc cleanup**

```bash
git add docs/superpowers/specs/2026-05-14-superslow-v1-release-design.md docs/superpowers/plans/2026-05-14-superslow-v1-release.md
git commit -m "docs(release): drop npm publish path for opencode"
```

### Task 6: Smoke-Test The Exact OpenCode Git Install Specs

**Files:**
- Modify: none (verification only)

- [ ] **Step 1: Create an isolated OpenCode config directory for the floating git ref smoke test**

Run:

```bash
TEST_ROOT="$(mktemp -d)"
mkdir -p "$TEST_ROOT/project"
cat > "$TEST_ROOT/project/opencode.json" <<'EOF'
{
  "plugin": ["@slowdini/superslow-opencode@git+https://github.com/slowdini/superslow.git"]
}
EOF
printf '%s\n' "$TEST_ROOT"
```

Expected: prints the temporary directory path.

- [ ] **Step 2: Run OpenCode with the floating git ref and verify the plugin loads**

Run:

```bash
XDG_CONFIG_HOME="$TEST_ROOT/.config" HOME="$TEST_ROOT" opencode run --print-logs --format json "Tell me about your superpowers" 2>&1 | tee "$TEST_ROOT/floating.log"
```

Expected: command exits successfully and the log output includes evidence that the plugin loaded and the bootstrap text or bundled skills were available.

- [ ] **Step 3: Replace the config with the pinned tag form and verify it also loads**

Run:

```bash
cat > "$TEST_ROOT/project/opencode.json" <<'EOF'
{
  "plugin": ["@slowdini/superslow-opencode@git+https://github.com/slowdini/superslow.git#v1.0.0"]
}
EOF
XDG_CONFIG_HOME="$TEST_ROOT/.config" HOME="$TEST_ROOT" opencode run --print-logs --format json "Tell me about your superpowers" 2>&1 | tee "$TEST_ROOT/pinned.log"
```

Expected: command exits successfully and the pinned tag form also loads the plugin correctly.

- [ ] **Step 4: Clean up the smoke-test directory**

Run:

```bash
rm -rf "$TEST_ROOT"
```

Expected: temp directory removed.

- [ ] **Step 5: Leave the smoke test uncommitted unless implementation added new automation files**

Run:

```bash
git status --short
```

Expected: no new smoke-test-only files need to be committed. If implementation
added reusable automation helpers, stage and commit them with the most relevant
task instead of creating a verification-only commit here.
