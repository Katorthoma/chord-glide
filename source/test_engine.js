// node test_engine.js — engine v3 checks
const fs = require('fs'), path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8');
const E = new Function(SRC + '; return {ENGINE_VERSION, realizationOf, builtFromRealization, validRealization, parseItem, parseProgression, buildPiece, pitchAt, hz, noteName, SHARP, composeFromSeed, defaultPiece, normalizePiece, landmarks};')();
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  ' + d : '')); };
console.log('engine v' + E.ENGINE_VERSION);
const base = (over = {}) => { const p = E.defaultPiece(); return E.normalizePiece(Object.assign(p, over)); };
const names = e => e.targets.map(E.noteName).join(' ');

// Regression: an original F-major passage with a pinned opening voicing.
// With variation 0 and voicing seed 1, engine 3.1 must produce exactly these voicings.
// (Other seeds may break exact ties differently, so they are checked for validity only.)
const REF = '=C6:0.5, Fmaj9[F2 E3 G3 A3 C4 G4 A4 C5 E5 G5 A5]:4, Dm9:4, Bbmaj7#11:4, C9sus4:4, Am7:4, Dm11:4, Gm9:4, C13sus4:4, Fmaj9:4';
const WANT = ['D2 E3 F3 A3 C4 F4 A4 C5 D5 F5 A5', 'A#2 E3 F3 A3 D4 F4 A4 A#4 D5 F5 A5', 'C2 F3 G3 A#3 D4 F4 A#4 C5 D5 F5 A#5', 'A2 E3 G3 A3 C4 E4 A4 C5 E5 G5 A5',
  'D2 F3 G3 A3 C4 E4 A4 C5 D5 G5 A5', 'G2 F3 G3 A3 D4 F4 A4 A#4 D5 G5 A5', 'C2 F3 G3 A3 C4 F4 A4 A#4 D5 G5 A5', 'F2 F3 G3 A3 C4 F4 A4 C5 E5 G5 A5'];
{
  const items = E.parseProgression(REF).items;
  const refPiece = s => base({ voices: 11, seeds: { harmony: 1, voicing: s, motion: 1, sound: 1 }, voicing: Object.assign(E.defaultPiece().voicing, { variation: 0 }), timing: { chordSec: 4, glide: 1.5, easing: 'smooth', tempo: 60 } });
  const got = E.buildPiece(items, refPiece(1)).events.slice(2).map(names);
  check('Voicing regression (engine 3.1, seed 1)', JSON.stringify(got) === JSON.stringify(WANT), got.filter((g, i) => g !== WANT[i]).join(' | '));
  for (const s of [2, 3, 99, 12345, 0xDEADBEEF]) {
    const b = E.buildPiece(items, refPiece(s));
    const ok = b.events.slice(2).every((e, i) => { const ch = items[i + 2]; return e.targets.length === 11 && e.targets[0] % 12 === ch.bass && e.targets.slice(1).every(m => ch.pcs.includes(m % 12)); });
    check('Regression passage stays in chord tones, voicing seed ' + s, ok);
  }
}

// Harmony fixed, voicing reroll changes realization but never the chords
{
  const chords = 'Ebmaj9, Cm11, Abmaj9, Bb9sus4, Gm7, Cm9, Abmaj7#11, Bb13sus4, Ebmaj9';
  const items = E.parseProgression(chords).items;
  const outs = new Set();
  for (let s = 1; s <= 12; s++) {
    const b = E.buildPiece(items, base({ seeds: { harmony: 7, voicing: s, motion: 1, sound: 1 } }));
    const ok = b.events.every((e, i) => e.targets.slice(1).every(m => items[i].pcs.includes(m % 12)) && e.targets[0] % 12 === items[i].bass);
    if (!ok) check('reroll keeps chord tones (seed ' + s + ')', false);
    outs.add(JSON.stringify(b.events.map(e => e.targets)));
  }
  check('Voicing reroll gives different realizations of the same chords', outs.size >= 6, outs.size + ' distinct of 12');
  const a = E.buildPiece(items, base({ seeds: { harmony: 7, voicing: 5, motion: 1, sound: 1 } }));
  const b = E.buildPiece(items, base({ seeds: { harmony: 7, voicing: 5, motion: 1, sound: 1 } }));
  check('Same seeds reproduce exactly', JSON.stringify(a.events) === JSON.stringify(b.events));
  const c = E.buildPiece(items, base({ seeds: { harmony: 7, voicing: 5, motion: 9, sound: 3 }, motion: { order: 'random', stagger: 60 } }));
  check('Motion/sound seeds do not change voicings', JSON.stringify(a.events.map(e => e.targets)) === JSON.stringify(c.events.map(e => e.targets)));
}

