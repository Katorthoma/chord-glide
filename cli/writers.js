
/* ===== File writers: ZIP, WAV, MIDI, MusicXML, MP4 and WebM (no DOM) ===== */
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
const utf8 = s => new TextEncoder().encode(s);

/* Stored (uncompressed) ZIP. files: [{name, data: Uint8Array}] */
function zipStore(files) {
  const chunks = [], central = [];
  let offset = 0;
  const now = new Date(), dt = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF,
    dd = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
  for (const f of files) {
    const name = utf8(f.name), data = f.data, crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, dt, true); lh.setUint16(12, dd, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    chunks.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, dt, true); ch.setUint16(14, dd, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
    ch.setUint16(28, name.length, true); ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true);
    ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((a, c) => a + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  const all = [...chunks, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((a, c) => a + c.length, 0));
  let p = 0; for (const c of all) { out.set(c, p); p += c.length; }
  return out;
}

/* 24-bit PCM WAV */
/* Title and artist for exported files: { title, artist }, either may be empty (then nothing is written for it) */
const metaFields = meta => [['title', meta && meta.title], ['artist', meta && meta.artist]].map(([k, v]) => [k, String(v || '').trim().slice(0, 200)]).filter(([, v]) => v);
/* RIFF LIST/INFO chunk: INAM (title), IART (artist), each null-terminated and padded to an even length */
function wavInfo(meta) {
  const ids = { title: 'INAM', artist: 'IART' }, subs = [];
  for (const [k, v] of metaFields(meta)) { const b = [...utf8(v), 0], size = b.length; if (b.length % 2) b.push(0); subs.push(...fourcc(ids[k]), ...be32(size).reverse(), ...b); } // the size excludes the pad byte
  if (!subs.length) return new Uint8Array(0);
  return Uint8Array.from([...fourcc('LIST'), ...be32(subs.length + 4).reverse(), ...fourcc('INFO'), ...subs]);
}
function encodeWav24(left, right, sampleRate, meta = null) {
  const info = wavInfo(meta);
  const n = left.length, bytes = n * 2 * 3, head = 44 + info.length, buf = new ArrayBuffer(head + bytes), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, head - 8 + bytes, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 6, true);
  v.setUint16(32, 6, true); v.setUint16(34, 24, true);
  new Uint8Array(buf, 36, info.length).set(info); // LIST/INFO sits between fmt and data
  w(36 + info.length, 'data'); v.setUint32(40 + info.length, bytes, true);
  let o = head;
  for (let i = 0; i < n; i++) for (const ch of [left, right]) {
    let s = Math.max(-1, Math.min(1, ch[i])); let x = Math.round(s * 8388607); if (x < 0) x += 16777216;
    v.setUint8(o, x & 255); v.setUint8(o + 1, (x >> 8) & 255); v.setUint8(o + 2, (x >> 16) & 255); o += 3;
  }
  return new Uint8Array(buf);
}

/* ID3v2.3 tag for the front of an MP3: TIT2 (title), TPE1 (artist), in UTF-16 with a byte-order mark. Empty if there's nothing to say. */
function id3v2(meta) {
  const ids = { title: 'TIT2', artist: 'TPE1' }, frames = [];
  for (const [k, v] of metaFields(meta)) {
    const body = [1, 0xFF, 0xFE]; for (const ch of v) { const c = ch.codePointAt(0); if (c > 0xFFFF) { const u = c - 0x10000; body.push(...[0xD800 + (u >> 10), 0xDC00 + (u & 1023)].flatMap(x => [x & 255, x >> 8])); } else body.push(c & 255, c >> 8); }
    frames.push(...fourcc(ids[k]), ...be32(body.length), 0, 0, ...body);
  }
  if (!frames.length) return new Uint8Array(0);
  const n = frames.length, size = [(n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127]; // sync-safe
  return Uint8Array.from([0x49, 0x44, 0x33, 3, 0, 0, ...size, ...frames]);
}

/* Put an "Info" frame (the constant-bitrate form of the Xing header) at the front of an MP3 stream, so players know its exact
   length and can seek in it. The frame copies the first frame's header and holds the frame count, byte count and a seek table.
   Returns the stream unchanged if it already has one or doesn't start with an MPEG-1 Layer III frame. */
function mp3WithInfo(u8) {
  const rates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], srs = [44100, 48000, 32000];
  const head = i => { if (u8[i] !== 0xFF || (u8[i + 1] & 0xFE) !== 0xFA) return null; const br = rates[u8[i + 2] >> 4], sr = srs[(u8[i + 2] >> 2) & 3];
    return br && sr ? { br, sr, len: Math.floor(144000 * br / sr) + ((u8[i + 2] >> 1) & 1), mono: (u8[i + 3] >> 6) === 3 } : null; };
  const h0 = head(0);
  if (!h0) return u8;
  let frames = 0; for (let i = 0; i + 4 <= u8.length;) { const h = head(i); if (!h) break; frames++; i += h.len; }
  const side = h0.mono ? 17 : 32, size = Math.floor(144000 * h0.br / h0.sr);
  if (/Xing|Info/.test(String.fromCharCode(...u8.subarray(4 + side, 8 + side)))) return u8;
  const f = new Uint8Array(size);
  f.set([0xFF, u8[1], u8[2] & 0xFD, u8[3]]); // same header, no padding
  const o = 4 + side, total = size + u8.length;
  f.set(fourcc('Info'), o); f.set(be32(0x0F), o + 4); f.set(be32(frames), o + 8); f.set(be32(total), o + 12); // flags: frames, bytes, seek table, quality. Frames counts audio frames only (as LAME does); bytes includes this one
  for (let k = 0; k < 100; k++) f[o + 16 + k] = Math.floor(k * 256 / 100); // constant bitrate: an even seek table
  f.set(be32(0), o + 116);
  return catBytes([f, u8]);
}

