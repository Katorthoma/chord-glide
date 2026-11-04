// node test_engine.js — engine v3 checks
const fs = require('fs'), path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8');
const E = new Function(SRC + '; return {ENGINE_VERSION, realizationOf, builtFromRealization, validRealization, parseItem, parseProgression, buildPiece, pitchAt, hz, noteName, SHARP, composeFromSeed, defaultPiece, normalizePiece, landmarks, TONES, TONE_GAIN, toneWave, realizationTooLarge, pitchMoves, parseNoteOct, MAX_VOICES, buildScore, parseLine, gainAt, gainMoves, vibratoMoves, volumeAt, partSeed, partRealizations, realizationOf, LINE_LIMITS, landmarks, FADE, itemSeconds, defaultChordSec, formatFor, usesMusicalTime, hasSections, sectionRuns, parsePattern, patternNote, pitchMoves, parseLine, envelopePoints};')();
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
  let refused = false; try { E.normalizePiece({ formatVersion: 6, chords: 'C' }); } catch (e) { refused = /newer/.test(e.message); }
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
// ---- Musical time: chord lengths in bars and beats ----
{
  const P = base({ timing: { chordSec: 5, glide: 1.6, easing: 'smooth', tempo: 120, meter: 3 } }); // a bar of 3/4 at 120 BPM is 1.5 s
  const its = E.parseProgression('C:6 Am:6s F:2bar G:3beat Em:1.5bars Dm:2beats').items;
  check('Chord lengths: :6 and :6s are seconds, :2bar and :1.5bars are bars, :3beat and :2beats are beats (at 120 BPM in 3/4)',
    JSON.stringify(its.map(it => E.itemSeconds(it, P))) === JSON.stringify([6, 6, 3, 1.5, 2.25, 1]), JSON.stringify(its.map(it => E.itemSeconds(it, P))));
  const b = E.buildPiece(its, P);
  check('… and the chords start where those lengths put them', JSON.stringify(b.events.map(e => e.t)) === JSON.stringify([0, 6, 12, 15, 16.5, 18.75]) && b.total === 19.75, JSON.stringify(b.events.map(e => e.t)));
  check('A pinned chord can have a length in bars', E.itemSeconds(E.parseProgression('Emaj9[E2 B3 G#4]:2bar').items[0], P) === 3);
  const inBars = base({ timing: { chordSec: 5, glide: 1.6, easing: 'smooth', tempo: 90, meter: 4, unit: 'bar', chordBars: 2 } });
  check('A piece kept in bars: a chord without a length lasts the chord length in bars (2 bars of 4/4 at 90 BPM = 5.33 s)', Math.abs(E.defaultChordSec(inBars) - 16 / 3) < 1e-12 && Math.abs(E.buildPiece(E.parseProgression('C Am').items, inBars).total - 32 / 3) < 1e-9);
  // the file format follows what the piece uses
  const plain = base({ chords: 'C:6 Am F G' }), bars = base({ chords: 'C:2bar Am F G' }), beats = base({ chords: 'C Am:3beat' });
  check('The file format follows musical time: seconds only → 3; a chord in bars or beats, or a piece kept in bars → 5', plain.formatVersion === 3 && bars.formatVersion === 5 && beats.formatVersion === 5 && inBars.formatVersion === 5
    && E.formatFor(Object.assign({}, plain, { parts: [{}] })) === 4, [plain.formatVersion, bars.formatVersion, beats.formatVersion, inBars.formatVersion].join(' '));
  check('… and a chord name with "b" in it (Bb, Ebm) is not mistaken for a length', !E.usesMusicalTime({ chords: 'Bb:6 Ebmaj7 Abm9:4' }));
  // a piece in seconds voices exactly as before, whatever the tempo and meter
  const a1 = E.buildPiece(E.parseProgression('Cmaj9 Am9:6 Fmaj7 G13').items, base()), a2 = E.buildPiece(E.parseProgression('Cmaj9 Am9:6 Fmaj7 G13').items, base({ timing: { chordSec: 4.5, glide: 1.6, easing: 'smooth', tempo: 137, meter: 7 } }));
  check('A piece in seconds is unchanged by tempo and meter', JSON.stringify(a1.events) === JSON.stringify(a2.events));
}
// ---- Sections ----
{
  const text = 'Am:4\n[Groove x2]\nAm:4 Fmaj7:4 Bbmaj7:4 G:4\n[Lift +2]\nAm:4 C#m:4 Emaj9[E2 B3 G#4]:4';
  const pr = E.parseProgression(text);
  check('Sections: a header starts a section, repeats expand and a key change transposes (flats stay flats)',
    pr.items.map(i => i.label).join(' ') === 'Am Am Fmaj7 Bbmaj7 G Am Fmaj7 Bbmaj7 G Bm D#m F#maj9' && pr.items[11].pin.join(' ') === '42 61 70'
    && JSON.stringify(pr.sections.map(s => [s.name, s.repeat, s.transpose])) === '[["Groove",2,0],["Lift",1,2]]', pr.items.map(i => i.label).join(' '));
  check('… a transposed Bb stays flat (Bbmaj7 +2 is Cmaj7, Eb +1 is E, Ab -1 is G)', E.parseProgression('[A +2]\nBbmaj7\n[B +1]\nEb\n[C -1]\nAb').items.map(i => i.label).join(' ') === 'Cmaj7 E G');
  check('… a header that can\'t be read (a repeat over 64) is reported', E.parseProgression('[Bad x99]\nC').errors[0] === '[Bad x99]');
  check('… and a pinned voicing on its own line is not a header', !E.hasSections('Emaj9[E2 B3 G#4]\nAm') && E.hasSections('C\n[Intro]\nD'));
  const P = base({ chords: text }), b0 = E.buildPiece(pr.items, P), runs = E.sectionRuns(b0);
  check('The sections as they fall in time: Groove twice, then Lift', JSON.stringify(runs.map(r => [r.name, r.pass, r.t0, r.t1])) === '[["Groove",0,4,20],["Groove",1,20,36],["Lift",0,36,48]]', JSON.stringify(runs));
  check('A piece with sections is saved as format 5; parts choosing sections too', P.formatVersion === 5 && E.formatFor({ chords: 'C', parts: [{ plays: ['A'] }] }) === 5);
  // the main part playing only in Groove, a line only in Lift (from Lift's start, not the piece's)
  const P2 = base({ chords: text, plays: ['Groove'], parts: [{ id: 'mel', preset: 'line', line: 'C5:4 E5:4', step: '1/4', plays: ['Lift'], repeat: true, envelope: { attack: 0.01, decay: 0, sustain: 1, release: 0.1 } }], timing: { chordSec: 4, glide: 1.6, easing: 'smooth', tempo: 60 } });
  const sb = E.buildScore(E.buildPiece(E.parseProgression(P2.chords).items, P2), E.parseProgression(P2.chords).items);
  const mainG = t => E.gainAt(sb, 0, t), mel = sb.parts[1].first;
  check('A part playing in chosen sections is silent outside them and sounds in them (main part: Groove only)', mainG(2) === 0 && mainG(10) === 1 && mainG(30) === 1 && mainG(42) === 0, [mainG(2), mainG(10), mainG(30), mainG(42)].join(' '));
  check('… a line playing in one section starts at that section, repeats to its end and stops there', sb.parts[1].sub.events.find(e => e.t >= 36) && Math.abs(sb.parts[1].sub.gates[0][0].on - 36) < 1e-9 && sb.parts[1].sub.gates[0].every(g => g.on >= 36 - 1e-9 && g.off <= 48 + 1e-9) && E.gainAt(sb, mel, 20) === 0, JSON.stringify(sb.parts[1].sub.gates[0].slice(0, 3)));
  const P3 = base({ chords: text, plays: ['Lift'] }), sb3 = E.buildScore(E.buildPiece(E.parseProgression(P3.chords).items, P3), E.parseProgression(P3.chords).items);
  check('… a held part playing to the end sounds on through the closing fade, without lengthening the piece', sb3.main.gates[0][0].off > sb3.musicEnd && sb3.total === sb3.musicEnd, JSON.stringify(sb3.main.gates[0]) + ' total ' + sb3.total);
  const r = E.realizationOf(b0), back = E.builtFromRealization(r, P);
  check('Saved notes keep each chord\'s section, so a frozen piece keeps its sections', JSON.stringify(E.sectionRuns(back)) === JSON.stringify(runs));
  const plain = E.buildScore(E.buildPiece(E.parseProgression('Am Fmaj7 C G').items, base()), E.parseProgression('Am Fmaj7 C G').items);
  check('A piece without sections has none, and no part is gated by them', plain.sections.length === 0 && !plain.main.gates);
}
// ---- Pattern parts ----
{
  const pp = E.parsePattern("R R' 1 2:2 3, . - r:0.5 4'' x");
  check('Patterns: R, octave marks, positions, lengths, holds and rests; a step it can\'t read is reported',
    JSON.stringify(pp.steps.map(s => s.kind === 'note' ? s.what + (s.oct > 0 ? '+' : '') + (s.oct < 0 ? '-' : '') + Math.abs(s.oct) + ':' + s.steps : s.kind + ':' + s.steps))
      === JSON.stringify(['R0:1', 'R+1:1', '10:1', '20:2', '3-1:1', 'hold:1', 'rest:1', 'rest:0.5', '4+2:1']) && pp.errors.join() === 'x', JSON.stringify(pp));
  const Am = E.parseProgression('Am').items[0], FC = E.parseProgression('F/C').items[0], st = w => E.parsePattern(w).steps[0];
  const pick = w => E.patternNote(w[0] === 'F' ? FC : Am, st(w.slice(1)), 36), got = ['AR', 'A1', 'A2', 'A3', 'A4', "AR'", 'A2,', 'FB', 'FR'].map(pick).join(' ');
  check('… notes come from the chord, counting up from the part\'s lowest note: over Am from C2, R is A2, 1 2 3 4 are C2 E2 A2 C3, R\' is A3, 2, is E1; over F/C, B is C2 and R is F2',
    got === '45 36 40 45 48 57 28 36 41', got);
  // a bass pattern over two chords, eighths at 120 BPM (0.25 s a step), each step taking the chord sounding as it starts
  const P = base({ chords: 'Am:1 F:1', timing: { chordSec: 4, glide: 1.6, easing: 'smooth', tempo: 120 },
    parts: [{ id: 'b', preset: 'pattern', pattern: "R R' . -", step: '1/8', from: 36, transpose: [0], portamento: 0 }] });
  const its = E.parseProgression(P.chords).items, sb = E.buildScore(E.buildPiece(its, P), its), sub = sb.parts[1].sub;
  const at = t => E.pitchAt(sb, sb.parts[1].first, t), on = t => E.gainAt(sb, sb.parts[1].first, t) > 0.01;
  check('… a bass pattern: A2 A3 (held) rest, then F2 F3 (held) rest as the chord changes', [at(0.1), at(0.3), at(0.6), at(1.1), at(1.3), at(1.6)].join(' ') === '45 57 57 41 53 53' && on(0.6) && !on(0.9) && on(1.1) && sub.gates[0].length === 4,
    [at(0.1), at(0.3), at(0.6), at(1.1), at(1.3), at(1.6)].join(' ') + ' gates ' + sub.gates[0].length);
  check('A piece with a pattern part is saved as format 5', P.formatVersion === 5);
  const hi = base({ chords: 'C', parts: [{ id: 'h', preset: 'pattern', pattern: "1''", step: '1/4', from: 110 }] });
  const its2 = E.parseProgression(hi.chords).items, sb2 = E.buildScore(E.buildPiece(its2, hi), its2);
  check('… a step pushed past MIDI 127 is a rest, not an error', sb2.parts.length === 1 || sb2.parts[1].sub === null || !sb2.parts[1].sub.gates[0].length);
}
// ---- The kick: fixed notes in patterns, and a pitch drop on every note ----
{
  check('A pattern step can be a note name, the same note whatever the chord (C1; C1, is an octave down)', E.patternNote(E.parseProgression('F#m').items[0], E.parsePattern('C1').steps[0], 36) === 24 && E.patternNote(E.parseProgression('F#m').items[0], E.parsePattern('C1,').steps[0], 36) === 12 && E.parsePattern('B2 B').steps.map(s => s.what).join() === 'fixed,B');
  const P = base({ chords: 'Am:2 F:2', timing: { chordSec: 4, glide: 1.6, easing: 'smooth', tempo: 60 },
    parts: [{ id: 'kick', preset: 'pattern', pattern: 'C1', step: '1/4', from: 24, transpose: [0], drop: { semis: 36, time: 0.12 }, envelope: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.05 } }] });
  const its = E.parseProgression(P.chords).items, sb = E.buildScore(E.buildPiece(its, P), its), v = sb.parts[1].first, at = t => E.pitchAt(sb, v, t);
  check('… a kick: every beat starts 36 semitones up and falls onto C1 within 0.12 s, fast at first (over 80% of the way down in the first third)',
    Math.abs(at(1) - 60) < 1e-9 && at(1.04) < 60 - 0.8 * 36 * 0.3 && Math.abs(at(1.12) - 24) < 1e-9 && Math.abs(at(1.5) - 24) < 1e-9 && Math.abs(at(2.0001) - 60) < 0.1,
    [at(1), at(1.04), at(1.12), at(1.5), at(2.0001)].map(x => x.toFixed(2)).join(' '));
  const moves = E.pitchMoves(sb, v, 0);
  check('… and its falls are scheduled as curves, starting at each beat', moves.filter(m => m.kind === 'curve').length === 4 && moves.filter(m => m.kind === 'curve').every((m, k) => Math.abs(m.t - k) < 1e-9), JSON.stringify(moves.slice(0, 4).map(m => [m.kind, +m.t.toFixed(3)])));
  check('A line or pattern with a pitch drop is saved as format 5', E.formatFor({ chords: 'C', parts: [{ preset: 'line', drop: { semis: 12 } }] }) === 5);
}
// ---- Echoes: a copy of another part, later and moved ----
{
  const mel = { id: 'tune', preset: 'line', line: 'C5:2 E5:2 G5:4', step: '1/8', transpose: [0], portamento: 0 };
  const P = base({ chords: 'C:4', timing: { chordSec: 4, glide: 1.6, easing: 'smooth', tempo: 120 }, parts: [mel, { id: 'echo', preset: 'copy', of: 'tune', delay: 0.75, shift: -12, sound: { level: -6, pan: -0.5 } }] });
  const its = E.parseProgression(P.chords).items, sb = E.buildScore(E.buildPiece(its, P), its);
  const src = sb.parts[1], cp = sb.parts[2], at = (pt, t) => E.pitchAt(sb, pt.first, t);
  check('An echo plays its source\'s notes later (0.75 beats = 0.375 s at 120 BPM) and moved (an octave down)', cp.sub.N === 1 && [0.1, 0.6, 1.1].every(t => Math.abs(at(cp, t + 0.375) - (at(src, t) - 12)) < 1e-9)
    && Math.abs(cp.sub.gates[0][0].on - src.sub.gates[0][0].on - 0.375) < 1e-9 && E.gainAt(sb, cp.first, 0.2) === 0, [0.1, 0.6, 1.1].map(t => at(cp, t + 0.375) + '/' + at(src, t)).join(' '));
  check('… counts its source\'s voices, and is saved as format 5', P.parts.length === 2 && P.formatVersion === 5);
  const bad = base({ chords: 'C', parts: [{ id: 'e', preset: 'copy', of: 'nothing' }] }), its2 = E.parseProgression('C').items;
  check('An echo of a part that isn\'t there is left out (no voices, nothing built)', E.buildScore(E.buildPiece(its2, bad), its2).parts.length === 1);
}
// ---- Slides and loudness per note; curved decays ----
{
  const pl = E.parseLine('C5:2@0.6 ~E5:2 G5@60% -:2 ~C4 C4@1.5 -@0.5');
  check('Lines: @ sets how loud a note is struck (@0.6, @60%), ~ slides into it; a loudness over 1, or on a rest, can\'t be read', pl.notes.length === 5 && pl.errors.join() === 'C4@1.5,-@0.5' && pl.notes[0].v === 0.6 && pl.notes[1].slide && pl.notes[2].v === 0.6 && pl.notes[4].slide, JSON.stringify(pl));
  const P = base({ chords: 'C:4', timing: { chordSec: 4, glide: 1.6, easing: 'smooth', tempo: 60 },
    parts: [{ id: 'm', preset: 'line', line: 'C5@0.5 ~G5 E5', step: '1/4', transpose: [0], portamento: 0, envelope: { attack: 0.01, decay: 0, sustain: 1, release: 0.05 } }] });
  const its = E.parseProgression(P.chords).items, sb = E.buildScore(E.buildPiece(its, P), its), v = sb.parts[1].first, sub = sb.parts[1].sub;
  check('… a slide continues the note before (one gate) and glides over 80 ms when the part has no portamento; the next note is struck afresh',
    sub.gates[0].length === 2 && Math.abs(sub.gates[0][0].off - 2 + 0.03) < 1e-9 && sub.events.find(e => Math.abs(e.t - 1) < 1e-9).g === 0.08, JSON.stringify(sub.gates[0]));
  check('… the struck loudness carries through the slide (0.5), and the next note is at full loudness', Math.abs(E.gainAt(sb, v, 0.5) - 0.5) < 1e-9 && Math.abs(E.gainAt(sb, v, 1.5) - 0.5) < 1e-9 && Math.abs(E.gainAt(sb, v, 2.5) - 1) < 1e-9,
    [0.5, 1.5, 2.5].map(t => E.gainAt(sb, v, t)).join(' '));
  check('Patterns take ~ and @ too: ~R@0.5, 3@70%', JSON.stringify(E.parsePattern('~R@0.5 3@70% .@1').steps.map(s => [s.slide, s.v])) === '[[true,0.5],[false,0.7]]' && E.parsePattern('~R@0.5 3@70% .@1').errors.join() === '.@1');
  // curved envelopes
  const lin = E.envelopePoints([{ on: 0, off: 0.001 }], { attack: 0.001, decay: 0, sustain: 1, release: 1 }), exp = E.envelopePoints([{ on: 0, off: 0.001 }], { attack: 0.001, decay: 0, sustain: 1, release: 1, curve: 'exp' });
  const at = (pts, t) => { for (let i = 1; i < pts.length; i++) if (pts[i].t >= t) { const a = pts[i - 1], b = pts[i]; return a.g + (b.g - a.g) * (t - a.t) / (b.t - a.t); } return 0; };
  check('A natural (curved) release falls fast and then slowly: a quarter of the way through it is under −14 dB (a straight one is at −2.5 dB), and it ends in silence',
    20 * Math.log10(at(exp, 0.251)) < -14 && 20 * Math.log10(at(lin, 0.251)) > -3 && exp[exp.length - 1].g === 0 && exp.length > 16, [at(exp, 0.251), at(lin, 0.251)].map(x => (20 * Math.log10(x)).toFixed(1)).join(' '));
  // saved notes: a loudness per voice strikes the note afresh
  const r = { engine: 'custom', easing: 'linear', N: 1, total: 3, events: [{ t: 0, g: 0, targets: [60], vel: [0.4] }, { t: 1, g: 0, targets: [62], vel: [1] }, { t: 2, g: 0, targets: [64] }] };
  const fb = E.builtFromRealization(r, base());
  check('Saved notes with a loudness per note: each is struck afresh at its loudness; a note without one carries on', fb.gates[0].length === 2 && fb.gates[0][0].v === 0.4 && fb.gates[0][1].on === 1 && fb.gates[0][1].v === undefined && fb.gates[0][1].off === 3, JSON.stringify(fb.gates));
  check('… and a piece using them, a curved envelope or ~ and @ in a line is saved as format 5', E.formatFor({ chords: 'C', parts: [{ preset: 'notes', realization: r }] }) === 5 && E.formatFor({ chords: 'C', parts: [{ preset: 'line', line: 'C5@0.5' }] }) === 5 && E.formatFor({ chords: 'C', parts: [{ preset: 'line', line: 'C5', envelope: { curve: 'exp' } }] }) === 5 && E.formatFor({ chords: 'C', parts: [{ preset: 'line', line: 'C5' }] }) === 4);
}
// ---- Breathing and ducking ----
{
  const kick = { id: 'kick', preset: 'pattern', pattern: 'C1', step: '1/4', from: 24, transpose: [0], envelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.05 } };
  const P = base({ chords: 'Am:4 F:4', timing: { chordSec: 4, glide: 1.6, easing: 'smooth', tempo: 60 }, breathe: { depth: 0.5, time: 0.6 }, duck: { under: 'kick', depth: 0.6, time: 0.3 }, parts: [kick] });
  const its = E.parseProgression(P.chords).items, sb = E.buildScore(E.buildPiece(its, P), its), g = t => E.gainAt(sb, 1, t);
  check('Ducking: the main part dips to 40% as each kick strikes and is back by 0.3 s later', Math.abs(g(1.02) - 0.4) < 1e-6 && Math.abs(g(1.31) - 1) < 1e-9 && Math.abs(g(1.165) - 0.7) < 0.02, [1.02, 1.165, 1.31].map(t => g(t).toFixed(3)).join(' '));
  const Pb = base({ chords: 'Am:4 F:4', timing: { chordSec: 4, glide: 1.6, easing: 'smooth', tempo: 60 }, breathe: { depth: 0.5, time: 0.6 } }), sbb = E.buildScore(E.buildPiece(its, Pb), its), gb = t => E.gainAt(sbb, 1, t);
  check('Breathing: the main part eases down to half at the chord change (4 s) over 0.21 s and swells back by 4.39 s', gb(3.7) === 1 && Math.abs(gb(4) - 0.5) < 1e-9 && Math.abs(gb(3.895) - 0.75) < 1e-6 && gb(4.4) === 1 && gb(2) === 1, [3.7, 3.895, 4, 4.2, 4.4].map(t => gb(t).toFixed(3)).join(' '));
  const moves = E.gainMoves(sb, 1, 0);
  check('… the main part, sounding throughout, now has a gain to follow, and still fades with the piece (held)', Array.isArray(moves) && moves.length > 10 && sb.main.held === true && !sb.main.gates);
  check('A piece that breathes or ducks is saved as format 5; one at depth 0 isn\'t', P.formatVersion === 5 && base({ chords: 'C' }).formatVersion === 3);
}
// ---- Arc glides ----
{
  // a top half circle: C4, slide up to E4 over the whole note, slide back to C4 (60 BPM, quarter-note steps: 1 s each)
  const P = base({ chords: 'C:4', timing: { chordSec: 4, glide: 1.6, easing: 'smooth', tempo: 60 },
    parts: [{ id: 'arc', preset: 'line', line: 'C4 ~E4 ~C4', step: '1/4', transpose: [0], portamento: 4, glideShape: 'arc' }] });
  const its = E.parseProgression(P.chords).items, sb = E.buildScore(E.buildPiece(its, P), its), v = sb.parts[1].first, at = t => E.pitchAt(sb, v, t);
  const circ = x => Math.sqrt(1 - x * x); // the circle through (−1, 0), (0, 1), (1, 0), as pitch over time from 1 s to 3 s
  const worst = Math.max(...[1.1, 1.3, 1.5, 1.7, 1.9, 2.1, 2.3, 2.5, 2.7, 2.9].map(t => Math.abs((at(t) - 60) / 4 - circ(t - 2))));
  check('Arc glides: slides that fill their notes, leaving steeply and then arriving steeply, trace a half circle (within 0.1% of its height)', worst < 1e-3, worst.toFixed(5));
  const mv = E.pitchMoves(sb, v, 0);
  check('… and are scheduled as curves (sampled), not ramps', mv.filter(m => m.kind === 'curve').length === 2 && !mv.some(m => m.kind === 'ramp'), JSON.stringify(mv.map(m => m.kind)));
  const st = base({ chords: 'C:4', timing: { chordSec: 4, glide: 1.6, easing: 'smooth', tempo: 60 }, parts: [{ id: 's', preset: 'line', line: 'C4 ~E4', step: '1/4', transpose: [0], portamento: 4, glideShape: 'straight' }] });
  const sb2 = E.buildScore(E.buildPiece(its, st), its);
  check('Straight glides are straight lines (scheduled as ramps)', Math.abs(E.pitchAt(sb2, sb2.parts[1].first, 1.25) - 61) < 1e-9 && E.pitchMoves(sb2, sb2.parts[1].first, 0).some(m => m.kind === 'ramp'));
  check('A part with arc or straight glides is saved as format 5', P.formatVersion === 5 && st.formatVersion === 5);
}
// ---- Text by section, key changes in lines, chord degrees in patterns ----
{
  const tm = { chordSec: 4, glide: 1.6, easing: 'smooth', tempo: 60 }, env = { attack: 0.01, decay: 0, sustain: 1, release: 0.1 };
  const mk = (chords, parts) => { const P = base({ chords, timing: tm, parts }), its = E.parseProgression(chords).items; return { P, sb: E.buildScore(E.buildPiece(its, P), its) }; };
  const chords = 'G:4\n[A]\nC:4 C:4\n[B]\nF:4 F:4\n[A]\nC:4';
  const { P, sb } = mk(chords, [{ id: 'mel', preset: 'line', line: 'G4:2 [A] C5:4 [B] E5:2 F5:2', step: '1/4', transpose: [0], repeat: true, envelope: env }]);
  const runs = sb.sections, v = sb.parts[1].first, at = t => E.pitchAt(sb, v, t), on = t => E.gainAt(sb, v, t) > 0;
  const mid = r => (r.t0 + r.t1) / 2, A = runs.filter(r => r.name === 'A'), B = runs.find(r => r.name === 'B');
  check('A line can play different text in each section: [A] text in A, [B] text in B, restarting at each',
    A.length === 2 && Math.abs(at(A[0].t0 + 1) - 72) < 0.5 && Math.abs(at(A[0].t0 + 5) - 72) < 0.5 && Math.abs(at(B.t0 + 0.5) - 76) < 0.5 && Math.abs(at(B.t0 + 2.5) - 77) < 0.5 && Math.abs(at(B.t0 + 4.5) - 76) < 0.5 && Math.abs(at(A[1].t0 + 1) - 72) < 0.5,
    JSON.stringify(runs.map(r => [r.name, r.t0, r.t1])) + ' ' + [A[0].t0 + 1, B.t0 + 0.5, B.t0 + 2.5, A[1].t0 + 1].map(t => at(t).toFixed(1)).join(' '));
  check('… the text before the markers plays where no section is (the opening chord)', runs[0].t0 > 0 && on(0.5) && Math.abs(at(0.5) - 67) < 0.5, at(0.5).toFixed(2));
  check('… and a line with markers is saved as format 5', P.formatVersion === 5);
  const { sb: sb2 } = mk('[A]\nC:4\n[A2 +2]\nC:4', [{ id: 'mel', preset: 'line', line: 'C5:4', step: '1/4', transpose: [0], repeat: true, envelope: env }]);
  const r2 = sb2.sections, at2 = t => E.pitchAt(sb2, sb2.parts[1].first, t);
  check('A key change moves a written melody with the chords ([A2 +2]: C5 plays as D5)', r2[1].key === 2 && Math.abs(at2(mid(r2[0])) - 72) < 0.5 && Math.abs(at2(mid(r2[1])) - 74) < 0.5, [mid(r2[0]), mid(r2[1])].map(t => at2(t).toFixed(2)).join(' '));
  const { sb: sb3 } = mk(chords, [{ id: 'bass', preset: 'pattern', pattern: '[A] R [B] R R\'', step: '1/4', from: 36, transpose: [0], envelope: env }]);
  const at3 = t => E.pitchAt(sb3, sb3.parts[1].first, t), B3 = sb3.sections.find(r => r.name === 'B');
  check('A pattern can play different steps in each section too', Math.abs(at3(B3.t0 - 3.5) - 36) < 0.5 && Math.abs(at3(B3.t0 + 0.5) - 41) < 0.5 && Math.abs(at3(B3.t0 + 1.5) - 53) < 0.5,
    [B3.t0 - 3.5, B3.t0 + 0.5, B3.t0 + 1.5].map(t => at3(t).toFixed(1)).join(' '));
  const st = E.parsePattern('3rd 5th 7th').steps, deg = (c, k) => E.patternNote(E.parseItem(c), st[k], 48);
  check('Patterns pick a chord\'s 3rd, 5th and 7th (C7 from C3: E3 G3 Bb3; Am: C4 E3; a sus4\'s 3rd is its 4th; C6\'s 7th is its 6th)',
    [deg('C7', 0), deg('C7', 1), deg('C7', 2), deg('Am', 0), deg('Am', 1), deg('Csus4', 0), deg('C6', 2)].join(' ') === '52 55 58 48 52 53 57',
    [deg('C7', 0), deg('C7', 1), deg('C7', 2), deg('Am', 0), deg('Am', 1), deg('Csus4', 0), deg('C6', 2)].join(' '));
}
// ---- Parts that never stop; echoes of some voices; slides that don't fall ----
{
  const tm = { chordSec: 4, glide: 0.5, easing: 'smooth', tempo: 60 };
  const mk = (chords, parts, over = {}) => { const P = base(Object.assign({ chords, timing: tm, parts }, over)), its = E.parseProgression(chords).items; return { P, sb: E.buildScore(E.buildPiece(its, P), its) }; };
  const chords = '=G4:2\n[A]\nC:4\n[B]\nF:4\n[A]\nAm:4';
  const { P, sb } = mk(chords, [{ id: 'mel', preset: 'line', line: '[A] C5:1 - E5:2', step: '1/4', transpose: [0, 0], nonstop: true, vibrato: { cents: 20, rate: 6, delay: 0.1 } }]);
  const pt = sb.parts[1], v = pt.first, at = (t, k = 0) => E.pitchAt(sb, v + k, t), runs = sb.sections;
  const A = runs.filter(r => r.name === 'A'), B = runs.find(r => r.name === 'B');
  check('A part that never stops sounds throughout: no gates, no rests in its level', !pt.sub.gates && [0.5, 3, 4.5, 7, 9, 13].every(t => E.gainAt(sb, v, t) === 1));
  check('… a rest holds the note before it (C5 through the rest), then E5', Math.abs(at(A[0].t0 + 0.5) - 72) < 1e-9 && Math.abs(at(A[0].t0 + 1.5) - 72) < 1e-9 && Math.abs(at(A[0].t0 + 3) - 76) < 0.01, [0.5, 1.5, 3].map(d => at(A[0].t0 + d).toFixed(2)).join(' '));
  check('… an opening single note gathers its voices onto it (G4)', at(0.5) === 67 && at(0.5, 1) === 67);
  const fb = [at(B.t1 - 0.2), at(B.t1 - 0.2, 1)];
  check('… outside its sections its voices join the chords, on different tones of F in the part\'s own range (C5 to E5)', fb.every(p => [5, 9, 0].includes(((p % 12) + 12) % 12) && p >= 69 && p <= 79) && fb[0] !== fb[1], fb.join(' '));
  check('… its notes still carry vibrato', !!E.vibratoMoves(sb, v, 0) && E.vibratoMoves(sb, v, 0).moves.some(m => m.g === 20));
  check('… and is saved as format 5', P.formatVersion === 5);
  // a pitch-dropping part: a slide doesn't fall
  const { sb: sk } = mk('C:4', [{ id: 'k', preset: 'pattern', pattern: 'C2 ~C2', step: '1/4', from: 36, transpose: [0], drop: { semis: 24, time: 0.1 } }]);
  const kat = t => E.pitchAt(sk, sk.parts[1].first, t);
  check('A slide in a part with a pitch drop doesn\'t fall (the first C2 falls from C4, the slid one stays)', kat(0.01) > 40 && Math.abs(kat(1.01) - 36) < 1e-9, [kat(0.01), kat(1.01)].map(x => x.toFixed(1)).join(' '));
  // an echo of some voices
  const { P: Pe, sb: se } = mk('C:4', [{ id: 'm', preset: 'line', line: 'C5 E5 G5 C6', step: '1/4', transpose: [0, 0, -12] }, { id: 'e', preset: 'copy', of: 'm', delay: 1, voices: 1 }]);
  check('An echo can take only its source\'s first voices (1 of 3)', se.parts[2].sub.N === 1 && se.N === se.parts[0].sub.N + 3 + 1 && Math.abs(E.pitchAt(se, se.parts[2].first, 2.5) - 76) < 0.01 && Pe.formatVersion === 5, se.N + ' ' + E.pitchAt(se, se.parts[2].first, 2.5));
  check('Every voice equal (mix: voices) is kept and saved as format 5; anything else isn\'t kept', base({ mix: 'voices' }).mix === 'voices' && base({ mix: 'voices' }).formatVersion === 5 && base({ mix: 'loud' }).mix === undefined);
}
// ---- Just intonation, and the drift of a comma pump ----
{
  const tm = { chordSec: 2, glide: 0.2, easing: 'smooth', tempo: 60 };
  const mk = (chords, over = {}) => { const P = base(Object.assign({ chords, timing: tm, voices: 5, tuning: 'just' }, over)), its = E.parseProgression(chords).items; return { P, its, b: E.buildPiece(its, P) }; };
  const cents = x => Math.round((x - Math.round(x)) * 10000) / 100; // a pitch's cents from equal temperament
  const { P, b } = mk('C Am Dm G C');
  const bass = b.events.map(e => e.targets[0]), first = b.events[0], last = b.events[4];
  check('Just: a C major chord\'s third is 13.7 cents flat and its fifth 2 cents sharp of equal temperament',
    first.targets.every(p => { const pc = ((Math.round(p) % 12) + 12) % 12; return Math.abs(cents(p) - ({ 0: 0, 4: -13.69, 7: 1.96 })[pc]) < 0.01; }), first.targets.map(p => p.toFixed(3)).join(' '));
  check('… C Am Dm G C comes back a syntonic comma (21.5 cents) lower', Math.abs((last.targets[0] - first.targets[0]) - (-0.2151)) < 0.001, (100 * (last.targets[0] - first.targets[0])).toFixed(2) + ' cents');
  const up = mk('C G Dm Am C').b;
  check('… and C G Dm Am C a comma higher', Math.abs(up.events[4].targets[0] - up.events[0].targets[0] - 0.2151) < 0.001, (100 * (up.events[4].targets[0] - up.events[0].targets[0])).toFixed(2));
  const g7 = mk('G7').b.events[0].targets, f = g7.find(p => ((Math.round(p) % 12) + 12) % 12 === 5);
  check('… a dominant 7th is the harmonic seventh (G7\'s F 31 cents flat)', Math.abs(cents(f) + 31.17) < 0.01, cents(f));
  const ht = mk('C Am Dm G C Ab F G7 C').b, root = k => ht.events[k].targets[0];
  check('… a 7th is never what holds the tuning: C Ab F G7 C keeps the drift the pump left (the last C where the C before Ab was)', Math.abs(root(8) - root(4)) < 0.001, (100 * (root(8) - root(4))).toFixed(2) + ' cents');
  const eq = E.buildPiece(E.parseProgression('C Am Dm G C').items, base({ chords: 'C Am Dm G C', timing: tm, voices: 5 }));
  check('Equal temperament (the default) is unchanged: every note whole', eq.events.every(e => e.targets.every(p => p === Math.round(p))) && base({}).tuning === undefined);
  check('A piece in just intonation is saved as format 5', P.formatVersion === 5 && P.tuning === 'just');
  // patterns and lines follow the tuning of the chord they're in
  const chords = 'C Am Dm G C', P2 = base({ chords, timing: tm, voices: 5, tuning: 'just', parts: [{ id: 'r', preset: 'pattern', pattern: 'R 3rd', step: '1/8', from: 48, transpose: [0] }, { id: 'm', preset: 'line', line: 'E5:2 G5:2', step: '1/4', transpose: [0], repeat: true }] });
  const its = E.parseProgression(chords).items, sb = E.buildScore(E.buildPiece(its, P2), its);
  const pat = t => E.pitchAt(sb, sb.parts[1].first, t), mel = t => E.pitchAt(sb, sb.parts[2].first, t);
  check('… a pattern\'s root falls with the drift (C3 at the end is 21.5 cents under the first) and its 3rd is a pure third above it',
    Math.abs(pat(8.25) - pat(0.25) + 0.2151) < 0.001 && Math.abs(pat(0.75) - pat(0.25) - 3.8631) < 0.001, [pat(0.25), pat(0.75), pat(8.25)].map(x => x.toFixed(4)).join(' '));
  check('… and a written E5 over C is the chord\'s pure third (13.7 cents flat)', Math.abs(cents(mel(0.5)) + 13.69) < 0.01, cents(mel(0.5)));
}
// ---- A note's own glide; parts that play nowhere; more parts ----
{
  const tm = { chordSec: 4, glide: 0.5, easing: 'smooth', tempo: 60 };
  const pl = E.parseLine('C4:2 E4:1/0.5 G4/0l D4+12.345:0.5/0 -/1');
  check('A written note can carry its own glide: /0.5 (smooth, the part\'s shape), /0.5l straight, /0 a jump; with cents to a thousandth; not on a rest',
    pl.notes.length === 4 && pl.notes[1].glide === 0.5 && pl.notes[1].slide && pl.notes[2].shape === 'linear' && pl.notes[3].glide === 0 && Math.abs(pl.notes[3].p - 62.12345) < 1e-9 && pl.errors.join() === '-/1', JSON.stringify(pl.errors));
  const P = base({ chords: 'C:8', timing: tm, plays: [], parts: [{ id: 'm', preset: 'line', line: 'C4:2 E4:2/1 G4:2/0.5l', step: '1/4', transpose: [0], portamento: 0 }] });
  const its = E.parseProgression(P.chords).items, sb = E.buildScore(E.buildPiece(its, P), its), at = t => E.pitchAt(sb, sb.parts[1].first, t);
  check('… it glides in over that time, without a new attack (C4 to E4 over 1 s, smooth; to G4 over 0.5 s, straight)', Math.abs(at(2.5) - 62) < 1e-9 && at(3.01) === 64 && Math.abs(at(4.25) - 65.5) < 1e-9 && sb.parts[1].sub.gates[0].length === 1, [2.5, 3.01, 4.25].map(at).join(' '));
  check('A main part that plays in no section (plays: []) is silent, even in a piece without sections', [0.5, 4, 7].every(t => E.gainAt(sb, 0, t) === 0) && P.plays.length === 0);
  const many = base({ chords: 'C', parts: Array.from({ length: 30 }, (_, k) => ({ id: 'p' + k, preset: 'line', line: 'C4', transpose: [0] })) });
  check('A piece can have up to 32 parts besides the main one', many.parts.length === 30);
  const L = x => base({ chords: 'C', parts: [Object.assign({ id: 'l', preset: 'line', line: 'C4', transpose: [0] }, x)] });
  check('… and these are saved as format 5, which older versions refuse: a glide time in a line, more than 12 parts, a line over 20,000 characters, main saved notes with loudness or glide shapes',
    L({ line: 'C4 D4/0.2' }).formatVersion === 5 && many.formatVersion === 5 && E.formatFor({ chords: 'C', parts: [{ preset: 'line', line: 'C4 '.repeat(7000) }] }) === 5
    && E.formatFor({ chords: 'C', realization: { events: [{ t: 0, targets: [60], ease: 'arcin' }] } }) === 5 && L({}).formatVersion === 4 && E.formatFor({ chords: 'C', timing: { meter: 3, chordBars: 2 } }) === 3);
}
// ---- Echo as a sound setting ----
{
  const P = base({ chords: 'C', echo: { time: '1/4', mix: 0.4 }, parts: [{ id: 'm', preset: 'line', line: 'C5', transpose: [0], echo: { time: '9/8', mix: 7, feedback: -1, pingpong: false } }] });
  check('An echo setting is kept on the main part and on parts, within its limits (an unknown length is a dotted eighth; level 0 to 1, repeats 0 to 0.9)',
    P.echo.time === '1/4' && P.echo.mix === 0.4 && P.echo.pingpong === true && JSON.stringify(P.parts[0].echo) === JSON.stringify({ time: '3/16', mix: 1, feedback: 0, pingpong: false }), JSON.stringify([P.echo, P.parts[0].echo]));
  check('… a piece with an echo on is saved as format 5; one at level 0 (off) isn\'t', P.formatVersion === 5 && base({ chords: 'C', echo: { time: '1/4', mix: 0 } }).formatVersion === 3);
}
// ---- 4.2 review: a pitch drop keeps to MIDI's range; an echo of a part that sounds throughout waits for its delay ----
{
  const tm = { chordSec: 4, glide: 1.6, easing: 'smooth', tempo: 120 };
  const mk = (chords, parts) => { const P = base({ chords, timing: tm, parts }), its = E.parseProgression(chords).items; return { P, sb: E.buildScore(E.buildPiece(its, P), its) }; };
  const env = { attack: 0.002, decay: 0.2, sustain: 0, release: 0.05 };
  check('A note whose pitch drop would start above MIDI 127 is out of range and rests (G9 falling from 36 up); one that slides in doesn\'t fall, so it\'s fine',
    E.parseLine('G9', [0], 36).errors.length === 1 && E.parseLine('G9', [0], 36).notes[0].p === null && E.parseLine('C4 ~G9', [0], 36).errors.length === 0 && E.parseLine('G9', [0], 0).errors.length === 0);
  const hi = mk('C:8', [{ id: 'k', preset: 'line', line: 'G9 C4', step: '1/4', transpose: [0], drop: { semis: 36, time: 0.1 }, envelope: env }]).sb.parts[1].sub;
  const lo = mk('C:8', [{ id: 'k', preset: 'line', line: 'C0 C4', step: '1/4', transpose: [0], drop: { semis: -36, time: 0.1 }, envelope: env }]).sb.parts[1].sub;
  const ok = mk('C:8', [{ id: 'k', preset: 'line', line: 'C1', step: '1/4', transpose: [0], drop: { semis: 36, time: 0.1 }, envelope: env }]).sb.parts[1].sub;
  check('… so a built line never leaves 0–127 (G9 up 36, C0 down 36), and C1 up 36 still falls from C4', hi.max <= 127 && lo.min >= 0 && ok.min === 24 && ok.max === 60, [hi.min, hi.max, lo.min, lo.max, ok.min, ok.max].join(' '));
  const pat = mk('C:8', [{ id: 'k', preset: 'pattern', pattern: 'G9 C4', step: '1/4', from: 36, transpose: [0], drop: { semis: 36, time: 0.1 }, envelope: env }]).sb.parts[1].sub;
  check('… and a pattern\'s note the same way', pat.max <= 127 && pat.min === 60, pat.min + ' ' + pat.max);
  const pad = { id: 'pad', preset: 'pad', voices: 3 };
  const { sb } = mk('C:8', [pad, { id: 'e', preset: 'copy', of: 'pad', delay: 4 }]), cp = sb.parts[2], src = sb.parts[1];
  const g = t => E.gainAt(sb, cp.first, t);
  check('An echo of a pad (4 beats at 120 BPM) is silent until 2 s, then sounds; the pad sounds from the start', g(0.5) === 0 && g(1) === 0 && g(1.99) === 0 && g(2.5) > 0 && E.gainAt(sb, src.first, 0.5) > 0, [0.5, 1, 1.99, 2.5].map(t => g(t).toFixed(2)).join(' '));
  check('… and plays on to the end of the music with it, so the piece doesn\'t get longer (8 s)', sb.musicEnd === 8 && cp.sub.held === true && cp.sub.gates.every(gs => gs.length === 1 && gs[0].on === 2 && gs[0].off > 8), sb.musicEnd + ' ' + JSON.stringify(cp.sub.gates[0]));
  const ns = mk('C:8', [{ id: 'm', preset: 'line', line: 'C5:4 E5:4', step: '1/4', transpose: [0], nonstop: true, envelope: env }, { id: 'e', preset: 'copy', of: 'm', delay: 2 }]).sb;
  const gn = t => E.gainAt(ns, ns.parts[2].first, t);
  check('… an echo of a part that never stops, too (2 beats: silent until 1 s), with its strikes moved later', gn(0.5) === 0 && gn(1.5) > 0 && ns.musicEnd === 8 && Math.abs(ns.parts[2].sub.strikes[0][0].on - 1) < 1e-9, [0.5, 1.5].map(t => gn(t).toFixed(2)).join(' '));
  const sec = mk('[A]\nC:4\n[B]\nF:4', [Object.assign({}, pad, { plays: ['A', 'B'] }), { id: 'e', preset: 'copy', of: 'pad', delay: 2, plays: ['B'] }]).sb;
  const gs = t => E.gainAt(sec, sec.parts[2].first, t);
  check('… and in sections: an echo of a pad that plays in B enters with B', gs(1.5) === 0 && gs(3.5) === 0 && gs(4.5) > 0 && sec.musicEnd === 8, [1.5, 3.5, 4.5].map(t => gs(t).toFixed(2)).join(' '));
}
// ---- 4.2 review, again: an echo copies what its source plays, voice by voice and section by section ----
{
  const tm = { chordSec: 4, glide: 1.6, easing: 'smooth', tempo: 120 };
  const mk = (chords, parts) => { const P = base({ chords, timing: tm, parts }), its = E.parseProgression(chords).items; return E.buildScore(E.buildPiece(its, P), its); };
  // saved notes with one voice that never rests (C4) and one that rests and comes in at 1 s; the part's own envelope is a pluck
  const mixed = { id: 'w', name: 'Written', preset: 'notes', envelope: { attack: 0.005, decay: 0.3, sustain: 0, release: 0.1 }, realization: { engine: 'custom', easing: 'linear', N: 2, total: 8, events: [
    { t: 0, g: 0, label: 'a', kind: 'note', targets: [60, null] }, { t: 1, g: 0, label: 'b', kind: 'note', targets: [60, 67] }] } };
  const sb = mk('C:8', [mixed, { id: 'e', preset: 'copy', of: 'w', delay: 4 }]), src = sb.parts[1], cp = sb.parts[2];
  const g = (v, t) => E.gainAt(sb, cp.first + v, t);
  check('An echo of saved notes whose voices differ: the voice that never rests waits for the delay too (silent until 2 s), then holds', src.sub.gates[0] === null && E.gainAt(sb, src.first, 0.5) === 1
    && g(0, 1) === 0 && g(0, 1.99) === 0 && g(0, 3) > 0.99 && g(0, 7.5) > 0.99, [1, 1.99, 3, 7.5].map(t => g(0, t).toFixed(2)).join(' '));
  check('… and the voice with notes comes in at 3 s, a second after the held one, by the part\'s own envelope', g(1, 2.5) === 0 && g(1, 3.003) > 0 && g(1, 4) < 0.05 && (cp.sub.heldV || [])[0] === true && !(cp.sub.heldV || [])[1], [2.5, 3.003, 4].map(t => g(1, t).toFixed(2)).join(' '));
  check('… its held voice plays through the closing fade and doesn\'t make the piece ring on', !!cp.sub.gates[0] && cp.sub.gates[0][0].off > sb.musicEnd && sb.total === sb.musicEnd, sb.total + ' / ' + sb.musicEnd);
  const one = mk('C:8', [mixed, { id: 'e', preset: 'copy', of: 'w', delay: 4, voices: 1 }]);
  check('… an echo of only its held voice sounds to the end of the music and fades with it, without lengthening the piece (8 s)', one.musicEnd === 8 && one.parts[2].sub.held === true && E.gainAt(one, one.parts[2].first, 1.5) === 0 && E.gainAt(one, one.parts[2].first, 7) > 0.99, one.musicEnd);
  check('… and with its voice that has notes too, the echo ends its delay later, the held voice with it', sb.musicEnd === 10 && cp.sub.gates[0][0].off === 13, sb.musicEnd + ' ' + JSON.stringify(cp.sub.gates[0]));
  const pad = { id: 'pad', preset: 'pad', voices: 3 }, chords = '[A]\nC:4\n[B]\nF:4';
  const inB = mk(chords, [Object.assign({}, pad, { plays: ['B'] }), { id: 'e', preset: 'copy', of: 'pad', delay: 2 }]);
  const gb = t => E.gainAt(inB, inB.parts[2].first, t);
  check('An echo of a pad that plays only in B (4–8 s) is silent until a second after B starts, as its source is until B', E.gainAt(inB, inB.parts[1].first, 2) === 0 && gb(1.5) === 0 && gb(4.5) === 0 && gb(5.6) > 0 && inB.musicEnd === 8,
    [1.5, 4.5, 5.6].map(t => gb(t).toFixed(2)).join(' '));
  const none = mk(chords, [Object.assign({}, pad, { plays: [] }), { id: 'e', preset: 'copy', of: 'pad', delay: 2 }]);
  check('… and an echo of a pad that plays in no section is silent too', [0.5, 2, 5, 7.9].every(t => E.gainAt(none, none.parts[2].first, t) === 0 && E.gainAt(none, none.parts[1].first, t) === 0));
}
// ---- 4.2 review, last: an echo of some voices checks only those voices' range ----
{
  const tm = { chordSec: 4, glide: 1.6, easing: 'smooth', tempo: 120 };
  const mk = (chords, parts) => { const P = base({ chords, timing: tm, parts }), its = E.parseProgression(chords).items; return E.buildScore(E.buildPiece(its, P), its); };
  const two = { id: 'm', preset: 'line', line: 'C4:8', step: '1/4', transpose: [0, 48] }; // C4 and C8
  const sb = mk('C:4', [two, { id: 'e', preset: 'copy', of: 'm', delay: 1, shift: 24, voices: 1 }]), cp = sb.parts.find(x => x.id === 'e');
  check('An echo of only the first voice, two octaves up, plays C6, though the voice it leaves out (C8) would go past 127', !!cp && cp.sub.N === 1 && cp.sub.max === 84 && E.pitchAt(sb, cp.first, 1) === 84, cp ? cp.sub.N + ' ' + cp.sub.max : 'left out');
  const all = mk('C:4', [two, { id: 'e', preset: 'copy', of: 'm', delay: 1, shift: 24 }]);
  check('… and an echo of both voices is still left out, as C8 up two octaves is out of range', !all.parts.find(x => x.id === 'e'));
}
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