// Voicing controls do what they say
{
  const items = E.parseProgression('=C6, Fmaj9, Dm11, Bbmaj9, C9sus4, Am11, Fmaj9').items;
  const meanMove = pc => { const b = E.buildPiece(items, pc); let s = 0, n = 0; for (let i = 2; i < b.events.length; i++) b.events[i].targets.forEach((m, v) => { if (v) { s += Math.abs(m - b.events[i - 1].targets[v]); n++; } }); return s / n; };
  const vo = o => base({ voicing: Object.assign(E.defaultPiece().voicing, o) });
  check('Higher continuity means less movement', meanMove(vo({ continuity: 100, variation: 0 })) <= meanMove(vo({ continuity: 10, variation: 0 })),
    meanMove(vo({ continuity: 100, variation: 0 })).toFixed(2) + ' vs ' + meanMove(vo({ continuity: 10, variation: 0 })).toFixed(2));
  const distinct = pc => { const b = E.buildPiece(items, pc); return b.events.slice(2).reduce((a, e) => a + new Set(e.targets).size, 0) / (b.events.length - 2); };
  check('Higher stacking means fewer distinct pitches', distinct(vo({ stacking: 100, spread: 30 })) < distinct(vo({ stacking: 0, spread: 30 })),
    distinct(vo({ stacking: 100, spread: 30 })).toFixed(2) + ' vs ' + distinct(vo({ stacking: 0, spread: 30 })).toFixed(2));
  const topMax = pc => Math.max(...E.buildPiece(items, pc).events.slice(1).flatMap(e => e.targets));
  check('Register top is respected', topMax(vo({ top: 76 })) <= 76, String(topMax(vo({ top: 76 }))));
  for (const mode of ['root', 'nearest', 'pedal', 'none']) {
    const b = E.buildPiece(items, vo({ bassMode: mode }));
    const basses = b.events.slice(1).map(e => E.noteName(e.targets[0]));
    const okMode = mode === 'pedal' ? new Set(basses).size === 1 : mode === 'root' ? b.events.slice(1).every((e, i) => e.targets[0] % 12 === items[i + 1].bass) : true;
    check('Bass mode ' + mode, okMode && !b.warnings.length, basses.join(' '));
  }
}

// Motion: stagger and departure order
{
  const items = E.parseProgression('Cmaj9, Fmaj9').items;
  const P = o => base({ motion: o, timing: { chordSec: 4, glide: 2, easing: 'smooth', tempo: 60 } });
  const ev = o => E.buildPiece(items, P(o)).events[1];
  const t = ev({ order: 'together', stagger: 80 });
  check('Together: everyone departs at once', t.off.every(x => x === 0) && t.dur.every(x => x === 2));
  const lh = ev({ order: 'low-high', stagger: 80 }), mv = lh.targets.map((m, v) => m !== E.buildPiece(items, P({})).events[0].targets[v]);
  const offs = lh.off.filter((_, v) => mv[v]);
  check('Low to high: departures rise with pitch', offs.every((x, i) => i === 0 || x >= offs[i - 1]) && offs[offs.length - 1] > 0, offs.map(x => x.toFixed(2)).join(' '));
  const hl = ev({ order: 'high-low', stagger: 80 }); const offs2 = hl.off.filter((_, v) => mv[v]);
  check('High to low: departures fall with pitch', offs2.every((x, i) => i === 0 || x <= offs2[i - 1]));
  check('Stagger stays inside the glide window', [lh, hl].every(e => e.off.every((o, v) => o + e.dur[v] <= e.g + 1e-9)));
  const b = E.buildPiece(items, P({ order: 'largest', stagger: 100 }));
  const mid = E.pitchAt(b, 1, b.events[1].t + 0.5); check('pitchAt works with stagger', Number.isFinite(mid));
}

// Composer writes chords only; normalizePiece fills gaps
{
  const txt = E.composeFromSeed(42, 5); const pr = E.parseProgression(txt);
  check('Composer output parses', pr.errors.length === 0 && pr.items.length >= 8, txt.split('\n').join(' '));
  const n = E.normalizePiece({ name: 'x', voicing: { coverage: 80 } });
  check('normalizePiece fills defaults', n.voicing.coverage === 80 && n.voicing.continuity === 50 && n.motion.order === 'together' && n.formatVersion === 3);
  const L = E.landmarks(E.buildPiece(E.parseProgression('=E6, Amaj9, Dmaj9, =E6').items, base()));
  check('Auto-zoom landmarks are ordered', L.inStart <= L.inEnd && L.inEnd <= L.outStart && L.outStart <= L.outEnd, JSON.stringify(L));
}

