const fs = require('fs'), path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8') + fs.readFileSync(path.join(__dirname, 'writers.js'), 'utf8');
const W = new Function(SRC + '; return {parseProgression, buildPiece, defaultPiece, normalizePiece, pitchAt, zipStore, encodeWav24, midiWithGlides, midiChords, musicXml, mp4Mux, webmMux, id3v2, midiGlideFiles, pieceJson, mp3WithInfo, builtFromRealization};')();
const p = W.normalizePiece(Object.assign(W.defaultPiece(), { name: 'Test piece', motion: { order: 'low-high', stagger: 50 } }));
const b = W.buildPiece(W.parseProgression('=Bb6:1, Ebmaj9, Cm11:3.2, Abmaj9#11, Bb13sus4, Gm7, Ebmaj9:2, =Bb6').items, p);
const out = process.argv[2] || fs.mkdtempSync(require('path').join(require('os').tmpdir(), 'chord-glide-test-'));
fs.mkdirSync(out, { recursive: true });
console.log('writing sample files to ' + out);
fs.writeFileSync(out + '/glides.mid', W.midiWithGlides(b, { tempo: 72, title: 'Test piece' }));
fs.writeFileSync(out + '/chords.mid', W.midiChords(b, { tempo: 72, title: 'Test piece' }));
fs.writeFileSync(out + '/score.musicxml', W.musicXml(b, { tempo: 72, title: 'Test & piece' }));
const n = 4800, L = new Float32Array(n), R = new Float32Array(n); for (let i = 0; i < n; i++) { L[i] = Math.sin(i / 10) * 0.5; R[i] = -L[i]; }
const wav = W.encodeWav24(L, R, 48000); fs.writeFileSync(out + '/t.wav', wav);
fs.writeFileSync(out + '/bundle.zip', W.zipStore([{ name: 'Test piece.wav', data: wav }, { name: 'Test piece.musicxml', data: W.musicXml(b, { tempo: 72, title: 'x' }) }, { name: 'Ünïcode name.mid', data: W.midiChords(b, {}) }]));
console.log('events', b.events.length, 'total', b.total.toFixed(1));

