# Capability Language Migration — Design

## Problem

Superslow ships across six harnesses (Claude Code, Codex, Cursor, OpenCode, Gemini CLI, Copilot CLI), but skill prose is written using Claude Code tool names (`TodoWrite`, `Grep`, `Bash`, `Task`, etc.). To bridge the gap we maintain per-platform mapping files (`skills/using-superpowers/references/{gemini,copilot,codex}-tools.md`) plus inline platform sections inside `using-superpowers/SKILL.md`.

This indirection costs us:

- **Maintenance churn.** Platforms rename and add tools. Mappings drift.
- **Real bugs.** `gemini-tools.md` currently lists `write_todos` as the Gemini todo tool. Gemini does not have a tool by that name. The mapping itself is wrong.
- **Hand-waving.** When a mapping gets too long, prose falls back to "check your platform's documentation," which provides nothing the agent could not work out itself.

Capable agents already know their own tool names. The mapping tables exist mostly to translate from Claude vocabulary back to the agent's native vocabulary — a translation the agent could do unaided if the skill described the *capability* it needed instead of the *tool* it expected.

## Goal

Eliminate Claude-Code-specific tool-name references from skills and harness instructions. Replace with capability-based language so each agent uses its own native tools without us maintaining mapping tables.

## Principles

1. **Describe capability, not tool.** "Search the codebase for X" instead of "use Grep". The agent picks the right tool on its own platform.
2. **Name load-bearing properties explicitly.** When a tool has a property that matters — the Skill loader's special framing, a task tracker's persistence across subagent dispatches — name the property in prose so the agent cannot substitute something weaker.
3. **Two exceptions stand by name.**
   - **Skill** stays as the universal name for the platform's skill loader (Claude `Skill`, Copilot `skill`, Gemini `activate_skill`). The prohibition "do not read skill files as plain text" is the load-bearing rule.
   - **Persistent task tracker** stays as a *property* — never as a tool name. No more `TodoWrite` in prose.
4. **Trust the agent.** When the skill says "dispatch a general-purpose subagent," the agent on each platform knows how to do that natively.

## In Scope

Fourteen files across four categories.

### Reference mapping files (delete)

- `skills/using-superpowers/references/gemini-tools.md`
- `skills/using-superpowers/references/copilot-tools.md`
- `skills/using-superpowers/references/codex-tools.md`

Combined ~152 lines, deleted in full.

### Skill prose (rewrite)

| File | Changes |
|------|---------|
| `skills/using-superpowers/SKILL.md` | Rewrite "How to Access Skills" and "Platform Adaptation" sections; update flow-diagram nodes referencing `TodoWrite`; add one-line philosophy mention |
| `skills/subagent-driven-development/SKILL.md` | Rewrite flow-diagram nodes (`TodoWrite` x2) and prose mentions |
| `skills/writing-skills/SKILL.md` | Replace `Task tool` (2) and `TodoWrite` (1) mentions; add glossary section |
| `skills/writing-skills/persuasion-principles.md` | Replace `TodoWrite` mentions (3) |
| `skills/brainstorming/visual-companion.md` | Replace `Bash` mentions (3) |

### Subagent prompt templates (rewrite)

All five use the same `Task tool (general-purpose)` phrasing and get the same replacement.

- `skills/brainstorming/spec-document-reviewer-prompt.md`
- `skills/writing-plans/plan-document-reviewer-prompt.md`
- `skills/subagent-driven-development/implementer-prompt.md`
- `skills/subagent-driven-development/spec-reviewer-prompt.md`
- `skills/subagent-driven-development/code-quality-reviewer-prompt.md`

### Harness install doc

- `opencode/INSTALL.md` lines 108–110 (tool name references in install instructions)

## Out of Scope

Explicitly excluded so they do not get bolted into this PR:

- **Plugin manifests** (`.claude-plugin/`, `.codex-plugin/`, `.cursor-plugin/`, `gemini-extension.json`) — already metadata-only, no tool refs.
- **Test files** — none assert on tool-name strings.
- **Skills with no tool references** — left untouched. This is not a stylistic sweep.
- **`docs/superpowers/upstream-CLAUDE.md`** — frozen historical reference.
- **Repo-level docs** (`CLAUDE.md`, `README.md`, `gemini-instructions.md`) — describe the project, not the agent's instructions.
- **Hooks, scripts, code** — pure prose migration.
- **Adversarial pressure testing** — future work; this migration becomes the first input to that effort.
- **A lint rule for tool-name strings** — over-fires on legitimate cases (code examples, the load-bearing `Skill` mentions, quoted output). Discipline lives in the glossary plus PR review.

## Prose Patterns

These are substitution templates, not mechanical find/replace. Sentences get reshaped, not just words swapped.

### Pattern 1 — Skill loader (load-bearing, stays by name)

Before:

> Use the `Skill` tool. When you invoke a skill, its content is loaded and presented to you—follow it directly. Never use the Read tool on skill files.

After:

> Skills are invoked through your platform's dedicated skill mechanism — whatever your host exposes for loading a skill by name. Use it. **Do not open skill files as plain text** — the raw markdown bypasses the loader's framing, prerequisite chains, and session state.

### Pattern 2 — Persistent task tracker (property-named, no tool name)

Before:

> Create TodoWrite todo per item

> Mark task complete in TodoWrite

After (diagrams):

> Track each checklist item as a persistent task

> Mark task complete in your task tracker

After (prose):

> Use a persistent task tracker — one that survives subagent dispatches and context churn, not a scratch markdown list.

### Pattern 3 — Subagent dispatch (general-purpose role hint)

Before:

> Use the Task tool (general-purpose) to dispatch this prompt verbatim...

After:

> Dispatch a general-purpose subagent — one without a specialized role — with this prompt verbatim...

### Pattern 4 — File / shell / search tools (pure capability)

Before:

> Use Bash to run...
> Use Grep to find...
> Use Read to open...

After:

> Run...
> Search the codebase for...
> Open the file at...

Verbs only, no tool names.

### Pattern 5 — Platform adaptation section (deleted)

The current "Platform Adaptation" section in `using-superpowers/SKILL.md` pointing at the reference files is deleted entirely. A short philosophy line replaces it:

> Skills describe capabilities, not tool names. Map each capability to whatever tool your platform provides. When a capability has a property that matters (persistence, hook-visibility, special loader), the skill names the property — that's the requirement, not the tool name.

## Glossary

Added near the top of `skills/writing-skills/SKILL.md`, alongside the "MUST understand TDD" prerequisite. Skill authors are the audience.

| Term | Means | Don't say |
|------|-------|-----------|
| **Skill mechanism** | The platform's dedicated skill loader | "Skill tool" (Claude-specific) |
| **Persistent task tracker** | A todo tool whose state survives subagent dispatches and context churn | "TodoWrite", "write_todos" |
| **General-purpose subagent** | A subagent without a specialized role | "Task tool", "@generalist" |
| **Capability** | A described action ("search file contents") | A platform tool name ("Grep") |
| **Load-bearing property** | A property a capability must have for the workflow to work | (no shorter form) |

The glossary is the canonical source of terminology. When a new load-bearing term is coined, it gets added here.

## Smoke Test

Lives at `docs/superpowers/specs/2026-05-16-capability-language-migration-smoke-test.md`. Two prompts, designed to be pasted into each harness manually.

### Prompt 1 — task tracker + subagent dispatch (any session)

> I have a small plan with three tasks: (1) list the files in this directory, (2) count how many of them are markdown files, (3) report back. Track each of these as a persistent task — one that will survive across any subagents you dispatch. For task 2, dispatch a general-purpose subagent to do the counting and report back to you with the number. Mark each task complete in your tracker as you go.

Pass criteria:

