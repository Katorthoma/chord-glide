// node test_engine.js — engine v3 checks
const fs = require('fs'), path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8');
const E = new Function(SRC + '; return {ENGINE_VERSION, realizationOf, builtFromRealization, validRealization, parseItem, parseProgression, buildPiece, pitchAt, hz, noteName, SHARP, composeFromSeed, defaultPiece, normalizePiece, landmarks, TONES, TONE_GAIN, toneWave, realizationTooLarge};')();
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
  check('Every tone is accepted; an unknown one falls back to Soft', ['pure', 'soft', 'warm', 'glass', 'reed', 'triangle', 'square', 'pulse', 'saw', 'organ', 'bowed', 'cello', 'brass', 'harp', 'octaves', 'chime', 'air'].every(t => E.normalizePiece(Object.assign(base(), { sound: { tone: t } })).sound.tone === t) && E.normalizePiece(Object.assign(base(), { sound: { tone: 'kazoo' } })).sound.tone === 'soft');
  check('Auto-zoom landmarks are ordered', L.inStart <= L.inEnd && L.inEnd <= L.outStart && L.outStart <= L.outEnd, JSON.stringify(L));
  // saved notes as dense snapshots: tiny trailing moves (shimmer) don't count as arrivals, so auto zoom still zooms out at the end
  const snaps = [{ t: 0, g: 0, label: 'a', kind: 'chord', targets: [50, 60, 70] }, { t: 1, g: 4, label: 'b', kind: 'chord', targets: [40, 64, 80] }];
  for (let k = 0; k < 40; k++) snaps.push({ t: 5 + k * 0.25, g: 0.25, label: 'b', kind: 'chord', targets: [40 + Math.sin(k) * 0.05, 64 - Math.sin(k) * 0.04, 80 + Math.cos(k) * 0.05] });
  const Ls = E.landmarks(E.builtFromRealization({ engine: '0', easing: 'linear', N: 3, total: 16, events: snaps }, base()));
  check('Auto zoom ignores trailing shimmer when finding the last arrival', Ls.outStart === 5 && Ls.outEnd === 16, JSON.stringify(Ls));
  const Lr = E.landmarks(E.buildPiece(E.parseProgression('C, F, G, G').items, base()));
  const Lp = E.landmarks(E.buildPiece(E.parseProgression('C, F, G').items, base()));
  check('A repeated last chord still counts as the last arrival', Lr.outStart > Lp.outStart, JSON.stringify([Lp.outStart, Lr.outStart]));
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
// ---- Tones: each formula checked against its definition, and the original five unchanged ----
{
  const T = E.TONES, near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
  const original = { pure: [0, 1], soft: [0, 1, .2, .06, .02], warm: [0, 1, .5, .25, .12, .06, .03], glass: [0, 1, 0, .32, 0, .16, 0, .08], reed: [0, 1, .6, .45, .3, .2, .12, .08, .05] };
  check('Tones: the original five are exactly as they were, with no gain change', Object.entries(original).every(([k, v]) => JSON.stringify(T[k]) === JSON.stringify(v) && !(k in E.TONE_GAIN)));
  check('Tones: Square has only odd harmonics, at 1/n', T.square.slice(1).every((a, i) => near(a, (i + 1) % 2 ? 1 / (i + 1) : 0)));
  check('Tones: Triangle has only odd harmonics, at ±1/n²', T.triangle.slice(1).every((a, i) => { const n = i + 1; return near(Math.abs(a), n % 2 ? 1 / (n * n) : 0) && (n % 2 === 0 || Math.sign(a) === (n % 4 === 1 ? 1 : -1)); }));
  check('Tones: Saw has every harmonic at 1/n', T.saw.slice(1).every((a, i) => near(a, 1 / (i + 1))));
  // Pulse: build one cycle of the actual waveform and measure how much of it is "high"
  const pw = E.toneWave('pulse'), M = 4096, x = Array.from({ length: M }, (_, i) => { const th = 2 * Math.PI * i / M; let v = 0; for (let n = 1; n < pw.real.length; n++) v += pw.real[n] * Math.cos(n * th) + pw.imag[n] * Math.sin(n * th); return v; });
  const mid = (Math.max(...x) + Math.min(...x)) / 2, duty = x.filter(v => v > mid).length / M;
  check('Tones: Pulse is a real 25% pulse (high for ' + (duty * 100).toFixed(1) + '% of each cycle), every 4th harmonic missing', Math.abs(duty - 0.25) < 0.02 && [4, 8, 12, 16].every(n => near(pw.real[n], 0, 1e-12)));
  const db = n => 20 * Math.log10(T.organ[n]);
  check('Tones: Organ drawbars 8-6-5-4-3-2 step down 3 dB each, harmonics 5 and 7 absent', near(db(2), -6, 0.01) && near(db(3), -9, 0.01) && near(db(4), -12, 0.01) && near(db(6), -15, 0.01) && near(db(8), -18, 0.01) && T.organ[5] === 0 && T.organ[7] === 0);
  check('Tones: Bowed lifts harmonics 2–5 above a plain saw', [2, 3, 4, 5].every(n => T.bowed[n] > 1.05 / n));
  check('Tones: Cello has notches at every 9th harmonic and its peak among harmonics 1–5', [9, 18, 27, 36].every(n => Math.abs(T.cello[n]) < 1e-12) && T.cello.slice(1, 6).some(a => Math.abs(a) === Math.max(...T.cello.slice(1).map(Math.abs))));
  const rel = (arr, n) => arr[n] / arr[1]; // ratios survive the peak normalization
  const J = { 0: -0.2600519549, 1: 0.3390589585, 2: 0.4860912606, 3: 0.3090627223, 4: 0.1320341839, 5: 0.0430284348 }; // published Bessel values at x = 3
  const brassWant = n => J[n - 1] + (n % 2 ? -1 : 1) * J[n + 1];
  check('Tones: Brass follows the FM sidebands J(n−1, 3) ± J(n+1, 3) (known Bessel values)', [1, 2, 3, 4].every(n => near(rel(T.brass, n), brassWant(n) / brassWant(1), 1e-6)));
  check('Tones: Harp is plucked at 1/7 (harmonics 7, 14, 21, 28 vanish) with a 1/n² slope', [7, 14, 21, 28].every(n => Math.abs(T.harp[n]) < 1e-12) && [2, 3, 5, 9].every(n => near(rel(T.harp, n), Math.sin(n * Math.PI / 7) / (n * n) / Math.sin(Math.PI / 7), 1e-9)));
  check('Tones: Octaves has only harmonics 1, 2, 4, 8, 16, 32, loudest one octave up', T.octaves.slice(1).every((a, i) => { const n = i + 1; return ((n & (n - 1)) === 0) === (a !== 0); }) && T.octaves[2] === Math.max(...T.octaves));
  const phi = (1 + Math.sqrt(5)) / 2, fib = [1, 2, 3, 5, 8, 13, 21];
  check('Tones: Chime has only Fibonacci harmonics, each 1/φ of the one before', T.chime.slice(1).every((a, i) => fib.includes(i + 1) === (a !== 0)) && fib.slice(1).every((n, k) => near(T.chime[n] / T.chime[fib[k]], 1 / phi, 1e-9)));
  check('Tones: Air is almost all fundamental (2nd −20 dB, 3rd −30 dB, a flat −40 dB shelf 5–20)', near(rel(T.air, 2), 0.1) && near(rel(T.air, 3), 0.03) && T.air[4] === 0 && T.air.slice(5).every(a => near(a / T.air[1], 0.01)) && T.air.length === 21);
  check('Tones: every tone gives cosine and sine arrays of equal length, and unknown names fall back to Soft', Object.keys(T).every(k => { const w = E.toneWave(k); return w.real.length === w.imag.length && w.real.length >= 2; }) && JSON.stringify(E.toneWave('kazoo').imag) === JSON.stringify(T.soft));
}
// ---- Saved notes: generous limits, a clear refusal beyond them, and a "custom" label that's kept ----
{
  const real = (N, events, total, p = 60) => ({ engine: 'custom', easing: 'linear', N, total, events: Array.from({ length: events }, (_, i) => ({ t: i * total / events, g: 0, label: 'x', kind: 'chord', targets: new Array(N).fill(p) })) });
  const opens = r => { try { return !!E.normalizePiece(Object.assign(base(), { realization: r })).realization; } catch (e) { return e.message; } };
  check('Saved notes: 30 voices × 561 snapshots, marked "custom", open and are kept', opens(real(30, 561, 28)) === true);
  const msgs = [opens(real(65, 10, 10)), opens(real(8, 10, 4000)), opens(real(64, 40000, 600)), opens(real(8, 10, 10, 300))];
  check('Saved notes: too many voices, too long, too many notes or unplayable pitches are refused with a reason', msgs.every(m => typeof m === 'string' && /can't be opened safely/.test(m)), msgs.join(' | '));
  check('Saved notes: merely broken ones are still dropped quietly', !E.normalizePiece(Object.assign(base(), { realization: { events: [{ targets: [1] }], N: 3, total: 1 } })).realization);
}
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
