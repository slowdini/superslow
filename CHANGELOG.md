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
