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
