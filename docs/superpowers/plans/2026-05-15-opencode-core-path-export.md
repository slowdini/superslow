# OpenCode Core Path Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the published `@slowdini/superslow-opencode` package installable and able to discover bundled skills through an explicit exported contract from `@slowdini/superslow-core`.

**Architecture:** Add a tiny `@slowdini/superslow-core/paths` module that owns skill path discovery, then update the OpenCode plugin to consume that contract instead of inferring core layout from `package.json` resolution. Lock the fix in with regression tests that cover the published-consumer path and with packaging metadata that clean installers can resolve.

**Tech Stack:** Node.js ESM, npm package exports, OpenCode plugin hooks, shell-based regression tests

**Spec:** `docs/superpowers/specs/2026-05-15-opencode-core-path-export-design.md`

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `packages/core/paths.js` | Stable exported file-system contract for published consumers | Create |
| `packages/core/package.json` | Published core package metadata and exports | Modify |
| `packages/opencode/plugins/superpowers.js` | OpenCode plugin bootstrap + skill path registration | Modify |
| `packages/opencode/package.json` | Published OpenCode dependency metadata | Modify |
| `packages/opencode/tests/opencode/test-core-paths.mjs` | Regression check for exported core paths contract | Create |
| `packages/opencode/tests/opencode/test-core-paths.sh` | Shell wrapper for the new regression test | Create |
| `packages/opencode/tests/opencode/run-tests.sh` | Test suite entrypoint | Modify |
| `packages/opencode/INSTALL.md` | User install instructions | Modify |

---

### Task 1: Add the exported core path contract

**Files:**
- Create: `packages/core/paths.js`
- Modify: `packages/core/package.json`

- [ ] **Step 1: Write the failing regression test for the new export**

Create `packages/opencode/tests/opencode/test-core-paths.mjs` with this content:

```js
import fs from "node:fs";
import path from "node:path";

const { skillsDir, usingSuperpowersSkillPath } = await import(
  "@slowdini/superslow-core/paths"
);

const failures = [];

if (!path.isAbsolute(skillsDir)) {
  failures.push(`expected skillsDir to be absolute, got ${skillsDir}`);
}

if (!path.isAbsolute(usingSuperpowersSkillPath)) {
  failures.push(
    `expected usingSuperpowersSkillPath to be absolute, got ${usingSuperpowersSkillPath}`,
  );
}

if (
  usingSuperpowersSkillPath !==
  path.join(skillsDir, "using-superpowers", "SKILL.md")
) {
  failures.push("expected usingSuperpowersSkillPath to live under skillsDir");
}

if (!fs.existsSync(skillsDir)) {
  failures.push(`expected skillsDir to exist, got ${skillsDir}`);
}

if (!fs.existsSync(usingSuperpowersSkillPath)) {
  failures.push(
    `expected usingSuperpowersSkillPath to exist, got ${usingSuperpowersSkillPath}`,
  );
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`FAIL: ${failure}`);
  }
  process.exit(1);
}

console.log(
  JSON.stringify({ skillsDir, usingSuperpowersSkillPath }, null, 2),
);
```

- [ ] **Step 2: Run the new test to verify it fails**

Run: `node packages/opencode/tests/opencode/test-core-paths.mjs`

Expected: the command fails with a module resolution error for `@slowdini/superslow-core/paths` because that export does not exist yet.

- [ ] **Step 3: Add the minimal core path module**

Create `packages/core/paths.js` with this content:

```js
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = path.dirname(fileURLToPath(import.meta.url));

export const skillsDir = path.join(packageDir, "skills");
export const usingSuperpowersSkillPath = path.join(
  skillsDir,
  "using-superpowers",
  "SKILL.md",
);
```

- [ ] **Step 4: Export the new module from core**

Update `packages/core/package.json` so it becomes:

```json
{
  "name": "@slowdini/superslow-core",
  "version": "1.0.0",
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
    "assets/",
    "paths.js"
  ],
  "exports": {
    "./paths": "./paths.js",
    "./skills/*": "./skills/*",
    "./assets/*": "./assets/*"
  }
}
```

