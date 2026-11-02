/* Measure how loud each tone is, to set or check TONE_GAIN in source/engine.js.

   Renders the piece Chord Glide opens with in a fresh browser once per tone, exactly as the app plays it (OfflineAudioContext, 48 kHz, no volume
   control or export normalization), and measures each render's integrated loudness (EBU R128 / ITU-R BS.1770:
   K-weighting, 400 ms blocks with 75% overlap, absolute gate at -70 LUFS, relative gate 10 LU below).
   Prints each tone's loudness, its difference from Soft, and the gain that would bring it level with Soft.

   The original five tones (Pure, Soft, Warm, Glass, Reed) are never given a gain, so existing pieces keep their sound;
   every other tone's gain is matched to Soft on this reference piece. Brightness, register and voicing change each
   tone's level differently, so this keeps tone changes consistent rather than exact.

   Usage: node source/build.js, then node tools/measure-tone-levels.js
   Needs Playwright with Chromium (npm install playwright, then npx playwright install chromium).
   Not needed to use or build Chord Glide, and not included in releases. */
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.error('This tool needs Playwright: npm install playwright, then npx playwright install chromium'); process.exit(1); }

(async () => {
  const page = 'file://' + path.join(__dirname, '..', 'Chord Glide.html');
  const browser = await chromium.launch(), p = await browser.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(page); await p.waitForTimeout(800);
  const rows = await p.evaluate(async () => {
    // BS.1770 K-weighting at 48 kHz: a high shelf (the head) then a high-pass (the RLB curve)
    const STAGES = [
      { b: [1.53512485958697, -2.69169618940638, 1.19839281085285], a: [-1.69065929318241, 0.73248077421585] },
      { b: [1.0, -2.0, 1.0], a: [-1.99004745483398, 0.99007225036621] }
    ];
    const kWeight = x => { let y = x; for (const { b, a } of STAGES) { const out = new Float32Array(y.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < y.length; i++) { const v = b[0] * y[i] + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2; x2 = x1; x1 = y[i]; y2 = y1; y1 = v; out[i] = v; } y = out; } return y; };
    const loudness = chans => {
      const w = chans.map(kWeight), sr = 48000, block = 0.4 * sr, hop = 0.1 * sr, z = [];
      for (let s = 0; s + block <= w[0].length; s += hop) { let sum = 0; for (const c of w) { let ms = 0; for (let i = s; i < s + block; i++) ms += c[i] * c[i]; sum += ms / block; } z.push(sum); }
      const L = ms => -0.691 + 10 * Math.log10(ms), mean = a => a.reduce((x, y) => x + y, 0) / a.length;
      const abs = z.filter(ms => L(ms) > -70), rel = L(mean(abs)) - 10;
      return L(mean(abs.filter(ms => L(ms) > rel)));
    };
    const tones = [...$('tone').options].map(o => o.value), out = [];
    // the piece a fresh browser opens with (no saved draft): the same reference the current gains were measured on
    for (const tone of tones) {
      piece.sound.tone = tone; rebuild();
      const len = Math.ceil((built.total + TAIL) * 48000), ctx = new OfflineAudioContext(2, len, 48000);
      buildGraph(ctx, built, 0, [ctx.destination], 1, true);
      const buf = await ctx.startRendering();
      out.push({ tone, lufs: loudness([buf.getChannelData(0), buf.getChannelData(1)]), gain: TONE_GAIN[tone] });
    }
    return out;
  });
  const soft = rows.find(r => r.tone === 'soft').lufs;
  console.log('Reference: the piece a fresh browser opens with, rendered raw. Soft is ' + soft.toFixed(1) + ' LUFS.\n');
  console.log('tone        LUFS   vs Soft   gain now   gain to match Soft');
  for (const r of rows) {
    const d = r.lufs - soft, now = r.gain || 1, match = r.gain === undefined ? '(original tone, no gain)' : (now * Math.pow(10, -d / 20)).toFixed(2);
    console.log(r.tone.padEnd(10), r.lufs.toFixed(1).padStart(6), (d >= 0 ? '+' : '') + d.toFixed(1).padStart(5) + ' dB', String(r.gain === undefined ? '-' : now).padStart(9), '  ' + match);
  }
  if (errors.length) console.log('\nPage errors:', errors);
  await browser.close();
})();
