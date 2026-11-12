# baton on Claude Code

## Install

In a Claude Code session:

```
/plugin marketplace add itsobai07/baton
/plugin install baton@baton
```

This installs the skill and both hooks. Node.js must be on your PATH.

## Use

- Start a handoff: `/baton:handoff`, or say "start a handoff".
- From then on, in that repository:
  - every new, resumed or compacted session is shown `HANDOFF.md` and `claude.md`;
  - if a turn changes code without updating `HANDOFF.md`, Claude is sent back once to update it.

## Good to know

- On Windows and macOS, file names ignore case, so Claude Code may also load `.agents/handoff/claude.md` as a `CLAUDE.md` memory file when it reads that folder. The notes are meant for Claude, so this is harmless.
- Hooks can fail to fire. If the handoff looks stale, say "update the handoff".
