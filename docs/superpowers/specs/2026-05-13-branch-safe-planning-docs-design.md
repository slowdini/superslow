# Branch-Safe Planning Doc Commits

## Problem

The `brainstorming` and `writing-plans` skills write and commit planning documents (specs and implementation plans) during their execution. However, this happens **before** any check for an isolated workspace. When the user is on `main` (or `master`), the skill commits directly to the default branch. This:

1. Pollutes the project's default branch with planning artifacts
2. Can convince the agent that committing to `main` is acceptable for the rest of the session
3. Violates the intended workflow where `using-git-worktrees` creates isolation before implementation work begins

## Design

### Changes to `brainstorming` SKILL.md

Insert a new step **5.5 — Ensure isolated workspace** between "Present design" and "Write design doc":

---

**5.5. Ensure isolated workspace before committing**

Before writing and committing the spec, verify the current branch is safe:

```bash
BRANCH=$(git branch --show-current)
DEFAULT=$(git rev-parse --abbrev-ref origin/HEAD 2>/dev/null | sed 's|^origin/||')

if [ "$BRANCH" = "$DEFAULT" ] || [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
    # On a protected branch — invoke using-git-worktrees to create isolation
fi
```

- **If already on a feature branch:** Proceed to write and commit in place
- **If on `main`/`master`:** Invoke `superpowers:using-git-worktrees` skill to create an isolated workspace. The spec is written and committed in the worktree.

---

**Update the checklist** to include this as step 6 (shifting subsequent steps). Update the process flow diagram to include the new node.

### Changes to `writing-plans` SKILL.md

Insert a guard before saving the plan:

---

Before writing the plan document, run the same branch safety check:

```bash
BRANCH=$(git branch --show-current)
DEFAULT=$(git rev-parse --abbrev-ref origin/HEAD 2>/dev/null | sed 's|^origin/||')

if [ "$BRANCH" = "$DEFAULT" ] || [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
    # On a protected branch — invoke using-git-worktrees to create isolation
fi
```

- **If already isolated:** Write and commit in place
- **If on `main`/`master`:** Invoke `superpowers:using-git-worktrees` skill first, then write and commit in the worktree

---

### Behavior

| Starting State | Action |
|----------------|--------|
| On `main`/`master` | Invoke `using-git-worktrees`, write + commit in worktree |
| On feature branch | Write + commit in place |
| Already in worktree | Write + commit in place |

### Why this approach

- **Conversational design work stays in place** — steps 1-5 of brainstorming happen wherever the user started. Only the commit requires isolation.
- **Commits only happen in safe locations** — protected branches trigger automatic worktree creation.
- **Aligns with `writing-plans`' existing assumption** — the skill's "Context" section already implies it runs in an isolated workspace. This change makes that true.
- **Minimal invasiveness** — one new step, no behavior change when already safe.
- **Self-demonstrating** — the spec for this very change was written and committed inside a worktree, following the new rule.

## Testing

1. Start a new session on `main`
2. Invoke `brainstorming` skill
3. Proceed through design approval
4. Verify that before the spec is committed, a worktree is created
5. Verify the spec exists in the worktree and is committed on a feature branch
6. Verify `main` remains clean
