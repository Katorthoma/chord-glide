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
function parseNoteOct(s) {
  const m = s.match(/^([A-G][#b]?)(-?\d)(?:([+-]\d{1,2}(?:\.\d+)?)¢?)?$/);
  return m ? pcOf(m[1]) + 12 * (parseInt(m[2], 10) + 1) + (m[3] ? parseFloat(m[3]) / 100 : 0) : null;
}

/* One token -> {kind:'note'|'chord'|'error', ...} */
function parseItem(raw) {
  let t = raw.replace(/♯/g, '#').replace(/♭/g, 'b').replace(/ø7?/g, 'm7b5').replace(/Δ/g, 'maj7').trim();
  if (!t) return null;
  let dur = null;
  const dm = t.match(/:(\d+(?:\.\d+)?)s?$/);
  if (dm) { dur = parseFloat(dm[1]); t = t.slice(0, dm.index); }
  let pin = null;
  const pm = t.match(/\[([^\]]*)\]$/);
  if (pm) {
    pin = pm[1].split(/[_\s,]+/).filter(Boolean).map(parseNoteOct);
    if (pin.some(x => x === null || !PLAYABLE(x))) return { kind: 'error', label: raw.trim() }; // unreadable, or outside MIDI 0–127
    t = t.slice(0, pm.index);
  }
  const um = t.match(new RegExp('^(?:=|->|→)(' + NOTE_OCT + ')$'));
  if (um) { const m = parseNoteOct(um[1]); return PLAYABLE(m) ? { kind: 'note', midi: m, label: um[1], dur } : { kind: 'error', label: raw.trim() }; }
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
  return { kind: 'chord', label: t, root, bass, pcs, dur, pin };
}

function parseProgression(text) {
  const prepared = text
    .replace(/\[([^\]]*)\]/g, (_, inner) => '[' + inner.trim().split(/[\s,]+/).join('_') + ']')
    .replace(/\(\s*(no|omit)\s*5\s*\)/gi, '(no5)');
  const items = [], errors = [];
  for (const tok of prepared.split(/[\s,|]+/)) {
    if (!tok) continue;
    const it = parseItem(tok);
    if (!it) continue;
    if (it.kind === 'error') errors.push(it.label); else items.push(it);
  }
  return { items, errors };
}

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
const PIECE_FORMAT_VERSION = 4; // 4 adds parts and a volume shape; pieces without them are still written as 3
function defaultPiece() {
  return {
    format: PIECE_FORMAT, formatVersion: PIECE_FORMAT_VERSION, engine: ENGINE_VERSION,
    name: 'Untitled piece', created: null, modified: null,
    chords: '',
    seeds: { harmony: 1, voicing: 1, motion: 1, sound: 1 },
    locks: { harmony: true, voicing: false, motion: false, sound: false },
    voices: 11,
    timing: { chordSec: 4.5, glide: 1.6, easing: 'smooth', tempo: 60 },
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
    out.view.trace = { look: pickFrom(tr.look, LOOKS, 'theme'), glow: num(tr.glow, 0, 100, 60), weight: num(tr.weight, 0.5, 3, 1),
      custom: { line: hex(c.line, dc.line), line2: hex(c.line2, hex(c.line, dc.line2)), bg: hex(c.bg, dc.bg) } };
  }
  { const big = realizationTooLarge(p.realization); if (big) throw new Error('This piece can\'t be opened safely: ' + big + '.'); }
  if (validRealization(p.realization)) out.realization = JSON.parse(JSON.stringify(p.realization));
  { // parts beyond the main one, within the overall voice limit
    // the main part's voices: its saved notes' count when it has some (they can have more voices than the setting)
    const used = new Set(['main']); let room = REALIZATION_LIMITS.voices - Math.max(out.voices, out.realization ? out.realization.N : 0);
    out.parts = [];
    (Array.isArray(p.parts) ? p.parts : []).slice(0, MAX_PARTS).forEach((q, i) => {
      const part = normalizePart(q, out, i, used); if (!part) return;
      const n = partVoices(part); if (n > room) return;
      room -= n; out.parts.push(part);
    });
    if (!out.parts.length) delete out.parts;
  }
  { // the volume shape: points in seconds and dB, joined by straight lines in dB
    const pts = (Array.isArray(p.volume) ? p.volume : []).filter(x => x && Number.isFinite(+x.t) && Number.isFinite(+x.db)).slice(0, 64)
      .map(x => ({ t: num(x.t, 0, 3600, 0), db: num(x.db, -60, 12, 0) })).sort((a, b) => a.t - b.t);
    if (pts.length) out.volume = pts; else delete out.volume;
  }
  out.formatVersion = out.parts || out.volume ? 4 : 3; // other pieces still open in older versions
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
    events: built.events.map(e => ({ t: e.t, g: e.g, label: e.label, kind: e.kind, targets: e.targets.slice(), off: e.off.slice(), dur: e.dur.slice() })) };
}
function builtFromRealization(r, piece, normalized = false) {
  const P = normalized ? piece : normalizePiece(piece);
  const events = r.events.map(e => ({ t: e.t, g: e.g, label: String(e.label), kind: e.kind === 'note' ? 'note' : 'chord', targets: e.targets.slice(),
    off: e.off ? e.off.slice() : new Array(r.N).fill(0), dur: e.dur ? e.dur.slice() : new Array(r.N).fill(e.g), fallback: false }));
  // rests (null, allowed in parts): the voice holds its last pitch silently, then jumps to its next note as it sounds again
  let gates = null;
  if (events.some(e => e.targets.some(x => x === null))) {
    gates = [];
    for (let v = 0; v < r.N; v++) {
      const firstP = events.map(e => e.targets[v]).find(x => x !== null);
      let held = firstP === undefined ? 60 : firstP, on = null; const gs = [];
      events.forEach((e, i) => {
        const x = e.targets[v];
        if (x === null) { e.targets[v] = held; e.dur[v] = 0; if (on !== null) { gs.push({ on, off: e.t }); on = null; } }
        else { if (on === null) { on = e.t; if (i > 0) e.dur[v] = 0; } held = x; }
      });
      if (on !== null) gs.push({ on, off: r.total });
      gates.push(gs.length === 1 && gs[0].on === 0 && gs[0].off === r.total ? null : gs);
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
const PRESETS = ['pad', 'line', 'notes'];
const MAX_PARTS = 12;
const STEPS = { '1/1': 4, '1/2': 2, '1/4': 1, '1/8': 0.5, '1/16': 0.25, '1/32': 0.125, '1/4t': 2 / 3, '1/8t': 1 / 3, '1/16t': 1 / 6 }; // in beats
const ENVELOPES = { // attack, decay and release in seconds; sustain as a fraction of full level
  pad: { attack: 0.4, decay: 0, sustain: 1, release: 1 },
  line: { attack: 0.01, decay: 0.15, sustain: 0.75, release: 0.12 },
  notes: { attack: 0.005, decay: 0, sustain: 1, release: 0.03 }
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
  const part = { id, name: String(q.name || id).slice(0, 40), preset,
    sound: { tone: TONES[s.tone] ? s.tone : P.sound.tone, level: num(s.level, -60, 12, 0), pan: num(s.pan, -1, 1, 0),
      width: num(s.width, 0, 100, preset === 'pad' ? P.sound.width : 30), detune: num(s.detune, 0, 20, P.sound.detune) },
    envelope: { attack: num(e.attack, 0.001, 10, E0.attack), decay: num(e.decay, 0, 10, E0.decay), sustain: num(e.sustain, 0, 1, E0.sustain), release: num(e.release, 0.005, 20, E0.release) } };
  if (preset === 'pad') {
    part.voices = Math.round(num(q.voices, 3, MAX_VOICES, 5)); // like the main part: a bass and at least two above it
    part.voicing = Object.assign({}, P.voicing, obj(q.voicing)); part.motion = Object.assign({}, P.motion, obj(q.motion)); // limited when it's voiced
    // its resolved notes, saved with the piece like the main part's, so a later engine plays it exactly as it was
    const big = realizationTooLarge(q.realization); if (big) throw new Error('This piece can\'t be opened safely: part ' + (i + 1) + ' ' + big + '.');
    if (validRealization(q.realization) && q.realization.N === part.voices) part.realization = JSON.parse(JSON.stringify(q.realization));
  } else if (preset === 'line') {
    part.line = typeof q.line === 'string' ? q.line.slice(0, 20000) : '';
    part.step = STEPS[q.step] ? q.step : '1/8';
    part.start = num(q.start, 0, 100000, 0); // in beats
    part.repeat = !!q.repeat; part.legato = !!q.legato;
    part.transpose = (Array.isArray(q.transpose) && q.transpose.length ? q.transpose : [0]).slice(0, 8).map(x => num(x, -48, 48, 0));
    part.portamento = num(q.portamento, 0, 2, 0.03);
    const vb = obj(q.vibrato);
    part.vibrato = { cents: num(vb.cents, 0, 100, 0), rate: num(vb.rate, 0.5, 12, 5.5), delay: num(vb.delay, 0, 5, 0.3) };
  } else {
    const big = realizationTooLarge(q.realization); if (big) throw new Error('This piece can\'t be opened safely: part ' + (i + 1) + ' ' + big + '.');
    if (!validRealization(q.realization, true)) return null;
    part.realization = JSON.parse(JSON.stringify(q.realization));
  }
  return part;
}
const partVoices = part => part.preset === 'pad' ? part.voices : part.preset === 'line' ? part.transpose.length : part.realization.N;
/* A written line: notes like the chord box's (C4, F#3, D3+33) with a length in steps (`G4:2`), and rests (`-` or `r`).
   Bar lines `|` and commas are ignored. */
/* A line can be written out of range only by its notes (with `transpose`, the intervals it's doubled at): a note that would
   go outside MIDI 0–127 is reported and kept as a rest of the same length, so the timing holds. Lengths must be finite, from
   1/64 to 1024 steps. */
function parseLine(text, transpose = [0]) {
  const notes = [], errors = [], re = new RegExp('^(-|r|' + NOTE_OCT + ')(?::(\\d+(?:\\.\\d+)?))?$');
  for (const tok of String(text || '').split(/[\s|,]+/).filter(Boolean)) {
    const m = tok.match(re), steps = m ? (m[2] === undefined ? 1 : parseFloat(m[2])) : 0;
    if (!m || !Number.isFinite(steps) || steps < 1 / 64 || steps > 1024) { errors.push(tok); continue; }
    const p = m[1] === '-' || m[1] === 'r' ? null : parseNoteOct(m[1].replace(/¢$/, ''));
    if (p !== null && !transpose.every(d => PLAYABLE(p + d))) { errors.push(tok + ' (out of range)'); notes.push({ p: null, steps }); continue; }
    notes.push({ p, steps });
  }
  return { notes, errors };
}
const LINE_LIMITS = { notes: 20000, total: 100000, shortest: 0.005 }; // notes per part and in the whole piece; shortest note (s)
/* A line part's timeline: one event per note, a glide of `portamento` seconds from a note straight before it (a jump after
   a rest), and a gate per note. Notes that follow each other end a moment early so the next one is heard as a new note,
   unless the part is legato, which joins them into one gate. A repeating line fills `until`. */
function buildLine(part, P, until, budget = LINE_LIMITS.notes) {
  const tr = part.transpose, { notes } = parseLine(part.line, tr), N = tr.length;
  const beat = 60 / P.timing.tempo, stepSec = STEPS[part.step] * beat;
  if (notes.some(n => n.steps * stepSec < LINE_LIMITS.shortest)) return null; // too short to hear, and the way to millions of notes
  // stops at the note budget or the longest a piece can be, whichever comes first
  const maxNotes = Math.min(budget, LINE_LIMITS.notes), end = Math.min(part.repeat ? until : Infinity, REALIZATION_LIMITS.seconds);
  const seq = []; let t = part.start * beat, cut = false;
  while (notes.length && t < end - 1e-9) {
    for (const n of notes) {
      if (t >= end - 1e-9) break;
      if (seq.length >= maxNotes) { cut = true; break; }
      const t1 = t + n.steps * stepSec; seq.push({ t0: t, t1: Math.min(t1, end), p: n.p }); t = t1;
    }
    if (cut || !part.repeat) break;
  }
  const sounding = seq.filter(x => x.p !== null);
  if (!sounding.length) return null;
  const first = sounding[0].p, zeros = () => new Array(N).fill(0);
  const events = [{ t: 0, g: 0, label: noteName(first), kind: 'note', targets: tr.map(x => first + x), off: zeros(), dur: zeros() }];
  const raw = [];
  seq.forEach((x, k) => {
    if (x.p === null) return;
    const prev = seq[k - 1], joined = prev && prev.p !== null && Math.abs(prev.t1 - x.t0) < 1e-9;
    const g = joined ? Math.min(part.portamento, (x.t1 - x.t0) * 0.5) : 0;
    if (!(events.length === 1 && x.t0 === 0)) events.push({ t: x.t0, g, label: noteName(x.p), kind: 'note', targets: tr.map(d => x.p + d), off: zeros(), dur: new Array(N).fill(g) });
    if (part.legato && joined && raw.length) raw[raw.length - 1].off = x.t1; else raw.push({ on: x.t0, off: x.t1 });
  });
  const gates = raw.map((gt, k) => { const next = raw[k + 1], cut = next && Math.abs(next.on - gt.off) < 1e-9 ? Math.min(0.03, (gt.off - gt.on) * 0.25) : 0; return { on: gt.on, off: gt.off - cut }; });
  let min = Infinity, max = -Infinity;
  for (const e of events) for (const p of e.targets) { if (p < min) min = p; if (p > max) max = p; }
  return { events, total: seq[seq.length - 1].t1, N, min, max, warnings: [], piece: P, ease: EASE.smooth, gates: tr.map(() => gates),
    vibrato: part.vibrato.cents > 0 ? part.vibrato : null, notes: seq.length, cut };
}
function buildPart(part, P, items, until, budget) {
  let sub = null;
  if (part.preset === 'line') sub = buildLine(part, P, until, budget);
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
function buildScore(main, items) {
  const P = main.piece;
  const list = [{ id: 'main', name: 'Main', preset: 'pad', main: true, sub: main, envelope: null,
    sound: { tone: P.sound.tone, level: 0, pan: 0, width: P.sound.width, detune: P.sound.detune } }];
  const others = P.parts || [];
  // non-repeating lines and saved notes can run past the chords; repeating lines then fill the whole length
  let budget = LINE_LIMITS.total; // notes all lines may make together
  const take = sub => { if (sub && sub.notes) budget -= sub.notes; return sub; };
  const subs = others.map(part => part.preset === 'line' && part.repeat ? null : take(buildPart(part, P, items, main.total, budget)));
  let total = main.total; for (const s of subs) if (s) total = Math.max(total, s.total);
  others.forEach((part, k) => { const sub = subs[k] || (part.preset === 'line' && part.repeat ? take(buildPart(part, P, items, total, budget)) : null); if (sub) list.push(Object.assign({}, part, { sub })); });
  /* Three ends: the music's (`total`, where the parts that sound throughout begin their closing fade); each line's last release,
     which rings on at its own level into the tail while they fade; and the end of the tail. A release only extends the music
     by what wouldn't fit in the tail (with 0.2 s to spare), so the usual releases end within it and change nothing. */
  let ring = 0; for (const pt of list) if (pt.sub.gates && pt.sub.env) for (const gs of pt.sub.gates) if (gs && gs.length) ring = Math.max(ring, gs[gs.length - 1].off + pt.sub.env.release);
  const musicEnd = total; // where the held parts' closing fade begins, whatever the releases do
  total = Math.max(total, ring - (TAIL - 0.2));
  total = Math.min(total, REALIZATION_LIMITS.seconds);
  const voices = [];
  list.forEach((pt, k) => { pt.first = voices.length; for (let v = 0; v < pt.sub.N; v++) voices.push({ p: k, b: pt.sub, v }); });
  let min = Infinity, max = -Infinity; for (const pt of list) { min = Math.min(min, pt.sub.min); max = Math.max(max, pt.sub.max); }
  return { events: main.events, total, musicEnd, N: voices.length, min, max, warnings: main.warnings, piece: P, ease: main.ease, frozen: main.frozen, main, parts: list, voices,
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
function envelopePoints(gates, env) {
  const { attack: A, decay: D, sustain: S, release: R } = env, pts = [{ t: 0, g: 0 }];
  gates.forEach((gt, k) => {
    const nextOn = k + 1 < gates.length ? gates[k + 1].on : Infinity;
    let loc = cutPoly([{ t: gt.on, g: polyAt(pts, gt.on) }, { t: gt.on + A, g: 1 }, { t: gt.on + A + D, g: S }], Math.max(gt.on, gt.off));
    if (gt.off > loc[loc.length - 1].t) loc.push({ t: gt.off, g: loc[loc.length - 1].g });
    loc.push({ t: Math.max(gt.on, gt.off) + R, g: 0 });
    pts.push(...cutPoly(loc, nextOn));
  });
  return pts;
}
function voiceEnvelope(sub, v) {
  if (!sub.gates || !sub.gates[v]) return null; // always sounding
  if (!sub.envCache) sub.envCache = [];
  return sub.envCache[v] || (sub.envCache[v] = envelopePoints(sub.gates[v], sub.env || ENVELOPES.notes));
}
function gainAt(built, v, t) {
  if (built.voices) { const r = built.voices[v]; return gainAt(r.b, r.v, t); }
  const pts = voiceEnvelope(built, v); return pts ? polyAt(pts, t) : 1;
}
/* Moves for a gain AudioParam from `from` on (straight lines), or null for a voice that always sounds */
function gainMoves(built, v, from = 0) {
  if (built.voices) { const r = built.voices[v]; return gainMoves(r.b, r.v, from); }
  const pts = voiceEnvelope(built, v); if (!pts) return null;
  return [{ t: from, g: polyAt(pts, from) }, ...pts.filter(p => p.t > from)];
}
/* Vibrato depth (in cents) over time for a line part: it blooms after `delay` into each note long enough to hold it */
function vibratoMoves(built, v, from = 0) {
  if (built.voices) { const r = built.voices[v]; return vibratoMoves(r.b, r.v, from); }
  const vb = built.vibrato; if (!vb || !built.gates || !built.gates[v]) return null;
  const pts = [{ t: 0, g: 0 }];
  for (const gt of built.gates[v]) { const s = gt.on + vb.delay; if (gt.off - s < 0.12) continue; pts.push({ t: s, g: 0 }, { t: Math.min(s + 0.25, gt.off), g: vb.cents }, { t: gt.off, g: vb.cents }, { t: gt.off + 0.05, g: 0 }); }
  return { rate: vb.rate, moves: [{ t: from, g: polyAt(pts, from) }, ...pts.filter(p => p.t > from)] };
}
/* The volume shape at time t, in dB (0 with no shape) */
function volumeAt(P, t) { const pts = P.volume; return pts && pts.length ? polyAt(pts.map(x => ({ t: x.t, g: x.db })), t) : 0; }

const EASE = {
  smooth: x => x * x * (3 - 2 * x),
  smoother: x => x * x * x * (x * (6 * x - 15) + 10),
  cosine: x => 0.5 - 0.5 * Math.cos(Math.PI * x),
  linear: x => x
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
  const spread = P.voicing.spread / 100;
  const longGlide = Math.max(2.4, T.glide * 1.9);
  const events = [];
  let t = 0, cur = null, prevKind = null;
  items.forEach((it, k) => {
    const last = k === items.length - 1;
    let hold = it.dur;
    if (hold == null) hold = it.kind === 'note' ? (k === 0 ? 1.0 : longGlide + (last ? 1.6 : 1.2)) : T.chordSec;
    const vr = eventRng(P.seeds.voicing, k, 0x5A17);
    let targets, g;
    if (it.kind === 'note') { targets = new Array(N).fill(it.midi); g = cur ? longGlide : 0; }
    else if (it.pin && it.pin.length) { targets = pinnedVoicing(it.pin, N); g = cur ? (prevKind === 'note' ? longGlide : T.glide) : 0; }
    else if (!cur || prevKind === 'note') { targets = spreadVoicing(it, N, spread, vr, W); g = cur ? longGlide : 0; }
    else { targets = leadVoicing(cur, it, vr, W); g = T.glide; }
    g = Math.min(g, hold * 0.92);
    const prev = cur || targets;
    const { off, dur } = scheduleMotion(prev, targets, g, P.motion, eventRng(P.seeds.motion, k, 0x0D1E));
    events.push({ t, g, off, dur, targets: Array.from(targets), label: it.label, kind: it.kind, fallback: !!targets.fallback });
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
  return a + (b - a) * built.ease(x);
}
/* How one voice's pitch moves from time `from` on, as a list of moves for an AudioParam, in piece time.
   Built from the glides themselves, not from a grid over the whole piece, so pitch accuracy never depends on how long
   the piece is. A glide that is linear in pitch is an exact exponential ramp in frequency ('ramp'); an eased glide is
   sampled `perSec` times a second, during the glide only ('curve'). Holds need no moves at all.
   Moves: { kind: 'set', t, p } | { kind: 'ramp', t, p } (ramp to p, arriving at t) | { kind: 'curve', t, d, ps } */
function pitchMoves(built, v, from = 0, perSec = 240) {
  if (built.voices) { const r = built.voices[v]; return pitchMoves(r.b, r.v, from, perSec); }
  const ev = built.events, ease = built.ease;
  const linear = [0.1, 0.3, 0.5, 0.7, 0.9].every(x => Math.abs(ease(x) - x) < 1e-12);
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
    if (linear) moves.push({ kind: 'ramp', t: t1, p: p1 });
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
  const groups = [];
  ev.forEach((e, i) => {
    const mv = i === 0 ? Infinity : Math.max(...e.targets.map((p, v) => Math.abs(p - ev[i - 1].targets[v])));
    const g = groups[groups.length - 1];
    if (g && g.label === e.label && g.kind === e.kind && e.t - g.lastT < 0.2) { g.lastT = e.t; if (mv >= 0.25) g.settle = e.t + e.g; }
    else groups.push({ label: e.label, kind: e.kind, t: e.t, g: e.g, lastT: e.t, moved: mv, settle: e.g > 0 ? e.t + e.g : 0 });
  });
  const chords = groups.filter(g => g.kind === 'chord');
  if (!chords.length) return { inStart: 0, inEnd: Math.min(2, T), outStart: T, outEnd: T };
  const f = chords[0];
  // the last real arrival: skip trailing chords that only shimmer (every voice moves, if at all, by less than a quarter of a
  // semitone). A repeated chord moves nothing at all and still counts.
  let k = chords.length - 1;
  while (k > 0 && chords[k].moved > 0 && chords[k].moved < 0.25) k--;
  const l = chords[k];
  let inStart = f.g > 0 ? f.t : 0, inEnd = Math.min(T, f.settle + 1.2);
  // a long piece shows its whole shape for a few seconds first (4% of its length, up to 6 s)
  const overview = T > 60 ? Math.min(6, T * 0.04) : 0;
  if (inStart < overview) { inStart = overview; inEnd = Math.min(T, Math.max(inEnd, inStart + 2)); }
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