- [ ] **Step 5: Run the new test to verify it passes**

Run: `node packages/opencode/tests/opencode/test-core-paths.mjs`

Expected: PASS with JSON output containing absolute `skillsDir` and `usingSuperpowersSkillPath` values.

- [ ] **Step 6: Commit**

```bash
git add packages/core/paths.js packages/core/package.json packages/opencode/tests/opencode/test-core-paths.mjs
git commit -m "feat(core): export stable skill paths for consumers"
```

---

### Task 2: Switch the OpenCode plugin to the explicit core contract

**Files:**
- Modify: `packages/opencode/plugins/superpowers.js`
- Test: `packages/opencode/tests/opencode/test-bootstrap-caching.mjs`
- Test: `packages/opencode/tests/opencode/test-plugin-loading.sh`

- [ ] **Step 1: Extend the bootstrap caching test to exercise the new import path**

Update `packages/opencode/tests/opencode/test-bootstrap-caching.mjs` as follows:

1. Add this import at the top:

```js
import path from "node:path";
```

2. After `const plugin = await mod.SuperpowersPlugin({ client: {}, directory: '.' });`, add:

```js
const config = {};
await plugin.config(config);
```

3. Add these fields to the `result` object before `const failures = ...`:

```js
  configuredSkillsPaths: config.skills?.paths ?? [],
  configuredUsingSuperpowersSkillPath: path.join(
    config.skills?.paths?.[0] ?? "",
    "using-superpowers",
    "SKILL.md",
  ),
```

4. Add these assertions to `assertPresentBootstrap(result)` before `return failures;`:

```js
  if (result.configuredSkillsPaths.length !== 1) {
    failures.push(
      `expected config hook to register one skills path, got ${result.configuredSkillsPaths.length}`,
    );
  }
  if (!result.configuredUsingSuperpowersSkillPath.endsWith("using-superpowers/SKILL.md")) {
    failures.push("expected config hook path to point at the bundled using-superpowers skill");
  }
```

- [ ] **Step 2: Run the bootstrap caching test to verify it fails**

Run: `bash packages/opencode/tests/opencode/test-bootstrap-caching.sh`

Expected: FAIL after the new assertions are added, because the current plugin still resolves core via the wrong package name and non-exported `package.json` path.

- [ ] **Step 3: Update the plugin to consume `@slowdini/superslow-core/paths`**

Edit `packages/opencode/plugins/superpowers.js` to the following content:

```js
/**
 * Superpowers plugin for OpenCode.ai
 *
 * Injects superpowers bootstrap context via system prompt transform.
 * Auto-registers skills directory via config hook (no symlinks needed).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let superpowersSkillsDir = path.resolve(__dirname, "../../core/skills");
let usingSuperpowersSkillPath = path.join(
  superpowersSkillsDir,
  "using-superpowers",
  "SKILL.md",
);

try {
  const corePaths = await import("@slowdini/superslow-core/paths");
  superpowersSkillsDir = corePaths.skillsDir;
  usingSuperpowersSkillPath = corePaths.usingSuperpowersSkillPath;
} catch {
  // Fall back to the workspace layout when the published core package is not available.
}

// Simple frontmatter extraction (avoid dependency on skills-core for bootstrap)
const extractAndStripFrontmatter = (content) => {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, content };

  const frontmatterStr = match[1];
  const body = match[2];
  const frontmatter = {};

  for (const line of frontmatterStr.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line
        .slice(colonIdx + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      frontmatter[key] = value;
    }
  }

  return { frontmatter, content: body };
};

const normalizePath = (p, homeDir) => {
  if (!p || typeof p !== "string") return null;
  let normalized = p.trim();
  if (!normalized) return null;
  if (normalized.startsWith("~/")) {
    normalized = path.join(homeDir, normalized.slice(2));
  } else if (normalized === "~") {
    normalized = homeDir;
  }
  return path.resolve(normalized);
};

let _bootstrapCache;

export const SuperpowersPlugin = async ({
  client: _client,
  directory: _directory,
}) => {
  const homeDir = os.homedir();
  const envConfigDir = normalizePath(process.env.OPENCODE_CONFIG_DIR, homeDir);
  const _configDir = envConfigDir || path.join(homeDir, ".config/opencode");

  const getBootstrapContent = () => {
    if (_bootstrapCache !== undefined) return _bootstrapCache;

    if (!fs.existsSync(usingSuperpowersSkillPath)) {
      _bootstrapCache = null;
      return null;
    }

    const fullContent = fs.readFileSync(usingSuperpowersSkillPath, "utf8");
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
      config.skills = config.skills || {};
      config.skills.paths = config.skills.paths || [];
      if (!config.skills.paths.includes(superpowersSkillsDir)) {
        config.skills.paths.push(superpowersSkillsDir);
      }
    },

    "experimental.chat.messages.transform": async (_input, output) => {
      const bootstrap = getBootstrapContent();
      if (!bootstrap || !output.messages.length) return;
      const firstUser = output.messages.find((m) => m.info.role === "user");
      if (!firstUser?.parts.length) return;

      if (
        firstUser.parts.some(
          (p) => p.type === "text" && p.text.includes("EXTREMELY_IMPORTANT"),
        )
      ) {
        return;
      }

      const ref = firstUser.parts[0];
      firstUser.parts.unshift({ ...ref, type: "text", text: bootstrap });
    },
  };
};
```

