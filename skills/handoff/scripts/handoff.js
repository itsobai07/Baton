#!/usr/bin/env node
// baton: one hook script shared by Claude Code, Codex and Kimi Code.
//   node handoff.js <agent>   hook mode: event JSON on stdin (SessionStart, Stop)
//   node handoff.js init      create .agents/handoff/ from the templates
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REL = '.agents/handoff';

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

// Agents may start in a subdirectory; the handoff lives at the repo root.
function repoRoot(cwd) {
  try { return git(cwd, 'rev-parse', '--show-toplevel').trim(); } catch { return cwd; }
}

function init(root) {
  const dest = path.join(root, REL);
  fs.cpSync(path.join(__dirname, '..', 'templates'), dest, { recursive: true, force: false });
  const ignore = path.join(dest, '.gitignore');
  if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, '.nag\n');
  console.log(`baton: handoff files are in ${dest}`);
}

function start(root, agent) {
  const dir = path.join(root, REL);
  const shared = path.join(dir, 'HANDOFF.md');
  if (!fs.existsSync(shared)) return;
  console.log(`baton: a previous session left a handoff in ${REL}/. Read it before acting, and keep HANDOFF.md current as you work.\n`);
  console.log(fs.readFileSync(shared, 'utf8'));
  const own = path.join(dir, `${agent}.md`);
  if (/^[a-z]+$/.test(agent) && fs.existsSync(own)) console.log(fs.readFileSync(own, 'utf8'));
}

// Time of the newest code change, in ms: uncommitted files, or the last commit.
function newestChange(root) {
  let newest = 0;
  for (const entry of git(root, 'status', '--porcelain', '-z', '--untracked-files=all').split('\0')) {
    const file = entry.slice(3);
    if (!file || file.startsWith(REL + '/')) continue;
    try { newest = Math.max(newest, fs.statSync(path.join(root, file)).mtimeMs); } catch {} // deleted, or a rename's old path
  }
  try {
    const [time, ...files] = git(root, 'show', '--name-only', '--format=%ct', 'HEAD').trim().split('\n');
    // A commit that includes the handoff was handed off; its time is always later than the file's.
    if (!files.includes(`${REL}/HANDOFF.md`)) newest = Math.max(newest, Number(time) * 1000);
  } catch {} // no commits yet
  return newest;
}

function stop(root, input) {
  const dir = path.join(root, REL);
  const shared = path.join(dir, 'HANDOFF.md');
  if (input.stop_hook_active || !fs.existsSync(shared)) return 0;
  const newest = newestChange(root);
  if (newest <= fs.statSync(shared).mtimeMs) return 0;
  // Kimi has no stop_hook_active, so remember what we already nagged about and never nag twice for it.
  const nag = path.join(dir, '.nag');
  if (fs.existsSync(nag) && fs.readFileSync(nag, 'utf8') === String(newest)) return 0;
  fs.writeFileSync(nag, String(newest));
  console.error(`baton: code changed after ${REL}/HANDOFF.md was last updated. Update its Done, Decisions and Next step sections now (keep it under 60 lines), then finish.`);
  return 2;
}

function main() {
  const agent = process.argv[2] || '';
  if (agent === 'init') { init(repoRoot(process.cwd())); return 0; }
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  // Kimi runs plugin hooks from the plugin folder, so trust the event's cwd over our own.
  const root = repoRoot(input.cwd || process.cwd());
  if (input.hook_event_name === 'SessionStart') start(root, agent);
  if (input.hook_event_name === 'Stop') return stop(root, input);
  return 0;
}

// Fail open: a handoff tool must never trap a session.
try { process.exitCode = main(); } catch (e) { if (process.argv[2] === 'init') throw e; process.exitCode = 0; }
