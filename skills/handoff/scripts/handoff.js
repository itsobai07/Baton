#!/usr/bin/env node
// baton: one hook script shared by Claude Code, Codex and Kimi Code.
//   node handoff.js <agent>   hook mode: event JSON on stdin (SessionStart, Stop)
//   node handoff.js init      create .agents/handoff/ from the templates
//   node handoff.js status    is there a handoff, how old is it, and is it stale
//   node handoff.js export    print the handoff as one prompt to paste into any chat app
//   node handoff.js list      every handoff on this machine, newest first
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REL = '.agents/handoff';
// One line per repository that has had a handoff, so `list` need not scan the disk.
const INDEX = path.join(os.homedir(), '.baton');

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

// Agents may start in a subdirectory; the handoff lives at the repo root.
function repoRoot(cwd) {
  try { return git(cwd, 'rev-parse', '--show-toplevel').trim(); } catch { return cwd; }
}

function known() {
  try { return fs.readFileSync(INDEX, 'utf8').split('\n').filter(Boolean); } catch { return []; }
}

function remember(root) {
  try { if (!known().includes(root)) fs.appendFileSync(INDEX, root + '\n'); } catch {} // a read-only home must not break a hook
}

function age(file) {
  const m = Math.round((Date.now() - fs.statSync(file).mtimeMs) / 60000);
  return m < 60 ? `${m} minute(s) ago` : m < 2880 ? `${Math.round(m / 60)} hour(s) ago` : `${Math.round(m / 1440)} day(s) ago`;
}

// A handoff belongs to one folder; say which, so the wrong project is obvious in the first line.
function label(root) {
  return `"${path.basename(root)}" (${root})`;
}

function list() {
  const shared = (root) => path.join(root, REL, 'HANDOFF.md');
  const live = known().filter((root) => fs.existsSync(shared(root)));
  if (!live.length) { console.log('baton: no handoffs on this machine yet.'); return; }
  live.sort((a, b) => fs.statSync(shared(b)).mtimeMs - fs.statSync(shared(a)).mtimeMs);
  console.log('baton: handoffs on this machine, newest first. Open a folder in your agent to continue that task.');
  for (const root of live) console.log(`- ${label(root)}, updated ${age(shared(root))}`);
}

function init(root) {
  const dest = path.join(root, REL);
  fs.cpSync(path.join(__dirname, '..', 'templates'), dest, { recursive: true, force: false });
  const ignore = path.join(dest, '.gitignore');
  if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, '.nag\n');
  remember(root);
  console.log(`baton: handoff files are in ${dest}`);
}

function status(root) {
  const shared = path.join(root, REL, 'HANDOFF.md');
  if (!fs.existsSync(shared)) { console.log(`baton: no handoff in ${root}. Ask an agent to "start a handoff" to create one.\n`); list(); return; }
  remember(root);
  console.log(`baton: the handoff for ${label(root)} was last updated ${age(shared)}.\n`);
  try { console.log(groundTruth(root, shared)); } catch { console.log('Not a git repository, so baton cannot check the handoff against the code.'); }
}

// For chat apps with no hooks and no access to the repository: everything in one paste.
function exportPrompt(root) {
  const shared = path.join(root, REL, 'HANDOFF.md');
  if (!fs.existsSync(shared)) { console.error(`baton: no handoff in ${root}, so there is nothing to export.`); process.exit(1); }
  console.log('I am continuing a coding task that another AI assistant started. You cannot see my files, so everything you know about the task is below. Start from "Next step", do not retry anything listed under "Decisions" as rejected, and ask me to paste any file you need.\n');
  console.log(`Project: ${path.basename(root)}\n`); // name only: this is pasted into a chat app, so keep the local path out
  console.log(fs.readFileSync(shared, 'utf8'));
  try { console.log(groundTruth(root, shared)); } catch {} // not a git repository
}

const COMMANDS = { init, status, export: exportPrompt, list };

function start(root, agent) {
  const dir = path.join(root, REL);
  const shared = path.join(dir, 'HANDOFF.md');
  if (!fs.existsSync(shared)) return;
  remember(root);
  console.log(`baton: a previous session left a handoff for ${label(root)} in ${REL}/. Read it before acting, and keep HANDOFF.md current as you work. If the user means a different project, say so and run this script with "list".\n`);
  console.log(fs.readFileSync(shared, 'utf8'));
  const own = path.join(dir, `${agent}.md`);
  if (/^[a-z]+$/.test(agent) && fs.existsSync(own)) console.log(fs.readFileSync(own, 'utf8'));
  try { console.log(groundTruth(root, shared)); } catch {} // not a git repository
}

// Code changes git can see: uncommitted files, and the last commit unless it carried the handoff.
function changes(root) {
  const list = [];
  for (const entry of git(root, 'status', '--porcelain', '-z', '--untracked-files=all').split('\0')) {
    const file = entry.slice(3);
    if (!file || file.startsWith(REL + '/')) continue;
    try { list.push({ what: file, time: fs.statSync(path.join(root, file)).mtimeMs }); } catch {} // deleted, or a rename's old path
  }
  try {
    const [head, ...files] = git(root, 'show', '--name-only', '--format=%ct %h %s', 'HEAD').trim().split('\n');
    // A commit that includes the handoff was handed off; its time is always later than the file's.
    if (!files.includes(`${REL}/HANDOFF.md`)) list.push({ what: `commit ${head.slice(head.indexOf(' ') + 1)}`, time: parseInt(head, 10) * 1000 });
  } catch {} // no commits yet
  return list;
}

// Facts the script collects itself, so the next agent need not trust what the last one wrote.
// A usage limit can kill a session mid-turn, before the stop check ever runs.
function groundTruth(root, shared) {
  const since = fs.statSync(shared).mtimeMs;
  const stale = changes(root).filter((c) => c.time > since).map((c) => c.what);
  const out = ['## Repository state (collected by baton from git, not written by an agent)', ''];
  out.push(`- Branch: ${git(root, 'branch', '--show-current').trim() || '(detached)'}`);
  try { out.push('- Last commits:', git(root, 'log', '-3', '--format=  - %h %s').trimEnd()); } catch {} // no commits yet
  if (!stale.length) return out.concat('- HANDOFF.md is newer than every code change git can see.').join('\n');
  out.push(`- STALE: ${stale.length} change(s) are newer than HANDOFF.md, so the last session may have been cut off before updating it. Check these against the handoff, trust the code where they disagree, and update HANDOFF.md first:`);
  out.push(...stale.slice(0, 20).map((f) => `  - ${f}`));
  if (stale.length > 20) out.push(`  - ...and ${stale.length - 20} more`);
  return out.join('\n');
}

function stop(root, input) {
  const dir = path.join(root, REL);
  const shared = path.join(dir, 'HANDOFF.md');
  if (input.stop_hook_active || !fs.existsSync(shared)) return 0;
  const newest = Math.max(0, ...changes(root).map((c) => c.time));
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
  if (Object.hasOwn(COMMANDS, agent)) { COMMANDS[agent](repoRoot(process.cwd())); return 0; }
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  // Kimi runs plugin hooks from the plugin folder, so trust the event's cwd over our own.
  const root = repoRoot(input.cwd || process.cwd());
  if (input.hook_event_name === 'SessionStart') start(root, agent);
  if (input.hook_event_name === 'Stop') return stop(root, input);
  return 0;
}

// Fail open: a handoff tool must never trap a session.
try { process.exitCode = main(); } catch (e) { if (Object.hasOwn(COMMANDS, process.argv[2] || '')) throw e; process.exitCode = 0; }