- [ ] **Step 4: Run the updated bootstrap test to verify it passes**

Run: `bash packages/opencode/tests/opencode/test-bootstrap-caching.sh`

Expected: PASS. The output should confirm bootstrap caching still works and the plugin config hook registers a bundled skills path.

- [ ] **Step 5: Run the plugin loading structure test**

Run: `bash packages/opencode/tests/opencode/test-plugin-loading.sh`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/opencode/plugins/superpowers.js packages/opencode/tests/opencode/test-bootstrap-caching.mjs
git commit -m "fix(opencode): use exported core paths contract"
```

---

### Task 3: Fix published dependency metadata and add a clean-package regression check

**Files:**
- Modify: `packages/opencode/package.json`
- Create: `packages/opencode/tests/opencode/test-core-paths.sh`
- Modify: `packages/opencode/tests/opencode/run-tests.sh`

- [ ] **Step 1: Write the failing packaging regression wrapper**

Create `packages/opencode/tests/opencode/test-core-paths.sh` with this content:

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Test: Exported Core Paths ==="

echo "Test 1: Verifying @slowdini/superslow-core/paths can be imported..."
node "$SCRIPT_DIR/test-core-paths.mjs"
echo "  [PASS] Core paths export resolves and points at bundled skills"

echo ""
echo "Test 2: Verifying published opencode package does not use workspace:* for core..."

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

cp "$SCRIPT_DIR/../../package.json" "$tmpdir/package.json"

(cd "$tmpdir" && npm pack --quiet >/dev/null)

package_json_path="$tmpdir/package/package.json"
tar -xzf "$tmpdir"/*.tgz -C "$tmpdir"

if grep -q '"@slowdini/superslow-core": "workspace:\*"' "$package_json_path"; then
    echo "  [FAIL] Published package still contains workspace:* for @slowdini/superslow-core"
    exit 1
fi

echo "  [PASS] Published package uses a real core dependency version"

echo ""
echo "=== Exported core path tests passed ==="
```

- [ ] **Step 2: Register the new test in the suite**

Update `packages/opencode/tests/opencode/run-tests.sh` so the `tests=(...)` array becomes:

```bash
tests=(
    "test-plugin-loading.sh"
    "test-bootstrap-caching.sh"
    "test-core-paths.sh"
)
```

Update the help text so the test list includes:

```bash
  test-core-paths.sh        Verify exported core paths and publish metadata
```

- [ ] **Step 3: Run the new shell test to verify it fails**

Run: `bash packages/opencode/tests/opencode/test-core-paths.sh`

Expected: FAIL because `packages/opencode/package.json` still publishes `"@slowdini/superslow-core": "workspace:*"`.

