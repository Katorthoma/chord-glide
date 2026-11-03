// node test_engine.js — engine v3 checks
const fs = require('fs'), path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8');
const E = new Function(SRC + '; return {ENGINE_VERSION, realizationOf, builtFromRealization, validRealization, parseItem, parseProgression, buildPiece, pitchAt, hz, noteName, SHARP, composeFromSeed, defaultPiece, normalizePiece, landmarks, TONES, TONE_GAIN, toneWave, realizationTooLarge, pitchMoves, parseNoteOct, MAX_VOICES, buildScore, parseLine, gainAt, gainMoves, vibratoMoves, volumeAt, partSeed, partRealizations, realizationOf, LINE_LIMITS, landmarks, FADE};')();
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
  let refused = false; try { E.normalizePiece({ formatVersion: 5, chords: 'C' }); } catch (e) { refused = /newer/.test(e.message); }
  check('A newer file format is refused, not silently downgraded', refused);
  const kept = E.normalizePiece({ formatVersion: 3, chords: 'C', myNotes: { a: 1 } });
  check('Unknown fields are kept', kept.myNotes && kept.myNotes.a === 1);
  const cl = E.normalizePiece({ voices: 99, voicing: { top: 120 }, timing: { tempo: 999, glide: 40 }, sound: { detune: 90 } });
  check('Imported values are limited to what the controls can show', cl.voicing.top === 96 && cl.timing.tempo === 180 && cl.timing.glide === 12 && cl.sound.detune === 20 && cl.voices === 32);
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
  check('Saved notes: one voice with 2,000,000 snapshots is refused for its snapshot count', /snapshots \(at most 75,000\)/.test(String(opens(real(1, 2000000, 3000)))), String(opens(real(1, 2000000, 3000))));
  check('Saved notes: an hour of 20-a-second snapshots still opens', opens(real(2, 72000, 3600)) === true);
  const asText = real(4, 10, 10); asText.total = '28'; const nText = real(4, 10, 10); nText.N = '4';
  check('Saved notes: a length or voice count written as text is not accepted', !E.validRealization(asText) && !E.validRealization(nText) && opens(asText) === false);
  check('Saved notes: merely broken ones are still dropped quietly', !E.normalizePiece(Object.assign(base(), { realization: { events: [{ targets: [1] }], N: 3, total: 1 } })).realization);
}
// ---- 4.1 foundations: more voices, longer glides, cents, and a pitch schedule that doesn't depend on length ----
{
  const prog = 'Cmaj9, Am11, Fmaj7#11, G13sus4, Em9, A7b9, Dm9, G7';
  const b32 = E.buildPiece(E.parseProgression(prog).items, base({ voices: 32 }));
  const okTones = b32.events.every(e => { const it = E.parseItem(e.label); return e.targets.slice(1).every(p => it.pcs.includes(((Math.round(p) % 12) + 12) % 12)); });
  check('32 voices: the editor allows ' + E.MAX_VOICES + ', and every upper voice is a chord tone under the highest-note limit', b32.N === 32 && E.MAX_VOICES === 32 && okTones && b32.max <= base().voicing.top && !b32.warnings.length, b32.N + ' voices, top ' + b32.max);
  check('Voice counts above the limit are clamped to it', base({ voices: 99 }).voices === 32);
  const long = E.buildPiece(E.parseProgression('C:14, Am:14, F:14').items, base({ timing: { glide: 12, chordSec: 12 } }));
  check('Glides up to 12 seconds: a 12 s glide is kept, and 20 is clamped to 12', long.events[1].g === 12 && long.events[2].g === 12 && base({ timing: { glide: 20 } }).timing.glide === 12);
  check('Cents after the octave: D3+33, B3-14, A4+12.5¢; C-1 is still octave -1; over 99 cents is refused',
    E.parseNoteOct('D3+33') === 50.33 && E.parseNoteOct('B3-14') === 58.86 && E.parseNoteOct('A4+12.5¢') === 69.125 && E.parseNoteOct('C-1') === 0 && E.parseNoteOct('D3+150') === null);
  const pc = E.buildPiece(E.parseProgression('=C4-14, Emaj9[E2 B3-14 G#4+41], Amaj9').items, base({ voices: 3 }));
  check('Cents reach the voices: a unison at C4-14 and a pinned voicing keep their exact pitches', pc.events[0].targets.every(p => p === 59.86) && JSON.stringify(pc.events[1].targets) === '[40,58.86,68.41]', JSON.stringify(pc.events[1].targets));
  // replay the schedule as an AudioParam would (ramps: exponential in Hz, so linear in pitch; curves: linear in Hz between samples)
  const replay = (mv, t) => { let p = mv[0].p, pt = mv[0].t;
    for (const m of mv) {
      if (m.kind === 'set') { if (m.t > t) break; p = m.p; pt = m.t; }
      else if (m.kind === 'ramp') { if (m.t <= t) { p = m.p; pt = m.t; } else { if (t >= pt) return p + (m.p - p) * (t - pt) / (m.t - pt); break; } }
      else { if (m.t > t) break; if (t >= m.t + m.d) { p = m.ps[m.ps.length - 1]; pt = m.t + m.d; continue; }
        const f = (t - m.t) / m.d * (m.ps.length - 1), k = Math.floor(f), h = E.hz(m.ps[k]) + (E.hz(m.ps[k + 1]) - E.hz(m.ps[k])) * (f - k); return 12 * Math.log2(h / 440) + 69; } }
    return p; };
  const worst = (bt, from) => { let w = 0; for (let v = 0; v < bt.N; v++) { const mv = E.pitchMoves(bt, v, from); for (let k = 0; k <= 4000; k++) { const t = from + (bt.total - from) * k / 4000; w = Math.max(w, Math.abs(replay(mv, t) - E.pitchAt(bt, v, t))); } } return w; };
  const items = E.parseProgression(prog).items;
  const wSmooth = Math.max(worst(E.buildPiece(items, base()), 0), worst(E.buildPiece(items, base({ timing: { easing: 'smoother' } })), 5.3));
  const wLin = worst(E.buildPiece(items, base({ motion: { order: 'low-high', stagger: 60 }, timing: { easing: 'linear' } })), 0);
  // a 10-minute piece of saved notes 0.05 s apart: accuracy must not depend on length
  const N = 4, ev = []; for (let i = 0; i < 12000; i++) ev.push({ t: i * 0.05, g: 0.05, label: 'x', kind: 'chord', targets: Array.from({ length: N }, (_, v) => 48 + v * 7 + 5 * Math.sin(i / 7 + v) + (i % 8 < 4 ? 0 : 12)) });
  const long10 = E.builtFromRealization({ engine: 'custom', easing: 'linear', N, total: 600, events: ev }, base());
  const wLong = Math.max(worst(long10, 0), worst(long10, 587.3));
  check('Pitch schedule: linear glides and saved notes replay exactly, at any length; eased glides within 0.01 cent',
    wLin < 1e-9 && wLong < 1e-9 && wSmooth < 1e-4, 'linear ' + wLin.toExponential(1) + ', 10-minute saved notes ' + wLong.toExponential(1) + ', eased ' + (wSmooth * 100).toFixed(4) + ' cents');
}
// ---- Parts (file format 4): the Three Parts example from the app, rests, envelopes, seeds, saved notes with rests ----
{
  const appSrc = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  const EX = new Function(appSrc.slice(appSrc.indexOf('const EXAMPLES = ['), appSrc.indexOf('const LAYERS')) + 'return EXAMPLES;')();
  const ex = EX.find(x => x.name === 'Three Parts');
  const P3 = E.normalizePiece(Object.assign(E.defaultPiece(), ex));
  const items = E.parseProgression(P3.chords).items;
  const score = E.buildScore(E.buildPiece(items, P3), items);
  check('Format: a piece without parts or a volume shape is still written as format 3, with no new fields; one with parts as format 4',
    base().formatVersion === 3 && !('parts' in base()) && !('volume' in base()) && P3.formatVersion === 4 && P3.parts.length === 2);
  const plain = E.normalizePiece(Object.assign(E.defaultPiece(), ex, { parts: undefined }));
  check('Parts never change the main part: its voicing is identical with or without them', JSON.stringify(E.buildPiece(items, plain).events) === JSON.stringify(score.main.events));
  check('Three Parts: both lines parse, and every part ends with the chords', P3.parts.every(pt => !E.parseLine(pt.line).errors.length) && score.parts.every(pt => Math.abs(pt.sub.total - score.total) < 1e-9) && score.N === 9,
    score.parts.map(pt => pt.name + ' ' + pt.sub.N + ' voices, ' + pt.sub.total + ' s').join('; '));
  // the melody's top voice in bar 8: C6 (14–14.75 s), B5 (–15), a rest (15–15.5), G5 (15.5–16)
  const m = score.parts[2].first, g = t => E.gainAt(score, m, t), pt = t => E.pitchAt(score, m, t);
  check('A voice attacks, moves, sustains, releases, rests and attacks again',
    g(14.0) < g(13.95) - 0.05 && g(14.03) > 0.9 && Math.abs(g(14.6) - 0.7) < 1e-9 && pt(14.6) === 84 && pt(14.9) === 83 && g(15.1) > 0 && g(15.3) === 0 && g(15.45) === 0 && pt(15.49) === 83 && pt(15.5) === 79 && g(15.6) > 0.9,
    [14.0, 14.03, 14.6, 14.9, 15.1, 15.3, 15.6].map(t => t + ' s: ' + E.noteName(pt(t)) + ' at ' + g(t).toFixed(2)).join(', '));
  const tr = score.parts[2];
  check('A line doubled an octave down moves in parallel', [1, 3.3, 9.9, 17].every(t => E.pitchAt(score, tr.first, t) - E.pitchAt(score, tr.first + 1, t) === 12));
  // gain moves replay the envelope exactly (straight lines), from any point
  let gw = 0, gr = [0, 1];
  for (const from of [0, 7.3, 15.2]) { const mv = E.gainMoves(score, m, from); for (let k = 0; k <= 3000; k++) { const t = from + (score.total + 1 - from) * k / 3000;
    let val = mv[0].g; for (let j = 1; j < mv.length; j++) { if (mv[j].t <= t) val = mv[j].g; else { if (mv[j].t > mv[j - 1].t) val = mv[j - 1].g + (mv[j].g - mv[j - 1].g) * (t - mv[j - 1].t) / (mv[j].t - mv[j - 1].t); break; } }
    gw = Math.max(gw, Math.abs(val - g(t))); gr = [Math.min(gr[0], val), Math.max(gr[1], val)]; } }
  check('Envelope moves replay the envelope exactly from any point, and stay between 0 and 1', gw < 1e-9 && gr[0] >= 0 && gr[1] <= 1 && E.gainMoves(score, 0, 0) === null, 'worst ' + gw.toExponential(1));
  const vm = E.vibratoMoves(score, m, 0);
  check('Vibrato blooms only into notes long enough to hold it', vm && vm.rate === 5.5 && Math.max(...vm.moves.map(x => x.g)) === 18 && E.vibratoMoves(score, 0, 0) === null);
  // seeds: a part's voicing comes from its own id, so other parts never reroll it
  const pad = { name: 'Strings', preset: 'pad', voices: 4, voicing: { top: 84 } };
  const one = E.normalizePiece(Object.assign(E.defaultPiece(), ex, { parts: [pad] })), two = E.normalizePiece(Object.assign(E.defaultPiece(), ex, { parts: [ex.parts[0], ex.parts[1], pad] }));
  const sOne = E.buildScore(E.buildPiece(items, one), items), sTwo = E.buildScore(E.buildPiece(items, two), items);
  const padOf = sc => JSON.stringify(sc.parts.find(x => x.id === 'strings').sub.events.map(e => e.targets));
  check('Seeds per part: adding other parts before a pad part leaves its voicing unchanged, and it differs from the main part\'s', padOf(sOne) === padOf(sTwo) && E.partSeed(1, 'strings', 'voicing') !== E.partSeed(1, 'bass', 'voicing'));
  // a line that repeats fills the piece; legato joins notes into one gate; a line's lengths follow the tempo
  const rep = E.normalizePiece(Object.assign(E.defaultPiece(), ex, { parts: [{ name: 'Pulse', preset: 'line', line: 'C3 G3', step: '1/8', repeat: true, legato: true }] }));
  const sRep = E.buildScore(E.buildPiece(items, rep), items), pul = sRep.parts[1].sub;
  check('A repeating line fills the piece (88 eighth notes at 120 BPM), and legato makes it one long note', pul.events.length === 88 && pul.total === 22 && pul.gates[0].length === 1 && Math.abs(pul.events[5].t - 1.25) < 1e-9);
  // saved notes in a part, with rests (null): the voice is silent there and jumps to its next note
  const notesPart = { name: 'Written', preset: 'notes', realization: { engine: 'custom', easing: 'linear', N: 2, total: 4, events: [
    { t: 0, g: 0, label: 'a', kind: 'note', targets: [60, 64] }, { t: 1, g: 0.5, label: 'b', kind: 'note', targets: [null, 65] }, { t: 2, g: 0.5, label: 'c', kind: 'note', targets: [67, 67] }] } };
  const wn = E.normalizePiece(Object.assign(E.defaultPiece(), { chords: 'C:4', parts: [notesPart] })), sW = E.buildScore(E.buildPiece(E.parseProgression('C:4').items, wn), E.parseProgression('C:4').items);
  const w0 = sW.parts[1].first;
  check('Saved notes with rests: the voice rests, then jumps straight to its next note; the other voice still glides',
    E.gainAt(sW, w0, 0.5) === 1 && E.gainAt(sW, w0, 1.5) === 0 && E.pitchAt(sW, w0, 1.5) === 60 && E.pitchAt(sW, w0, 2.01) === 67 && E.gainAt(sW, w0, 2.2) > 0.9 && E.pitchAt(sW, w0 + 1, 1.25) === 64.5 && E.gainMoves(sW, w0 + 1, 0) === null);
  check('Saved notes with rests are accepted only in parts', !E.normalizePiece({ chords: 'C', realization: notesPart.realization }).realization && !!wn.parts);
  // the volume shape: straight lines in dB between its points, held before the first and after the last
  const vs = E.normalizePiece({ chords: 'C', volume: [{ t: 10, db: 0 }, { t: 0, db: -24 }, { t: 20, db: 99 }] });
  check('Volume shape: sorted, limited to +12 dB, and straight in dB between points', vs.formatVersion === 4 && E.volumeAt(vs, 0) === -24 && E.volumeAt(vs, 5) === -12 && E.volumeAt(vs, 15) === 6 && E.volumeAt(vs, 30) === 12 && E.volumeAt(base(), 3) === 0);
  // the overall voice limit
  const many = E.normalizePiece({ chords: 'C', voices: 32, parts: [{ preset: 'pad', voices: 32 }, { preset: 'line', line: 'C4', transpose: [0, 12] }] });
  check('All parts together stay within 64 voices: a part that would go over is left out', many.parts.length === 1 && many.parts[0].preset === 'pad');
}
// ---- Safety and fidelity for parts (from review) ----
{
  // a file can claim a glide far longer than the piece: the schedule stops at the end, without allocating for the rest
  const huge = { engine: 'custom', easing: 'smooth', N: 1, total: 1, events: [{ t: 0, g: 0, label: 'a', kind: 'note', targets: [60] }, { t: 0.5, g: 1e9, label: 'b', kind: 'note', targets: [72], off: [0], dur: [1e9] }] };
  const hb = E.builtFromRealization(huge, base()), t0 = Date.now(), hm = E.pitchMoves(hb, 0, 0), pts = hm.reduce((a, m) => a + (m.ps ? m.ps.length : 1), 0);
  check('A glide that claims to last 10⁹ seconds is scheduled only up to the end of the piece', pts < 200 && Date.now() - t0 < 200 && hm.every(m => (m.t || 0) <= 1 + 1e-9), pts + ' points');
  // lines: finite, sensible lengths; a budget per part and for the whole piece
  const longDigits = 'C4:' + '9'.repeat(400);
  check('A line refuses an endless or too short a length (a 400-digit length, 1/128 of a step)', E.parseLine(longDigits).errors.length === 1 && E.parseLine('C4:0.0078').errors.length === 1 && E.parseLine('C4:0.25').errors.length === 0);
  const tiny = E.normalizePiece({ chords: 'C:20', timing: { tempo: 180 }, parts: [{ name: 'Fizz', preset: 'line', step: '1/32', line: 'C4:0.02 D4:0.02', repeat: true }] });
  const tit = E.parseProgression(tiny.chords).items, tsc = E.buildScore(E.buildPiece(tit, tiny), tit);
  check('A line of notes too short to hear (under 5 ms) is left out, not expanded into hundreds of thousands', tsc.parts.length === 1);
  const many = E.normalizePiece({ chords: 'C:3000', timing: { tempo: 180 }, parts: Array.from({ length: 7 }, (_, k) => ({ name: 'Run ' + (k + 1), preset: 'line', step: '1/32', line: 'C4 E4 G4', repeat: true })) });
  const mit = E.parseProgression(many.chords).items, msc = E.buildScore(E.buildPiece(mit, many), mit);
  const counts = msc.parts.slice(1).map(pt => pt.sub.notes), sum = counts.reduce((a, x) => a + x, 0);
  check('Lines stop at ' + E.LINE_LIMITS.notes + ' notes each and ' + E.LINE_LIMITS.total + ' together, and say so', counts.every(c => c <= E.LINE_LIMITS.notes) && sum <= E.LINE_LIMITS.total && msc.cut.length >= 5, counts.join(', '));
  // the voice budget counts the main part's saved notes
  const r60 = { engine: 'custom', easing: 'linear', N: 60, total: 4, events: [{ t: 0, g: 0, label: 'a', kind: 'chord', targets: new Array(60).fill(60) }] };
  const big = E.normalizePiece({ chords: 'C', voices: 15, realization: r60, parts: [{ name: 'Pad', preset: 'pad', voices: 20 }, { name: 'Tune', preset: 'line', line: 'C5', transpose: [0, 12, 24, 36] }] });
  check('All parts stay within 64 voices counting the main part\'s saved notes (60 + 4, not 60 + 20)', big.parts.length === 1 && big.parts[0].name === 'Tune');
  // pitches outside MIDI 0–127 are refused where they're written
  const items = E.parseProgression('=C-1-50, =G9+50, =C-1, Cmaj7[C2 G#9], =G9').items, errs = E.parseProgression('=C-1-50, =G9+50, =C-1, Cmaj7[C2 G#9], =G9').errors;
  check('Notes outside MIDI 0–127 are refused: =C-1-50, =G9+50 and a pin at G#9, while C-1 and G9 are fine', errs.length === 3 && items.length === 2, errs.join(', '));
  const lr = E.parseLine('C8 G9 E4', [0, 12]);
  check('A line note that its doubling would take past G9 is reported, and plays as a rest so the timing holds', lr.errors.length === 1 && /G9 \(out of range\)/.test(lr.errors[0]) && lr.notes.length === 3 && lr.notes[1].p === null && lr.notes[0].p === 108);
  // pad parts keep their resolved notes: saved by another engine, they play exactly as saved
  const pp = E.normalizePiece(Object.assign(E.defaultPiece(), { chords: 'C, Am, F, G', voices: 6, parts: [{ name: 'Strings', preset: 'pad', voices: 4 }] }));
  const pit = E.parseProgression(pp.chords).items, psc = E.buildScore(E.buildPiece(pit, pp), pit), rz = E.partRealizations(psc);
  check('Pad parts\' resolved notes are saved with the piece, the main part\'s separately', rz.strings && rz.strings.N === 4 && E.realizationOf(psc).N === 6);
  const old = JSON.parse(JSON.stringify(rz.strings)); old.engine = '3.0'; old.events.forEach(e => { e.targets = e.targets.map(x => x + 0.5); });
  const pf = E.normalizePiece(Object.assign({}, pp, { parts: [Object.assign({}, pp.parts[0], { realization: old })] })), pfs = E.buildScore(E.buildPiece(pit, pf), pit);
  check('A pad part saved by another engine plays its saved notes exactly, and a mismatched voice count is ignored',
    JSON.stringify(pfs.parts[1].sub.events.map(e => e.targets)) === JSON.stringify(old.events.map(e => e.targets)) && pfs.parts[1].sub.frozen === '3.0'
    && !E.normalizePiece(Object.assign({}, pp, { parts: [Object.assign({}, pp.parts[0], { voices: 5, realization: old })] })).parts[0].realization);
  // a release that runs past the chords' end extends the piece, so it isn't cut off
  // releases ring on into the tail while the held parts fade; only what wouldn't fit in it extends the music
  const ring = rel => { const rl = E.normalizePiece({ chords: 'C:4', timing: { tempo: 60 }, parts: [{ name: 'Bell', preset: 'line', step: '1/4', line: 'C5:4', envelope: { release: rel } }] });
    const rit = E.parseProgression(rl.chords).items; return E.buildScore(E.buildPiece(rit, rl), rit); };
  const r25 = ring(2.5), r5 = ring(5);
  check('A 2.5 s release rings out in the tail without lengthening the music (4 s); a 5 s release lengthens the piece only by what won\'t fit (6.2 s), and the held parts still fade from the music\'s end (4 s)',
    r25.total === 4 && r25.musicEnd === 4 && r5.musicEnd === 4 && E.gainAt(r25, r25.parts[1].first, 6.49) > 0 && E.gainAt(r25, r25.parts[1].first, 6.5) === 0 && Math.abs(r5.total - 6.2) < 1e-9 && E.gainAt(r5, r5.parts[1].first, 6.2 + 2.79) > 0 && E.gainAt(r5, r5.parts[1].first, 9) === 0, r25.total + ' s, ' + r5.total + ' s');
}
// ---- Auto zoom for pieces saved as dense snapshots ----
{
  // 100 s of snapshots 0.05 s apart: four chords, each with a glide at its start; the last one moving to within 0.1 s of the end
  const N = 4, ev = [], total = 100, chordAt = t => Math.min(3, Math.floor(t / 25)), names = ['C', 'Am', 'F', 'G'];
  for (let i = 0; i < 2000; i++) { const t = i * 0.05, c = chordAt(t), into = t - c * 25;
    ev.push({ t, g: 0.05, label: names[c], kind: 'chord', targets: Array.from({ length: N }, (_, v) => 48 + v * 5 + c * 2 + (into < 2 ? into : 2) + (c === 3 && t > 99.85 ? 1 : 0)) }); }
  const dense = E.builtFromRealization({ engine: 'custom', easing: 'linear', N, total, events: ev }, base());
  const L = E.landmarks(dense);
  check('Auto zoom on dense snapshots: zooms in from the first chord as it always has, and out over at least 3 s that run on into the closing fade',
    L.inStart === 0 && Math.abs(L.inEnd - 1.25) < 1e-9 && L.outEnd > total && Math.abs(L.outEnd - (total + E.FADE * 0.9)) < 1e-9 && L.outEnd - L.outStart >= 3 - 1e-9, JSON.stringify(L));
  // snapshots without chord names (as other programs write them) aren't merged into one chord that lasts the whole piece
  const unnamed = E.landmarks(E.builtFromRealization({ engine: 'custom', easing: 'linear', N, total, events: ev.map(e => { const o = Object.assign({}, e); delete o.label; return o; }) }, base()));
  check('Saved notes without labels have no chord name (not "undefined")', E.builtFromRealization({ engine: 'custom', easing: 'linear', N: 3, total: 2, events: [{ t: 0, g: 0, targets: [60, 64, 67] }] }, base()).events[0].label === '');
  check('Auto zoom on unnamed snapshots: zooms in at the start and out at the end, not across the whole piece', unnamed.inStart === 0 && unnamed.inEnd < 2 && unnamed.outStart > 95 && unnamed.outEnd > total, JSON.stringify(unnamed));
  // when the last chord's final move is 8 s before the end and it then holds still, the zoom out starts there and ends with the music
  const still = Array.from({ length: 2000 }, (_, i) => { const t = i * 0.05, c = chordAt(t);
    return { t, g: 0.05, label: names[c], kind: 'chord', targets: Array.from({ length: N }, (_, v) => 48 + v * 5 + c * 2 + (t >= 92 ? 1 : 0)) }; });
  const S = E.landmarks(E.builtFromRealization({ engine: 'custom', easing: 'linear', N, total, events: still }, base()));
  check('… and when the last chord settles 8 s before the end, the zoom out starts there and ends with the music', Math.abs(S.outStart - 92) < 0.06 && S.outEnd === total, JSON.stringify(S));
}
// ---- Auto zoom times chosen for a piece ----
{
  const z = E.normalizePiece(Object.assign(base(), { view: { zoom: { inStart: 2, inEnd: 1, outStart: 30, outEnd: 35 } } })).view.zoom;
  check('A piece can set its own auto zoom times, kept in order (an end before its start moves up to it)', z && z.inStart === 2 && z.inEnd === 2 && z.outStart === 30 && z.outEnd === 35, JSON.stringify(z));
  const bad = E.normalizePiece(Object.assign(base(), { view: { zoom: { inStart: 2, inEnd: 'x', outStart: 30, outEnd: 35 } } })).view.zoom;
  const none = E.normalizePiece(base()).view.zoom;
  check('… and times that aren\'t numbers are dropped, so the piece zooms automatically; a piece without them has none', bad === undefined && none === undefined);
}
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
