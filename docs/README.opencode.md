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

Verify by using OpenCode's native `skill` tool to list bundled skills and make
sure entries such as `brainstorming` appear:

```text
use skill tool to list skills
```

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

- `TodoWrite` -> `todowrite`
- `Task` with subagents -> OpenCode's `@mention` system
- `Skill` tool -> OpenCode's native `skill` tool
- File operations -> Native OpenCode tools

## Troubleshooting

### Plugin not loading

1. Check OpenCode logs: `opencode run --print-logs "hello" 2>&1 | grep -Ei 'superpowers|superslow'`
2. Verify the plugin line in your `opencode.json` is correct
3. Make sure you're running a recent version of OpenCode

### Git install issues

Some environments have upstream issues with git-backed plugin specs. If
OpenCode cannot install the plugin from GitHub, clone the repo locally and
point OpenCode at the checkout root:

```bash
git clone https://github.com/slowdini/superslow "$HOME/.config/opencode/superslow"
```

Then use an absolute installed path in `opencode.json`:

```json
{
  "plugin": ["/Users/your-user/.config/opencode/superslow"]
}
```

Do not rely on `~` expansion unless you have verified that your OpenCode build
expands it in plugin paths.

### Skills not found

1. Use OpenCode's `skill` tool to list available skills
2. Check that the plugin is loading (see above)
3. Each skill needs a `SKILL.md` file with valid YAML frontmatter

### Bootstrap not appearing

1. Check that your OpenCode version supports `experimental.chat.messages.transform`
2. Restart OpenCode after config changes

## Getting Help

- [Report issues](https://github.com/slowdini/superslow/issues)
- [Main documentation](https://github.com/slowdini/superslow)
- [OpenCode docs](https://opencode.ai/docs/)