- [ ] **Step 4: Fix the published core dependency version**

Update `packages/opencode/package.json` to:

```json
{
  "name": "@slowdini/superslow-opencode",
  "version": "1.0.0",
  "description": "Superslow integration for OpenCode",
  "type": "module",
  "main": "plugins/superpowers.js",
  "dependencies": {
    "@opencode-ai/plugin": "1.14.29",
    "@slowdini/superslow-core": "1.0.0"
  }
}
```

- [ ] **Step 5: Run the new shell test to verify it passes**

Run: `bash packages/opencode/tests/opencode/test-core-paths.sh`

Expected: PASS. The packed tarball should no longer contain `workspace:*` for core.

- [ ] **Step 6: Run the full non-integration OpenCode test suite**

Run: `bash packages/opencode/tests/opencode/run-tests.sh`

Expected: PASS with all three non-integration tests green.

- [ ] **Step 7: Commit**

```bash
git add packages/opencode/package.json packages/opencode/tests/opencode/test-core-paths.sh packages/opencode/tests/opencode/run-tests.sh
git commit -m "fix(opencode): publish installable core dependency metadata"
```

---

### Task 4: Update published install instructions

**Files:**
- Modify: `packages/opencode/INSTALL.md`

- [ ] **Step 1: Update the primary install example**

Change the main install snippet near the top of `packages/opencode/INSTALL.md` from:

```json
{
  "plugin": ["@slowdini/superslow-opencode@git+https://github.com/slowdini/superslow.git"]
}
```

To:

```json
{
  "plugin": ["@slowdini/superslow-opencode@1.0.0"]
}
```

- [ ] **Step 2: Update the update/pinning section**

Replace the text in the "Updating" section so it no longer describes the primary install path as git-backed. Update the pinning example to:

```json
{
  "plugin": ["@slowdini/superslow-opencode@1.0.0"]
}
```

Keep the cache/reinstall guidance, but describe it in terms of npm package installation rather than a git dependency.

- [ ] **Step 3: Keep local fallback troubleshooting, but repoint it at npm**

In the Windows/local install fallback section, keep the existing local-package workaround but ensure the install command uses npm registry syntax:

```powershell
npm install @slowdini/superslow-opencode@1.0.0 --prefix "$HOME\.config\opencode"
```

- [ ] **Step 4: Review the document for stale git-backed instructions**

Read `packages/opencode/INSTALL.md` end-to-end and remove or rewrite any remaining wording that presents the git-backed plugin spec as the normal install flow.

- [ ] **Step 5: Commit**

```bash
git add packages/opencode/INSTALL.md
git commit -m "docs(opencode): switch install instructions to npm package"
```

---

### Task 5: Final verification

**Files:**
- Verify only

- [ ] **Step 1: Re-run the focused regression commands**

Run:

```bash
node packages/opencode/tests/opencode/test-core-paths.mjs
bash packages/opencode/tests/opencode/test-bootstrap-caching.sh
bash packages/opencode/tests/opencode/test-plugin-loading.sh
bash packages/opencode/tests/opencode/test-core-paths.sh
bash packages/opencode/tests/opencode/run-tests.sh
```

Expected: all commands pass.

- [ ] **Step 2: Inspect the packed opencode manifest directly**

Run:

```bash
tmpdir="$(mktemp -d)"
cp packages/opencode/package.json "$tmpdir/package.json"
(cd "$tmpdir" && npm pack --quiet >/dev/null)
tar -xzf "$tmpdir"/*.tgz -C "$tmpdir"
node -e "const pkg=require(process.argv[1]); console.log(pkg.dependencies['@slowdini/superslow-core'])" "$tmpdir/package/package.json"
rm -rf "$tmpdir"
```

Expected: prints `1.0.0`.

- [ ] **Step 3: Summarize the user-visible fix**

Prepare a concise handoff note covering:

1. published package installability is fixed
2. OpenCode now reads bundled skills through `@slowdini/superslow-core/paths`
3. install docs now point at the npm package flow
