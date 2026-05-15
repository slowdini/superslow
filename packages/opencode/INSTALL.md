# Installing Superslow for OpenCode

## Prerequisites

- [OpenCode.ai](https://opencode.ai) installed

## Installation

Add Superslow to the `plugin` array in your `opencode.json` (global or project-level):

```json
{
  "plugin": ["@slowdini/superslow-opencode@1.0.0"]
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

OpenCode installs Superslow from the npm registry. To update, change the
version in `opencode.json` to the newer published release and restart
OpenCode. Some OpenCode and Bun versions pin the resolved package in a lockfile
or cache, so a restart may not pick up the new version immediately. If updates
do not appear, clear OpenCode's package cache or reinstall the plugin.

The `plugin` entry can point at any published version, for example:

```json
{
  "plugin": ["@slowdini/superslow-opencode@1.0.0"]
}
```

## Troubleshooting

### Plugin not loading

1. Check logs: `opencode run --print-logs "hello" 2>&1 | grep -i superpowers`
2. Verify the plugin line in your `opencode.json`
3. Make sure you're running a recent version of OpenCode

### Windows install issues

Some Windows OpenCode builds have upstream installer issues in OpenCode's
plugin installer. If OpenCode cannot install the published package, try
installing it with system npm and pointing OpenCode at the local package:

```powershell
npm install @slowdini/superslow-opencode@1.0.0 --prefix "$HOME\.config\opencode"
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