// v3.1 fixes
{
  const vo = o => base({ voicing: Object.assign(E.defaultPiece().voicing, o) });
  for (const [txt, top, oct] of [['Bmaj9', 67, 3], ['Emaj9, Bmaj9, G#m11, C#m9, F#13sus4', 67, 3], ['=E6, Amaj9, F#m11, Dmaj9', 72, 2], ['Cmaj9, Am11, Fmaj7#11, G13sus4', 69, 3]]) {
    for (const mode of ['root', 'nearest', 'pedal', 'none']) {
      const b = E.buildPiece(E.parseProgression(txt).items, vo({ top, bassOctave: oct, bassMode: mode }));
      const chordEvents = b.events.filter(e => e.kind === 'chord');
      const mx = Math.max(...chordEvents.flatMap(e => e.targets));
      const above = mode === 'none' || chordEvents.every(e => e.targets.slice(1).every(m => m > e.targets[0]));
      if (mx > top || !above) check(`Highest note ${E.noteName(top)} is hard (${txt}, bass oct ${oct}, ${mode})`, false, 'max ' + E.noteName(mx) + (above ? '' : ', a voice at or below the bass'));
    }
  }
  check('Highest note is a hard ceiling across 16 tight-register cases', true);
  const nb = E.buildPiece(E.parseProgression('Dm7, Cmaj7/D').items, vo({ bassMode: 'nearest' }));
  const pc = nb.events[1].targets[0] % 12;
  check('Nearest chord tone ignores a slash note outside the chord', [0, 4, 7, 11].includes(pc), E.noteName(nb.events[1].targets[0]));
  let refused = false; try { E.normalizePiece({ formatVersion: 4, chords: 'C' }); } catch (e) { refused = /newer/.test(e.message); }
  check('A newer file format is refused, not silently downgraded', refused);
  const kept = E.normalizePiece({ formatVersion: 3, chords: 'C', myNotes: { a: 1 } });
  check('Unknown fields are kept', kept.myNotes && kept.myNotes.a === 1);
  const cl = E.normalizePiece({ voicing: { top: 120 }, timing: { tempo: 999, glide: 40 }, sound: { detune: 90 } });
  check('Imported values are limited to what the controls can show', cl.voicing.top === 96 && cl.timing.tempo === 180 && cl.timing.glide === 5 && cl.sound.detune === 20);
  // realization round trip: frozen playback equals the original
  const items = E.parseProgression('=F6:0.8, Dbmaj9, Fm7, Gbmaj9#11, Ebm9, Ab9sus4, Dbmaj9:3, =F6').items;
  const orig = E.buildPiece(items, base({ motion: { order: 'low-high', stagger: 60 } }));
  const real = JSON.parse(JSON.stringify(E.realizationOf(orig)));
  const back = E.builtFromRealization(real, base());
  let worst = 0; for (let t = 0; t < orig.total; t += 0.07) for (let v = 0; v < orig.N; v++) worst = Math.max(worst, Math.abs(E.pitchAt(orig, v, t) - E.pitchAt(back, v, t)));
  check('Saved realization replays the exact same pitches', E.validRealization(real) && worst === 0, 'worst diff ' + worst);
  const withReal = E.normalizePiece(Object.assign(base(), { realization: real }));
  const bad = (mut) => { const r2 = JSON.parse(JSON.stringify(real)); mut(r2); return E.validRealization(r2); };
  check('Realization check rejects bad timing values', !bad(r => {}) === false && !bad(r => { r.events[1].dur[0] = 'oops'; }) === true && !bad(r => { r.events[1].off[2] = null; }) === true
    && !bad(r => { r.events[1].dur[3] = -9; }) === true && !bad(r => { r.events[2].t = r.events[1].t - 1; }) === true && !bad(r => { r.events[1].g = -1; }) === true && !bad(r => { delete r.events[1].dur; }) === true);
  check('Piece keeps a valid realization; rejects a broken one', !!withReal.realization && !E.normalizePiece(Object.assign(base(), { realization: { events: [{ targets: [1] }], N: 3, total: 1 } })).realization);
}
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
