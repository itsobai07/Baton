# baton

**Hand a coding task from one AI agent to another without re-explaining it.**

[![tests](https://github.com/itsobai07/Baton/actions/workflows/test.yml/badge.svg)](https://github.com/itsobai07/Baton/actions/workflows/test.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![stars](https://img.shields.io/github/stars/itsobai07/Baton?style=social)](https://github.com/itsobai07/Baton/stargazers)

Works with **Claude Code · Codex · Kimi Code · Gemini CLI · Cursor**

<!-- Demo GIF goes here: hit a limit in one agent, open another, it already knows the task. -->

You are deep in a task in Claude Code and hit a usage limit. You open Codex or Kimi Code, and it knows nothing: not the goal, not what is done, not the three approaches you already ruled out.

baton keeps that state in plain files in your repository, current at the end of every turn, and gives it to whichever agent works next.

## Install

**Claude Code**

```
/plugin marketplace add itsobai07/baton
/plugin install baton@baton
```

**Kimi Code**

```
/plugins install https://github.com/itsobai07/baton
/reload
```

**Codex** (desktop app or CLI)

```bash
codex plugin marketplace add itsobai07/baton
```

Then install baton from **Plugins** and trust its two hooks. The [Codex guide](docs/codex.md) has the app steps.

**Gemini CLI, Cursor**

```bash
npx skills add itsobai07/baton
```

**ChatGPT, Claude.ai or any other chat app**: nothing to install; see [Any chat app](#any-chat-app).

Requires Node.js 18 or later and git.

| Agent | Automatic (hooks) | Guide |
|---|---|---|
| Claude Code | yes | [docs/claude-code.md](docs/claude-code.md) |
| Codex | yes | [docs/codex.md](docs/codex.md) |
| Kimi Code | yes | [docs/kimi.md](docs/kimi.md) |
| Gemini CLI | no, skill only | [docs/gemini-cli.md](docs/gemini-cli.md) |
| Cursor | no, skill only | [docs/cursor.md](docs/cursor.md) |

## Use

1. In any agent, say **"start a handoff"**. It creates `.agents/handoff/` and fills it in.
2. Work as usual. The agent keeps `HANDOFF.md` current.
3. Switch agents whenever you like. With hooks, the new agent is briefed at session start; without them, say **"resume from the handoff"**.
4. When the task is finished, delete `.agents/handoff/`.

Commit the folder if you want the handoff to follow the branch to another machine or teammate; otherwise add it to `.gitignore`.

### Check before you switch

Say **"handoff status"**. The agent reports how old the handoff is and lists every change git can see that is newer than it.

### One handoff per project

A handoff belongs to the folder it was started in, and every briefing names that project in its first line. Working on several projects? Say **"list the handoffs"** to see each one with its folder and age, then open the right folder. baton keeps the list in one file, `~/.baton`.

### Any chat app

A chat app such as ChatGPT or Claude.ai cannot read your repository or run hooks. Say **"export the handoff"** and the agent prints the task state as one prompt. Paste it into the chat app and carry on there.

All three also run without an agent, from the repository:

```bash
npx github:itsobai07/baton status
```

```bash
npx github:itsobai07/baton list
```

```bash
npx github:itsobai07/baton export
```

## How it works

```
.agents/handoff/
  HANDOFF.md   shared: Goal, Done, Decisions, Next step, Open questions
  claude.md    what differs for Claude Code
  codex.md     what differs for Codex
  kimi.md      what differs for Kimi Code
  gemini.md    what differs for Gemini CLI
  cursor.md    what differs for Cursor
```

- A **skill** teaches the agent the format and to update `HANDOFF.md` in the same turn as any code change.
- A **session-start hook** shows the incoming agent `HANDOFF.md` plus its own file, and nothing from the other agents' files.
- The same hook adds **facts it collects from git itself**: the branch, the last commits, and every change newer than the handoff. If a limit killed the last session mid-turn, the next agent is told the handoff is stale and exactly which files to check, instead of trusting it.
- A **stop hook** notices when code changed but the handoff did not, and sends the agent back once to update it. That is what keeps the file usable when a limit cuts the session off.

It is opt-in per repository: nothing happens until you start a handoff there. The whole thing is one dependency-free Node script and a few Markdown files.

## Limits

- Hooks sometimes do not fire, and they fail open by design, so the stop check is a strong reminder, not a guarantee.
- The handoff is only as good as what the agent writes. Read it before you switch.
- The stop check and the staleness report compare file times and the last commit. They do not notice a change that only deleted a file, and they need a git repository.
- The automated suite runs on Windows, macOS and Linux, and the session-start hook has been run in a live Claude Code session. The hook formats follow each vendor's documentation as of November 2026; the Codex plugin and Kimi Code registrations have not been run inside those agents.

## Contributing

Issues and pull requests are welcome, especially reports from Codex, Kimi Code, Gemini CLI and Cursor users.

```bash
npm test
```

## License

[MIT](LICENSE)