// Video containers, checked structurally with stand-in encoded data (real encoding needs a browser).
// They are written to the folder too; any video player or `ffprobe` can inspect them, though the frames are not real video.
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name); };
const sps = Uint8Array.from([0x67, 100, 0, 42, 0xAC, 0xD9, 0x40, 0x78]), pps = Uint8Array.from([0x68, 0xEB, 0xE3, 0xCB]);
const sc = Uint8Array.from([0, 0, 0, 1]), cat = a => Uint8Array.from(Buffer.concat(a.map(x => Buffer.from(x))));
const frames = 120, fps = 60;
const vSamples = Array.from({ length: frames }, (_, i) => {
  const slice = Uint8Array.from([i % 60 === 0 ? 0x65 : 0x41, ...Array.from({ length: 50 + (i % 7) }, (_, k) => (i * 31 + k) & 255)]);
  return { data: i % 60 === 0 ? cat([sc, sps, sc, pps, sc, slice]) : cat([sc, slice]), key: i % 60 === 0 };
});
const aSamples = Array.from({ length: 94 }, (_, i) => ({ data: Uint8Array.from({ length: 30 + (i % 5) }, (_, k) => (i + k) & 255), duration: 1024 / 48000 }));
const mp4 = Buffer.concat(W.mp4Mux({ video: { width: 1920, height: 1080, fps, samples: vSamples }, audio: { codec: 'aac', sampleRate: 48000, channels: 2, bitrate: 320000, samples: aSamples } }).map(x => Buffer.from(x)));
fs.writeFileSync(out + '/structure-test.mp4', mp4);
const boxes = []; for (let i = 0; i < mp4.length;) { const n = mp4.readUInt32BE(i); boxes.push([mp4.toString('latin1', i + 4, i + 8), i, n]); i += n || mp4.length; }
check('MP4: ftyp, moov, mdat in that order, sizes add up to the file', boxes.map(b => b[0]).join() === 'ftyp,moov,mdat' && boxes.reduce((a, b) => a + b[2], 0) === mp4.length);
const find = (type, from = 0) => mp4.indexOf(Buffer.from(type, 'latin1'), from) - 4;
const table = (type, nth = 0) => { let at = -1; for (let k = 0; k <= nth; k++) at = find(type, at + 5); const count = mp4.readUInt32BE(at + (type === 'stsz' ? 16 : 12)); return { at, count }; }; // stsz has a sample-size field before its count
const vSt = table('stco', 0), aSt = table('stco', 1), vSz = table('stsz', 0);
const vOffsets = Array.from({ length: vSt.count }, (_, k) => mp4.readUInt32BE(vSt.at + 16 + 4 * k));
const vSizes = Array.from({ length: vSz.count }, (_, k) => mp4.readUInt32BE(vSz.at + 20 + 4 * k));
check('MP4: one entry per video frame and per audio packet', vSt.count === frames && vSz.count === frames && aSt.count === aSamples.length);
const firstFrame = mp4.subarray(vOffsets[0], vOffsets[0] + vSizes[0]);
check('MP4: frame offsets point at length-prefixed slices, with parameter sets moved to avcC', firstFrame.readUInt32BE(0) === vSizes[0] - 4 && firstFrame[4] === 0x65 && find('avcC') > 0);
// every fixed-size header box must be exactly the size the format defines (a short box broke QuickTime in an early 4.0 build)
{
  const want = { mvhd: 108, tkhd: 92, mdhd: 32, vmhd: 20, smhd: 16 }, bad = [];
  const walk = (from, to) => { for (let i = from; i + 8 <= to;) { const n = mp4.readUInt32BE(i), t = mp4.toString('latin1', i + 4, i + 8);
    if (want[t] && n !== want[t]) bad.push(t + ' ' + n); if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(t)) walk(i + 8, i + n); i += n; } };
  walk(boxes[1][1] + 8, boxes[1][1] + boxes[1][2]);
  check('MP4: header boxes have their exact sizes (mvhd 108, tkhd 92, mdhd 32, vmhd 20, smhd 16)' + (bad.length ? ' — wrong: ' + bad.join(', ') : ''), !bad.length);
  const tk = find('tkhd'); const m = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(k => mp4.readInt32BE(tk + 48 + 4 * k));
  check('MP4: the video track has the identity display matrix (no rotation)', m.join() === [0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000].join());
  const md = find('mdhd'); check('MP4: language is "und"', mp4.readUInt16BE(md + 28) === 0x55C4);
}
const stss = table('stss'); check('MP4: keyframe table lists frames 1 and 61', stss.count === 2 && mp4.readUInt32BE(stss.at + 16) === 1 && mp4.readUInt32BE(stss.at + 20) === 61);
check('MP4: every sample lies inside mdat', vOffsets.every((o, k) => o >= boxes[2][1] + 8 && o + vSizes[k] <= mp4.length));
// AAC priming: an edit list skips the encoder's start-up samples and ends at the real sound, so sound and picture line up
{
  const m = Buffer.concat(W.mp4Mux({ video: { width: 1920, height: 1080, fps, samples: vSamples }, audio: { codec: 'aac', sampleRate: 48000, channels: 2, bitrate: 320000, samples: aSamples, delay: 2112, length: 94 * 1024 - 3000 } }).map(x => Buffer.from(x)));
  const el = m.indexOf(Buffer.from('elst', 'latin1')) - 4, tk = m.lastIndexOf(Buffer.from('tkhd', 'latin1')) - 4, wantMs = Math.round((94 * 1024 - 3000) / 48) ;
  check('MP4: AAC priming goes in an edit list (skip 2112 samples, play the real length)', el > 0 && m.readUInt32BE(el + 12) === 1 && m.readUInt32BE(el + 16) === wantMs && m.readUInt32BE(el + 20) === 2112 && m.readUInt32BE(el + 24) === 0x10000 && m.readUInt32BE(tk + 28) === wantMs);
  check('MP4: no edit list without priming', mp4.indexOf(Buffer.from('elst', 'latin1')) < 0);
}
// Title and artist in every format (and nothing at all when they're empty)
{
  const meta = { title: 'Lantern — Hours', artist: 'Noizgenie' }, has = (buf, str) => Buffer.from(buf).indexOf(Buffer.from(str, 'utf8')) >= 0;
  const L = new Float32Array(100), wav = Buffer.from(W.encodeWav24(L, L, 48000, meta));
  const li = wav.indexOf(Buffer.from('LIST')), dataAt = wav.indexOf(Buffer.from('data'));
  check('WAV: LIST/INFO with INAM and IART between fmt and data, RIFF size right', li === 36 && li < dataAt && has(wav, 'INAM') && has(wav, 'IART') && has(wav, 'Noizgenie') && wav.readUInt32LE(4) === wav.length - 8 && wav.readUInt32LE(dataAt + 4) === 600);
  check('WAV: no LIST chunk without a title or artist', Buffer.from(W.encodeWav24(L, L, 48000, {})).length === 44 + 600 && Buffer.from(W.encodeWav24(L, L, 48000)).indexOf(Buffer.from('LIST')) < 0);
  const id3 = Buffer.from(W.id3v2(meta)), sz = (id3[6] << 21) | (id3[7] << 14) | (id3[8] << 7) | id3[9];
  check('MP3: ID3v2.3 tag with TIT2 and TPE1 in UTF-16, sync-safe size', id3.toString('latin1', 0, 3) === 'ID3' && id3[3] === 3 && sz === id3.length - 10 && has(id3, 'TIT2') && has(id3, 'TPE1') && id3.indexOf(Buffer.from('Noizgenie', 'utf16le')) > 0 && W.id3v2({}).length === 0);
  const m4 = Buffer.concat(W.mp4Mux({ video: { width: 640, height: 360, fps, samples: vSamples }, audio: { codec: 'aac', sampleRate: 48000, channels: 2, samples: aSamples }, meta }).map(x => Buffer.from(x)));
  check('MP4: iTunes-style ilst with ©nam and ©ART inside moov/udta/meta', has(m4, 'ilst') && m4.indexOf(Buffer.from([0xA9, 0x41, 0x52, 0x54])) > 0 && has(m4, 'mdir') && has(m4, 'Lantern — Hours') && m4.indexOf(Buffer.from('udta')) < m4.indexOf(Buffer.from('mdat')));
  const blocks = [{ data: new Uint8Array(4096), frames: 1024 }];
  const mv = Buffer.concat(W.mp4Mux({ quicktime: true, video: { width: 640, height: 360, fps, samples: vSamples }, audio: { codec: 'pcm', sampleRate: 48000, channels: 2, samples: blocks }, meta }).map(x => Buffer.from(x)));
  check('MOV: QuickTime text atoms ©nam and ©ART in moov/udta', !has(mv, 'ilst') && mv.indexOf(Buffer.from([0xA9, 0x6E, 0x61, 0x6D])) > 0 && has(mv, 'Noizgenie'));
  const wm = Buffer.concat(W.webmMux({ video: { codec: 'vp9', width: 640, height: 360, fps, samples: vSamples.map(s => ({ data: s.data.subarray(4), key: s.key })) }, meta }).map(x => Buffer.from(x)));
  check('WebM: Tags with TITLE and ARTIST, listed in the seek head, and a title in Info', wm.indexOf(Buffer.from([0x12, 0x54, 0xC3, 0x67])) > 0 && has(wm, 'ARTIST') && has(wm, 'TITLE') && wm.indexOf(Buffer.from([0x7B, 0xA9])) > 0
    && wm.indexOf(Buffer.from([0x53, 0xAB, 0x84, 0x12, 0x54, 0xC3, 0x67])) > 0);
  const plain = Buffer.concat(W.webmMux({ video: { codec: 'vp9', width: 640, height: 360, fps, samples: vSamples.map(s => ({ data: s.data.subarray(4), key: s.key })) } }).map(x => Buffer.from(x)));
  const mid = Buffer.from(W.midiChords(b, { tempo: 72, title: 'T', artist: 'Noizgenie' })), mid0 = Buffer.from(W.midiChords(b, { tempo: 72, title: 'T' }));
  check('MIDI: the artist as a copyright notice (FF 02), none without one', mid.indexOf(Buffer.from([0xFF, 0x02, 9, ...Buffer.from('Noizgenie')])) > 0 && mid0.indexOf(Buffer.from([0xFF, 0x02])) < 0 && Buffer.from(W.midiWithGlides(b, { artist: 'Noizgenie' })).indexOf(Buffer.from([0xFF, 0x02])) > 0);
  const xml = Buffer.from(W.musicXml(b, { title: 'T', artist: 'Noi<z>genie' })).toString('utf8');
  check('MusicXML: the artist as the composer (escaped), none without one', xml.includes('<creator type="composer">Noi&lt;z&gt;genie</creator>') && !Buffer.from(W.musicXml(b, { title: 'T' })).toString('utf8').includes('<creator'));
  check('Video: no tags without a title or artist', plain.indexOf(Buffer.from([0x12, 0x54, 0xC3, 0x67])) < 0 && Buffer.concat(W.mp4Mux({ video: { width: 640, height: 360, fps, samples: vSamples } }).map(x => Buffer.from(x))).indexOf(Buffer.from('udta')) < 0);
}
// MIDI glides for more than 15 voices: split into files of up to 15, nothing dropped
{
  const N = 30, r = { engine: 'custom', easing: 'linear', N, total: 4, events: [{ t: 0, g: 0, label: 'a', kind: 'chord', targets: Array.from({ length: N }, (_, v) => 40 + v) }, { t: 1, g: 2, label: 'b', kind: 'chord', targets: Array.from({ length: N }, (_, v) => 70 - v) }] };
  const bb = W.builtFromRealization(r, W.defaultPiece()), parts = W.midiGlideFiles(bb, { title: 'T' });
  const tracksIn = d => Buffer.from(d).readUInt16BE(10), noteOns = d => { let n = 0; const u = Buffer.from(d); for (let i = 0; i + 2 < u.length; i++) if ((u[i] & 0xF0) === 0x90 && u[i + 2] > 0 && u[i - 1] !== 0xFF) n++; return n; };
  check('MIDI: a 30-voice piece gives two glide files, voices 1–15 and 16–30, each with all its voices', parts.length === 2 && parts[0].voices.join() === '1,15' && parts[1].voices.join() === '16,30' && parts.every(p => tracksIn(p.data) === 16) && Buffer.from(parts[1].data).includes(Buffer.from('T (voices 16–30)')));
  const small = W.midiGlideFiles(b, { title: 'T' });
  check('MIDI: a piece of 15 voices or fewer still gives one file', small.length === 1 && small[0].voices[0] === 1);
}
// Readable piece files and the MP3 Info frame
{
  const p = { name: 'x', seeds: { a: 1 }, list: [1, 2.5, 3], nested: [{ t: 0, targets: [60, 61] }], empty: [], none: {} }, s = W.pieceJson(p);
  check('Piece files: indented, each list of numbers on one line, and read back identically', s.includes('\n  "seeds": {\n') && s.includes('"list": [1, 2.5, 3]') && s.includes('"targets": [60, 61]') && JSON.stringify(JSON.parse(s)) === JSON.stringify(p));
  const frame = () => { const f = new Uint8Array(576); f.set([0xFF, 0xFB, 0xB4, 0x04]); return f; }, stream = Buffer.concat(Array.from({ length: 10 }, () => Buffer.from(frame())));
  const m = Buffer.from(W.mp3WithInfo(new Uint8Array(stream))), at = m.indexOf(Buffer.from('Info'));
  check('MP3: an Info frame in front, counting 10 audio frames and every byte, added only once', at === 36 && m.length === 11 * 576 && m.readUInt32BE(at + 8) === 10 && m.readUInt32BE(at + 12) === m.length && W.mp3WithInfo(new Uint8Array(m)).length === m.length);
}
// QuickTime .mov with uncompressed audio (for browsers that can't encode AAC): QuickTime won't play MP3 or Opus inside an MP4
{
  const sr = 48000, total = 2500, pcm = Buffer.alloc(total * 4); for (let k = 0; k < total * 2; k++) pcm.writeInt16LE(((k * 37) % 4001) - 2000, 2 * k);
  const blocks = []; for (let i = 0; i < total; i += 1024) { const n = Math.min(1024, total - i); blocks.push({ data: new Uint8Array(pcm.buffer, pcm.byteOffset + 4 * i, 4 * n), frames: n }); }
  const mov = Buffer.concat(W.mp4Mux({ quicktime: true, video: { width: 1920, height: 1080, fps, samples: vSamples }, audio: { codec: 'pcm', sampleRate: sr, channels: 2, samples: blocks } }).map(x => Buffer.from(x)));
  fs.writeFileSync(out + '/structure-test.mov', mov);
  const at = t => mov.indexOf(Buffer.from(t, 'latin1')) - 4;
  const sowt = at('sowt'), stsz = mov.indexOf(Buffer.from('stsz', 'latin1'), at('soun')) - 4, stco = mov.indexOf(Buffer.from('stco', 'latin1'), at('soun')) - 4;
  const offs = Array.from({ length: mov.readUInt32BE(stco + 12) }, (_, k) => mov.readUInt32BE(stco + 16 + 4 * k));
  const back = Buffer.concat(offs.map((o, k) => mov.subarray(o, o + blocks[k].data.length)));
  check('MOV: QuickTime brand, 16-bit stereo PCM sample entry with a channel layout, and QuickTime handlers',
    mov.toString('latin1', 8, 12) === 'qt  ' && sowt > 0 && mov.readUInt16BE(sowt + 24) === 2 && mov.readUInt16BE(sowt + 26) === 16 && mov.readUInt32BE(sowt + 32) === sr * 65536 && mov.toString('latin1', sowt + 40, sowt + 44) === 'chan' && at('mhlr') > 0 && at('dhlr') > 0);
  check('MOV: one 4-byte sample per audio frame, and the audio reads back exactly from the chunk offsets', mov.readUInt32BE(stsz + 12) === 4 && mov.readUInt32BE(stsz + 16) === total && back.equals(pcm));
  let threw = false; try { W.mp4Mux({ video: { width: 64, height: 64, fps, samples: vSamples }, audio: { codec: 'pcm', sampleRate: sr, channels: 2, samples: blocks } }); } catch (e) { threw = true; }
  check('MP4: uncompressed audio is refused outside a .mov', threw);
}
const webm = Buffer.concat(W.webmMux({ video: { codec: 'vp9', width: 1920, height: 1080, fps, samples: vSamples.map(s => ({ data: s.data.subarray(4), key: s.key })) }, audio: { sampleRate: 48000, channels: 2, samples: aSamples.map(a => ({ data: a.data, duration: 0.02 })) } }).map(x => Buffer.from(x)));
fs.writeFileSync(out + '/structure-test.webm', webm);
const segAt = webm.indexOf(Buffer.from([0x18, 0x53, 0x80, 0x67])), segLen = Number(webm.readBigUInt64BE(segAt + 4) & 0x00FFFFFFFFFFFFFFn);
check('WebM: EBML header, then a Segment whose size reaches exactly the end of the file', webm.readUInt32BE(0) === 0x1A45DFA3 && segAt > 0 && segAt + 12 + segLen === webm.length);
check('WebM: has Info with a duration, Tracks, Cues and a seek head', [[0x15, 0x49, 0xA9, 0x66], [0x44, 0x89], [0x16, 0x54, 0xAE, 0x6B], [0x1C, 0x53, 0xBB, 0x6B], [0x11, 0x4D, 0x9B, 0x74]].every(id => webm.indexOf(Buffer.from(id)) > 0));
const clusters = []; for (let i = webm.indexOf(Buffer.from([0x1F, 0x43, 0xB6, 0x75])); i > 0; i = webm.indexOf(Buffer.from([0x1F, 0x43, 0xB6, 0x75]), i + 4)) clusters.push(i);
check('WebM: a new cluster at each video keyframe (2 here)', clusters.length === 2);
// Reordered frames (B-frames): decode order I P B B, shown as I B B P; the writer must add composition offsets (ctts)
{
  const order = [0, 3, 1, 2, 4, 7, 5, 6];
  const rs = order.map((shown, i) => ({ data: i === 0 ? cat([sc, sps, sc, pps, sc, Uint8Array.from([0x65, 1, 2, 3])]) : cat([sc, Uint8Array.from([0x41, i, 2, 3])]), key: i === 0, pts: shown / 30 }));
  const m = Buffer.concat(W.mp4Mux({ video: { width: 640, height: 360, fps: 30, samples: rs } }).map(x => Buffer.from(x)));
  const at = m.indexOf(Buffer.from('ctts', 'latin1')) - 4;
  const runs = at > 0 ? m.readUInt32BE(at + 12) : 0, offs = [];
  for (let k = 0; k < runs; k++) { const n = m.readUInt32BE(at + 16 + 8 * k), o = m.readInt32BE(at + 20 + 8 * k); for (let j = 0; j < n; j++) offs.push(o); }
  check('MP4: reordered frames get composition offsets that put each frame at its own time', offs.length === 8 && offs.every((o, i) => o === (order[i] - i) * 100));
}
// MIDI glides: decode the file and compare the pitch it plays with the engine's curve
function midiPitchError(built, tempo) {
  const smf = Buffer.from(W.midiWithGlides(built, { tempo })), tracks = [];
  for (let i = 14; i < smf.length;) { const len = smf.readUInt32BE(i + 4); tracks.push(smf.subarray(i + 8, i + 8 + len)); i += 8 + len; }
  let worst = 0;
  tracks.slice(1).forEach((tr, v) => {
    const ev = []; let tick = 0;
    for (let i = 0; i < tr.length;) {
      let d = 0; do { d = (d << 7) | (tr[i] & 127); } while (tr[i++] & 128); tick += d;
      const st = tr[i];
      if (st === 0xFF) { let n = 0, j = i + 2; do { n = (n << 7) | (tr[j] & 127); } while (tr[j++] & 128); i = j + n; continue; }
      const type = st & 0xF0; ev.push({ t: tick / 960 * 60 / tempo, type, a: tr[i + 1], b: tr[i + 2] }); i += 3;
    }
    let note = null, bend = 0, k = 0;
    for (let s2 = 0; s2 <= 4000; s2++) {
      const t = built.total * s2 / 4000;
      while (k < ev.length && ev[k].t <= t + 1e-9) { const e = ev[k++]; if (e.type === 0x90) note = e.a; if (e.type === 0xE0) bend = ((e.b << 7 | e.a) - 8192) / 8191 * 48; }
      if (note !== null) worst = Math.max(worst, Math.abs(note + bend - W.pitchAt(built, v, t)));
    }
  });
  return worst;
}
const normalErr = midiPitchError(b, 72);
check('MIDI glides follow the curve within 10 cents, allowing for the 3-cent send threshold and tick timing (worst ' + (normalErr * 100).toFixed(1) + ' cents)', normalErr <= 0.1);
const wide = W.buildPiece(W.parseProgression('=C0:1, =G9:6, =C1:6').items, W.normalizePiece(Object.assign(W.defaultPiece(), { voices: 3 })));
const wideErr = midiPitchError(wide, 60);
check('MIDI glides beyond the bend range hand over near the current pitch (worst ' + (wideErr * 100).toFixed(1) + ' cents)', wideErr <= 0.1);
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
