/* ===== Chord Glide — engine v3.1 (1 Nov 2026): parsing, voicing, motion, timeline (no DOM) ===== */
const ENGINE_VERSION = '3.1';
const SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const LETTER = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};
const hz = n => 440 * Math.pow(2, (n - 69) / 12);
const pcOf = s => { let p = LETTER[s[0]]; for (const c of s.slice(1)) { if (c === '#') p++; else if (c === 'b') p--; } return (p + 120) % 12; };
const noteName = m => SHARP[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// A note with its octave, and optional cents after the octave: C4, F#2, C-1 (octave -1), D3+33, B3-14, A4+12.5¢
const NOTE_OCT = '[A-G][#b]?-?\\d(?:[+-]\\d{1,2}(?:\\.\\d+)?¢?)?';
const PLAYABLE = p => p >= 0 && p <= 127; // MIDI's range, which saved notes must keep to
// a line's or pattern's note at every doubling, and, if it falls (a pitch drop, unless it slides in), from the top of its fall
const fitsRange = (p, tr, fall = 0) => tr.every(d => PLAYABLE(p + d) && PLAYABLE(p + d + fall));
const fallOf = (part, slide) => !slide && part && part.drop && part.drop.semis ? part.drop.semis : 0;
function parseNoteOct(s) {
  const m = s.match(/^([A-G][#b]?)(-?\d)(?:([+-]\d{1,2}(?:\.\d+)?)¢?)?$/);
  return m ? pcOf(m[1]) + 12 * (parseInt(m[2], 10) + 1) + (m[3] ? parseFloat(m[3]) / 100 : 0) : null;
}

/* One token -> {kind:'note'|'chord'|'error', ...} */
function parseItem(raw) {
  let t = raw.replace(/♯/g, '#').replace(/♭/g, 'b').replace(/ø7?/g, 'm7b5').replace(/Δ/g, 'maj7').trim();
  if (!t) return null;
  let dur = null, unit = null; // a length in seconds (:6 or :6s), bars (:2bar) or beats (:3beat); turned into seconds by itemSeconds()
  const dm = t.match(/:(\d+(?:\.\d+)?)(s|bars?|beats?)?$/);
  if (dm) { dur = parseFloat(dm[1]); unit = /^bar/.test(dm[2] || '') ? 'bar' : /^beat/.test(dm[2] || '') ? 'beat' : null; t = t.slice(0, dm.index); }
  let pin = null;
  const pm = t.match(/\[([^\]]*)\]$/);
  if (pm) {
    pin = pm[1].split(/[_\s,]+/).filter(Boolean).map(parseNoteOct);
    if (pin.some(x => x === null || !PLAYABLE(x))) return { kind: 'error', label: raw.trim() }; // unreadable, or outside MIDI 0–127
    t = t.slice(0, pm.index);
  }
  const um = t.match(new RegExp('^(?:=|->|→)(' + NOTE_OCT + ')$'));
  if (um) { const m = parseNoteOct(um[1]); return PLAYABLE(m) ? { kind: 'note', midi: m, label: um[1], dur, unit } : { kind: 'error', label: raw.trim() }; }
  const m = t.match(/^([A-G][#b]?)(.*)$/);
  if (!m) return { kind: 'error', label: raw.trim() };
  const root = pcOf(m[1]);
  let q = m[2], bass = root;
  const sm = q.match(/\/([A-G][#b]?)$/);
  if (sm) { bass = pcOf(sm[1]); q = q.slice(0, sm.index); }
  let no5 = false;
  q = q.replace(/\(?(no|omit)5\)?/gi, () => { no5 = true; return ''; }).replace(/[()]/g, '');
  const iv = new Set([0]);
  const add = (...a) => a.forEach(x => iv.add(x));
  const minor = /^(m(?!aj)|min|-)/.test(q);
  const dim = /dim|°/.test(q), aug = /aug|\+/.test(q);
  const sus2 = /sus2/.test(q), sus4 = !sus2 && /sus/.test(q);
  let s = q.replace(/^(min|m(?!aj)|-)/, '').replace(/dim|°|aug|\+|sus2|sus4|sus/g, '');
  let flat5 = false, sharp5 = false;
  s = s.replace(/(add)?#11/g, () => { add(6); return ''; });
  s = s.replace(/b13/g, () => { add(8); return ''; });
  s = s.replace(/b9/g, () => { add(1); return ''; });
  s = s.replace(/#9/g, () => { add(3); return ''; });
  s = s.replace(/b5/g, () => { flat5 = true; return ''; });
  s = s.replace(/#5/g, () => { sharp5 = true; return ''; });
  s = s.replace(/add(9|2)/g, () => { add(2); return ''; });
  s = s.replace(/add(11|4)/g, () => { add(5); return ''; });
  s = s.replace(/add(13|6)/g, () => { add(9); return ''; });
  s = s.replace(/6\/9|69/g, () => { add(9, 2); return ''; });
  const mj = s.match(/(maj|Maj|MAJ|M)(13|11|9|7)?/);
  if (mj) {
    const n = +mj[2] || 0;
    if (n) { add(11); if (n >= 9) add(2); if (n === 11) add(5); if (n === 13) add(9); }
    s = s.replace(mj[0], '');
  }
  const dg = s.match(/13|11|9|7|6/);
  if (dg) {
    const n = +dg[0];
    if (n === 6) add(9);
    else { add(dim && n === 7 ? 9 : 10); if (n >= 9) add(2); if (n === 11) add(5); if (n === 13) add(9); }
    s = s.replace(dg[0], '');
  }
  if (s.trim()) return { kind: 'error', label: raw.trim() };
  if (sus2) add(2); else if (sus4) add(5); else add(minor || dim ? 3 : 4);
  if (!no5) add(dim || flat5 ? 6 : (aug || sharp5) ? 8 : 7);
  const pcs = [...new Set([...iv].map(i => (root + i) % 12))];
  return { kind: 'chord', label: t, root, bass, pcs, dur, unit, pin };
}
/* ---- Musical time ----
   The tempo (beats a minute) and the meter (beats a bar) set a beat grid from the start of the piece. A chord's own length can
   be in seconds, bars or beats, and an explicit unit never changes meaning on its own. A chord without a length lasts the piece's
   chord length: timing.chordSec seconds, or timing.chordBars bars when the piece keeps its time in bars (timing.unit 'bar'). */
const beatSec = P => 60 / P.timing.tempo, barSec = P => beatSec(P) * P.timing.meter;
const defaultChordSec = P => P.timing.unit === 'bar' ? P.timing.chordBars * barSec(P) : P.timing.chordSec;
function itemSeconds(it, P) { return it.dur == null ? null : it.unit === 'bar' ? it.dur * barSec(P) : it.unit === 'beat' ? it.dur * beatSec(P) : it.dur; }
// whether a piece needs file format 5: it keeps time in bars, or a chord's length is in bars or beats
const usesMusicalTime = p => !!(p && ((p.timing && p.timing.unit === 'bar') || /:\d+(?:\.\d+)?(?:bars?|beats?)(?=[\s,|\]]|$)/m.test(String(p.chords || ''))));
/* The file format a piece needs: 5 with 4.2's features, 4 with parts or a volume shape, else 3, so older versions open what they can
   play and refuse what they'd get wrong */
const shaped = x => !!x && ((x.breathe && +x.breathe.depth > 0) || (x.duck && +x.duck.depth > 0 && x.duck.under));
const accented = r => !!(r && Array.isArray(r.events) && r.events.some(e => e && (e.vel || e.ease))); // saved notes with loudness or glide shapes
const echoing = x => !!(x && x.echo && +x.echo.mix > 0);
function formatFor(p) { return echoing(p) || (p.parts || []).some(echoing) || p.mix === 'voices' || p.tuning === 'just' || accented(p.realization) || (p.parts || []).length > 12 || usesMusicalTime(p) || shaped(p) || (p.parts || []).some(shaped) || hasSections(p.chords) || Array.isArray(p.plays) || (p.parts || []).some(x => x && (Array.isArray(x.plays) || x.preset === 'pattern' || x.preset === 'copy' || (x.drop && +x.drop.semis) || (x.envelope && x.envelope.curve === 'exp') || (x.glideShape && x.glideShape !== 'smooth') || x.nonstop || (x.preset === 'copy' && +x.voices > 0) || +x.portamento > 2 || /[~@[\/]/.test(String(x.line || '')) || String(x.line || '').length > 20000 || /\[/.test(String(x.pattern || '')) || accented(x.realization))) ? 5 : (p.parts && p.parts.length) || (p.volume && p.volume.length) ? 4 : 3; }

/* ---- Sections ----
   A line that is only a header in brackets starts a section: its name, then optionally a repeat (x2) and a key change in
   semitones (+2, -3), in any order: [Groove x2], [Lift x2 +2]. Chords before the first header are a section with no name.
   The progression is expanded: each section's chords, transposed, as many times as it repeats. Every item says which section
   it's in (`section`, its name) and which time through (`pass`); parts can play in chosen sections only (see sectionSpans()). */
const SECTION_LIMITS = { repeat: 64, transpose: 24, items: 20000 };
function parseHeader(inner) {
  let name = [], repeat = 1, transpose = 0, ok = true;
  for (const w of inner.trim().split(/\s+/).filter(Boolean)) {
    let m;
    if ((m = w.match(/^[x×](\d+)$/i))) repeat = +m[1];
    else if ((m = w.match(/^([+-]\d+)(?:st)?$/))) transpose = +m[1];
    else name.push(w);
  }
  name = name.join(' ').slice(0, 40);
  if (!name || repeat < 1 || repeat > SECTION_LIMITS.repeat || Math.abs(transpose) > SECTION_LIMITS.transpose) ok = false;
  return ok ? { name, repeat, transpose } : null;
}
// a chord or note moved by k semitones, with its name respelled (flats stay flats, sharps stay sharps)
function transposeItem(it, k) {
  if (!k) return Object.assign({}, it);
  if (it.kind === 'note') { const m = it.midi + k; return PLAYABLE(m) ? Object.assign({}, it, { midi: m, label: noteName(Math.round(m)) }) : null; }
  const spell = (name, pc) => (/b/.test(name.slice(1)) ? FLAT : SHARP)[pc];
  const label = it.label.replace(/^([A-G][#b]?)/, r => spell(r, (pcOf(r) + k + 120) % 12)).replace(/\/([A-G][#b]?)$/, (_, r) => '/' + spell(r, (pcOf(r) + k + 120) % 12));
  const pin = it.pin ? it.pin.map(p => p + k) : null;
  if (pin && pin.some(p => !PLAYABLE(p))) return null;
  return Object.assign({}, it, { label, root: (it.root + k + 120) % 12, bass: (it.bass + k + 120) % 12, pcs: it.pcs.map(p => (p + k + 120) % 12), pin });
}
function parseProgression(text) {
  const prep = line => line
    .replace(/\[([^\]]*)\]/g, (_, inner) => '[' + inner.trim().split(/[\s,]+/).join('_') + ']')
    .replace(/\(\s*(no|omit)\s*5\s*\)/gi, '(no5)');
  const errors = [], sections = [{ name: '', repeat: 1, transpose: 0, items: [] }];
  for (const line of String(text).split(/\r?\n/)) {
    const hm = line.match(/^\s*\[([^\]]*)\]\s*$/);
    if (hm) { const h = parseHeader(hm[1]); if (h) sections.push(Object.assign(h, { items: [] })); else errors.push(line.trim()); continue; }
    for (const tok of prep(line).split(/[\s,|]+/)) {
      if (!tok) continue;
      const it = parseItem(tok);
      if (!it) continue;
      if (it.kind === 'error') errors.push(it.label); else sections[sections.length - 1].items.push(it);
    }
  }
  const items = [];
  for (const s of sections) for (let r = 0; r < s.repeat; r++) for (const it of s.items) {
    if (items.length >= SECTION_LIMITS.items) break;
    const x = transposeItem(it, s.transpose);
    if (!x) { if (r === 0) errors.push(it.label + ' ' + (s.transpose > 0 ? '+' : '') + s.transpose); continue; }
    x.section = s.name; x.pass = r; x.key = s.transpose; items.push(x);
  }
  return { items, errors, sections: sections.filter(s => s.name).map(s => ({ name: s.name, repeat: s.repeat, transpose: s.transpose, chords: s.items.length })) };
}
// whether the chords have section headers
const hasSections = text => /^\s*\[[^\]]*\]\s*$/m.test(String(text || '')) && parseProgression(text).sections.length > 0;

const ORDERS = ['together', 'low-high', 'high-low', 'largest', 'smallest', 'random'];
const LOOKS = ['theme', 'phosphor', 'laserred', 'laserblue', 'amber', 'aurora', 'spectrum', 'neon', 'custom'];
/* ---- Tones ----
   Each tone is a fixed mix of harmonics, given as the strength of harmonic n (index n; index 0 is unused), in the sine terms
   unless it's an object { real, imag } with cosine terms too. The first five are hand-tuned recipes; the rest are formulas.
   The browser removes harmonics above the audible limit for each note, so long lists are safe. */
const harmonics = (count, f) => [0, ...Array.from({ length: count }, (_, i) => f(i + 1))];
const TONES = {
  pure: [0, 1], soft: [0, 1, .2, .06, .02], warm: [0, 1, .5, .25, .12, .06, .03], glass: [0, 1, 0, .32, 0, .16, 0, .08], reed: [0, 1, .6, .45, .3, .2, .12, .08, .05],
  triangle: harmonics(31, n => n % 2 ? (n % 4 === 1 ? 1 : -1) / (n * n) : 0),            // odd harmonics at 1/n², alternating sign
  square: harmonics(31, n => n % 2 ? 1 / n : 0),                                        // odd harmonics at 1/n
  pulse: { real: harmonics(32, n => Math.sin(n * Math.PI / 4) / n), imag: harmonics(32, () => 0) }, // a centred 25% pulse: cosine terms sin(nπ/4)/n, every 4th harmonic missing
  saw: harmonics(32, n => 1 / n),                                                      // every harmonic at 1/n
  organ: harmonics(8, n => ({ 1: 8, 2: 6, 3: 5, 4: 4, 6: 3, 8: 2 })[n] ? Math.pow(10, -3 * (8 - { 1: 8, 2: 6, 3: 5, 4: 4, 6: 3, 8: 2 }[n]) / 20) : 0), // drawbars 8' 4' 2⅔' 2' 1⅓' 1' at 8-6-5-4-3-2, 3 dB a step
  bowed: harmonics(16, n => (1 / n) * (1 + 0.9 * Math.exp(-Math.pow(n - 3.5, 2) / 3))), // a saw with harmonics 2–5 lifted by a resonance
  cello: harmonics(40, n => (Math.sin(n * Math.PI / 9) / n) * (1 + 0.6 * Math.exp(-Math.pow(n - 4, 2) / 3)) * Math.exp(-n / 28)), // bowed-string-inspired:
  // notches at multiples of the 9th harmonic (as from bowing at 1/9 of the length), a body resonance around harmonics 3–5, and a gentle roll-off
  brass: harmonics(20, n => besselJ(n - 1, 3) + (n % 2 ? -1 : 1) * besselJ(n + 1, 3)), // Chowning FM, carrier = modulator, index 3: harmonic n
  // gathers the sidebands J(n−1) and, folded back from below zero, J(n+1) (Chowning 1973, the classic FM brass)
  harp: harmonics(32, n => Math.sin(n * Math.PI / 7) / (n * n)),                       // a string plucked at 1/7 of its length: sin(nπ/7)/n²,
  // from the wave equation, so harmonics 7, 14, 21, 28 vanish (sustained here: the spectrum of a pluck, without its decay)
  octaves: harmonics(32, n => (n & (n - 1)) === 0 ? Math.exp(-Math.pow(Math.log2(n) - 1, 2) / (2 * 1.2 * 1.2)) : 0), // only octaves (1, 2, 4, 8,
  // 16, 32) under a bell curve in log-frequency centred one octave up, inspired by Shepard's and Risset's
  // octave stacks (theirs keep the bell curve fixed in absolute frequency; this one moves with the note)
  chime: harmonics(21, n => { const fib = [1, 2, 3, 5, 8, 13, 21], k = fib.indexOf(n); return k < 0 ? 0 : Math.pow((1 + Math.sqrt(5)) / 2, -k); }), // only
  // Fibonacci harmonics (1, 2, 3, 5, 8, 13, 21), each 1/φ the strength of the one before: a harmonic chime, not a real bell
  air: harmonics(20, n => n === 1 ? 1 : n === 2 ? 0.1 : n === 3 ? 0.03 : n >= 5 ? 0.01 : 0) // a nearly pure fundamental with a faint, flat
  // shelf of high harmonics (5–20), the nearest a fixed mix gets to a breathy flute
};
/* Bessel function of the first kind, J_k(x), by its power series (for the FM tone; small k and x converge quickly) */
function besselJ(k, x) {
  if (k < 0) return (k % 2 ? -1 : 1) * besselJ(-k, x);
  let term = Math.pow(x / 2, k); for (let i = 2; i <= k; i++) term /= i; // (x/2)^k / k!
  let sum = term;
  for (let m = 1; m < 60; m++) { term *= -(x * x / 4) / (m * (m + k)); sum += term; if (Math.abs(term) < 1e-16) break; }
  return sum;
}
/* Gains for the formula tones, measured so a reference piece at default settings reaches Soft's loudness (the original five stay
   at 1, unchanged). Brightness, register and voicing change each tone's level differently, so this keeps changes reasonable, not exact. */
const TONE_GAIN = { triangle: 1.17, square: 0.81, pulse: 1.36, saw: 1.29, organ: 1.1, bowed: 1.24, cello: 1.84, brass: 0.79, harp: 1.16, octaves: 1, chime: 1.11, air: 1 }; // measured: EBU R128 loudness of the same piece, matched to Soft
/* The tone as the two coefficient arrays the Web Audio API wants, of equal length */
function toneWave(name) { const t = TONES[name] || TONES.soft, imag = Array.isArray(t) ? t : t.imag, real = Array.isArray(t) ? imag.map(() => 0) : t.real; return { real, imag }; }
/* ---- Piece defaults: everything needed to reopen a piece identically ---- */
const PIECE_FORMAT = 'chord-glide-piece';
const PIECE_FORMAT_VERSION = 5; // 4 adds parts and a volume shape, 5 musical time (bars and beats); a piece is written as the oldest format that holds it (formatFor())
function defaultPiece() {
  return {
    format: PIECE_FORMAT, formatVersion: PIECE_FORMAT_VERSION, engine: ENGINE_VERSION,
    name: 'Untitled piece', created: null, modified: null,
    chords: '',
    seeds: { harmony: 1, voicing: 1, motion: 1, sound: 1 },
    locks: { harmony: true, voicing: false, motion: false, sound: false },
    voices: 11,
    timing: { chordSec: 4.5, glide: 1.6, easing: 'smooth', tempo: 60, meter: 4, unit: 'sec', chordBars: 1 },
    breathe: { depth: 0, time: 0.6 }, duck: { under: '', depth: 0, time: 0.25 },
    voicing: { continuity: 50, coverage: 50, stacking: 25, spacing: 25, variation: 25, spread: 100, top: 88, bassMode: 'root', bassOctave: 2 },
    motion: { order: 'together', stagger: 0 },
    sound: { tone: 'soft', detune: 4, width: 70, reverb: 38, brightness: 4200 },
    view: { mode: 'auto', labels: 'notes', trace: { look: 'theme', glow: 60, weight: 1, custom: { line: '#39ff88', line2: '#39ff88', bg: '#020604' } } }
  };
}
/* Fill any missing fields from defaults (older or partial files) */
class NewerPieceError extends Error {}
function normalizePiece(p) {
  const d = defaultPiece();
  if (p && typeof p === 'object' && +p.formatVersion > PIECE_FORMAT_VERSION)
    throw new NewerPieceError('This piece was made with a newer version of Chord Glide (file format ' + p.formatVersion + '). Open it in that version.');
  const out = JSON.parse(JSON.stringify(d));
  if (!p || typeof p !== 'object') return out;
  for (const k of Object.keys(p)) if (!(k in d) && k !== 'realization') { try { out[k] = JSON.parse(JSON.stringify(p[k])); } catch (e) {} } // keep fields this version doesn't use
  for (const k of Object.keys(d)) {
    if (p[k] === undefined) continue;
    if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k])) out[k] = Object.assign({}, d[k], p[k]);
    else out[k] = p[k];
  }
  out.format = PIECE_FORMAT; out.formatVersion = PIECE_FORMAT_VERSION; out.engine = ENGINE_VERSION;
  out.voices = Math.max(3, Math.min(MAX_VOICES, Math.round(+out.voices || 11)));
  for (const k of ['harmony', 'voicing', 'motion', 'sound']) { out.seeds[k] = (+out.seeds[k] >>> 0); out.locks[k] = !!out.locks[k]; }
  const pickFrom = (v, list, dflt) => list.includes(v) ? v : dflt;
  const num = (v, lo, hi, dflt) => { v = +v; return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : dflt; };
  out.chords = typeof out.chords === 'string' ? out.chords : '';
  out.name = String(out.name || 'Untitled piece').slice(0, 80);
  out.timing.easing = pickFrom(out.timing.easing, ['smooth', 'smoother', 'cosine', 'linear'], 'smooth');
  out.timing.chordSec = num(out.timing.chordSec, 1.5, 12, 4.5); out.timing.glide = num(out.timing.glide, 0, 12, 1.6); out.timing.tempo = Math.round(num(out.timing.tempo, 30, 180, 60));
  out.timing.meter = Math.round(num(out.timing.meter, 1, 12, 4)); out.timing.unit = pickFrom(out.timing.unit, ['sec', 'bar'], 'sec'); out.timing.chordBars = num(out.timing.chordBars, 0.25, 32, 1);
  for (const k of ['continuity', 'coverage', 'stacking', 'spacing', 'variation', 'spread']) out.voicing[k] = num(out.voicing[k], 0, 100, d.voicing[k]);
  out.voicing.top = Math.round(num(out.voicing.top, 67, 96, 88));
  out.voicing.bassOctave = Math.round(num(out.voicing.bassOctave, 1, 3, 2));
  out.voicing.bassMode = pickFrom(out.voicing.bassMode, ['root', 'nearest', 'pedal', 'none'], 'root');
  out.motion.order = pickFrom(out.motion.order, ORDERS, 'together'); out.motion.stagger = num(out.motion.stagger, 0, 100, 0);
  out.sound.tone = pickFrom(out.sound.tone, Object.keys(TONES), 'soft');
  out.sound.detune = num(out.sound.detune, 0, 20, 4); out.sound.width = num(out.sound.width, 0, 100, 70);
  out.sound.reverb = num(out.sound.reverb, 0, 100, 38); out.sound.brightness = num(out.sound.brightness, 800, 12000, 4200);
  out.view.mode = pickFrom(out.view.mode, ['auto', 'scroll', 'whole'], 'auto'); out.view.labels = pickFrom(out.view.labels, ['notes', 'hz'], 'notes');
  { // trace look: how the lines are drawn (saved with the piece, used for video)
    const tr = (p.view && p.view.trace && typeof p.view.trace === 'object') ? p.view.trace : {}, c = (tr.custom && typeof tr.custom === 'object') ? tr.custom : {};
    const hex = (v, dflt) => /^#[0-9a-f]{6}$/i.test(String(v)) ? String(v).toLowerCase() : dflt;
    const dc = d.view.trace.custom;
    out.view.trace = { look: pickFrom(tr.look, LOOKS, 'theme'), glow: num(tr.glow, 0, 100, 60), weight: num(tr.weight, 0.5, 3, 1), busy: pickFrom(tr.busy, ['range', 'middle', 'every'], 'range'),
      custom: { line: hex(c.line, dc.line), line2: hex(c.line2, hex(c.line, dc.line2)), bg: hex(c.bg, dc.bg) } };
  }
  { // auto zoom times chosen for this piece (seconds), in place of the automatic ones; kept in order
    const zm = p.view && p.view.zoom, ks = ['inStart', 'inEnd', 'outStart', 'outEnd'];
    delete out.view.zoom;
    if (zm && typeof zm === 'object') { const v = ks.map(k => Number(zm[k]));
      if (v.every(x => Number.isFinite(x) && x >= 0 && x <= 86400)) { for (let i = 1; i < 4; i++) v[i] = Math.max(v[i], v[i - 1]); out.view.zoom = {}; ks.forEach((k, i) => { out.view.zoom[k] = v[i]; }); } }
  }
  { const big = realizationTooLarge(p.realization); if (big) throw new Error('This piece can\'t be opened safely: ' + big + '.'); }
  if (validRealization(p.realization)) out.realization = JSON.parse(JSON.stringify(p.realization));
  { // parts beyond the main one, within the overall voice limit
    // the main part's voices: its saved notes' count when it has some (they can have more voices than the setting)
    const used = new Set(['main']); let room = REALIZATION_LIMITS.voices - Math.max(out.voices, out.realization ? out.realization.N : 0);
    out.parts = [];
    (Array.isArray(p.parts) ? p.parts : []).slice(0, MAX_PARTS).forEach((q, i) => {
      const part = normalizePart(q, out, i, used); if (!part) return;
      const n = partVoices(part, out.parts); if (n > room) return;
      room -= n; out.parts.push(part);
    });
    if (!out.parts.length) delete out.parts;
  }
  { // the volume shape: points in seconds and dB, joined by straight lines in dB
    const pts = (Array.isArray(p.volume) ? p.volume : []).filter(x => x && Number.isFinite(+x.t) && Number.isFinite(+x.db)).slice(0, 64)
      .map(x => ({ t: num(x.t, 0, 3600, 0), db: num(x.db, -60, 12, 0) })).sort((a, b) => a.t - b.t);
    if (pts.length) out.volume = pts; else delete out.volume;
  }
  { const obj = x => (x && typeof x === 'object' && !Array.isArray(x)) ? x : {}; out.breathe = (o => ({ depth: num(o.depth, 0, 0.9, 0), time: num(o.time, 0.05, 4, 0.6) }))(obj(p.breathe)); out.duck = (o => ({ under: String(o.under || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24), depth: num(o.depth, 0, 0.95, 0), time: num(o.time, 0.05, 2, 0.25) }))(obj(p.duck)); } // the main part's shape over time
  out.echo = normalizeEcho(p.echo); // the main part's echo
  if (p.mix === 'voices') out.mix = 'voices'; else delete out.mix;
  if (p.tuning === 'just') out.tuning = 'just'; else delete out.tuning; // pure chords that may drift (equal temperament if not set) // balance every voice equally rather than every part
  { const PL = p.plays, v = Array.isArray(PL) ? [...new Set(PL.map(x => String(x).slice(0, 40)).filter(Boolean))].slice(0, 64) : undefined; if (v) out.plays = v; else delete out.plays; } // the sections the main part plays in (all if none)
  out.formatVersion = formatFor(out); // other pieces still open in older versions
  return out;
}

/* ---- Voicing ---- */
const MASK = 4096; // 12 bits of chord-tone coverage per DP state
function weightsFrom(v) {
  return {
    move: (v.continuity / 50),                 // 50 -> 1.0
    miss: (v.coverage / 50) * 3.0,             // 50 -> 3.0
    dup: 3 * (1 - v.stacking / 50),            // 25 -> 1.5, 50 -> 0, 100 -> -3 (prefers stacking)
    gap: (v.spacing / 25) * 0.01,              // 25 -> 0.01
    jitter: Math.max(0.004, (v.variation / 100) * 3), // 0 -> seeded tie-break only
    top: v.top, spreadHi: v.top - 4,
    bassLo: 12 * (v.bassOctave + 1),           // octave 2 -> 36 (C2)
    bassMode: v.bassMode
  };
}
const placeBass = (pc, lo) => lo + (((pc - lo) % 12) + 12) % 12;
const eventRng = (seed, i, salt) => mulberry32(((seed >>> 0) ^ Math.imul(i + 1, 0x9E3779B1) ^ salt) >>> 0);

function pinnedVoicing(pin, N) {
  const p = [...pin].sort((a, b) => a - b);
  if (p.length === N) return p;
  return Array.from({ length: N }, (_, i) => p[Math.round(i * (p.length - 1) / Math.max(1, N - 1))]);
}

function chooseBass(ch, prevBass, W, isFirst) {
  const root = placeBass(ch.bass, W.bassLo);
  if (W.bassMode === 'pedal') return isFirst || prevBass == null ? root : prevBass;
  if (W.bassMode === 'nearest' && !isFirst && prevBass != null) {
    const pcs = ch.pcs;
    let best = placeBass(pcs.includes(ch.root) ? ch.root : pcs[0], W.bassLo), bd = Math.abs(best - prevBass) - 0.5; // ties go to the root
    for (const pc of pcs) { const m = placeBass(pc, W.bassLo); const d = Math.abs(m - prevBass); if (d < bd) { bd = d; best = m; } }
    return best;
  }
  return root; // 'root': root or slash note
}

/* Opening voicing out of a unison (or the first chord): spread over the register */
function spreadVoicing(ch, N, spread, rng, W) {
  const noBass = W.bassMode === 'none';
  const bass = noBass ? null : chooseBass(ch, null, W, true);
  // Highest note is a hard ceiling. In a tight register the voices may sit closer to the bass.
  let lo = noBass ? W.bassLo : bass + 7, hi = Math.min(W.spreadHi, W.top);
  if (lo > hi) { lo = noBass ? W.bassLo : bass + 1; hi = W.top; }
  let pool = [];
  for (let m = lo; m <= hi; m++) if (ch.pcs.includes(m % 12)) pool.push(m);
  if (!pool.length) for (let m = (noBass ? W.bassLo - 12 : bass + 1); m <= W.top; m++) if (ch.pcs.includes(m % 12)) pool.push(m);
  if (!pool.length) pool = [noBass ? Math.min(W.top, W.bassLo) : bass];
  const U = noBass ? N : N - 1;
  const maxD = Math.min(U, pool.length);
  const minD = Math.min(2, maxD);
  const D = Math.max(1, Math.round(minD + (maxD - minD) * spread));
  const chosen = [];
  for (let k = 0; k < D; k++) {
    const u = (k + 0.5 + (rng() - 0.5) * 0.7) / D;
    const target = lo + (hi - lo) * u;
    let best = null, bd = 1e9;
    for (const p of pool) { if (chosen.includes(p)) continue; const d = Math.abs(p - target); if (d < bd) { bd = d; best = p; } }
    if (best !== null) chosen.push(best);
  }
  for (const pc of ch.pcs) {
    if (chosen.some(p => p % 12 === pc)) continue;
    let swap = null, bd = 1e9;
    chosen.forEach((p, i) => {
      if (chosen.filter(x => x % 12 === p % 12).length < 2) return;
      for (const c of pool) { if (c % 12 !== pc || chosen.includes(c)) continue; const d = Math.abs(c - p); if (d < bd) { bd = d; swap = [i, c]; } }
    });
    if (swap) chosen[swap[0]] = swap[1];
  }
  chosen.sort((a, b) => a - b);
  const counts = chosen.map(() => Math.floor(U / chosen.length));
  let rem = U - counts.reduce((a, b) => a + b, 0);
  const order = chosen.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  for (let i = 0; rem > 0; i++, rem--) counts[order[i % order.length]]++;
  const out = noBass ? [] : [bass];
  chosen.forEach((p, i) => { for (let c = 0; c < counts[i]; c++) out.push(p); });
  return out;
}

/* Chord to chord: bass by bass mode; the other voices assigned jointly (DP, no crossings).
   Sets .fallback = true when the rules could not be satisfied. */
function leadVoicing(prev, ch, rng, W) {
  const noBass = W.bassMode === 'none';
  const bass = noBass ? null : chooseBass(ch, prev[0], W, false);
  const up = noBass ? prev.slice() : prev.slice(1);
  const ceil = W.top; // hard ceiling
  let floor = noBass ? W.bassLo : bass + 3;
  const P = ch.pcs.length;
  let allowed = [];
  const fill = (a, b) => { allowed = []; for (let m = a; m <= b; m++) { const i = ch.pcs.indexOf(m % 12); if (i >= 0) allowed.push({ m, i }); } };
  fill(floor, ceil);
  if (!allowed.length) { floor = noBass ? W.bassLo - 12 : bass + 1; fill(floor, ceil); }
  if (!allowed.length) { const only = noBass ? Math.min(W.top, W.bassLo) : bass; const out = up.map(() => only); if (!noBass) out.unshift(bass); out.fallback = true; return out; }
  const motion = d => W.move * (Math.abs(d) + 0.1 * d * d);
  const pop = x => { let c = 0; while (x) { c += x & 1; x >>= 1; } return c; };
  for (const win of [6, 12]) {
    const cands = up.map(p => {
      let c = allowed.filter(a => Math.abs(a.m - p) <= win);
      if (!c.length) c = [...allowed].sort((a, b) => Math.abs(a.m - p) - Math.abs(b.m - p)).slice(0, 3);
      return c.map(a => ({ m: a.m, i: a.i, j: rng() * W.jitter }));
    });
    const layers = [];
    let layer = new Map([[(floor - 1) * MASK, { cost: 0, back: null, m: null }]]);
    let ok = true;
    for (let v = 0; v < up.length; v++) {
      const next = new Map();
      for (const [key, st] of layer) {
        const lastP = Math.floor(key / MASK), mask = key % MASK;
        for (const c of cands[v]) {
          if (c.m < lastP) continue;
          const cost = st.cost + motion(c.m - up[v]) + c.j + (c.m === lastP ? W.dup : 0) + (v > 0 ? W.gap * (c.m - lastP) ** 2 : 0);
          const nk = c.m * MASK + (mask | (1 << c.i));
          const ex = next.get(nk);
          if (!ex || cost < ex.cost) next.set(nk, { cost, back: key, m: c.m });
        }
      }
      if (!next.size) { ok = false; break; }
      layers.push(next); layer = next;
    }
    if (!ok) continue;
    let bestKey = null, best = Infinity;
    for (const [key, st] of layer) {
      const total = st.cost + W.miss * (P - pop(key % MASK));
      if (total < best) { best = total; bestKey = key; }
    }
    const res = new Array(up.length);
    let k = bestKey;
    for (let v = up.length - 1; v >= 0; v--) { const st = layers[v].get(k); res[v] = st.m; k = st.back; }
    return noBass ? res : [bass, ...res];
  }
  const fb = up.map(p => [...allowed].sort((a, b) => Math.abs(a.m - p) - Math.abs(b.m - p))[0].m).sort((a, b) => a - b);
  const out = noBass ? fb : [bass, ...fb]; out.fallback = true;
  return out;
}

/* ---- Realization: the resolved notes and timing, saved so a piece can reopen exactly even after the engine changes ---- */
/* Saved notes from a file are played as written, so they're bounded: a broken or hostile file mustn't be able to freeze the page */
const MAX_VOICES = 32; // in the editor; saved notes may carry up to REALIZATION_LIMITS.voices
const REALIZATION_LIMITS = { voices: 64, seconds: 3600, events: 75000, values: 2000000 }; // events: snapshots (an hour at 20 a second); values: voices × events
function realizationTooLarge(r) {
  if (!r || typeof r !== 'object' || !Array.isArray(r.events)) return '';
  const L = REALIZATION_LIMITS;
  if (+r.N > L.voices) return 'it asks for ' + r.N + ' voices (at most ' + L.voices + ')';
  if (+r.total > L.seconds) return 'it lasts ' + Math.round(r.total / 60) + ' minutes (at most ' + L.seconds / 60 + ')';
  if (r.events.length > L.events) return 'it has ' + r.events.length.toLocaleString('en-US') + ' snapshots (at most ' + L.events.toLocaleString('en-US') + ')';
  if (r.events.length * (+r.N || 1) > L.values) return 'it has ' + r.events.length + ' snapshots of ' + r.N + ' voices (at most ' + L.values.toLocaleString('en-US') + ' notes in all)';
  if (r.events.some(e => e && Array.isArray(e.targets) && e.targets.some(p => typeof p === 'number' && (p < 0 || p > 127)))) return 'some of its notes are outside the playable range (MIDI 0–127)';
  return '';
}
function validRealization(r, rests = false) {
  // N and total must be real numbers: a total written as text ("28") would later be joined as text, not added
  if (!r || typeof r !== 'object' || !Array.isArray(r.events) || !r.events.length || !Number.isInteger(r.N) || r.N < 1) return false;
  if (typeof r.total !== 'number' || !Number.isFinite(r.total) || r.total <= 0 || realizationTooLarge(r)) return false;
  const okNum = x => typeof x === 'number' && Number.isFinite(x) && x >= 0;
  let lastT = -Infinity;
  return r.events.every(e => {
    if (!e || !Array.isArray(e.targets) || e.targets.length !== r.N || !e.targets.every(x => (typeof x === 'number' && Number.isFinite(x)) || (rests && x === null))) return false;
    if (!okNum(e.t) || !okNum(e.g) || e.t < lastT || e.t > r.total) return false; // times present, nonnegative, in order
    lastT = e.t;
    if (e.off === undefined && e.dur === undefined) return true;
    return Array.isArray(e.off) && Array.isArray(e.dur) && e.off.length === r.N && e.dur.length === r.N && e.off.every(okNum) && e.dur.every(okNum);
  });
}
/* Resolved notes for the pad parts of a score (lines regenerate exactly from what's written; saved notes are already notes) */
function partRealizations(built) {
  const out = {};
  for (const pt of built.parts || []) if (!pt.main && pt.preset === 'pad') out[pt.id] = pt.sub.frozen ? pt.realization : realizationOf(pt.sub);
  return out;
}
function realizationOf(built) {
  if (built.main) built = built.main; // the main part's; other pad parts' come from partRealizations()
  return { engine: ENGINE_VERSION, easing: built.piece.timing.easing, N: built.N, total: built.total,
    events: built.events.map(e => Object.assign({ t: e.t, g: e.g, label: e.label, kind: e.kind, targets: e.targets.slice(), off: e.off.slice(), dur: e.dur.slice() }, e.section ? { section: e.section, pass: e.pass || 0, key: e.key || 0 } : {})) };
}
function builtFromRealization(r, piece, normalized = false) {
  const P = normalized ? piece : normalizePiece(piece);
  const events = r.events.map(e => ({ t: e.t, g: e.g, label: e.label == null ? '' : String(e.label), kind: e.kind === 'note' ? 'note' : 'chord', targets: e.targets.slice(),
    off: e.off ? e.off.slice() : new Array(r.N).fill(0), dur: e.dur ? e.dur.slice() : new Array(r.N).fill(e.g), fallback: false,
    section: typeof e.section === 'string' ? e.section.slice(0, 40) : '', pass: Math.max(0, Math.floor(+e.pass) || 0), key: Math.max(-24, Math.min(24, Math.round(+e.key) || 0)), ...(EASE[e.ease] ? { ease: e.ease } : {}) })); // a glide shape of its own, if it names one
  // rests (null, allowed in parts): the voice holds its last pitch silently, then jumps to its next note as it sounds again.
  // A loudness for a voice in an event (vel, 0 to 1) strikes that note afresh at that loudness, even straight after another.
  const vels = r.events.map(e => Array.isArray(e.vel) && e.vel.length === r.N ? e.vel.map(x => x === null || x === undefined ? null : Math.max(0, Math.min(1, +x || 0))) : null);
  let gates = null;
  if (events.some(e => e.targets.some(x => x === null)) || vels.some(Boolean)) {
    gates = [];
    for (let v = 0; v < r.N; v++) {
      const firstP = events.map(e => e.targets[v]).find(x => x !== null);
      let held = firstP === undefined ? 60 : firstP, on = null, gate = null; const gs = [];
      events.forEach((e, i) => {
        const x = e.targets[v];
        const vv = vels[i] ? vels[i][v] : null;
        if (x === null) { e.targets[v] = held; e.dur[v] = 0; if (on !== null) { gs.push(gate); on = null; } }
        else {
          const fromRest = on === null;
          if (!fromRest && vv !== null) { gs.push(gate); on = null; } // struck afresh (keeping any glide into it)
          if (on === null) { on = e.t; gate = { on, off: Infinity }; if (vv !== null && vv !== 1) gate.v = vv; if (i > 0 && fromRest) e.dur[v] = 0; } held = x; }
        if (gs.length && gs[gs.length - 1].off === Infinity) gs[gs.length - 1].off = e.t;
      });
      if (on !== null) { gate.off = r.total; gs.push(gate); }
      gates.push(gs.length === 1 && gs[0].on === 0 && gs[0].off === r.total && gs[0].v === undefined ? null : gs);
    }
    if (gates.every(x => x === null)) gates = null;
  }
  let min = Infinity, max = -Infinity;
  for (const e of events) for (const p of e.targets) { if (p < min) min = p; if (p > max) max = p; }
  return { events, total: r.total, N: r.N, min, max, warnings: [], piece: P, ease: EASE[r.easing] || EASE.smooth, frozen: r.engine, gates };
}

/* ======== Parts (file format 4) ========
   The main part is the piece itself: its voices and its Voicing, Motion and Sound settings, voiced by the chord-following
   engine exactly as in format 3. A piece can add more parts in `parts`. Each has its own voices, sound (tone, level in dB,
   pan, width, detune) and envelope, and one of these pitch sources (presets):
     pad   – chord-following: the same engine, with its own voices, voicing and motion, and seeds derived from its id
     line  – a written line of notes and rests at the piece's tempo, doubled at fixed intervals (transpose), with portamento
             and vibrato
     notes – saved notes written by another program (`realization`, engine "custom"); a target of null is a rest
   Voices can rest: gates (when a voice sounds) and the part's envelope shape its gain over time. */
/* After the music's end: the tail (the closing fade and the reverb, which the clock and every render include), and the
   closing fade of the parts that sound throughout (the main part and pads) inside it */
const TAIL = 3.0, FADE = 2.8;
const PRESETS = ['pad', 'line', 'notes', 'pattern', 'copy'];
const MAX_PARTS = 32;
/* An echo as a sound setting: the part again, a note-length later at the tempo, quieter with each repeat (heard, not drawn).
   time: the note length; mix: the first repeat's level (0 is off); feedback: each repeat's share of the one before;
   pingpong: repeats alternate left and right. */
const ECHO_BEATS = { '1/16': 0.25, '1/8': 0.5, '3/16': 0.75, '1/4': 1, '3/8': 1.5, '1/2': 2 };
function normalizeEcho(o) {
  o = o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  const num = (v, lo, hi, d) => { v = +v; return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
  return { time: ECHO_BEATS[o.time] ? o.time : '3/16', mix: num(o.mix, 0, 1, 0), feedback: num(o.feedback, 0, 0.9, 0.35), pingpong: o.pingpong !== false };
}
/* How long an echo rings on after the last thing it repeats: until its repeats are 50 dB down (each one `feedback` of the one
   before, the first at `mix`), in seconds at this tempo */
function echoRing(ec, beat) {
  if (!ec || !(ec.mix > 0)) return 0;
  const dt = Math.min(4, (ECHO_BEATS[ec.time] || 0.75) * beat), fb = Math.min(0.9, Math.max(0, +ec.feedback || 0));
  const n = fb > 0 ? Math.max(1, Math.ceil(Math.log(0.00316 / ec.mix) / Math.log(fb))) : 1;
  return n * dt;
}
const ECHO_ROOM = 20; // the most an echo can lengthen a piece past the end of its music, in seconds
const STEPS = { '1/1': 4, '1/2': 2, '1/4': 1, '1/8': 0.5, '1/16': 0.25, '1/32': 0.125, '1/4t': 2 / 3, '1/8t': 1 / 3, '1/16t': 1 / 6 }; // in beats
const ENVELOPES = { // attack, decay and release in seconds; sustain as a fraction of full level
  pad: { attack: 0.4, decay: 0, sustain: 1, release: 1 },
  line: { attack: 0.01, decay: 0.15, sustain: 0.75, release: 0.12 },
  notes: { attack: 0.005, decay: 0, sustain: 1, release: 0.03 },
  pattern: { attack: 0.005, decay: 0.15, sustain: 0.6, release: 0.06 },
  copy: { attack: 0.01, decay: 0.15, sustain: 0.75, release: 0.12 } // (a copy uses its source's envelope)
};
/* A stable seed for one part and one purpose: adding, removing or reordering parts never changes another part's seeds */
function partSeed(seed, id, salt) {
  let h = (0x811C9DC5 ^ (seed >>> 0)) >>> 0;
  for (const ch of String(id) + '/' + salt) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193); }
  h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12; h = Math.imul(h, 0x297A2D39); h ^= h >>> 15;
  return h >>> 0;
}
function normalizePart(q, P, i, used) {
  if (!q || typeof q !== 'object') return null;
  const num = (v, lo, hi, dflt) => { v = +v; return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : dflt; };
  const obj = x => (x && typeof x === 'object' && !Array.isArray(x)) ? x : {};
  const preset = PRESETS.includes(q.preset) ? q.preset : 'line';
  let id = String(q.id || q.name || preset).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'part';
  for (let k = 2, base = id; used.has(id); k++) id = base + '-' + k;
  used.add(id);
  const s = obj(q.sound), e = obj(q.envelope), E0 = ENVELOPES[preset];
  const PL = q.plays, plays = Array.isArray(PL) ? [...new Set(PL.map(x => String(x).slice(0, 40)).filter(Boolean))].slice(0, 64) : undefined; // the sections it plays in (all if none)
  const part = { id, name: String(q.name || id).slice(0, 40), preset,
    sound: { tone: TONES[s.tone] ? s.tone : P.sound.tone, level: num(s.level, -60, 12, 0), pan: num(s.pan, -1, 1, 0),
      width: num(s.width, 0, 100, preset === 'pad' ? P.sound.width : 30), detune: num(s.detune, 0, 20, P.sound.detune) },
    envelope: { attack: num(e.attack, 0.001, 10, E0.attack), decay: num(e.decay, 0, 10, E0.decay), sustain: num(e.sustain, 0, 1, E0.sustain), release: num(e.release, 0.005, 20, E0.release), curve: e.curve === 'exp' ? 'exp' : 'linear' } };
  if (plays) part.plays = plays;
  part.echo = normalizeEcho(q.echo);
  part.duck = (o => ({ under: String(o.under || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24), depth: num(o.depth, 0, 0.95, 0), time: num(o.time, 0.05, 2, 0.25) }))(obj(q.duck)); // dips when another part strikes a note
  if (preset === 'pad') part.breathe = (o => ({ depth: num(o.depth, 0, 0.9, 0), time: num(o.time, 0.05, 4, 0.6) }))(obj(q.breathe)); // dips at each chord change
  if (preset === 'pad') {
    part.voices = Math.round(num(q.voices, 3, MAX_VOICES, 5)); // like the main part: a bass and at least two above it
    part.voicing = Object.assign({}, P.voicing, obj(q.voicing)); part.motion = Object.assign({}, P.motion, obj(q.motion)); // limited when it's voiced
    // its resolved notes, saved with the piece like the main part's, so a later engine plays it exactly as it was
    const big = realizationTooLarge(q.realization); if (big) throw new Error('This piece can\'t be opened safely: part ' + (i + 1) + ' ' + big + '.');
    if (validRealization(q.realization) && q.realization.N === part.voices) part.realization = JSON.parse(JSON.stringify(q.realization));
  } else if (preset === 'copy') { // another part, later and moved: an echo
    part.of = String(q.of || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
    part.delay = num(q.delay, 0, 64, 0.75); // in beats
    part.shift = Math.round(num(q.shift, -48, 48, 0)); // in semitones
    if (+q.voices > 0) part.voices = Math.round(num(q.voices, 1, MAX_VOICES, 1)); // only its source's first voices (all if not set)
  } else if (preset === 'line' || preset === 'pattern') {
    if (preset === 'line') part.line = typeof q.line === 'string' ? q.line.slice(0, 400000) : '';
    else { part.pattern = typeof q.pattern === 'string' ? q.pattern.slice(0, 4000) : 'R'; part.from = Math.round(num(q.from, 0, 115, 36)); } // its lowest note (MIDI)
    part.step = STEPS[q.step] ? q.step : '1/8';
    part.start = num(q.start, 0, 100000, 0); // in beats
    part.repeat = !!q.repeat; part.legato = !!q.legato;
    if (q.nonstop) part.nonstop = true; // its voices never stop: rests hold, and outside its sections they join the chords
    part.transpose = (Array.isArray(q.transpose) && q.transpose.length ? q.transpose : [0]).slice(0, 8).map(x => num(x, -48, 48, 0));
    part.portamento = num(q.portamento, 0, 4, 0.03);
    part.glideShape = ['smooth', 'straight', 'arc'].includes(q.glideShape) ? q.glideShape : 'smooth';
    const dr = obj(q.drop); part.drop = { semis: num(dr.semis, -48, 48, 0), time: num(dr.time, 0.005, 2, 0.12) }; // each note starts this far above and falls onto its pitch
    const vb = obj(q.vibrato);
    part.vibrato = { cents: num(vb.cents, 0, 100, 0), rate: num(vb.rate, 0.5, 12, 5.5), delay: num(vb.delay, 0, 5, 0.3) };
  } else {
    const big = realizationTooLarge(q.realization); if (big) throw new Error('This piece can\'t be opened safely: part ' + (i + 1) + ' ' + big + '.');
    if (!validRealization(q.realization, true)) return null;
    part.realization = JSON.parse(JSON.stringify(q.realization));
  }
  return part;
}
const partVoices = (part, others = []) => part.preset === 'copy' ? (s => s && s.preset !== 'copy' ? (part.voices ? Math.min(part.voices, partVoices(s)) : partVoices(s)) : 0)(others.find(x => x.id === part.of)) : part.preset === 'pad' ? part.voices : part.preset === 'line' || part.preset === 'pattern' ? part.transpose.length : part.realization.N;
/* A written line: notes like the chord box's (C4, F#3, D3+33) with a length in steps (`G4:2`), and rests (`-` or `r`).
   Bar lines `|` and commas are ignored. */
/* A line can be written out of range only by its notes (with `transpose`, the intervals it's doubled at): a note that would
   go outside MIDI 0–127 is reported and kept as a rest of the same length, so the timing holds. Lengths must be finite, from
   1/64 to 1024 steps. */
/* A line's or pattern's text can differ by section: [Name] starts the text for that section, [A A2] for both; text before any
   marker is used everywhere else. { base, by: Map name → text, sectioned } */
function splitBySection(text) {
  const by = new Map(), bits = String(text || '').split(/\[([^\]]*)\]/);
  for (let i = 1; i < bits.length; i += 2) for (const n of bits[i].split(/[\s,]+/).filter(Boolean)) by.set(n, (by.get(n) || '') + ' ' + bits[i + 1]);
  return { base: bits[0], by, sectioned: bits.length > 1 };
}
const textFor = (sp, name) => sp.by.has(name) ? sp.by.get(name) : sp.base;
const withoutMarkers = text => String(text || '').replace(/\[[^\]]*\]/g, ' ');
/* A note's loudness after @: 0 to 1 (@0.6) or a percentage (@60%); undefined if there's none, NaN if it can't be read */
function parseLoud(s) { if (s === undefined) return undefined; const pc = /%$/.test(s), v = parseFloat(s) / (pc ? 100 : 1); return v >= 0 && v <= 1 ? v : NaN; }
// a note: ~ to slide in, a name (or - or r for a rest), :steps, /seconds to glide in over (l straight, s smooth), @loudness
const LINE_NOTE = new RegExp('^(~)?(-|r|' + NOTE_OCT + ')(?::(\\d+(?:\\.\\d+)?))?(?:\\/(\\d*\\.?\\d+)([ls])?)?(?:@(\\d*\\.?\\d+%?))?$');
/* A written line: notes like G4 or D3+33 with a length in steps after a colon (G4:2), - or r for a rest; ~ before a note slides
   into it from the note before without a new attack; @ after it sets how loud it's struck (@0.6, @60%) */
function parseLine(text, transpose = [0], drop = 0) {
  const notes = [], errors = [];
  for (const tok of withoutMarkers(text).split(/[\s|,]+/).filter(Boolean)) {
    const m = tok.match(LINE_NOTE), steps = m ? (m[3] === undefined ? 1 : parseFloat(m[3])) : 0, v = m ? parseLoud(m[6]) : undefined;
    const rest = m && (m[2] === '-' || m[2] === 'r'), glide = m && m[4] !== undefined ? parseFloat(m[4]) : undefined;
    if (!m || !Number.isFinite(steps) || steps < 1 / 64 || steps > 1024 || Number.isNaN(v) || (glide !== undefined && !(glide <= 3600)) || (rest && (m[1] || v !== undefined || glide !== undefined))) { errors.push(tok); continue; }
    const p = rest ? null : parseNoteOct(m[2].replace(/¢$/, ''));
    const slide = !!m[1] || glide !== undefined;
    if (p !== null && !fitsRange(p, transpose, slide ? 0 : drop)) { errors.push(tok + ' (out of range)'); notes.push({ p: null, steps }); continue; }
    const n = { p, steps, slide, v: v === undefined ? 1 : v };
    if (glide !== undefined) { n.glide = glide; if (m[5]) n.shape = m[5] === 'l' ? 'linear' : 'smooth'; } // its own glide, without a new attack
    notes.push(n);
  }
  return { notes, errors };
}
const LINE_LIMITS = { notes: 20000, total: 100000, shortest: 0.005 }; // notes per part and in the whole piece; shortest note (s)
/* ---- Patterns ----
   A pattern part plays a cycle of steps that take their notes from the chord sounding when each step starts:
     R  the chord's root, B its bass note (they differ in a slash chord), in the octave from the part's lowest note (`from`) up;
     3rd, 5th, 7th  the chord's third, fifth and seventh, the same way (a sus chord's 3rd is its sus note);
     1, 2, 3 …  chord tones in a close voicing from `from` up (past the chord's last tone, the next octave: in a triad, 4 is 1 an
       octave up);
     a note name (C1, F#2) is that note whatever the chord, as for a kick;
     ~ before a note slides into it without a new attack, and @ after it sets how loud it's struck (R@0.5, ~3@70%), as in lines;
     ' after a step raises it an octave, , lowers it (R' R, 3'');  . holds the note before;  - or r is a rest;
     :2 after any of them makes it two steps long (R:2, .:4, -:0.5).
   The cycle starts with the piece (or with each stretch of sections the part plays in) and loops until the music ends. */
const PATTERN_STEP = new RegExp('^(~)?(R|B|3rd|5th|7th|[1-9]\\d?|\\.|-|r|' + NOTE_OCT + ')([\'’,]*)(?::(\\d+(?:\\.\\d+)?))?(?:@(\\d*\\.?\\d+%?))?$');
function parsePattern(text) {
  const steps = [], errors = [];
  for (const tok of withoutMarkers(text).split(/[\s|]+/).filter(Boolean)) { // (a comma is an octave down, not a separator)
    const m = tok.match(PATTERN_STEP), len = m ? (m[4] === undefined ? 1 : parseFloat(m[4])) : 0, v = m ? parseLoud(m[5]) : undefined;
    const plain = m && ['.', '-', 'r'].includes(m[2]); // holds and rests take no slide, loudness or octave
    if (!m || !(len >= 1 / 64 && len <= 1024) || Number.isNaN(v) || (plain && (m[1] || m[3] || v !== undefined))) { errors.push(tok); continue; }
    const oct = [...m[3]].reduce((a, c) => a + (c === ',' ? -1 : 1), 0), fixed = /\d/.test(m[2]) && /^[A-G]/.test(m[2]); // a note name: the same note whatever the chord
    const extra = { slide: !!m[1], v: v === undefined ? 1 : v };
    steps.push(m[2] === '.' ? { kind: 'hold', steps: len } : m[2] === '-' || m[2] === 'r' ? { kind: 'rest', steps: len }
      : fixed ? Object.assign({ kind: 'note', what: 'fixed', p: parseNoteOct(m[2].replace(/¢$/, '')), oct, steps: len }, extra) : Object.assign({ kind: 'note', what: m[2], oct, steps: len }, extra));
  }
  return { steps, errors };
}
// the note a step picks from a chord (or from a unison note), counting up from `from`
function patternNote(it, s, from) {
  const pc = x => ((x % 12) + 12) % 12, up = c => from + pc(c - from); // the first note at or above `from` with pitch class c
  const root = it.kind === 'note' ? pc(Math.round(it.midi)) : it.root, bass = it.kind === 'note' ? root : it.bass;
  let p;
  const deg = (...ivs) => { const rel = (it.kind === 'note' ? [0] : it.pcs).map(q => pc(q - root)); const iv = ivs.find(x => rel.includes(x)); return iv === undefined ? root : pc(root + iv); };
  if (s.what === 'fixed') p = s.p; else if (s.what === 'R') p = up(root);
  // a sus chord's 3rd is its sus note; a chord without a 7th gives its 6th, or its root
  else if (s.what === '3rd') p = up(deg(4, 3, 5, 2)); else if (s.what === '5th') p = up(deg(7, 6, 8)); else if (s.what === '7th') p = up(deg(10, 11, 9, 0));
  else if (s.what === 'B') p = up(bass);
  else { const pcs = it.kind === 'note' ? [root] : it.pcs, tones = pcs.map(up).sort((a, b) => a - b), n = +s.what - 1; p = tones[n % tones.length] + 12 * Math.floor(n / tones.length); }
  return p + 12 * s.oct;
}
// which chord sounds at time t: { t, it } entries in order
/* ---- Just intonation ----
   With `tuning: 'just'`, each chord's notes are tuned as pure ratios from its root (a major third 5/4, a fifth 3/2, a minor
   third 6/5; a 7th over a major third is the harmonic 7/4, and the tritone 11/8, so a pinned harmonic-series voicing rings as
   the harmonics do), and the root itself is placed so that a note the chord shares with the one before stays exactly where it
   was (its root if shared, else its fifth, a third, a sixth or its fourth; with none of those, the root moves by a pure interval
   from the root before). So a progression that comes round can drift: C Am Dm G C lands
   a syntonic comma (21.5 cents) lower each time, and C G Dm Am C as much higher. A single note keeps the tuning before it.
   justTuning() gives each item a tuning: off(pc) is the cents from equal temperament of that pitch class in that chord. */
const JUST = [0, 11.73, 3.91, 15.64, -13.69, -1.96, -9.78, 1.96, 13.69, -15.64, 17.6, -11.73]; // 16/15 9/8 6/5 5/4 4/3 45/32 3/2 8/5 5/3 9/5 15/8
function justTuning(items) {
  const pc = x => ((Math.round(x) % 12) + 12) % 12;
  let prev = null;
  return items.map(it => {
    if (it.kind !== 'chord') return prev || { off: () => 0, pcs: [pc(it.midi)] };
    const major = it.pcs.includes((it.root + 4) % 12);
    const J = q => { const i = ((q - it.root) % 12 + 12) % 12; return i === 10 && major ? -31.17 : i === 6 && major ? -48.68 : JUST[i]; };
    let rootOff = 0;
    if (prev) {
      // a consonant note held in common: the root, fifth, a third, a sixth or the fourth (not a 7th, 9th or tritone, whose pure
      // tunings are far from equal temperament); with none, the root moves by a pure interval from the root before (F to G7: 9/8)
      const prefs = [0, 7, 4, 3, 8, 9, 5].map(i => (it.root + i) % 12).filter(q => it.pcs.includes(q));
      const shared = prefs.find(q => prev.pcs.includes(q));
      rootOff = shared !== undefined ? prev.off(shared) - J(shared) : prev.root === undefined ? prev.off(it.root) : prev.off(prev.root) + JUST[((it.root - prev.root) % 12 + 12) % 12];
    }
    return prev = { off: q => rootOff + J(q), pcs: it.pcs, root: it.root };
  });
}
// a pitch tuned by a tuning (none: as it is); a pitch written with cents keeps them on top
const tunedBy = (tu, p) => tu ? p + tu.off(((Math.round(p) % 12) + 12) % 12) / 100 : p;
// the timeline entry sounding at time t
function entryAt(timeline, t) { let lo = 0, hi = timeline.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (timeline[m].t <= t + 1e-9) lo = m; else hi = m - 1; } return timeline[lo]; }
function chordAt(timeline, t) { let lo = 0, hi = timeline.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (timeline[m].t <= t + 1e-9) lo = m; else hi = m - 1; } return timeline[lo].it; }
function buildPattern(part, P, timeline, lay, budget = LINE_LIMITS.notes, end = 0) {
  const tr = part.transpose;
  if (!timeline || !timeline.length) return null;
  const beat = 60 / P.timing.tempo, stepSec = STEPS[part.step] * beat;
  const maxNotes = Math.min(budget, LINE_LIMITS.notes), seq = []; let cut = false;
  for (const run of lay) {
    const { steps } = parsePattern(run.text);
    if (!steps.some(s => s.kind === 'note')) continue;
    if (steps.some(s => s.steps * stepSec < LINE_LIMITS.shortest)) return null;
    const stop = Math.min(run.t1, REALIZATION_LIMITS.seconds); let t = run.t0 + part.start * beat;
    while (t < stop - 1e-9 && !cut) for (const s of steps) {
      if (t >= stop - 1e-9) break;
      if (seq.length >= maxNotes) { cut = true; break; }
      const t1 = Math.min(t + s.steps * stepSec, stop), last = seq[seq.length - 1];
      if (s.kind === 'hold') { if (last && Math.abs(last.t1 - t) < 1e-9) last.t1 = t1; else seq.push({ t0: t, t1, p: null }); }
      else if (s.kind === 'rest') seq.push({ t0: t, t1, p: null });
      else { const e = entryAt(timeline, t), p = tunedBy(e.tu, patternNote(e.it, s, part.from)); seq.push({ t0: t, t1, p: fitsRange(p, tr, fallOf(part, s.slide)) ? p : null, slide: s.slide, v: s.v }); } // out of range: a rest
      t = t1;
    }
  }
  return lineFromSeq(part.nonstop ? nonstopSeq(seq, part, P, timeline, end) : seq, part, P, cut);
}
/* A line part's timeline: one event per note, a glide of `portamento` seconds from a note straight before it (a jump after
   a rest), and a gate per note. Notes that follow each other end a moment early so the next one is heard as a new note,
   unless the part is legato, which joins them into one gate. A repeating line fills `until`. */
/* Where a line or pattern is laid, and with which text: [{ t0, t1, text }].
   Text that differs by section: each stretch of the piece, section by section, with that section's text (a stretch outside any
   section, or a section without its own, takes the text before the markers), restarting at each.
   Otherwise: for a part that plays in chosen sections, each run of them; else the whole piece, to `end`. */
function layoutFor(text, plays, runs, total, end) {
  const sp = splitBySection(text);
  if (sp.sectioned && runs.length) {
    const all = []; let t = 0;
    for (const r of runs) { if (r.t0 > t + 1e-9) all.push({ name: '', t0: t, t1: r.t0 }); all.push(r); t = r.t1; }
    if (t < total - 1e-9) all.push({ name: '', t0: t, t1: total });
    return all.filter(r => !plays || plays.includes(r.name)).map(r => ({ t0: r.t0, t1: r.t1, text: textFor(sp, r.name) })).filter(r => r.text.trim());
  }
  const spans = plays && runs.length ? playSpans(runs, plays) : null;
  return spans ? spans.map(([a, b]) => ({ t0: a, t1: b, text: sp.base })) : [{ t0: 0, t1: end, text: sp.base }];
}
// the key change in force at time t (a section's +2), 0 outside sections
const keyAtFrom = runs => t => { for (const r of runs) if (t >= r.t0 - 1e-9 && t < r.t1 - 1e-9) return r.key || 0; return 0; };
function buildLine(part, P, lay, budget = LINE_LIMITS.notes, keyAt = () => 0, timeline = null, end = 0) {
  const tr = part.transpose, N = tr.length;
  const beat = 60 / P.timing.tempo, stepSec = STEPS[part.step] * beat;
  const maxNotes = Math.min(budget, LINE_LIMITS.notes), seq = []; let cut = false;
  for (const run of lay) {
    const { notes } = parseLine(run.text, tr, fallOf(part));
    if (notes.some(n => n.steps * stepSec < LINE_LIMITS.shortest)) return null; // too short to hear, and the way to millions of notes
    // stops at the note budget or the longest a piece can be, whichever comes first
    const stop = Math.min(run.t1, REALIZATION_LIMITS.seconds); let t = run.t0 + part.start * beat;
    while (notes.length && t < stop - 1e-9 && !cut) {
      for (const n of notes) {
        if (t >= stop - 1e-9) break;
        if (seq.length >= maxNotes) { cut = true; break; }
        // a written note moves with the section's key change, as the chords do
        const q = n.p === null ? null : timeline ? tunedBy(entryAt(timeline, t).tu, n.p + keyAt(t)) : n.p + keyAt(t), p = q !== null && fitsRange(q, tr, fallOf(part, n.slide)) ? q : null;
        const t1 = t + n.steps * stepSec, x = { t0: t, t1: Math.min(t1, stop), p, slide: n.slide, v: n.v };
        if (n.glide !== undefined) { x.glide = n.glide; if (n.shape) x.shape = n.shape; }
        seq.push(x); t = t1;
      }
      if (!part.repeat) break;
    }
    if (cut) break;
  }
  return lineFromSeq(part.nonstop ? nonstopSeq(seq, part, P, timeline, end) : seq, part, P, cut);
}
/* A part that never stops: its voices sound from the first moment to the end, as one tone each. A rest holds the note before it;
   wherever the part has nothing to play (outside its sections, before its first note, after its last) its voices join the chords:
   each glides to a chord tone in its own register (spread over the range the part plays in, then led to the nearest tone at each
   change, over the piece's glide time), and a single note (=G4) gathers them all onto it. The note after a stretch of chords glides in
   too. Entries may carry their own pitch for each voice (`ps`), glide (`g`) and glide shape (`ease`); `join` marks the chord tones. */
function nonstopSeq(seq, part, P, timeline, end) {
  const tr = part.transpose, N = tr.length, sounding = seq.filter(x => x.p !== null);
  const total = Math.max(end || 0, seq.length ? seq[seq.length - 1].t1 : 0);
  if (!timeline || !timeline.length || !(total > 0)) return seq;
  const lo = sounding.length ? Math.min(...sounding.map(x => x.p)) : 60, hi = sounding.length ? Math.max(...sounding.map(x => x.p)) : 60;
  // where each voice sits among the chords: voices doubling the same line spread over its range
  const home = tr.map((d, v) => { const grp = tr.map((x, i) => x === d ? i : -1).filter(i => i >= 0), j = grp.indexOf(v), m = grp.length; return lo + d + (hi - lo) * (j + 0.5) / m; });
  const pc = x => ((x % 12) + 12) % 12;
  const nearest = (pcs, x) => { let best = null; for (let p = Math.floor(x) - 7; p <= Math.ceil(x) + 7; p++) if (pcs.includes(pc(p)) && (best === null || Math.abs(p - x) < Math.abs(best - x))) best = p; return best !== null && PLAYABLE(best) ? best : Math.round(x); };
  const T = P.timing, longGlide = Math.max(2.4, T.glide * 1.9), out = [];
  let cur = null, gathered = true; // the voices' last pitches; whether they last gathered on one note (or haven't moved yet)
  const push = x => { out.push(x); cur = x.ps || tr.map(d => x.p + d); gathered = !!x.gather; };
  const join = (a, b) => {
    for (let k = 0; k < timeline.length; k++) {
      const t0 = Math.max(a, timeline[k].t), t1 = Math.min(b, k + 1 < timeline.length ? timeline[k + 1].t : Infinity);
      if (t1 <= t0 + 1e-9) continue;
      const it = timeline[k].it, len = t1 - t0, wasGathered = gathered, last = out[out.length - 1];
      if (it.kind === 'note') { push({ t0, t1, p: it.midi, ps: new Array(N).fill(it.midi), join: true, gather: true, g: cur ? Math.min(longGlide, len * 0.92) : 0, ease: 'smooth' }); continue; }
      const ps = tr.map((d, v) => tunedBy(timeline[k].tu, nearest(it.pcs, last && last.join && !wasGathered ? cur[v] : home[v])));
      push({ t0, t1, p: ps[0], ps, join: true, g: cur ? Math.min(wasGathered ? longGlide : T.glide, len * 0.92) : 0, ease: 'smooth' });
    }
  };
  let t = 0;
  for (const x of seq) {
    if (x.t0 > t + 1e-9) join(t, x.t0);
    if (x.p === null) { if (out.length) out[out.length - 1].t1 = x.t1; else join(x.t0, x.t1); } // a rest holds
    else { const prev = out[out.length - 1], y = Object.assign({}, x);
      if (prev && prev.join) { y.g = Math.min(prev.gather ? longGlide : T.glide, (x.t1 - x.t0) * 0.5); y.ease = 'smooth'; } // in from the chords
      push(y); }
    t = Math.max(t, x.t1);
  }
  if (t < total - 1e-9) join(t, total);
  return out;
}
/* A sequence of notes and rests ({ t0, t1, p }, p null for a rest) as a part's timeline: one event per note, a glide of the
   part's portamento from a note straight before it, and a gate per note (a legato part joins notes that touch) */
function lineFromSeq(seq, part, P, cut) {
  const tr = part.transpose, N = tr.length, sounding = seq.filter(x => x.p !== null);
  if (!sounding.length) return null;
  const first = sounding[0].p, zeros = () => new Array(N).fill(0), at = x => x.ps || tr.map(d => x.p + d);
  const events = [{ t: 0, g: 0, label: noteName(first), kind: 'note', targets: at(sounding[0]), off: zeros(), dur: zeros() }];
  const raw = [], drop = part.drop && part.drop.semis ? part.drop : null; let arcN = 0;
  const falls = x => drop && !x.slide && !x.join; // a slide, or a part that never stops resting on the chords, doesn't fall
  if (falls(sounding[0])) events[0].targets = tr.map(d => first + drop.semis + d); // it starts from the top of its first fall
  seq.forEach((x, k) => {
    if (x.p === null) return;
    const prev = seq[k - 1], joined = prev && prev.p !== null && Math.abs(prev.t1 - x.t0) < 1e-9;
    if (x.g !== undefined) { // its own glide (a part that never stops, joining or leaving the chords)
      const ev = { t: x.t0, g: x.g, label: noteName(x.p), kind: 'note', targets: at(x), off: zeros(), dur: new Array(N).fill(x.g) };
      if (x.ease) ev.ease = x.ease;
      if (!(events.length === 1 && x.t0 === 0)) events.push(ev);
    } else if (falls(x)) { // every note starts `semis` above its pitch and falls onto it, fast then settling (EASE.drop)
      const g = Math.min(drop.time, x.t1 - x.t0);
      events.push({ t: x.t0, g: 0, label: noteName(x.p), kind: 'note', targets: tr.map(d => x.p + drop.semis + d), off: zeros(), dur: zeros() },
        { t: x.t0, g, label: noteName(x.p), kind: 'note', targets: tr.map(d => x.p + d), off: zeros(), dur: new Array(N).fill(g) });
    } else {
    // a slide (~) glides in over the part's portamento (or 80 ms if it has none), up to the whole note; other notes that touch, up to half
    const g = !joined ? 0 : x.glide !== undefined ? Math.min(x.glide, x.t1 - x.t0) : Math.min(x.slide ? part.portamento || 0.08 : part.portamento, (x.t1 - x.t0) * (x.slide ? 1 : 0.5));
    arcN = joined && g > 0 ? arcN + 1 : 0;
    const ev1 = { t: x.t0, g, label: noteName(x.p), kind: 'note', targets: at(x), off: zeros(), dur: new Array(N).fill(g) };
    if (x.shape && g > 0) ev1.ease = x.shape; // a note's own glide shape
    else if (part.glideShape === 'arc' && g > 0) ev1.ease = arcN % 2 ? 'arcout' : 'arcin'; // out, in, out, in … along each run of joined notes
    else if (drop && g > 0) ev1.ease = part.glideShape === 'straight' ? 'linear' : 'smooth'; // a slide in a part that falls
    if (!(events.length === 1 && x.t0 === 0)) events.push(ev1);
    }
    // a note that slides in, or any note of a legato part, continues the note before (one gate, at the loudness it was struck)
    if (x.join) return; // (resting on the chords: no note)
    if ((part.legato || x.slide) && joined && raw.length && raw[raw.length - 1].off >= x.t0 - 1e-9) raw[raw.length - 1].off = x.t1; else raw.push({ on: x.t0, off: x.t1, v: x.v === undefined ? 1 : x.v });
  });
  const gates = raw.map((gt, k) => { const next = raw[k + 1], cut = next && Math.abs(next.on - gt.off) < 1e-9 ? Math.min(0.03, (gt.off - gt.on) * 0.25) : 0; return gt.v === 1 ? { on: gt.on, off: gt.off - cut } : { on: gt.on, off: gt.off - cut, v: gt.v }; });
  let min = Infinity, max = -Infinity;
  for (const e of events) for (const p of e.targets) { if (p < min) min = p; if (p > max) max = p; }
  // a part that never stops has no gates (it sounds throughout, at its level); its notes are still `strikes`, for vibrato and ducking
  const sub = { events, total: seq[seq.length - 1].t1, N, min, max, warnings: [], piece: P, ease: drop ? EASE.drop : part.glideShape === 'straight' ? EASE.linear : EASE.smooth,
    gates: part.nonstop ? null : tr.map(() => gates), vibrato: part.vibrato.cents > 0 ? part.vibrato : null, notes: seq.length, cut };
  if (part.nonstop) { sub.strikes = tr.map(() => gates); sub.held = true; }
  return sub;
}
function buildPart(part, P, items, until, budget, lay = null, timeline = null, keyAt = () => 0) {
  let sub = null;
  if (part.preset === 'line') sub = buildLine(part, P, lay || [{ t0: 0, t1: part.repeat ? until : Infinity, text: part.line }], budget, keyAt, timeline, until);
  else if (part.preset === 'pattern') sub = buildPattern(part, P, timeline, lay || [{ t0: 0, t1: until, text: part.pattern }], budget, until);
  else if (part.preset === 'pad' && part.realization && part.realization.engine !== ENGINE_VERSION && validRealization(part.realization))
    sub = builtFromRealization(part.realization, P, true); // saved by another engine: play it exactly as it was
  else if (part.preset === 'notes') sub = builtFromRealization(part.realization, P, true);
  else if (items && items.length) { // pad: the chord-following engine with this part's voices and settings, and its own seeds
    const S = P.seeds;
    sub = buildPiece(items, { name: P.name, chords: P.chords, voices: part.voices, timing: P.timing, voicing: part.voicing, motion: part.motion, sound: P.sound,
      seeds: { harmony: S.harmony, voicing: partSeed(S.voicing, part.id, 'voicing'), motion: partSeed(S.motion, part.id, 'motion'), sound: partSeed(S.sound, part.id, 'sound') } });
  }
  if (sub) sub.env = part.envelope;
  return sub;
}
/* The whole score: the main part (as built by buildPiece or builtFromRealization) and the piece's other parts.
   Voices are numbered across parts, main first; `voices[v]` says which part and which of its voices. The chord
   timeline (`events`) stays the main part's, for labels, auto zoom, MIDI chords and MusicXML. */
/* The sections as they fall in time: runs of the main part's events with the same section and time through,
   { name, pass, t0, t1 } (none if the chords have no headers) */
function sectionRuns(main) {
  const out = [], ev = main.events;
  ev.forEach((e, i) => { if (!e.section) return; const last = out[out.length - 1], t1 = i + 1 < ev.length ? ev[i + 1].t : main.total;
    if (last && last.name === e.section && last.pass === (e.pass || 0) && Math.abs(last.t1 - e.t) < 1e-9) last.t1 = t1; else out.push({ name: e.section, pass: e.pass || 0, key: e.key || 0, t0: e.t, t1 }); });
  return out;
}
// the stretches of time a part plays in: the runs of its sections, joined where they meet
function playSpans(runs, plays) {
  const out = [];
  for (const r of runs) { if (!plays.includes(r.name)) continue; const last = out[out.length - 1]; if (last && Math.abs(last[1] - r.t0) < 1e-9) last[1] = r.t1; else out.push([r.t0, r.t1]); }
  return out;
}
/* A part's notes later by dt seconds and moved by dp semitones (a copy: an echo). The voices hold their first pitch until the
   copy begins; it uses its source's envelope, vibrato and glides. Null if moving it would leave MIDI's range. */
function shiftSub(src, dt, dp, voices = 0) {
  const n = voices > 0 ? Math.min(voices, src.N) : src.N, keep = a => a.slice(0, n); // the first `voices` of its source's voices
  const events = src.events.map((e, i) => Object.assign({}, e, { t: i === 0 ? 0 : e.t + dt, targets: keep(e.targets).map(p => p + dp), off: e.off && keep(e.off), dur: e.dur && keep(e.dur) }));
  /* A voice that sounds throughout (each of a pad's, of a part that never stops, or one voice of saved notes that never rests)
     has no notes to move later. In the copy it's silent until the delay, then enters as a pad does, whatever the part's own
     envelope, and sounds on to the end of the music, fading with it (`heldV`). A copy of a held part (a pad, also in its
     sections, or a part that never stops, or copied voices that all sound throughout) plays on to the end of the music and fades
     with it, so it doesn't lengthen the piece; a copy with notes ends its delay later, its held voices with it. */
  const srcGates = keep(src.gates || new Array(src.N).fill(null)), heldV = srcGates.map(gs => !gs);
  const held = !src.gates || !!src.held || heldV.every(Boolean), end = src.total, last = held ? end : end + dt, endAt = t => held ? Math.min(t, end + TAIL) : t;
  const later = g => g.v === undefined ? { on: g.on + dt, off: endAt(g.off + dt) } : { on: g.on + dt, off: endAt(g.off + dt), v: g.v };
  const gates = srcGates.map(gs => gs ? gs.map(later).filter(g => g.on < end - 1e-9 || !held) : dt < last ? [{ on: dt, off: last + TAIL }] : []);
  const strikes = src.strikes ? keep(src.strikes).map(gs => gs ? gs.map(later) : gs) : undefined;
  let min = Infinity, max = -Infinity; for (const e of events) for (const p of e.targets) { if (p < min) min = p; if (p > max) max = p; }
  if (!PLAYABLE(min) || !PLAYABLE(max)) return null; // the voices it copies, moved, must keep to MIDI's range (the ones it leaves out needn't)
  const out = Object.assign({}, src, { events, gates, N: n, total: last, min, max, envCache: null, notes: 0, cut: false });
  if (held) { out.held = true; if (!out.env) out.env = ENVELOPES.pad; }
  if (heldV.some(Boolean)) out.heldV = heldV;
  if (strikes) out.strikes = strikes; return out;
}
/* Gate a part to the stretches it plays in: each voice sounds only where its own notes and those stretches meet, entering and
   leaving by the part's envelope. A part that sounds throughout (`held`: pads, the main part) and plays on to the end of the
   music keeps sounding through the closing fade, which fades it as before. */
function maskGates(sub, spans, end, held) {
  const out = [];
  for (let v = 0; v < sub.N; v++) {
    const gs = sub.gates && sub.gates[v] ? sub.gates[v] : [{ on: 0, off: sub.total }], res = [];
    for (const g of gs) for (const [a, b] of spans) { const on = Math.max(g.on, a), off = Math.min(g.off, b); if (off > on + 1e-9) res.push({ on, off }); }
    res.sort((x, y) => x.on - y.on);
    if (held && res.length && res[res.length - 1].off >= end - 1e-9) res[res.length - 1].off = end + TAIL;
    out.push(res);
  }
  sub.gates = out; sub.envCache = null; if (!sub.env) sub.env = ENVELOPES.pad; sub.held = !!held;
}
function buildScore(main, items) {
  const P = main.piece;
  const runs = sectionRuns(main), spansFor = plays => !plays ? null : !plays.length ? [] : runs.length ? playSpans(runs, plays) : null; // in no section: silent
  if (spansFor(P.plays)) maskGates(main, spansFor(P.plays), main.total, true);
  const list = [{ id: 'main', name: 'Main', preset: 'pad', main: true, sub: main, envelope: null,
    sound: { tone: P.sound.tone, level: 0, pan: 0, width: P.sound.width, detune: P.sound.detune } }];
  const others = P.parts || [];
  // non-repeating lines and saved notes can run past the chords; repeating lines then fill the whole length
  let budget = LINE_LIMITS.total; // notes all lines may make together
  const take = sub => { if (sub && sub.notes) budget -= sub.notes; return sub; };
  const sp = part => spansFor(part.plays), keyAt = keyAtFrom(runs);
  const sectioned = part => (part.preset === 'line' || part.preset === 'pattern') && runs.length && splitBySection(part.preset === 'line' ? part.line : part.pattern).sectioned;
  const deferred = part => part.preset === 'line' && part.repeat && !sp(part) && !sectioned(part); // a repeating line fills the whole piece, once its length is known
  // the chords in time, for patterns: the main part's events when they match the chords one for one (as built, or saved), else timed from the chords
  const TU = P.tuning === 'just' && items && items.length ? justTuning(items) : null;
  const timeline = items && items.length ? (main.events.length === items.length ? items.map((it, k) => ({ t: main.events[k].t, it, tu: TU && TU[k] }))
    : (() => { let t = 0; return items.map((it, k) => { const e = { t, it, tu: TU && TU[k] }; t += itemSeconds(it, P) || defaultChordSec(P); return e; }); })()) : null;
  const laid = part => part.preset === 'line' || part.preset === 'pattern'; // laid out within their sections, rather than gated to them
  const lay = (part, end) => laid(part) ? layoutFor(part.preset === 'line' ? part.line : part.pattern, part.plays, runs, main.total, end) : null;
  const subs = others.map(part => deferred(part) || part.preset === 'copy' ? null : take(buildPart(part, P, items, main.total, budget,
    lay(part, part.preset === 'line' && !part.repeat ? Infinity : main.total), timeline, keyAt)));
  let total = main.total; for (const s of subs) if (s) total = Math.max(total, s.total);
  others.forEach((part, k) => { if (!subs[k] && deferred(part)) subs[k] = take(buildPart(part, P, items, total, budget, null, timeline, keyAt)); });
  // each part gated to the sections it plays in (lines and patterns were laid within them) …
  const mask = (part, sub) => { if (sp(part) && !laid(part)) maskGates(sub, sp(part), main.total, part.preset === 'pad' || (part.preset === 'copy' && !!sub.held)); };
  others.forEach((part, k) => { if (part.preset !== 'copy' && subs[k]) mask(part, subs[k]); });
  // … then copies: their source's notes as it plays them (in its sections), later and moved, then gated to their own sections
  const beat = 60 / P.timing.tempo;
  others.forEach((part, k) => { if (part.preset !== 'copy') return; const j = others.findIndex(x => x.id === part.of && x.preset !== 'copy');
    if (j >= 0 && subs[j]) { subs[k] = shiftSub(subs[j], part.delay * beat, part.shift, part.voices); if (subs[k]) { total = Math.max(total, subs[k].total); mask(part, subs[k]); } } });
  others.forEach((part, k) => { if (subs[k]) list.push(Object.assign({}, part, { sub: subs[k] })); });
  const mainPt = list[0]; mainPt.breathe = P.breathe; mainPt.duck = P.duck; shapeParts(list, main);
  /* Three ends: the music's (`total`, where the parts that sound throughout begin their closing fade); each line's last release,
     which rings on at its own level into the tail while they fade; and the end of the tail. A release only extends the music
     by what wouldn't fit in the tail (with 0.2 s to spare), so the usual releases end within it and change nothing. */
  let ring = 0; for (const pt of list) if (pt.sub.gates && pt.sub.env && !pt.sub.held) pt.sub.gates.forEach((gs, v) => { if (gs && gs.length && !(pt.sub.heldV && pt.sub.heldV[v])) ring = Math.max(ring, gs[gs.length - 1].off + pt.sub.env.release); });
  const musicEnd = total; // where the held parts' closing fade begins, whatever the releases do
  /* An echo (the Echo setting) rings on after its part's last sound: the held parts' closing fade, or a line's last release. The
     piece lasts until its repeats have died away, like a long release, but no more than ECHO_ROOM past the music's end (the
     echo then fades out with the end of the tail rather than stopping). */
  let echoEnd = 0;
  for (const pt of list) {
    const ec = pt.main ? P.echo : pt.echo, gs = pt.sub.gates; if (!ec || !(ec.mix > 0)) continue;
    let end = !gs ? musicEnd + FADE : 0;
    if (gs) for (const g of gs) if (g && g.length) end = Math.max(end, pt.sub.held ? Math.min(g[g.length - 1].off, musicEnd + FADE) : g[g.length - 1].off + (pt.sub.env ? pt.sub.env.release : 0));
    if (end > 0) echoEnd = Math.max(echoEnd, Math.min(end + echoRing(ec, 60 / P.timing.tempo), musicEnd + ECHO_ROOM));
  }
  total = Math.max(total, ring - (TAIL - 0.2), echoEnd - (TAIL - 0.2));
  total = Math.min(total, REALIZATION_LIMITS.seconds);
  const voices = [];
  list.forEach((pt, k) => { pt.first = voices.length; for (let v = 0; v < pt.sub.N; v++) voices.push({ p: k, b: pt.sub, v }); });
  let min = Infinity, max = -Infinity; for (const pt of list) { min = Math.min(min, pt.sub.min); max = Math.max(max, pt.sub.max); }
  return { events: main.events, total, musicEnd, N: voices.length, min, max, warnings: main.warnings, piece: P, ease: main.ease, frozen: main.frozen, main, parts: list, voices, sections: runs,
    cut: list.filter(pt => pt.sub.cut).map(pt => pt.name) };
}
/* ---- Gain over time ----
   A voice's envelope as a polyline of { t, g } (g from 0 to 1): for each gate, attack to 1, decay to sustain, hold until
   the gate closes, then release to 0. The next gate starts from wherever the last one had got to. */
function polyAt(pts, t) {
  if (t <= pts[0].t) return pts[0].g;
  let lo = 0, hi = pts.length - 1;
  if (t >= pts[hi].t) return pts[hi].g;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].t <= t) lo = m; else hi = m; }
  const a = pts[lo], b = pts[hi];
  return b.t > a.t ? a.g + (b.g - a.g) * (t - a.t) / (b.t - a.t) : b.g;
}
function cutPoly(pts, T) { const out = pts.filter(p => p.t < T); if (out.length < pts.length) out.push({ t: T, g: polyAt(pts, T) }); return out; }
/* An envelope as points: for each gate, attack to its loudness (gate.v, 1 if none), decay to the sustain level times that,
   hold until the gate closes, then release to silence. Straight lines, or with curve 'exp', a decay and release that fall away
   as real strings and bells do: exponentially, fast at first and then slower, sampled at 16 points a segment (the release reaches
   −60 dB at its end, then silence). */
const CURVE_POINTS = 16;
function envelopePoints(gates, env) {
  const { attack: A, decay: D, sustain: S, release: R } = env, curved = env.curve === 'exp', pts = [{ t: 0, g: 0 }];
  // from (t0, g0) toward g1 over T: straight, or exponential (reaching within 0.7% of g1 at T, or −60 dB of g0 when g1 is silence)
  const seg = (t0, g0, g1, T) => { if (!curved || T <= 0) return [{ t: t0 + T, g: g1 }];
    const out = [], k = g1 === 0 ? Math.log(1000) : 5; for (let i = 1; i <= CURVE_POINTS; i++) { const x = i / CURVE_POINTS; out.push({ t: t0 + T * x, g: i === CURVE_POINTS ? g1 : g1 + (g0 - g1) * Math.exp(-k * x) }); } return out; };
  gates.forEach((gt, k) => {
    const nextOn = k + 1 < gates.length ? gates[k + 1].on : Infinity, V = gt.v === undefined ? 1 : gt.v;
    const top = { t: gt.on + A, g: V };
    let loc = cutPoly([{ t: gt.on, g: polyAt(pts, gt.on) }, top, ...seg(top.t, V, S * V, D)], Math.max(gt.on, gt.off));
    if (gt.off > loc[loc.length - 1].t) loc.push({ t: gt.off, g: loc[loc.length - 1].g });
    const end = loc[loc.length - 1]; loc.push(...seg(Math.max(gt.on, gt.off), end.g, 0, R));
    pts.push(...cutPoly(loc, nextOn));
  });
  return pts;
}
function voiceEnvelope(sub, v) {
  if (!sub.gates || !sub.gates[v]) return null; // always sounding
  if (!sub.envCache) sub.envCache = [];
  return sub.envCache[v] || (sub.envCache[v] = envelopePoints(sub.gates[v], sub.heldV && sub.heldV[v] ? ENVELOPES.pad : sub.env || ENVELOPES.notes));
}
function gainAt(built, v, t) {
  if (built.voices) { const r = built.voices[v]; return gainAt(r.b, r.v, t); }
  const pts = voiceEnvelope(built, v); return (pts ? polyAt(pts, t) : 1) * (built.mod ? polyAt(built.mod, t) : 1);
}
/* Moves for a gain AudioParam from `from` on (straight lines), or null for a voice that always sounds: its envelope, times
   its part's shape over time (breathing, ducking) if it has one */
function gainMoves(built, v, from = 0) {
  if (built.voices) { const r = built.voices[v]; return gainMoves(r.b, r.v, from); }
  const env = voiceEnvelope(built, v); if (!env && !built.mod) return null;
  const pts = !built.mod ? env : mulPoly(env || [{ t: 0, g: 1 }], built.mod);
  return [{ t: from, g: polyAt(pts, from) }, ...pts.filter(p => p.t > from)];
}
// two polylines multiplied, at every point of either
function mulPoly(a, b) {
  const ts = [...new Set([...a.map(p => p.t), ...b.map(p => p.t)])].sort((x, y) => x - y);
  return ts.map(t => ({ t, g: polyAt(a, t) * polyAt(b, t) }));
}
/* ---- A part's shape over time ----
   Dips in a part's level, on top of its envelope: at each of `times` it falls to 1 − depth over `down` seconds (20 ms for a duck) and rises back
   over the rest of `time`; a dip that starts before the last has recovered starts from wherever that had got to. */
function dipPoly(times, depth, time, down = Math.min(0.02, time * 0.25)) {
  const pts = [{ t: 0, g: 1 }];
  times.forEach((t, k) => { const next = k + 1 < times.length ? times[k + 1] : Infinity;
    pts.push(...cutPoly([{ t, g: polyAt(pts, t) }, { t: t + down, g: 1 - depth }, { t: t + time, g: 1 }], next)); });
  return pts.filter((p, i) => i === 0 || p.t > pts[i - 1].t - 1e-12);
}
/* Breathe: a part that sounds throughout dips at each chord change and swells back, as strings re-bow (the dip is centred on the
   change). Duck: a part dips each time another part strikes a note (pads pumping under a kick), and recovers over `time`. */
function shapeParts(list, main) {
  const changes = main.events.filter((e, i) => i > 0 && e.kind === 'chord').map(e => e.t);
  for (const pt of list) {
    const br = pt.breathe, dk = pt.duck; let mod = null;
    if (br && br.depth > 0 && changes.length) mod = dipPoly(changes.map(t => Math.max(0, t - br.time * 0.35)), br.depth, br.time, br.time * 0.35); // lowest at the change
    if (dk && dk.depth > 0 && dk.under) {
      const src = list.find(x => x.id === dk.under && x !== pt);
      const strikes = src && (src.sub.gates || src.sub.strikes);
      const ons = strikes ? [...new Set(strikes.flatMap(gs => gs ? gs.map(g => g.on) : []))].sort((a, b) => a - b) : [];
      if (ons.length) { const d = dipPoly(ons, dk.depth, dk.time); mod = mod ? mulPoly(mod, d) : d; }
    }
    if (mod) { pt.sub.mod = mod; if (!pt.sub.gates) pt.sub.held = true; } // a part that sounds throughout still fades with the piece
  }
}
/* Vibrato depth (in cents) over time for a line part: it blooms after `delay` into each note long enough to hold it */
function vibratoMoves(built, v, from = 0) {
  if (built.voices) { const r = built.voices[v]; return vibratoMoves(r.b, r.v, from); }
  const vb = built.vibrato, gates = built.gates || built.strikes; if (!vb || !gates || !gates[v]) return null;
  const pts = [{ t: 0, g: 0 }];
  for (const gt of gates[v]) { const s = gt.on + vb.delay; if (gt.off - s < 0.12) continue; pts.push({ t: s, g: 0 }, { t: Math.min(s + 0.25, gt.off), g: vb.cents }, { t: gt.off, g: vb.cents }, { t: gt.off + 0.05, g: 0 }); }
  return { rate: vb.rate, moves: [{ t: from, g: polyAt(pts, from) }, ...pts.filter(p => p.t > from)] };
}
/* The volume shape at time t, in dB (0 with no shape) */
function volumeAt(P, t) { const pts = P.volume; return pts && pts.length ? polyAt(pts.map(x => ({ t: x.t, g: x.db })), t) : 0; }

const EASE = {
  smooth: x => x * x * (3 - 2 * x),
  smoother: x => x * x * x * (x * (6 * x - 15) + 10),
  cosine: x => 0.5 - 0.5 * Math.cos(Math.PI * x),
  linear: x => x,
  drop: x => 1 - Math.pow(1 - x, 3), // fast, then settling: a pitch drop's fall
  arcout: x => Math.sqrt(1 - (1 - x) * (1 - x)), // a quarter circle that leaves steeply and arrives level
  arcin: x => 1 - Math.sqrt(1 - x * x) // one that leaves level and arrives steeply: after arcout, the other half of a circle's side
};

/* Per-voice departure offsets and glide durations for one change */
function scheduleMotion(prev, targets, g, M, rng) {
  const N = targets.length;
  const off = new Array(N).fill(0), dur = new Array(N).fill(g);
  if (g <= 0 || M.order === 'together' || !(M.stagger > 0)) return { off, dur };
  const s = Math.min(1, M.stagger / 100);
  const moving = [];
  for (let v = 0; v < N; v++) if (Math.abs(targets[v] - prev[v]) > 1e-9) moving.push(v);
  if (moving.length < 2) return { off, dur };
  const leap = v => Math.abs(targets[v] - prev[v]);
  let order = moving.slice();
  if (M.order === 'low-high') order.sort((a, b) => prev[a] - prev[b] || a - b);
  else if (M.order === 'high-low') order.sort((a, b) => prev[b] - prev[a] || b - a);
  else if (M.order === 'largest') order.sort((a, b) => leap(b) - leap(a) || a - b);
  else if (M.order === 'smallest') order.sort((a, b) => leap(a) - leap(b) || a - b);
  else if (M.order === 'random') for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const d = g * (1 - 0.75 * s);
  order.forEach((v, k) => { off[v] = (k / (order.length - 1)) * (g - d); dur[v] = d; });
  return { off, dur };
}

/* Build the full timeline from parsed items and a piece */
function buildPiece(items, piece) {
  const P = normalizePiece(piece);
  const N = P.voices, T = P.timing, W = weightsFrom(P.voicing);
  const spread = P.voicing.spread / 100, TU = P.tuning === 'just' ? justTuning(items) : null;
  const longGlide = Math.max(2.4, T.glide * 1.9);
  const events = [];
  let t = 0, cur = null, prevKind = null;
  items.forEach((it, k) => {
    const last = k === items.length - 1;
    let hold = itemSeconds(it, P);
    if (hold == null) hold = it.kind === 'note' ? (k === 0 ? 1.0 : longGlide + (last ? 1.6 : 1.2)) : defaultChordSec(P);
    const vr = eventRng(P.seeds.voicing, k, 0x5A17);
    let targets, g;
    if (it.kind === 'note') { targets = new Array(N).fill(it.midi); g = cur ? longGlide : 0; }
    else if (it.pin && it.pin.length) { targets = pinnedVoicing(it.pin, N); g = cur ? (prevKind === 'note' ? longGlide : T.glide) : 0; }
    else if (!cur || prevKind === 'note') { targets = spreadVoicing(it, N, spread, vr, W); g = cur ? longGlide : 0; }
    else { targets = leadVoicing(cur, it, vr, W); g = T.glide; }
    g = Math.min(g, hold * 0.92);
    const prev = cur || targets;
    const { off, dur } = scheduleMotion(prev, targets, g, P.motion, eventRng(P.seeds.motion, k, 0x0D1E));
    events.push({ t, g, off, dur, targets: TU && it.kind === 'chord' ? targets.map(p => tunedBy(TU[k], p)) : Array.from(targets), label: it.label, kind: it.kind, fallback: !!targets.fallback, section: it.section || '', pass: it.pass || 0, key: it.key || 0 });
    cur = targets; prevKind = it.kind; t += hold;
  });
  let min = Infinity, max = -Infinity;
  for (const e of events) for (const p of e.targets) { if (p < min) min = p; if (p > max) max = p; }
  const warnings = events.filter(e => e.fallback).map(e => e.label);
  return { events, total: t, N, min, max, warnings, piece: P, ease: EASE[T.easing] || EASE.smooth };
}

function eventIndex(built, t) {
  const ev = built.events;
  let lo = 0, hi = ev.length - 1;
  if (t < ev[0].t) return 0;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ev[mid].t <= t) lo = mid; else hi = mid - 1; }
  return lo;
}
function pitchAt(built, v, t, idx) {
  if (built.voices) { const r = built.voices[v]; return pitchAt(r.b, r.v, t); } // a whole score: ask the voice's own part
  const ev = built.events;
  const i = idx ?? eventIndex(built, t);
  const e = ev[i];
  if (i === 0 || e.g <= 0) return e.targets[v];
  const a = ev[i - 1].targets[v], b = e.targets[v];
  if (a === b) return b;
  const d = e.dur[v];
  if (d <= 0) return b;
  const x = Math.min(1, Math.max(0, (t - e.t - e.off[v]) / d));
  return a + (b - a) * (e.ease ? EASE[e.ease] : built.ease)(x); // an event can have its own glide shape (arcs)
}
/* How one voice's pitch moves from time `from` on, as a list of moves for an AudioParam, in piece time.
   Built from the glides themselves, not from a grid over the whole piece, so pitch accuracy never depends on how long
   the piece is. A glide that is linear in pitch is an exact exponential ramp in frequency ('ramp'); an eased glide is
   sampled `perSec` times a second, during the glide only ('curve'). Holds need no moves at all.
   Moves: { kind: 'set', t, p } | { kind: 'ramp', t, p } (ramp to p, arriving at t) | { kind: 'curve', t, d, ps } */
function pitchMoves(built, v, from = 0, perSec = 240) {
  if (built.voices) { const r = built.voices[v]; return pitchMoves(r.b, r.v, from, perSec); }
  const ev = built.events, ease = built.ease;
  const isLinear = f => [0.1, 0.3, 0.5, 0.7, 0.9].every(x => Math.abs(f(x) - x) < 1e-12), linearAll = isLinear(ease);
  const moves = [{ kind: 'set', t: from, p: pitchAt(built, v, from) }], end = Math.max(from, built.total);
  let lastP = moves[0].p, lastT = from; // where the previous move left the voice
  for (let i = 1; i < ev.length; i++) {
    const e = ev[i], next = i + 1 < ev.length ? ev[i + 1].t : Infinity;
    if (next <= from) continue;
    if (e.t >= end) break; // nothing after the end is heard
    const a = ev[i - 1].targets[v], b = e.targets[v];
    // at the event itself the voice holds `a` (a previous glide cut short by this event jumps here, as pitchAt does)
    if (e.t > from && a !== lastP) { moves.push({ kind: 'set', t: e.t, p: a }); lastP = a; lastT = e.t; }
    if (a === b) continue;
    const s = e.t + (e.g > 0 ? e.off[v] : 0), d = e.g > 0 ? e.dur[v] : 0;
    if (d <= 0) { const t = Math.max(s, from); if (t > from || lastP !== b) { moves.push({ kind: 'set', t, p: b }); lastP = b; lastT = t; } continue; }
    const t0 = Math.max(s, from), t1 = Math.min(s + d, next, end); // never past the end: a file can claim a glide far longer than the piece
    if (t1 <= t0) continue;
    const p0 = pitchAt(built, v, t0, i), p1 = t1 >= s + d ? b : pitchAt(built, v, t1, i);
    if (!(t0 === lastT && p0 === lastP)) moves.push({ kind: 'set', t: t0, p: p0 }); // a glide straight on from the last needs no anchor
    if (e.ease ? isLinear(EASE[e.ease]) : linearAll) moves.push({ kind: 'ramp', t: t1, p: p1 });
    else {
      const n = Math.max(3, Math.ceil((t1 - t0) * perSec) + 1), ps = new Array(n);
      for (let k = 0; k < n; k++) ps[k] = k === n - 1 ? p1 : pitchAt(built, v, t0 + (t1 - t0) * k / (n - 1), i);
      moves.push({ kind: 'curve', t: t0, d: t1 - t0, ps });
    }
    lastP = p1; lastT = t1;
  }
  return moves;
}
/* Times when the first chord is established and when the last chord arrives (for auto zoom) */
function landmarks(built) {
  const ev = built.events, T = built.musicEnd !== undefined ? built.musicEnd : built.total;
  /* Chords, not events: snapshots of the same chord less than 0.2 s apart are one chord, as in pieces saved as dense snapshots
     of every voice. A chord settles when its last real movement (a quarter of a semitone or more) has ended. With one event
     per chord, as the engine writes them, this gives exactly the same landmarks as before. */
  const groups = []; // (snapshots without a chord name aren't merged: one name shared by a whole piece isn't one chord)
  ev.forEach((e, i) => {
    const mv = i === 0 ? Infinity : Math.max(...e.targets.map((p, v) => Math.abs(p - ev[i - 1].targets[v])));
    const g = groups[groups.length - 1];
    if (g && e.label && g.label === e.label && g.kind === e.kind && e.t - g.lastT < 0.2) { g.lastT = e.t; if (mv >= 0.25) g.settle = e.t + e.g; }
    else groups.push({ label: e.label, kind: e.kind, t: e.t, g: e.g, lastT: e.t, moved: mv, settle: e.g > 0 ? e.t + e.g : 0 });
  });
  const chords = groups.filter(g => g.kind === 'chord');
  if (!chords.length) return { inStart: 0, inEnd: Math.min(2, T), outStart: T, outEnd: T };
  // the last real arrival: skip trailing chords that only shimmer (every voice moves, if at all, by less than a quarter of a
  // semitone). A repeated chord moves nothing at all and still counts.
  let k = chords.length - 1;
  while (k > 0 && chords[k].moved > 0 && chords[k].moved < 0.25) k--;
  const l = chords[k];
  // the zoom in, as it has always been: from the first chord's glide until 1.2 s after it arrives (a piece can set its own
  // times instead, in view.zoom)
  const fe = ev.find(e => e.kind === 'chord'), inStart = fe.g > 0 ? fe.t : 0, inEnd = Math.min(T, (fe.g > 0 ? fe.t + fe.g : 0) + 1.2);
  let outStart = Math.max(inEnd, Math.max(l.t + l.g, l.settle)), outEnd = T;
  // the zoom out takes at least 3 s: when the music moves to the very end, it runs on into the closing fade
  if (outEnd - outStart < 3) { outEnd = T + FADE * 0.9; outStart = Math.max(inEnd, Math.min(outStart, outEnd - 3)); }
  return { inStart, inEnd, outStart, outEnd };
}

/* Harmony seed: a diatonic progression with extended chords, opening and closing on one high note */
function composeFromSeed(seed, chordSec = 4.5) {
  const r = mulberry32((seed ^ 0x5BD1E995) >>> 0);
  const pick = arr => arr[Math.floor(r() * arr.length)];
  const wpick = opts => { let x = r() * opts.reduce((a, o) => a + o[1], 0); for (const o of opts) { if ((x -= o[1]) <= 0) return o[0]; } return opts[0][0]; };
  const key = Math.floor(r() * 12);
  const names = [1, 3, 5, 8, 10].includes(key) ? FLAT : SHARP;
  const scale = [0, 2, 4, 5, 7, 9, 11];
  const QUAL = { 1: ['maj9', 'maj7', 'add9', '6/9', 'maj9'], 2: ['m9', 'm11', 'm7'], 3: ['m7', 'm11'], 4: ['maj9', 'maj7#11', 'maj7', 'maj9'], 5: ['7sus4', '9sus4', '13sus4'], 6: ['m9', 'm11', 'm7'] };
  const TR = { 1: [[6, .3], [4, .3], [3, .2], [2, .2]], 2: [[5, .55], ['45', .3], [3, .15]], 3: [[6, .5], [4, .5]], 4: [[5, .3], ['45', .3], [2, .2], [1, .2]], 5: [[1, .55], [6, .3], [3, .15]], 6: [[4, .4], [2, .35], [3, .25]], '45': [[5, .3], [1, .35], [3, .35]] };
  const rootName = d => names[(key + scale[d - 1]) % 12];
  const chordName = d => d === '45' ? rootName(4) + pick(['maj7', 'maj9']) + '/' + rootName(5) : rootName(d) + pick(QUAL[d]);
  const len = 8 + Math.floor(r() * 4);
  const seq = [1];
  while (seq.length < len - 2) { let n = wpick(TR[seq[seq.length - 1]]); if (n === seq[seq.length - 1]) n = wpick(TR[seq[seq.length - 1]]); seq.push(n); }
  seq.push(r() < 0.5 ? 5 : '45', 1);
  const anchorPc = (key + pick([4, 7, 2, 4])) % 12;
  let anchor = anchorPc + 12 * 6; while (anchor > 92) anchor -= 12; while (anchor < 78) anchor += 12;
  const aName = names[anchorPc] + (Math.floor(anchor / 12) - 1);
  const chords = seq.map(chordName);
  return ['=' + aName + ':0.8', ...chords.slice(0, -1), chords[chords.length - 1] + ':' + (chordSec * 0.6).toFixed(1), '=' + aName].join('\n');
}