- Agent uses its native task-tracker tool (not a markdown list).
- Agent dispatches an actual subagent for the count step.
- No tool-name errors surface.

### Prompt 2 — skill activation (fresh session)

> Let's make a todo app using react.

Pass criteria:

- Agent activates `superpowers:brainstorming` (or its equivalent) without being asked.
- Activation uses the platform's skill mechanism, not a raw file read.

### Rationale

Prompt 1 exercises Patterns 2 and 3 (persistent task tracker, general-purpose subagent). Prompt 2 exercises Pattern 1 (skill mechanism, no raw file reads). A fresh session for Prompt 2 is required because `using-superpowers/SKILL.md` loads at session start; we want to test cold-start activation, not forced activation.

The smoke test is *not* adversarial. It is a sanity check: did we break activation. Per-harness regression testing is future work.

## Rollout

Single PR. Execution order keeps intermediate states sane.

1. Delete the three reference files.
2. Rewrite `using-superpowers/SKILL.md` (foundation — downstream prose references its terminology).
3. Add the glossary to `writing-skills/SKILL.md`.
4. Rewrite remaining skill prose: `subagent-driven-development/SKILL.md` → `writing-skills/persuasion-principles.md` → `brainstorming/visual-companion.md`.
5. Rewrite the five subagent prompt templates.
6. Update `opencode/INSTALL.md` lines 108–110.
7. Write the smoke-test doc.

## Verification Gate

Before PR is ready for review:

- `bun test && bun run check` both pass.
- Grep the repo for dead tokens (`TodoWrite`, `Bash`, `Grep`, `Glob`, `WebFetch`, `WebSearch`, capitalized `Read`/`Write`/`Edit`, `Task tool`) and confirm zero hits outside of:
  - The two load-bearing exceptions (`Skill` references where intentional).
  - Code examples and quoted output (false positives).
  - `docs/superpowers/upstream-CLAUDE.md` (frozen).
  - This spec document and the smoke-test doc (which discuss the migration itself).
- User runs Prompt 1 and Prompt 2 across at least Claude Code plus one other harness. Smoke test passes per the criteria above.

Merge criteria:

- Verification gate clean.
- Spec and smoke-test doc committed to the branch.
- PR description names which harnesses were spot-checked and the observed behavior.

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Agent reads "persistent task tracker" and uses a markdown scratch list instead of its native todo tool | Medium | Medium — silent regression, no error | Pattern 2 prose explicitly names "not a scratch markdown list"; smoke-test Prompt 1 catches this |
| Agent reads "skill mechanism" wording and tries to read the skill file directly | Low | High — bypasses loader contract | Pattern 1 prose explicitly states "do not open skill files as plain text"; smoke-test Prompt 2 catches this |
| Skill-activation rate drops on a specific harness because the new framing is weaker than the old tool-named version | Medium | High — defeats the purpose | Manual smoke test across harnesses before merge; if regressions appear, add per-harness notes inside the affected skill (not back to a central reference file) |
| Diagram node labels in `using-superpowers/SKILL.md` and `subagent-driven-development/SKILL.md` read awkwardly | Low | Low — cosmetic | Reviewed as part of spec self-review; node text is short by nature |
| Glossary in `writing-skills/SKILL.md` drifts as terminology evolves | Medium (over time) | Low — only affects future editors | Glossary is short (5 entries); treat as canonical source, not a record. New load-bearing terms get added |
| Subagent prompt template rewrites confuse parent agents about dispatch mechanism | Low | Medium — would break subagent-driven-development workflows | "General-purpose subagent" is well-understood terminology; smoke-test Prompt 1 exercises this |
| `opencode/INSTALL.md` regression — users following install instructions hit dead tool names | Low | Medium — install-time friction | Small file in scope; easy to verify |
| Future skill PRs use tool-name language by habit | Medium (over time) | Low — easy to fix in review | Glossary in `writing-skills` is the enforcement mechanism |