/* A piece file as readable JSON: indented, but each list of plain values on one line (a list of 30 pitches stays one line) */
function pieceJson(x, ind = '') {
  const pad = ind + '  ';
  if (Array.isArray(x)) return x.every(y => y === null || typeof y !== 'object') ? '[' + x.map(y => JSON.stringify(y)).join(', ') + ']' : (x.length ? '[\n' + x.map(y => pad + pieceJson(y, pad)).join(',\n') + '\n' + ind + ']' : '[]');
  if (x && typeof x === 'object') { const k = Object.keys(x).filter(k => x[k] !== undefined); return k.length ? '{\n' + k.map(key => pad + JSON.stringify(key) + ': ' + pieceJson(x[key], pad)).join(',\n') + '\n' + ind + '}' : '{}'; }
  return JSON.stringify(x === undefined ? null : x);
}

/* ---- MIDI ---- */
const PPQ = 960;
function vlq(n) { const b = [n & 0x7F]; while ((n >>= 7)) b.unshift((n & 0x7F) | 0x80); return b; }
function trackChunk(evts) {
  evts.sort((a, b) => a.tick - b.tick || a.ord - b.ord);
  const bytes = []; let last = 0;
  for (const e of evts) { bytes.push(...vlq(Math.max(0, e.tick - last)), ...e.data); last = Math.max(last, e.tick); }
  bytes.push(0, 0xFF, 0x2F, 0);
  return [0x4D, 0x54, 0x72, 0x6B, (bytes.length >>> 24) & 255, (bytes.length >>> 16) & 255, (bytes.length >>> 8) & 255, bytes.length & 255, ...bytes];
}
function smf(tracks) {
  const head = [0x4D, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, (tracks.length >> 8) & 255, tracks.length & 255, (PPQ >> 8) & 255, PPQ & 255];
  return new Uint8Array([...head, ...tracks.flat()]);
}
const metaText = (type, s) => { const b = Array.from(utf8(s)); return [0xFF, type, ...vlq(b.length), ...b]; };
function conductorTrack(built, tempo, title, extra = [], artist = '') {
  const tick = t => Math.round(t * tempo / 60 * PPQ);
  const us = Math.round(60e6 / tempo);
  const ev = [
    { tick: 0, ord: 0, data: metaText(0x03, title) },
    ...(String(artist || '').trim() ? [{ tick: 0, ord: 0.5, data: metaText(0x02, String(artist).trim().slice(0, 200)) }] : []), // copyright notice: the artist
    { tick: 0, ord: 1, data: [0xFF, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255] },
    { tick: 0, ord: 2, data: [0xFF, 0x58, 4, 4, 2, 24, 8] },
    ...extra
  ];
  built.events.forEach((e, i) => ev.push({ tick: tick(e.t), ord: 10 + i, data: metaText(0x06, (e.kind === 'note' ? '→ ' : '') + e.label) }));
  return trackChunk(ev);
}
const clampMidi = m => Math.max(0, Math.min(127, Math.round(m)));

/* MIDI with glides holds 15 voices (one MPE member channel each). A larger piece goes into several files of up to 15 voices:
   returns [{ voices: [first, last] (1-based), data }], one entry when it all fits. */
/* Every voice as { b: its part's timeline, v: its number there }, across all parts of a score */
const voiceRefs = built => built.voices || Array.from({ length: built.N }, (_, v) => ({ b: built, v }));
function midiGlideFiles(built, opts = {}) {
  if (built.N <= 15) return [{ voices: [1, built.N], data: midiWithGlides(built, opts) }];
  const out = [], refs = voiceRefs(built);
  for (let a = 0; a < built.N; a += 15) {
    const b = Math.min(built.N, a + 15);
    const part = Object.assign({}, built, { N: b - a, voices: refs.slice(a, b) });
    out.push({ voices: [a + 1, b], data: midiWithGlides(part, Object.assign({}, opts, { title: (opts.title || 'Piece') + ' (voices ' + (a + 1) + '–' + b + ')' })) });
  }
  return out;
}
/* Glides kept as per-voice pitch bend: MPE lower zone, one member channel per voice, ±48 semitones */
/* Glides are written as pitch bend, walked one MIDI tick at a time at each tick's exact time (so nothing is rounded to a tick).
   A bend is sent at a tick when, by the end of that tick, the curve would be more than `tolerance` semitones (2 cents) from the
   last value sent; it carries the pitch at the middle of the tick, so inside any tick the error is at most half a tick's movement. */
