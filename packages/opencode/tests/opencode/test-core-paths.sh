#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

echo "=== Test: Core Paths Packaging ==="

echo "Test 1: Checking core path exports..."
node "$SCRIPT_DIR/test-core-paths.mjs"
echo "  [PASS] Core path exports resolve correctly"

echo "Test 2: Checking packed dependency metadata..."
PACK_OUTPUT="$(npm pack --json --pack-destination "$REPO_ROOT" "$REPO_ROOT/packages/opencode")"
PACK_FILE_RELATIVE="$(printf '%s' "$PACK_OUTPUT" | node -e 'const fs = require("node:fs"); const data = JSON.parse(fs.readFileSync(0, "utf8")); process.stdout.write(data[0].filename);')"
PACK_FILE="$REPO_ROOT/$PACK_FILE_RELATIVE"
TEMP_DIR="$(mktemp -d)"

cleanup() {
    rm -f "$PACK_FILE"
    rm -rf "$TEMP_DIR"
}

trap cleanup EXIT

tar -xzf "$PACK_FILE" -C "$TEMP_DIR"

if node -e '
const fs = require("node:fs");
const packageJson = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (packageJson.dependencies?.["@slowdini/superslow-core"] === "workspace:*") {
  console.error("packed package.json still contains workspace:* dependency metadata");
  process.exit(1);
}
' "$TEMP_DIR/package/package.json"; then
    echo "  [PASS] Packed package.json exports a publishable core dependency version"
else
    echo "  [FAIL] Packed package.json contains non-publishable core dependency metadata"
    exit 1
fi

echo ""
echo "=== Core paths packaging test passed ==="
