# baton on Gemini CLI

Skill only: there are no baton hooks for Gemini CLI yet, so nothing is loaded or checked automatically.

## Install

```bash
npx skills add itsobai07/baton
```

Pick Gemini CLI when asked.

## Use

- Switching to Gemini: say "resume from the handoff". It reads `HANDOFF.md` and `gemini.md`.
- Before switching away: say "update the handoff".

## Good to know

- On Windows and macOS, file names ignore case, so Gemini CLI may load `.agents/handoff/gemini.md` as a `GEMINI.md` context file. The notes are meant for Gemini, so this is harmless.