function midiWithGlides(built, { tempo = 60, title = 'Piece', artist = '', bendRange = 48, tolerance = 0.02 } = {}) {
  const tick = t => Math.round(t * tempo / 60 * PPQ);
  const refs = voiceRefs(built), N = Math.min(refs.length, 15);
  const mpe = [ // MPE configuration on the master channel (1): 15 member channels
    { tick: 0, ord: 3, data: [0xB0, 101, 0] }, { tick: 0, ord: 4, data: [0xB0, 100, 6] }, { tick: 0, ord: 5, data: [0xB0, 6, 15] },
    { tick: 0, ord: 6, data: [0xB0, 101, 127] }, { tick: 0, ord: 7, data: [0xB0, 100, 127] }
  ];
  const tracks = [conductorTrack(built, tempo, title, mpe, artist)];
  const bendVal = s => Math.max(0, Math.min(16383, Math.round(8192 + (s / bendRange) * 8191)));
  for (let v = 0; v < N; v++) {
    const ch = v + 1, ev = []; let ord = 0;
    const sb = refs[v].b, lv = refs[v].v, evs = sb.events, gates = sb.gates && sb.gates[lv]; // this voice's own part
    const add = (t, data) => ev.push({ tick: tick(Math.max(0, Math.min(t, built.total))), ord: ord++, data }); // nothing after the end
    add(0, [0xB0 | ch, 101, 0]); add(0, [0xB0 | ch, 100, 0]); add(0, [0xB0 | ch, 6, bendRange]); add(0, [0xB0 | ch, 38, 0]);
    add(0, [0xB0 | ch, 101, 127]); add(0, [0xB0 | ch, 100, 127]);
    add(0, metaText(0x03, 'Voice ' + (v + 1)));
    let note = clampMidi(evs[0].targets[lv]), lastBend = 8192;
    const bend = (t, semis) => { const b = bendVal(semis); if (b !== lastBend) { add(t, [0xE0 | ch, b & 0x7F, (b >> 7) & 0x7F]); lastBend = b; } };
    // one change of pitch (event i), written up to `stop` (the end of a note, for a voice that rests)
    const change = (i, stop = Infinity) => {
      const e = evs[i], a = evs[i - 1].targets[lv], b = e.targets[lv];
      if (a === b) return;
      // a glide is written only until the next change, the note's end or the part's end, whichever comes first: a file can claim
      // a glide far longer than the piece, and walking it tick by tick would never finish
      const next = i + 1 < evs.length ? evs[i + 1].t : Infinity, limit = Math.min(stop, next, sb.total, built.total);
      const t0 = e.t + (e.off ? e.off[lv] : 0);
      if (t0 >= limit) return;
      const d = Math.min(e.dur ? e.dur[lv] : e.g, Math.max(0, limit - t0));
      const reach = (t, p) => { // past the bend range mid-glide: hand over to a new note near where the pitch is now
        if (Math.abs(p - note) <= bendRange) return;
        add(t, [0x80 | ch, note, 0]);
        // the target if it's within reach from here; otherwise a full bend range ahead, so the next handover is as late as possible
        note = clampMidi(Math.abs(b - p) <= bendRange ? b : p + Math.sign(b - p) * bendRange); lastBend = -1;
        bend(t, Math.max(-bendRange, Math.min(bendRange, p - note)));
        add(t, [0x90 | ch, note, 88]);
      };
      const full = e.dur ? e.dur[lv] : e.g;
      if (full <= 0) { reach(t0, b); bend(t0, b - note); return; }
      const spt = 60 / (tempo * PPQ), at = t => pitchAt(sb, lv, Math.min(Math.max(t, t0), e.t + e.g), i);
      let sent = a;
      for (let k = Math.ceil(t0 / spt - 1e-9), kEnd = Math.round((t0 + d) / spt); k < kEnd; k++) {
        const t = k * spt;
        if (Math.abs(at(t + spt) - sent) > tolerance) { const p = at(t + spt / 2); reach(t, p); bend(t, p - note); sent = p; }
      }
      if (d >= full) bend(t0 + d, b - note);
      else if (limit === next) { reach(next, b); bend(next, b - note); } // cut short by the next change, which starts from the target
    };
    if (!gates) { // always sounding: one note from start to end, bent along every glide
      add(0, [0xE0 | ch, 0, 64]); add(0, [0x90 | ch, note, 88]);
      for (let i = 1; i < evs.length; i++) change(i);
      add(built.total, [0x80 | ch, note, 0]);
    } else for (const gt of gates) { // a voice that rests: a note-off when it stops, and a fresh note-on when it sounds again
      const p0 = pitchAt(sb, lv, gt.on); note = clampMidi(p0); lastBend = -1;
      bend(gt.on, p0 - note); add(gt.on, [0x90 | ch, note, 88]);
      for (let i = 1; i < evs.length; i++) if (evs[i].t >= gt.on - 1e-9 && evs[i].t < gt.off) change(i, gt.off);
      add(gt.off, [0x80 | ch, note, 0]);
    }
    tracks.push(trackChunk(ev));
  }
  return smf(tracks);
}

/* Settled chords only: one channel, notes start at each change */
function midiChords(built, { tempo = 60, title = 'Piece', artist = '' } = {}) {
  if (built.main) built = built.main; // the chords are the main part's
  const tick = t => Math.round(t * tempo / 60 * PPQ);
  const ev = []; let ord = 0;
  built.events.forEach((e, i) => {
    const end = i + 1 < built.events.length ? built.events[i + 1].t : built.total;
    for (const m of [...new Set(e.targets.map(clampMidi))]) {
      ev.push({ tick: tick(e.t), ord: ord++, data: [0x90, m, 80] });
      ev.push({ tick: Math.max(tick(e.t) + 1, tick(end)) - 1, ord: ord++, data: [0x80, m, 0] });
    }
  });
  return smf([conductorTrack(built, tempo, title, [], artist), trackChunk(ev)]);
}

