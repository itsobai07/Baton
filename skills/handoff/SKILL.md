---
name: handoff
description: Keep a handoff file so another coding agent (Claude Code, Codex, Kimi Code, Gemini CLI, Cursor) or a later session can continue this task without re-explaining. Use when the user asks to start, update or resume a handoff, says they will switch agents, when .agents/handoff/HANDOFF.md exists, or when a baton hook asks you to update it.
---

# Handoff

The task's state lives in `.agents/handoff/` at the repository root:

- `HANDOFF.md` — shared state: Goal, Done, Decisions, Next step, Open questions.
- `claude.md`, `codex.md`, `kimi.md`, `gemini.md`, `cursor.md` — one per agent, holding only what differs for that agent.

## Starting (the folder does not exist)

1. Run `node scripts/handoff.js init` (the script is in this skill's folder) from the repository. It creates the folder from templates and never overwrites.
2. Fill in `HANDOFF.md` from the conversation so far.
3. In each agent file, fill in "For this task": the tools, MCP servers and permissions this task relied on, and what that agent should use in their place. Leave a line empty if you do not know; do not guess another agent's features.

## Resuming (the folder exists)

Read `HANDOFF.md` and the file named after you before doing anything else. Start from **Next step**. Do not retry anything listed under **Decisions** as rejected unless the user asks.

## While working

Update `HANDOFF.md` in the same turn as any code change. The session can end without warning at a usage limit, so the file must be right at the end of every turn, not just the last one.

- **Done**: only what is finished and checked. Say how it was checked.
- **Decisions**: what was tried and rejected, and why, in one line each.
- **Next step**: one concrete action a different agent could start on cold.
- Keep the file under 60 lines. Replace old detail; do not append a log.
- Touch the agent files only when the tooling the task depends on changes.

## Finishing

When the task is complete and the user confirms, delete `.agents/handoff/`. A leftover handoff will be fed to the next session as if the task were still open.
