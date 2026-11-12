const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'skills', 'handoff', 'scripts', 'handoff.js');

function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'baton-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  return dir;
}

function run(cwd, arg, input) {
  return spawnSync('node', [SCRIPT, arg], {
    cwd, encoding: 'utf8', input: input === undefined ? '' : JSON.stringify({ cwd, ...input }),
  });
}

// Set a file's modified time to `seconds` after a fixed base, so order is explicit.
function touch(file, seconds) {
  const t = new Date(Date.UTC(2026, 0, 1) + seconds * 1000);
  fs.utimesSync(file, t, t);
}

function withHandoff(dir) {
  run(dir, 'init');
  return path.join(dir, '.agents', 'handoff', 'HANDOFF.md');
}

test('init creates the files and does not overwrite them', () => {
  const dir = repo();
  const shared = withHandoff(dir);
  for (const f of ['HANDOFF.md', 'claude.md', 'codex.md', 'kimi.md', 'gemini.md', 'cursor.md', '.gitignore']) {
    assert.ok(fs.existsSync(path.join(dir, '.agents', 'handoff', f)), f);
  }
  fs.writeFileSync(shared, 'mine');
  run(dir, 'init');
  assert.strictEqual(fs.readFileSync(shared, 'utf8'), 'mine');
});

test('session start prints nothing when there is no handoff', () => {
  const r = run(repo(), 'codex', { hook_event_name: 'SessionStart' });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout, '');
});

test('session start prints the shared file and only this agent\'s notes', () => {
  const dir = repo();
  fs.writeFileSync(withHandoff(dir), 'GOAL-TEXT');
  const r = run(dir, 'codex', { hook_event_name: 'SessionStart' });
  assert.match(r.stdout, /GOAL-TEXT/);
  assert.match(r.stdout, /Notes for Codex/);
  assert.doesNotMatch(r.stdout, /Notes for Kimi/);
});

test('session start works from a subdirectory', () => {
  const dir = repo();
  fs.writeFileSync(withHandoff(dir), 'GOAL-TEXT');
  const sub = path.join(dir, 'src');
  fs.mkdirSync(sub);
  assert.match(run(sub, 'claude', { hook_event_name: 'SessionStart' }).stdout, /GOAL-TEXT/);
});

test('session start flags code that changed after the handoff was written', () => {
  const dir = repo();
  const shared = withHandoff(dir);
  touch(shared, 10);
  fs.writeFileSync(path.join(dir, 'app.js'), 'x');
  touch(path.join(dir, 'app.js'), 20);
  const r = run(dir, 'codex', { hook_event_name: 'SessionStart' });
  assert.match(r.stdout, /Branch: \S/);
  assert.match(r.stdout, /STALE: 1 change/);
  assert.match(r.stdout, /  - app\.js/);
});

test('session start says the handoff is current when nothing changed after it', () => {
  const dir = repo();
  const shared = withHandoff(dir);
  fs.writeFileSync(path.join(dir, 'app.js'), 'x');
  touch(path.join(dir, 'app.js'), 10);
  touch(shared, 20);
  const r = run(dir, 'codex', { hook_event_name: 'SessionStart' });
  assert.match(r.stdout, /newer than every code change/);
  assert.doesNotMatch(r.stdout, /STALE/);
});

test('session start still briefs outside a git repository', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'baton-plain-'));
  fs.writeFileSync(withHandoff(dir), 'GOAL-TEXT');
  const r = run(dir, 'claude', { hook_event_name: 'SessionStart' });
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /GOAL-TEXT/);
});

test('stop blocks once when code is newer than the handoff', () => {
  const dir = repo();
  const shared = withHandoff(dir);
  touch(shared, 10);
  fs.writeFileSync(path.join(dir, 'app.js'), 'x');
  touch(path.join(dir, 'app.js'), 20);
  const first = run(dir, 'kimi', { hook_event_name: 'Stop' });
  assert.strictEqual(first.status, 2);
  assert.match(first.stderr, /HANDOFF\.md/);
  assert.strictEqual(run(dir, 'kimi', { hook_event_name: 'Stop' }).status, 0);
});

test('stop passes when the handoff is newer than the code', () => {
  const dir = repo();
  const shared = withHandoff(dir);
  fs.writeFileSync(path.join(dir, 'app.js'), 'x');
  touch(path.join(dir, 'app.js'), 10);
  touch(shared, 20);
  assert.strictEqual(run(dir, 'claude', { hook_event_name: 'Stop' }).status, 0);
});

test('stop blocks after a commit that left the handoff behind', () => {
  const dir = repo();
  const shared = withHandoff(dir);
  touch(shared, 10); // 2026-01-01, long before the commit below
  fs.writeFileSync(path.join(dir, 'app.js'), 'x');
  execFileSync('git', ['add', 'app.js'], { cwd: dir });
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'x'], { cwd: dir });
  assert.strictEqual(run(dir, 'codex', { hook_event_name: 'Stop' }).status, 2);
});

test('stop passes after a commit that includes the handoff', () => {
  const dir = repo();
  withHandoff(dir);
  fs.writeFileSync(path.join(dir, 'app.js'), 'x');
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'x'], { cwd: dir });
  assert.strictEqual(run(dir, 'codex', { hook_event_name: 'Stop' }).status, 0);
});

test('stop never blocks without a handoff, when already continuing, or on bad input', () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, 'app.js'), 'x');
  assert.strictEqual(run(dir, 'claude', { hook_event_name: 'Stop' }).status, 0);
  touch(withHandoff(dir), 10);
  assert.strictEqual(run(dir, 'claude', { hook_event_name: 'Stop', stop_hook_active: true }).status, 0);
  assert.strictEqual(spawnSync('node', [SCRIPT, 'claude'], { cwd: dir, input: 'not json' }).status, 0);
});

test('status reports a missing handoff, then its age and what is stale', () => {
  const dir = repo();
  assert.match(run(dir, 'status').stdout, /no handoff/);
  touch(withHandoff(dir), 10);
  fs.writeFileSync(path.join(dir, 'app.js'), 'x');
  const out = run(dir, 'status').stdout;
  assert.match(out, /last updated \d+ minute/);
  assert.match(out, /STALE: 1 change/);
});

test('export prints one paste-ready prompt, and fails without a handoff', () => {
  const dir = repo();
  assert.strictEqual(run(dir, 'export').status, 1);
  fs.writeFileSync(withHandoff(dir), 'GOAL-MARKER');
  const r = run(dir, 'export');
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /^I am continuing a coding task/);
  assert.match(r.stdout, /GOAL-MARKER/);
  assert.match(r.stdout, /Repository state/);
});

test('the Codex plugin manifest points at files that exist', () => {
  const root = path.join(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, '.codex-plugin', 'plugin.json'), 'utf8'));
  assert.strictEqual(manifest.version, require('../package.json').version);
  const hooks = JSON.parse(fs.readFileSync(path.join(root, manifest.hooks), 'utf8')).hooks;
  for (const event of ['SessionStart', 'Stop']) {
    const file = hooks[event][0].hooks[0].command.match(/\$\{PLUGIN_ROOT\}\/([^"]+)/)[1];
    assert.ok(fs.existsSync(path.join(root, file)), file);
  }
});
