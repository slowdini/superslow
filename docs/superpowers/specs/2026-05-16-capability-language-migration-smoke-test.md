# Capability Language Migration — Smoke Test

Sanity check that the capability-language rewrite did not break skill activation or weaken agent behavior. Paste each prompt into a session on every harness you care about and eyeball the result against the pass criteria.

This is *not* adversarial pressure testing. Per-harness regression testing is future work.

## Prompt 1 — task tracker and subagent dispatch

Use any session (does not need to be fresh).

> I have a small plan with three tasks: (1) list the files in this directory, (2) count how many of them are markdown files, (3) report back. Track each of these as a persistent task — one that will survive across any subagents you dispatch. For task 2, dispatch a general-purpose subagent to do the counting and report back to you with the number. Mark each task complete in your tracker as you go.

### Pass criteria

- Agent uses its native task-tracker tool (not a markdown list in chat).
- Agent dispatches an actual subagent for the count step (not "I'll do that step myself").
- No tool-name errors surface (e.g., "write_todos is not a valid tool").

### What this exercises

- Pattern 2: persistent task tracker phrasing.
- Pattern 3: general-purpose subagent dispatch phrasing.

### Failure-mode notes

| Symptom | Likely cause |
|---------|--------------|
| Agent writes a markdown checklist in chat instead of using a task tool | The "persistent task tracker" phrasing did not name the persistence property strongly enough for this harness |
| Agent says "I'll handle the count myself" instead of dispatching | "Dispatch a general-purpose subagent" phrasing did not register as a dispatch instruction |
| Agent invokes a specialist subagent (e.g., code-reviewer) | The "general-purpose" role hint was lost — strengthen the role-distinction language |
| Tool-name error | A platform mapping issue we need to address per-harness |

## Prompt 2 — skill activation

**Must be a fresh session.** `using-superpowers/SKILL.md` loads at session start; this prompt tests cold-start framing.

> Let's make a todo app using react.

### Pass criteria

- Agent activates `superpowers:brainstorming` (or its equivalent) without being asked.
- Activation uses the platform's skill mechanism, not a raw file read.

### What this exercises

- Pattern 1: skill mechanism phrasing.
- Pattern 5: replacement of the deleted Platform Adaptation section.

### Failure-mode notes

| Symptom | Likely cause |
|---------|--------------|
| Agent dives into building the todo app without invoking any skill | The "skill mechanism" framing in `using-superpowers/SKILL.md` did not trigger activation — most likely a phrasing regression |
| Agent reads `skills/brainstorming/SKILL.md` as a file instead of invoking it | The "do not open skill files as plain text" prohibition did not land |
| Agent says it cannot find a skill mechanism | The replacement philosophy section is unclear about whether skills are platform-provided |

## Harness coverage

You do not need to run both prompts on every harness. Minimum recommendation: Claude Code plus one non-Claude harness (Gemini CLI, Codex, OpenCode, Copilot CLI, or Cursor).

Record observed behavior per harness in the PR description.