/* ---- MusicXML: the settled chords on a grand staff (glides are not notated) ---- */
const xmlEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function musicXml(built, { tempo = 60, title = 'Piece', artist = '' } = {}) {
  if (built.main) built = built.main; // the harmonic score is the main part's
  const evs = built.events;
  const flatCount = evs.filter(e => /^[A-G]b/.test(e.label)).length, sharpCount = evs.filter(e => /^[A-G]#/.test(e.label)).length;
  const pieceFlats = flatCount > sharpCount;
  const SPELL_S = [['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0], ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0]];
  const SPELL_F = [['C', 0], ['D', -1], ['D', 0], ['E', -1], ['E', 0], ['F', 0], ['G', -1], ['G', 0], ['A', -1], ['A', 0], ['B', -1], ['B', 0]];
  const toQ = t => Math.round(t * tempo / 60 * 2); // eighth notes
  const segs = [];
  let cursor = 0;
  evs.forEach((e, i) => {
    const end = i + 1 < evs.length ? evs[i + 1].t : built.total;
    let qEnd = Math.max(cursor + 1, toQ(end));
    const flats = /^[A-G]b/.test(e.label) ? true : /^[A-G]#/.test(e.label) ? false : pieceFlats;
    segs.push({ label: (e.kind === 'note' ? '→ ' : '') + e.label, notes: [...new Set(e.targets.map(clampMidi))].sort((a, b) => a - b), start: cursor, len: qEnd - cursor, spell: flats ? SPELL_F : SPELL_S });
    cursor = qEnd;
  });
  const TYPES = { 1: ['eighth', 0], 2: ['quarter', 0], 3: ['quarter', 1], 4: ['half', 0], 6: ['half', 1], 8: ['whole', 0] };
  const split = n => { const out = []; for (const s of [8, 6, 4, 3, 2, 1]) while (n >= s) { out.push(s); n -= s; } return out; };
  const pitchXml = (m, spell) => { const [step, alter] = spell[m % 12]; return `<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ''}<octave>${Math.floor(m / 12) - 1}</octave></pitch>`; };
  const noteXml = (notes, len, staff, spell, tieStart, tieStop) => {
    const [type, dot] = TYPES[len];
    if (!notes.length) return `<note><rest/><duration>${len}</duration><voice>${staff}</voice><type>${type}</type>${dot ? '<dot/>' : ''}<staff>${staff}</staff></note>`;
    return notes.map((m, k) => {
      const ties = (tieStop ? '<tie type="stop"/>' : '') + (tieStart ? '<tie type="start"/>' : '');
      const tied = (tieStop ? '<tied type="stop"/>' : '') + (tieStart ? '<tied type="start"/>' : '');
      return `<note>${k ? '<chord/>' : ''}${pitchXml(m, spell)}<duration>${len}</duration>${ties}<voice>${staff}</voice><type>${type}</type>${dot ? '<dot/>' : ''}<staff>${staff}</staff>${tied ? `<notations>${tied}</notations>` : ''}</note>`;
    }).join('');
  };
  const MEAS = 8;
  const total = cursor, nMeas = Math.max(1, Math.ceil(total / MEAS));
  const measures = [];
  for (let mi = 0; mi < nMeas; mi++) {
    const m0 = mi * MEAS, m1 = m0 + MEAS;
    let body = mi === 0
      ? `<attributes><divisions>2</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes><direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${tempo}</per-minute></metronome></direction-type><sound tempo="${tempo}"/></direction>`
      : '';
    const parts = [];
    for (const s of segs) {
      const a = Math.max(s.start, m0), b = Math.min(s.start + s.len, m1);
      if (b > a) parts.push({ s, a, b });
    }
    const staffXml = staff => {
      let x = '', pos = m0;
      for (const { s, a, b } of parts) {
        const notes = s.notes.filter(m => staff === 1 ? m >= 60 : m < 60);
        const pieces = split(b - a);
        pieces.forEach((len, k) => {
          const first = a === s.start && k === 0, last = b === s.start + s.len && k === pieces.length - 1;
          if (staff === 1 && first) x += `<direction placement="above"><direction-type><words>${xmlEsc(s.label)}</words></direction-type><staff>1</staff></direction>`;
          x += noteXml(notes, len, staff, s.spell, notes.length && !last, notes.length && !first);
          pos += len;
        });
      }
      for (const len of split(m1 - pos)) x += noteXml([], len, staff, SPELL_S, false, false);
      return x;
    };
    body += staffXml(1) + `<backup><duration>${MEAS}</duration></backup>` + staffXml(2);
    measures.push(`<measure number="${mi + 1}">${body}</measure>`);
  }
  return utf8(`<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0"><work><work-title>${xmlEsc(title)}</work-title></work><identification>${String(artist || '').trim() ? `<creator type="composer">${xmlEsc(String(artist).trim().slice(0, 200))}</creator>` : ''}<encoding><software>Chord Glide ${ENGINE_VERSION}</software></encoding></identification><part-list><score-part id="P1"><part-name>Voices</part-name></score-part></part-list><part id="P1">${measures.join('')}</part></score-partwise>`);
}

/* ---- Video containers ----
   The browser's encoders produce compressed samples; these functions package them as files.
   Video samples: { data: Uint8Array, key: bool, pts?: seconds } in decode order, one per frame, at a constant frame rate
   (pts is only needed if the encoder reordered frames; otherwise frame i shows at i / fps).
   Audio samples: { data: Uint8Array, duration: seconds }, back to back from time 0.
   Both return a list of parts (Uint8Arrays) to put in a Blob, so long videos never need one huge buffer. */
const catBytes = parts => { let n = 0; for (const p of parts) n += p.length; const o = new Uint8Array(n); let k = 0; for (const p of parts) { o.set(p, k); k += p.length; } return o; };
const asBytes = p => typeof p === 'number' ? Uint8Array.of(p) : p instanceof Uint8Array ? p : Uint8Array.from(p); // a lone number is one byte (Uint8Array.from would drop it)
const be32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const be16 = n => [(n >> 8) & 255, n & 255];
const be64 = n => [...be32(Math.floor(n / 4294967296)), ...be32(n >>> 0)];
const fourcc = s => [...s].map(c => c.charCodeAt(0));
function be32Table(values, signed) { // a run of 32-bit big-endian integers
  const o = new Uint8Array(values.length * 4), dv = new DataView(o.buffer);
  values.forEach((v, i) => signed ? dv.setInt32(i * 4, v) : dv.setUint32(i * 4, v));
  return o;
}

/* H.264 in Annex B form (start codes) → NAL units */
function annexbNals(u8) {
  const out = []; let i = 0, start = -1;
  while (i + 2 < u8.length) {
    if (u8[i] === 0 && u8[i + 1] === 0 && (u8[i + 2] === 1 || (u8[i + 2] === 0 && i + 3 < u8.length && u8[i + 3] === 1))) {
      if (start >= 0) out.push(u8.subarray(start, i));
      i += u8[i + 2] === 1 ? 3 : 4; start = i;
    } else i++;
  }
  if (start >= 0) out.push(u8.subarray(start));
  return out.filter(n => n.length);
}

/* ISO base media (MP4) boxes */
function mbox(type, ...parts) { const body = catBytes(parts.map(asBytes)); return catBytes([Uint8Array.from([...be32(body.length + 8), ...fourcc(type)]), body]); }
const fullBox = (type, version, flags, ...parts) => mbox(type, [version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255], ...parts);
const MATRIX = [...be32(0x00010000), ...be32(0), ...be32(0), ...be32(0), ...be32(0x00010000), ...be32(0), ...be32(0), ...be32(0), ...be32(0x40000000)]; // 3×3 display matrix, 36 bytes: identity
function mp4Descriptor(tag, body) { const n = body.length; return catBytes([Uint8Array.from([tag, 0x80 | ((n >> 21) & 127), 0x80 | ((n >> 14) & 127), 0x80 | ((n >> 7) & 127), n & 127]), body]); }
function runLengths(values) { const runs = []; for (const v of values) { const r = runs[runs.length - 1]; if (r && r[1] === v) r[0]++; else runs.push([1, v]); } return runs; }

/* Length-prefixed H.264 (what an encoder gives when it ignores a request for start codes) → NAL units */
function lengthPrefixedNals(u8) { const out = []; for (let i = 0; i + 4 <= u8.length;) { const n = ((u8[i] << 24) | (u8[i + 1] << 16) | (u8[i + 2] << 8) | u8[i + 3]) >>> 0; if (!n || i + 4 + n > u8.length) break; out.push(u8.subarray(i + 4, i + 4 + n)); i += 4 + n; } return out; }
/* Convert one Annex B frame to length-prefixed form as it arrives, collecting the parameter sets once.
   state: { sps, pps }. Returns the frame's new bytes. */
function avcFrame(u8, state) {
  const keep = [];
  for (const n of annexbNals(u8)) {
    const t = n[0] & 0x1F;
    if (t === 7) { if (!state.sps) state.sps = n.slice(); } else if (t === 8) { if (!state.pps) state.pps = n.slice(); } else if (t !== 9) keep.push(Uint8Array.from(be32(n.length)), n);
  }
  return catBytes(keep);
}
/* An avcC record (decoder configuration) from SPS and PPS */
function avcConfig(sps, pps) { return Uint8Array.from([1, sps[1], sps[2], sps[3], 0xFF, 0xE1, ...be16(sps.length), ...sps, 1, ...be16(pps.length), ...pps]); }
/* SPS and PPS from an avcC record */
function avcCParams(c) {
  if (!c || c.length < 7 || c[0] !== 1) return {};
  let i = 6; const nSps = c[5] & 31, sps = [];
  for (let k = 0; k < nSps; k++) { const n = (c[i] << 8) | c[i + 1]; sps.push(c.slice(i + 2, i + 2 + n)); i += 2 + n; }
  const nPps = c[i++], pps = [];
  for (let k = 0; k < nPps; k++) { const n = (c[i] << 8) | c[i + 1]; pps.push(c.slice(i + 2, i + 2 + n)); i += 2 + n; }
  return { sps: sps[0], pps: pps[0] };
}
/* MP4 with H.264 video and AAC or Opus audio, or (quicktime: true) a QuickTime .mov, which can also carry uncompressed audio.
   The index (moov) comes first, so it plays and seeks at once.
   video: { width, height, fps, samples }
   audio: { codec: 'aac' | 'opus' | 'pcm', sampleRate, channels, bitrate, description, samples, delay?, length? }
   delay: the encoder's start-up samples (AAC priming) for players to skip; length: the real sound in samples. Both go in an edit list.
   PCM samples are blocks { data: 16-bit little-endian interleaved bytes, frames }, laid out the way QuickTime and ffmpeg write them.
   meta: { title, artist } — iTunes-style tags (moov/udta/meta/ilst) in an MP4, classic QuickTime text atoms (moov/udta/©nam, ©ART) in a .mov. */
function mp4Mux({ video, audio, quicktime = false, meta = null }) {
  // video: split each frame into NAL units, keep the parameter sets for the avcC box, store the rest length-prefixed
  let { sps, pps } = avcCParams(video.description);
  const vData = video.samples.map(s => {
    // an encoder that sends an avcC record is sending length-prefixed frames; otherwise they have start codes (Annex B)
    const nals = video.description ? lengthPrefixedNals(s.data) : annexbNals(s.data);
    if (video.description && nals.every(n => ![7, 8, 9].includes(n[0] & 0x1F))) return s.data; // already clean: no copy
    const keep = [];
    for (const n of nals) {
      const t = n[0] & 0x1F;
      if (t === 7) { if (!sps) sps = n.slice(); } else if (t === 8) { if (!pps) pps = n.slice(); } else if (t !== 9) keep.push(Uint8Array.from(be32(n.length)), n);
    }
    return catBytes(keep);
  });
  if (!sps || !pps) throw new Error('The video encoder gave no H.264 parameter sets.');
  const vts = video.fps * 100, frameDur = 100, vDuration = vData.length * frameDur;
  const aSr = audio ? audio.sampleRate : 48000;
  const pcm = !!(audio && audio.codec === 'pcm');
  if (pcm && !quicktime) throw new Error('Uncompressed audio needs the QuickTime (.mov) container.');
  const aDurs = audio ? audio.samples.map(s => pcm ? s.frames : Math.max(1, Math.round(s.duration * aSr))) : [];
  const aDuration = aDurs.reduce((a, b) => a + b, 0);
  // with an edit list, playback starts after the priming samples and stops at the end of the real sound
  const aDelay = audio && audio.delay > 0 ? Math.min(Math.round(audio.delay), aDuration - 1) : 0;
  const aShown = audio ? Math.max(1, Math.min(aDuration - aDelay, audio.length > 0 ? Math.round(audio.length) : Infinity)) : 0;
  const aEdit = aDelay > 0 || (audio && aShown < aDuration);
  const aMs = Math.round(aShown / aSr * 1000);
  const movieMs = Math.ceil(Math.max(vDuration / vts, audio ? aShown / aSr : 0) * 1000);

  // interleave samples by time: [track, index, size]
  const order = [];
  { let ai = 0, at = 0;
    for (let vi = 0; vi < vData.length; vi++) {
      const vt = vi / video.fps;
      while (audio && ai < aDurs.length && at <= vt) { order.push([1, ai]); at += aDurs[ai] / aSr; ai++; }
      order.push([0, vi]);
    }
    while (audio && ai < aDurs.length) order.push([1, ai++]); }
  const size = ([tr, i]) => tr === 0 ? vData[i].length : audio.samples[i].data.length;
  const mdatBody = order.reduce((a, o) => a + size(o), 0);
  const big = mdatBody + 8 > 0xFFFFFFFF;

  const highProfile = [100, 110, 122, 144].includes(sps[1]);
  const avcC = mbox('avcC', [1, sps[1], sps[2], sps[3], 0xFF, 0xE1, ...be16(sps.length)], sps, [1, ...be16(pps.length)], pps, highProfile ? [0xFD, 0xF8, 0xF8, 0] : []);
  const vEntry = mbox('avc1', [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...be16(video.width), ...be16(video.height),
    0, 0x48, 0, 0, 0, 0x48, 0, 0, 0, 0, 0, 0, 0, 1, ...new Array(32).fill(0), 0, 0x18, 0xFF, 0xFF], avcC, mbox('pasp', be32(1), be32(1))); // square pixels
  const audioHead = ch => [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, ...be16(ch), 0, 16, 0, 0, 0, 0, ...be32(aSr * 65536)];
  let aEntry = null;
  if (audio && audio.codec === 'aac') {
    const asc = audio.description && audio.description.length ? audio.description : Uint8Array.from([0x11, 0x90]); // AAC-LC, 48 kHz, stereo
    const dcd = mp4Descriptor(4, catBytes([Uint8Array.from([0x40, 0x15, 0, 0, 0, ...be32(audio.bitrate || 0), ...be32(audio.bitrate || 0)]), mp4Descriptor(5, asc)]));
    const es = mp4Descriptor(3, catBytes([Uint8Array.from([0, 1, 0]), dcd, mp4Descriptor(6, Uint8Array.from([2]))]));
    aEntry = mbox('mp4a', audioHead(audio.channels), fullBox('esds', 0, 0, es));
  } else if (pcm) { // 16-bit little-endian PCM ('sowt'), with a stereo or mono channel layout
    aEntry = mbox('sowt', audioHead(audio.channels), fullBox('chan', 0, 0, be32(audio.channels === 2 ? 0x650002 : 0x640001), be32(0), be32(0)));
  } else if (audio) {
    const d = audio.description, preSkip = d && d.length >= 12 ? d[10] | (d[11] << 8) : 312;
    aEntry = mbox('Opus', audioHead(audio.channels), mbox('dOps', [0, audio.channels, ...be16(preSkip), ...be32(aSr), 0, 0, 0]));
  }

  // title and artist
  const tags = metaFields(meta), atom = { title: '\u00A9nam', artist: '\u00A9ART' };
  const udta = !tags.length ? new Uint8Array(0) : quicktime
    ? mbox('udta', ...tags.map(([k, v]) => { const b = utf8(v); return mbox(atom[k], be16(b.length), be16(0x55C4), b); })) // UTF-8, language 'und'
    : mbox('udta', fullBox('meta', 0, 0, fullBox('hdlr', 0, 0, be32(0), fourcc('mdir'), fourcc('appl'), be32(0), be32(0), [0]),
        mbox('ilst', ...tags.map(([k, v]) => mbox(atom[k], mbox('data', be32(1), be32(0), utf8(v)))))));
  const build = offsets => {
    const chunkOffsets = (tr, n) => { const a = offsets ? offsets[tr] : new Array(n).fill(0); return big ? fullBox('co64', 0, 0, be32(n), ...a.map(be64)) : fullBox('stco', 0, 0, be32(n), be32Table(a)); };
    const dinf = mbox('dinf', fullBox('dref', 0, 0, be32(1), fullBox('url ', 0, 1)));
    const stsc = fullBox('stsc', 0, 0, be32(1), be32(1), be32(1), be32(1));
    const pcmStsc = () => { // one chunk per PCM block, with a new entry whenever the block length changes
      const e = []; aDurs.forEach((f, k) => { if (!e.length || e[e.length - 1][1] !== f) e.push([k + 1, f, 1]); });
      return fullBox('stsc', 0, 0, be32(e.length), be32Table(e.flat()));
    };
    const tkhd = (id, ms, w, h, vol) => fullBox('tkhd', 0, 3, be32(0), be32(0), be32(id), be32(0), be32(ms), new Array(8).fill(0), 0, 0, 0, 0, ...be16(vol), 0, 0, MATRIX, be32(w * 65536), be32(h * 65536));
    const mdhd = (ts, dur) => fullBox('mdhd', 0, 0, be32(0), be32(0), be32(ts), be32(dur), 0x55, 0xC4, 0, 0);
    // QuickTime handler names are length-prefixed and the media handler is marked 'mhlr'; MP4's are null-terminated
    const hdlr = (type, name) => quicktime ? fullBox('hdlr', 0, 0, fourcc('mhlr'), fourcc(type), new Array(12).fill(0), [utf8(name).length], utf8(name)) : fullBox('hdlr', 0, 0, be32(0), fourcc(type), new Array(12).fill(0), utf8(name), [0]);
    const dataHdlr = quicktime ? fullBox('hdlr', 0, 0, fourcc('dhlr'), fourcc('url '), new Array(12).fill(0), [11], utf8('DataHandler')) : new Uint8Array(0);
    const stts = runs => fullBox('stts', 0, 0, be32(runs.length), be32Table(runs.flat()));
    const vRuns = [[vData.length, frameDur]];
    // composition offsets, only if the encoder reordered frames (B-frames)
    const cto = video.samples.map((s, i) => s.pts === undefined ? 0 : Math.round(s.pts * vts) - i * frameDur);
    const ctts = cto.some(x => x !== 0) ? fullBox('ctts', 1, 0, be32(runLengths(cto).length), be32Table(runLengths(cto).flat(), true)) : new Uint8Array(0);
    const keys = []; video.samples.forEach((s, i) => { if (s.key) keys.push(i + 1); });
    const vtrak = mbox('trak', tkhd(1, Math.round(vDuration / vts * 1000), video.width, video.height, 0),
      mbox('mdia', mdhd(vts, vDuration), hdlr('vide', 'Chord Glide video'),
        mbox('minf', fullBox('vmhd', 0, 1, 0, 0, 0, 0, 0, 0, 0, 0), dataHdlr, dinf,
          mbox('stbl', fullBox('stsd', 0, 0, be32(1), vEntry), stts(vRuns), ctts, fullBox('stss', 0, 0, be32(keys.length), be32Table(keys)), stsc,
            fullBox('stsz', 0, 0, be32(0), be32(vData.length), be32Table(vData.map(d => d.length))), chunkOffsets(0, vData.length)))));
    const edts = aEdit ? mbox('edts', fullBox('elst', 0, 0, be32(1), be32(aMs), be32(aDelay), be32(0x00010000))) : new Uint8Array(0);
    const atrak = audio ? mbox('trak', tkhd(2, aEdit ? aMs : Math.round(aDuration / aSr * 1000), 0, 0, 0x0100), edts,
      mbox('mdia', mdhd(aSr, aDuration), hdlr('soun', 'Chord Glide audio'),
        mbox('minf', fullBox('smhd', 0, 0, 0, 0, 0, 0), dataHdlr, dinf,
          mbox('stbl', fullBox('stsd', 0, 0, be32(1), aEntry), pcm ? stts([[aDuration, 1]]) : stts(runLengths(aDurs)), pcm ? pcmStsc() : stsc,
            pcm ? fullBox('stsz', 0, 0, be32(2 * audio.channels), be32(aDuration)) : fullBox('stsz', 0, 0, be32(0), be32(aDurs.length), be32Table(audio.samples.map(s => s.data.length))),
            chunkOffsets(1, aDurs.length))))) : new Uint8Array(0);
    const mvhd = fullBox('mvhd', 0, 0, be32(0), be32(0), be32(1000), be32(movieMs), be32(0x00010000), 1, 0, new Array(10).fill(0), MATRIX, new Array(24).fill(0), be32(audio ? 3 : 2));
    return mbox('moov', mvhd, vtrak, atrak, udta);
  };
  const ftyp = quicktime ? mbox('ftyp', fourcc('qt  '), be32(0x200), fourcc('qt  ')) : mbox('ftyp', fourcc('isom'), be32(0x200), fourcc('isom'), fourcc('iso2'), fourcc('avc1'), fourcc('mp41'));
  const moovLen = build(null).length, mdatHead = big ? 16 : 8;
  let pos = ftyp.length + moovLen + mdatHead;
  const offsets = [new Array(vData.length), new Array(aDurs.length)];
  for (const o of order) { offsets[o[0]][o[1]] = pos; pos += size(o); }
  const moov = build(offsets);
  if (moov.length !== moovLen) throw new Error('MP4 index size changed while writing.');
  const mdatHeader = big ? Uint8Array.from([0, 0, 0, 1, ...fourcc('mdat'), ...be64(mdatBody + 16)]) : Uint8Array.from([...be32(mdatBody + 8), ...fourcc('mdat')]);
  return [ftyp, moov, mdatHeader, ...order.map(([tr, i]) => tr === 0 ? vData[i] : audio.samples[i].data)];
}

/* WebM with VP9 or VP8 video and Opus audio, including the duration and a seek index (Cues) */
function ebmlId(id) { const b = []; while (id > 0) { b.unshift(id & 255); id = Math.floor(id / 256); } return b; }
function ebmlSize(n) { for (let len = 1; len <= 8; len++) if (n < Math.pow(2, 7 * len) - 1) { const b = []; let x = n; for (let i = 0; i < len; i++) { b.unshift(x % 256); x = Math.floor(x / 256); } b[0] |= 0x80 >> (len - 1); return b; } throw new Error('EBML element too large'); }
function ebml(id, ...parts) { const body = catBytes(parts.map(asBytes)); return catBytes([Uint8Array.from([...ebmlId(id), ...ebmlSize(body.length)]), body]); }
function ebmlUint(id, n, len) { const b = []; let x = n; do { b.unshift(x % 256); x = Math.floor(x / 256); } while (x > 0 || (len && b.length < len)); return ebml(id, b); }
function ebmlFloat(id, x) { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, x); return ebml(id, b); }
const ebmlStr = (id, s) => ebml(id, utf8(s));
function opusHead(channels, preSkip, sampleRate) { return Uint8Array.from([...fourcc('OpusHead'), 1, channels, preSkip & 255, preSkip >> 8, ...be32(sampleRate).reverse(), 0, 0, 0]); }

function webmMux({ video, audio, meta = null }) {
  const codecId = video.codec === 'vp8' ? 'V_VP8' : 'V_VP9';
  const head = audio && audio.description && audio.description.length >= 19 ? audio.description : opusHead(audio ? audio.channels : 2, 312, audio ? audio.sampleRate : 48000);
  const preSkip = head[10] | (head[11] << 8);
  // every block with its time in milliseconds; video first at equal times
  const blocks = video.samples.map((s, i) => ({ track: 1, ms: Math.round((s.pts === undefined ? i / video.fps : s.pts) * 1000), key: s.key, data: s.data }));
  if (audio) { let t = 0; for (const s of audio.samples) { blocks.push({ track: 2, ms: Math.round(t * 1000), key: true, data: s.data }); t += s.duration; } }
  blocks.sort((a, b) => a.ms - b.ms || a.track - b.track);
  const durationMs = Math.max(video.samples.length * 1000 / video.fps, audio ? audio.samples.reduce((a, s) => a + s.duration, 0) * 1000 : 0);
  // clusters start at video keyframes (and at least every 30 s, so block times fit in 16 bits)
  const clusters = []; let cur = null;
  for (const b of blocks) {
    if (!cur || (b.track === 1 && b.key && cur.blocks.length) || b.ms - cur.ms > 30000) { cur = { ms: b.ms, blocks: [], cue: b.track === 1 && b.key }; clusters.push(cur); }
    cur.blocks.push(b);
  }
  // each cluster is a list of parts: small headers are built here, block data is referenced, not copied
  const clusterParts = clusters.map(c => {
    const inner = [ebmlUint(0xE7, c.ms)];
    for (const b of c.blocks) {
      const rel = b.ms - c.ms, head = [0x80 | b.track, (rel >> 8) & 255, rel & 255, b.key ? 0x80 : 0];
      inner.push(Uint8Array.from([...ebmlId(0xA3), ...ebmlSize(head.length + b.data.length), ...head]), b.data);
    }
    const len = inner.reduce((a, x) => a + x.length, 0);
    return [Uint8Array.from([...ebmlId(0x1F43B675), ...ebmlSize(len)]), ...inner];
  });
  const clusterBytes = clusterParts.map(parts => ({ length: parts.reduce((a, x) => a + x.length, 0), parts }));
  const tagList = metaFields(meta), titleTag = tagList.find(([k]) => k === 'title');
  const info = ebml(0x1549A966, ebmlUint(0x2AD7B1, 1000000), ebmlFloat(0x4489, durationMs), ...(titleTag ? [ebmlStr(0x7BA9, titleTag[1])] : []), ebmlStr(0x4D80, 'Chord Glide'), ebmlStr(0x5741, 'Chord Glide'));
  // Tags: TITLE and ARTIST for the whole file (target type 50, an album/movie-level item)
  const tagsEl = tagList.length ? ebml(0x1254C367, ebml(0x7373, ebml(0x63C0, ebmlUint(0x68CA, 50)),
    ...tagList.map(([k, v]) => ebml(0x67C8, ebmlStr(0x45A3, k.toUpperCase()), ebmlStr(0x4487, v))))) : null;
  const tracks = ebml(0x1654AE6B,
    ebml(0xAE, ebmlUint(0xD7, 1), ebmlUint(0x73C5, 1), ebmlUint(0x83, 1), ebmlUint(0x9C, 0), ebmlStr(0x86, codecId), ebmlUint(0x23E383, Math.round(1e9 / video.fps)),
      ebml(0xE0, ebmlUint(0xB0, video.width), ebmlUint(0xBA, video.height))),
    ...(audio ? [ebml(0xAE, ebmlUint(0xD7, 2), ebmlUint(0x73C5, 2), ebmlUint(0x83, 2), ebmlUint(0x9C, 0), ebmlStr(0x86, 'A_OPUS'), ebml(0x63A2, head),
      ebmlUint(0x56AA, Math.round(preSkip / 48000 * 1e9)), ebmlUint(0x56BB, 80000000),
      ebml(0xE1, ebmlFloat(0xB5, audio.sampleRate), ebmlUint(0x9F, audio.channels)))] : []));
  // positions are relative to the start of the Segment's data; the seek head uses fixed-size numbers so its own size is known in advance
  const seekHead = pos => ebml(0x114D9B74, ...[[0x1549A966, pos.info], [0x1654AE6B, pos.tracks], [0x1C53BB6B, pos.cues], ...(tagsEl ? [[0x1254C367, pos.tags]] : [])].map(([id, p]) =>
    ebml(0x4DBB, ebml(0x53AB, ebmlId(id)), ebmlUint(0x53AC, p, 8))));
  const seekLen = seekHead({ info: 0, tracks: 0, cues: 0, tags: 0 }).length;
  const pos = { info: seekLen }; pos.tracks = pos.info + info.length;
  let p = pos.tracks + tracks.length; const clusterPos = clusterBytes.map(c => { const at = p; p += c.length; return at; });
  pos.cues = p;
  const cues = ebml(0x1C53BB6B, ...clusters.map((c, i) => c.cue ? ebml(0xBB, ebmlUint(0xB3, c.ms), ebml(0xB7, ebmlUint(0xF7, 1), ebmlUint(0xF1, clusterPos[i]))) : null).filter(Boolean));
  pos.tags = pos.cues + cues.length;
  const segBody = [seekHead(pos), info, tracks, ...clusterParts.flat(), cues, ...(tagsEl ? [tagsEl] : [])];
  const segLen = segBody.reduce((a, b) => a + b.length, 0);
  const header = ebml(0x1A45DFA3, ebmlUint(0x4286, 1), ebmlUint(0x42F7, 1), ebmlUint(0x42F2, 4), ebmlUint(0x42F3, 8), ebmlStr(0x4282, 'webm'), ebmlUint(0x4287, 4), ebmlUint(0x4285, 2));
  const segHead = Uint8Array.from([...ebmlId(0x18538067), 0x01, ...be64(segLen).slice(1)]); // 8-byte size
  return [header, segHead, ...segBody];
}
