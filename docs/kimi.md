# baton on Kimi Code

This is for Kimi Code CLI (`MoonshotAI/kimi-code`). The older `kimi-cli` is archived and is not supported.

## Install

In the Kimi Code TUI:

```
/plugins install https://github.com/itsobai07/baton
/reload
```

This installs the skill and the hooks for your user. Node.js must be on your PATH.

## Use

- Start a handoff: `/skill:baton:handoff`, or say "start a handoff".
- Every session starts with the handoff skill loaded, so Kimi knows to read `.agents/handoff/` when it exists.
- If a turn changes code without updating `HANDOFF.md`, Kimi is sent back once to update it.

## Good to know

- Kimi hooks are user-wide. baton stays silent in repositories that have no `.agents/handoff/` folder.
- Kimi's docs do not say whether a session-start hook's output reaches the model, so baton also loads the skill at session start as a second route.
- Nothing re-feeds the handoff after a compaction. The skill tells Kimi to re-read it; if it seems lost, say "resume from the handoff".
