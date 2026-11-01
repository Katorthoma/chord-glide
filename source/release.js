#!/usr/bin/env node
/*
 * Makes a clean release zip:
 *
 *   node source/release.js
 *
 * 1. runs the engine tests and the writer tests, and stops if any fail
 * 2. rebuilds "Chord Glide.html", cli/ and dist/
 * 3. copies only the files listed below into releases/chord-glide-<version>/
 * 4. zips that folder as releases/chord-glide-<version>.zip
 *
 * Only listed files are copied, and hidden files are always skipped, so .git, .DS_Store,
 * __MACOSX, piece files and exported audio, MIDI or video can never end up in a release.
 * No dependencies; uses the same zip writer as the app.
 */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
const run = f => execFileSync(process.execPath, [path.join(root, f)], { cwd: root, stdio: 'inherit' });

try { run('source/test_engine.js'); run('source/test_writers.js'); } catch (e) { console.error('\nTests failed, so no release was made.'); process.exit(1); }
run('source/build.js');

const version = (fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8').match(/APP_VERSION = '([^']+)'/) || [])[1];
if (!version) { console.error('Couldn\'t read APP_VERSION from source/app.js.'); process.exit(1); }

// what a release contains: files, and folders copied whole (minus hidden files)
const INCLUDE = ['Chord Glide.html', 'lame.min.js', 'README.md', 'CHANGES.md', 'LICENSE', 'LICENSES', 'cli', 'source'];
const name = 'chord-glide-' + version, outDir = path.join(root, 'releases'), stage = path.join(outDir, name);
fs.rmSync(stage, { recursive: true, force: true });

const files = [];
const add = rel => {
  const abs = path.join(root, rel), base = path.basename(rel);
  if (base.startsWith('.') || base === '__MACOSX') return;
  const st = fs.statSync(abs);
  if (st.isDirectory()) { for (const f of fs.readdirSync(abs).sort()) add(path.join(rel, f)); return; }
  if (!st.isFile()) return;
  const dest = path.join(stage, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(abs, dest);
  files.push({ name: (name + '/' + rel).split(path.sep).join('/'), data: new Uint8Array(fs.readFileSync(abs)) });
};
for (const rel of INCLUDE) {
  if (!fs.existsSync(path.join(root, rel))) { console.error('Missing ' + rel + '; no release was made.'); process.exit(1); }
  add(rel);
}

const W = new Function(fs.readFileSync(path.join(__dirname, 'writers.js'), 'utf8') + '; return { zipStore };')();
const zip = path.join(outDir, name + '.zip');
fs.writeFileSync(zip, W.zipStore(files));
console.log('\nwrote releases/' + name + '.zip (' + files.length + ' files, ' + Math.round(fs.statSync(zip).size / 1024) + ' KB)');
