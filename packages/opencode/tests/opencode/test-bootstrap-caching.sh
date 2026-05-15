#!/usr/bin/env bash
# Test: Bootstrap Content Caching (#1202)
# Verifies the OpenCode transform caches bootstrap content between agent steps.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Test: Bootstrap Content Caching (#1202) ==="

source "$SCRIPT_DIR/setup.sh"
trap cleanup_test_env EXIT

run_present_file_check() {
    node "$SCRIPT_DIR/test-bootstrap-caching.mjs" "$SUPERPOWERS_PLUGIN_FILE" present
}

run_missing_file_check() {
    mv "$SUPERPOWERS_SKILLS_DIR/using-superpowers/SKILL.md" "$TEST_HOME/using-superpowers.SKILL.md.bak"

    node "$SCRIPT_DIR/test-bootstrap-caching.mjs" "$SUPERPOWERS_PLUGIN_FILE" missing
}

run_local_missing_file_check() {
    local fallback_skills_dir
    fallback_skills_dir="$(dirname "$SUPERPOWERS_PLUGIN_FILE")/../../core/skills"
    mkdir -p "$fallback_skills_dir/using-superpowers"
    trap 'rm -rf "$fallback_skills_dir"' RETURN
    node "$SCRIPT_DIR/test-bootstrap-caching.mjs" "$SUPERPOWERS_PLUGIN_FILE" local-missing
}

run_unresolved_check() {
    node "$SCRIPT_DIR/test-bootstrap-caching.mjs" "$SUPERPOWERS_PLUGIN_FILE" unresolved
}

echo "Test 1: Caches bootstrap after the first successful transform..."
run_present_file_check
echo "  [PASS] Bootstrap content is cached while fresh message arrays still receive injection"

echo "Test 2: Caches missing SKILL.md result..."
run_missing_file_check
echo "  [PASS] Missing bootstrap file is cached and not re-probed every transform"

echo "Test 3: Registers local fallback skills without bootstrap..."
run_local_missing_file_check
echo "  [PASS] Local fallback skills stay registered when bootstrap file is absent"

echo "Test 4: Handles unresolved core paths safely..."
run_unresolved_check
echo "  [PASS] Unresolved core paths avoid registration and bootstrap disk work"

echo ""
echo "=== All bootstrap caching tests passed ==="
