# baton on Codex

Codex runs plugin-bundled hooks only in its desktop app, so the skill and the hooks are installed separately.

## 1. Install the skill

```bash
npx skills add itsobai07/baton
```

Pick Codex when asked. Note where the `handoff` skill folder was placed; you need the path to `scripts/handoff.js` inside it.

## 2. Register the hooks

Add this to `~/.codex/hooks.json` (all repositories) or `<repo>/.codex/hooks.json` (one repository), replacing the path. Use forward slashes on Windows.

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "node \"/full/path/to/handoff/scripts/handoff.js\" codex" }] }
    ],
    "Stop": [
      { "hooks": [{ "type": "command", "command": "node \"/full/path/to/handoff/scripts/handoff.js\" codex" }] }
    ]
  }
}
```

## 3. Trust the hooks

Run `/hooks` in Codex and trust both entries. Codex skips untrusted hooks, and asks again whenever the script changes (for example after updating baton).

## Use

- Start a handoff: `$handoff`, or say "start a handoff".
- New, resumed and compacted sessions are shown `HANDOFF.md` and `codex.md`.
- If a turn changes code without updating `HANDOFF.md`, Codex is sent back once to update it.

## Good to know

- Codex passes at most about 2,500 tokens of hook output into context by default. Keeping `HANDOFF.md` under 60 lines stays well inside that.
