# baton on Codex

baton installs as a Codex plugin: the skill and both hooks come together. Node.js must be on your PATH.

## Install in the Codex app

1. Add the marketplace. Open a terminal once and run:

   ```bash
   codex plugin marketplace add itsobai07/baton
   ```

   No `codex` command? Add this to `~/.codex/config.toml` instead:

   ```toml
   [marketplaces.baton]
   source_type = "git"
   source = "https://github.com/itsobai07/Baton.git"
   ref = "main"
   ```

2. Restart the Codex app.
3. Open **Plugins**, pick the **baton** source, open the plugin and press the plus button to install it.
4. Trust the hooks: choose **Review hooks** in the composer, or **Settings > Hooks**, and trust both entries. Codex skips hooks until you do, and asks again whenever baton is updated.
5. Start a new chat.

## Install in the Codex CLI

```bash
codex plugin marketplace add itsobai07/baton
```

Then run `/plugins` to install baton, and `/hooks` to trust its two hooks.

## Use

- Start a handoff: `$handoff`, or say "start a handoff".
- New, resumed and compacted sessions are shown `HANDOFF.md` and `codex.md`.
- If a turn changes code without updating `HANDOFF.md`, Codex is sent back once to update it.
- Say "handoff status" to see how old the handoff is and what changed since.

## Good to know

- Hooks run in the Codex desktop app and CLI on your machine. They do not run in cloud tasks or in ChatGPT on the web; there, use `export` (see the README).
- Codex passes at most about 2,500 tokens of hook output into context by default. Keeping `HANDOFF.md` under 60 lines stays well inside that.
- Already added baton before version 0.3.0? Run `codex plugin marketplace upgrade baton`, or restart the app, to pick up the plugin.
