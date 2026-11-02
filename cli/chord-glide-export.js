#!/usr/bin/env node
/*
 * Chord Glide — command-line exporter (engine 3.1)
 *
 *   node chord-glide-export.js <piece.json> [options]
 *
 *   --midi        MIDI with glides (MPE, one channel per voice)
 *   --chords      MIDI with settled chords only
 *   --musicxml    MusicXML harmonic score
 *   --all         all three (the default when no format is given)
 *   --out <dir>   where to write (default: beside the piece file)
 *   --tempo <bpm> override the piece's export tempo
 *   --revoice     ignore saved notes from an older engine and voice the piece again
 *   --artist <n>  write this artist name into the files (the title is the piece name)
 *
 * Audio (WAV, MP3) and video need a browser's audio engine: export those from
 * "Chord Glide.html". Requires Node 18 or later. No network, no dependencies.
 */
const fs = require('fs'), path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8') + fs.readFileSync(path.join(__dirname, 'writers.js'), 'utf8');
const E = new Function(SRC + '; return {ENGINE_VERSION, normalizePiece, parseProgression, buildPiece, builtFromRealization, validRealization, midiWithGlides, midiChords, musicXml};')();

const args = process.argv.slice(2);
const flag = f => args.includes(f);
const opt = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const file = args.find((a, i) => !a.startsWith('--') && !['--out', '--tempo', '--artist'].includes(args[i - 1]));
if (!file || flag('--help') || flag('-h')) {
  console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n\/\*\n?/, '').replace(/^ \* ?/gm, ''));
  process.exit(file ? 0 : 1);
}

let raw;
try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.error('Could not read ' + file + ': ' + e.message); process.exit(1); }
let piece;
try { piece = E.normalizePiece(raw); } catch (e) { console.error(e.message); process.exit(1); }
const tempo = opt('--tempo') ? Math.max(20, Math.min(300, +opt('--tempo'))) : piece.timing.tempo;

const frozen = !flag('--revoice') && piece.realization && piece.realization.engine !== E.ENGINE_VERSION && E.validRealization(piece.realization);
let built;
if (frozen) {
  built = E.builtFromRealization(piece.realization, piece);
  console.log('Using the notes saved by engine ' + piece.realization.engine + ' (pass --revoice to voice it with engine ' + E.ENGINE_VERSION + ').');
} else {
  const { items, errors } = E.parseProgression(piece.chords);
  if (errors.length) console.warn('Skipped chords it could not read: ' + errors.join(', '));
  if (!items.length) { console.error('The piece has no chords.'); process.exit(1); }
  built = E.buildPiece(items, piece);
  if (built.warnings.length) console.warn('Voiced with nearest notes: ' + built.warnings.join(', '));
}

const all = flag('--all') || !(flag('--midi') || flag('--chords') || flag('--musicxml'));
const outDir = opt('--out') || path.dirname(path.resolve(file));
fs.mkdirSync(outDir, { recursive: true });
const base = (String(piece.name || 'Untitled piece').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled piece').slice(0, 80);
const o = { tempo, title: piece.name, artist: opt('--artist') || '' };
const write = (name, data) => { const p = path.join(outDir, name); fs.writeFileSync(p, data); console.log('wrote ' + p + ' (' + data.length + ' bytes)'); };
if (all || flag('--midi')) write(base + ' (glides).mid', E.midiWithGlides(built, o));
if (all || flag('--chords')) write(base + ' (chords).mid', E.midiChords(built, o));
if (all || flag('--musicxml')) write(base + '.musicxml', E.musicXml(built, o));
