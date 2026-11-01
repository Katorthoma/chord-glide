
/* ===== File writers: ZIP, WAV, MIDI, MusicXML (no DOM) ===== */
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
function encodeWav24(left, right, sampleRate) {
  const n = left.length, bytes = n * 2 * 3, buf = new ArrayBuffer(44 + bytes), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + bytes, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 6, true);
  v.setUint16(32, 6, true); v.setUint16(34, 24, true); w(36, 'data'); v.setUint32(40, bytes, true);
  let o = 44;
  for (let i = 0; i < n; i++) for (const ch of [left, right]) {
    let s = Math.max(-1, Math.min(1, ch[i])); let x = Math.round(s * 8388607); if (x < 0) x += 16777216;
    v.setUint8(o, x & 255); v.setUint8(o + 1, (x >> 8) & 255); v.setUint8(o + 2, (x >> 16) & 255); o += 3;
  }
  return new Uint8Array(buf);
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
function conductorTrack(built, tempo, title, extra = []) {
  const tick = t => Math.round(t * tempo / 60 * PPQ);
  const us = Math.round(60e6 / tempo);
  const ev = [
    { tick: 0, ord: 0, data: metaText(0x03, title) },
    { tick: 0, ord: 1, data: [0xFF, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255] },
    { tick: 0, ord: 2, data: [0xFF, 0x58, 4, 4, 2, 24, 8] },
    ...extra
  ];
  built.events.forEach((e, i) => ev.push({ tick: tick(e.t), ord: 10 + i, data: metaText(0x06, (e.kind === 'note' ? '→ ' : '') + e.label) }));
  return trackChunk(ev);
}
const clampMidi = m => Math.max(0, Math.min(127, Math.round(m)));

/* Glides kept as per-voice pitch bend: MPE lower zone, one member channel per voice, ±48 semitones */
/* Pitch bend is sent whenever the curve moves more than `tolerance` semitones from the last value sent (default 3 cents). */
function midiWithGlides(built, { tempo = 60, title = 'Piece', bendRange = 48, tolerance = 0.03 } = {}) {
  const tick = t => Math.round(t * tempo / 60 * PPQ);
  const N = Math.min(built.N, 15);
  const mpe = [ // MPE configuration on the master channel (1): 15 member channels
    { tick: 0, ord: 3, data: [0xB0, 101, 0] }, { tick: 0, ord: 4, data: [0xB0, 100, 6] }, { tick: 0, ord: 5, data: [0xB0, 6, 15] },
    { tick: 0, ord: 6, data: [0xB0, 101, 127] }, { tick: 0, ord: 7, data: [0xB0, 100, 127] }
  ];
  const tracks = [conductorTrack(built, tempo, title, mpe)];
  const bendVal = s => Math.max(0, Math.min(16383, Math.round(8192 + (s / bendRange) * 8191)));
  for (let v = 0; v < N; v++) {
    const ch = v + 1, ev = []; let ord = 0;
    const add = (t, data) => ev.push({ tick: tick(t), ord: ord++, data });
    add(0, [0xB0 | ch, 101, 0]); add(0, [0xB0 | ch, 100, 0]); add(0, [0xB0 | ch, 6, bendRange]); add(0, [0xB0 | ch, 38, 0]);
    add(0, [0xB0 | ch, 101, 127]); add(0, [0xB0 | ch, 100, 127]);
    add(0, metaText(0x03, 'Voice ' + (v + 1)));
    let note = clampMidi(built.events[0].targets[v]), lastBend = 8192;
    const bend = (t, semis) => { const b = bendVal(semis); if (b !== lastBend) { add(t, [0xE0 | ch, b & 0x7F, (b >> 7) & 0x7F]); lastBend = b; } };
    add(0, [0xE0 | ch, 0, 64]); add(0, [0x90 | ch, note, 88]);
    for (let i = 1; i < built.events.length; i++) {
      const e = built.events[i], a = built.events[i - 1].targets[v], b = e.targets[v];
      if (a === b) continue;
      const t0 = e.t + (e.off ? e.off[v] : 0), d = e.dur ? e.dur[v] : e.g;
      const reach = (t, p) => { // past the bend range mid-glide: hand over to a new note on the target
        if (Math.abs(p - note) <= bendRange) return;
        add(t, [0x80 | ch, note, 0]);
        note = clampMidi(b); lastBend = -1;
        bend(t, Math.max(-bendRange, Math.min(bendRange, p - note)));
        add(t, [0x90 | ch, note, 88]);
      };
      if (d <= 0) { reach(t0, b); bend(t0, b - note); continue; }
      // adaptive: walk the curve at 0.5 ms and send a bend only when it drifts past the tolerance
      const steps = Math.max(2, Math.ceil(d / 0.0005));
      let sent = a;
      for (let k = 1; k <= steps; k++) {
        const t = t0 + d * k / steps; const p = pitchAt(built, v, Math.min(t, e.t + e.g), i);
        reach(t, p);
        if (Math.abs(p - sent) >= tolerance) { bend(t, p - note); sent = p; }
      }
      bend(t0 + d, b - note);
    }
    add(built.total, [0x80 | ch, note, 0]);
    tracks.push(trackChunk(ev));
  }
  return smf(tracks);
}

/* Settled chords only: one channel, notes start at each change */
function midiChords(built, { tempo = 60, title = 'Piece' } = {}) {
  const tick = t => Math.round(t * tempo / 60 * PPQ);
  const ev = []; let ord = 0;
  built.events.forEach((e, i) => {
    const end = i + 1 < built.events.length ? built.events[i + 1].t : built.total;
    for (const m of [...new Set(e.targets.map(clampMidi))]) {
      ev.push({ tick: tick(e.t), ord: ord++, data: [0x90, m, 80] });
      ev.push({ tick: Math.max(tick(e.t) + 1, tick(end)) - 1, ord: ord++, data: [0x80, m, 0] });
    }
  });
  return smf([conductorTrack(built, tempo, title), trackChunk(ev)]);
}

/* ---- MusicXML: the settled chords on a grand staff (glides are not notated) ---- */
const xmlEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function musicXml(built, { tempo = 60, title = 'Piece' } = {}) {
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
<score-partwise version="4.0"><work><work-title>${xmlEsc(title)}</work-title></work><identification><encoding><software>Chord Glide ${ENGINE_VERSION}</software></encoding></identification><part-list><score-part id="P1"><part-name>Voices</part-name></score-part></part-list><part id="P1">${measures.join('')}</part></score-partwise>`);
}
