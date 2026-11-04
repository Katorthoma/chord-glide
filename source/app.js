
/* ===== App: pieces, library, controls, audio, drawing, exports ===== */
const APP_VERSION = '4.2';
const EXAMPLES = [
  { name: 'Lantern Hours', voices: 12, seeds: { harmony: 0x2F6A11C3, voicing: 0x51D0A7E2, motion: 0x0C44B9A1, sound: 0x7E1F33D0 },
    chords: '=F6:0.8\nDbmaj9\nFm7\nGbmaj9#11\nEbm9\nAb9sus4\nBbm11\nGbmaj9\nAb13sus4\nDbmaj9:3\n=F6',
    timing: { chordSec: 5, glide: 1.8, easing: 'smooth', tempo: 60 }, voicing: { variation: 25, spread: 100 }, motion: { order: 'together', stagger: 0 }, sound: { tone: 'soft' } },
  { name: 'Slow Orbit', voices: 9, seeds: { harmony: 0x13C0FFEE, voicing: 0x6B2D9F04, motion: 0x3A7712E5, sound: 0x48B1C9D6 },
    chords: '=E6:1\nAm9\nFmaj9\nCmaj7/E\nDm11\nG9sus4\nEm7\nFmaj7#11\nE7sus4\nAm(add9):3.5\n=A5',
    timing: { chordSec: 6, glide: 2.6, easing: 'smoother', tempo: 60 }, voicing: { variation: 35, spread: 30, stacking: 40 }, motion: { order: 'high-low', stagger: 55 }, sound: { tone: 'warm', reverb: 50 } },
  { name: 'Glasshouse', voices: 14, seeds: { harmony: 0x77E01234, voicing: 0x0BADF00D, motion: 0x1EAF5A2B, sound: 0x5C3E9D11 },
    chords: '=F#6:0.6\nBmaj9\nG#m11\nEmaj9\nGmaj7#11\nC#m9\nF#13sus4\nD#m7\nGmaj9\nF#9sus4\nBmaj9:3\n=D#6',
    timing: { chordSec: 4, glide: 1.3, easing: 'smooth', tempo: 60 }, voicing: { variation: 20, spread: 85, coverage: 65 }, motion: { order: 'low-high', stagger: 70 }, sound: { tone: 'glass', detune: 6, brightness: 6000 } },
  // Parts: the main part is the pad; a bass line and a melody (with rests and vibrato) are written out, one bar per chord at 120 BPM
  { name: 'Three Parts', voices: 6, seeds: { harmony: 0x3A1E5C07, voicing: 0x6D2B8F14, motion: 0x19C4E7A2, sound: 0x4F08B3D6 },
    chords: 'C\nG/B\nAm\nEm/G\nF\nC/E\nDm7\nG7sus4\nG7\nC:4',
    timing: { chordSec: 2, glide: 0.5, easing: 'smooth', tempo: 120 }, voicing: { variation: 15, spread: 60, top: 79, bassMode: 'none' }, motion: { order: 'together', stagger: 0 },
    sound: { tone: 'warm', detune: 5, width: 80, reverb: 34, brightness: 5200 },
    parts: [
      { name: 'Bass', preset: 'line', step: '1/4', sound: { tone: 'saw', level: -5, pan: 0, width: 0, detune: 3 },
        envelope: { attack: 0.005, decay: 0.25, sustain: 0.55, release: 0.08 },
        line: 'C2 C3 C2 C3 | B1 B2 B1 B2 | A1 A2 A1 A2 | G1 G2 G1 G2 | F1 F2 F1 F2 | E1 E2 E1 E2 | D2 D3 D2 D3 | G1 G2 G1 G2 | G1 G2 G1 G2 | C2:4 -:4' },
      { name: 'Melody', preset: 'line', step: '1/8', transpose: [0, -12], portamento: 0.04, sound: { tone: 'triangle', level: -1, pan: 0.15, width: 30, detune: 4 },
        envelope: { attack: 0.02, decay: 0.3, sustain: 0.7, release: 0.2 }, vibrato: { cents: 18, rate: 5.5, delay: 0.35 },
        line: 'E5:2 G5:2 C6:3 B5:1 | D6:2 B5:2 G5:4 | C6:2 A5:2 E5:2 A5:2 | B5:3 A5:1 G5:4 | A5:2 C6:2 F6:3 E6:1 | E6:2 C6:2 G5:4 | F5:2 A5:2 D6:2 C6:2 | C6:3 B5:1 -:2 G5:2 | D6:2 B5:2 F5:2 D5:2 | E5:8 -:8' }
    ] },
  // pieces kept whole in source/examples/ (sections, parts that never stop, their own look), after the ones above
  ...(typeof EXAMPLE_PIECES !== 'undefined' ? EXAMPLE_PIECES : []).map(p => ({ name: p.name, piece: p }))
];
const LAYERS = ['harmony', 'voicing', 'motion', 'sound'];

const $ = id => document.getElementById(id);
const clamp01 = x => Math.max(0, Math.min(1, x));
const lerp = (a, b, z) => a + (b - a) * z;
const fmtSeed = v => '0x' + (v >>> 0).toString(16).toUpperCase().padStart(8, '0');
const parseSeed = s => { s = String(s).trim(); const v = /^0x/i.test(s) ? parseInt(s, 16) : parseInt(s, 10); return Number.isFinite(v) ? v >>> 0 : null; };
const randSeed = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0]; };
const fmtClock = t => { t = Math.max(0, t); return Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'); };
const safeName = s => (String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)) || 'Untitled piece';
const getPath = (o, p) => p.split('.').reduce((a, k) => a[k], o);
const setPath = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
/* Some browsers refuse or forget storage for pages opened straight from disk: test it for real before promising a library */
const STORAGE_OK = (() => { try { const k = 'cge.probe.' + Math.random().toString(36).slice(2); localStorage.setItem(k, '1'); const ok = localStorage.getItem(k) === '1'; localStorage.removeItem(k); return ok; } catch (e) { return false; } })();
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
/* Pieces (the library and the working draft) are kept in IndexedDB, where browsers allow hundreds of megabytes; localStorage
   (about 5 MB for the whole site) keeps only small preferences, and holds pieces only where IndexedDB isn't available.
   A piece of saved notes can be several megabytes, so the old way, the whole library as one localStorage string, filled up fast. */
const IDB = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    let r; try { r = indexedDB.open('chord-glide', 1); } catch (e) { rej(e); return; }
    r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains('pieces')) db.createObjectStore('pieces', { keyPath: 'id' }); if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('blocked'));
  }));
  // one request in its own transaction; resolves when the transaction is done, so a write has really been kept
  const run = (store, mode, fn) => open().then(db => new Promise((res, rej) => {
    const t = db.transaction(store, mode), req = fn(t.objectStore(store)); let out;
    req.onsuccess = () => { out = req.result; };
    t.oncomplete = () => res(out);
    const fail = () => { const e = t.error || req.error; rej(Object.assign(new Error('storage'), { code: e && e.name === 'QuotaExceededError' ? 'quota_exceeded' : 'storage_unavailable' })); };
    t.onerror = fail; t.onabort = fail;
  }));
  const api = {
    all: () => run('pieces', 'readonly', st => st.getAll()), put: item => run('pieces', 'readwrite', st => st.put(item)), remove: id => run('pieces', 'readwrite', st => st.delete(id)),
    get: k => run('kv', 'readonly', st => st.get(k)), set: (k, v) => run('kv', 'readwrite', st => st.put(v, k))
  };
  // usable only if a write and a read-back both work (some browsers refuse storage for pages opened from a file)
  api.ready = (async () => { try { if (typeof indexedDB === 'undefined') return false; const k = 'probe'; await api.set(k, 1); return (await api.get(k)) === 1; } catch (e) { return false; } })();
  return api;
})();

/* The optional artist name for exports (Settings): this browser only, never part of a piece */
/* The video option only makes sense once there's a name: otherwise it's dimmed and says where to add one */
function showArtistOption() {
  const has = !!artistName(); $('vartist').disabled = !has; $('vartist-row').classList.toggle('off', !has);
  $('vartist-text').textContent = has ? 'Artist name under the title (' + artistName() + ')' : 'Artist name under the title (add your name in Settings)';
}
let artistTyped = null; // what was typed this session, in case this browser can't store it
const artistName = () => String(artistTyped !== null ? artistTyped : (lsGet('cge.artist') || '')).trim().slice(0, 80);
function defaultLook() { try { const v = JSON.parse(lsGet('cge.look') || 'null'); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } }
function examplePiece(ex) {
  if (ex.piece) { const p = Object.assign(defaultPiece(), JSON.parse(JSON.stringify(ex.piece))); p.created = new Date().toISOString(); delete p.modified; return normalizePiece(p); } // with its own look
  const p = defaultPiece();
  const dl = defaultLook(); if (dl) p.view.trace = dl;
  p.name = ex.name; p.voices = ex.voices; p.chords = ex.chords; p.seeds = Object.assign({}, ex.seeds);
  Object.assign(p.timing, ex.timing); Object.assign(p.voicing, ex.voicing); Object.assign(p.motion, ex.motion); Object.assign(p.sound, ex.sound);
  if (ex.parts) p.parts = JSON.parse(JSON.stringify(ex.parts)); if (ex.volume) p.volume = JSON.parse(JSON.stringify(ex.volume));
  p.created = new Date().toISOString();
  return normalizePiece(p);
}

/* ---------- State ---------- */
let piece = null, built = null, marks = null;
let currentLibId = null, savedJSON = null;
let undoStack = [], redoStack = [], committed = null;
let offset = 0, playing = false, startAt = 0;
// TAIL (the fade and reverb after the last change, which the clock counts) and FADE (the closing fade inside it) are in engine.js
let actx = null, live = null;
let recording = null;
const screenCam = { slo: 50, shi: 80, snap: true };

/* ---------- Controls ---------- */
const pct = v => Math.round(v) + '%';
const SLIDERS = [
  ['chordsec', 'timing.chordSec', v => (+v).toFixed(1) + ' s'], ['chordbars', 'timing.chordBars', v => (+v) + (+v === 1 ? ' bar' : ' bars')], ['voices', 'voices', v => String(v)],
  ['continuity', 'voicing.continuity', pct], ['coverage', 'voicing.coverage', pct], ['stacking', 'voicing.stacking', pct],
  ['spacing', 'voicing.spacing', pct], ['variation', 'voicing.variation', pct], ['spread', 'voicing.spread', pct],
  ['glide', 'timing.glide', v => (+v).toFixed(1) + ' s'], ['stagger', 'motion.stagger', pct],
  ['detune', 'sound.detune', v => (+v).toFixed(1) + ' ¢'], ['width', 'sound.width', pct], ['reverb', 'sound.reverb', pct],
  ['brightness', 'sound.brightness', v => (v / 1000).toFixed(1) + ' kHz'], ['tempo', 'timing.tempo', v => v + ' BPM'],
  ['breathedepth', 'breathe.depth', v => +v ? '−' + Math.round(-20 * Math.log10(1 - v) * 10) / 10 + ' dB' : 'off'], ['breathetime', 'breathe.time', v => (+v).toFixed(2) + ' s'],
  ['echomix', 'echo.mix', v => +v ? Math.round(v * 100) + '%' : 'off'], ['echofb', 'echo.feedback', v => Math.round(v * 100) + '%'],
  ['duckdepth', 'duck.depth', v => +v ? '−' + Math.round(-20 * Math.log10(1 - v) * 10) / 10 + ' dB' : 'off'], ['ducktime', 'duck.time', v => Math.round(v * 1000) + ' ms']
];
const SELECTS = [['top', 'voicing.top', Number], ['bassoct', 'voicing.bassOctave', Number], ['bassmode', 'voicing.bassMode', String],
  ['easing', 'timing.easing', String], ['mix', 'mix', String], ['tuning', 'tuning', String], ['order', 'motion.order', String], ['tone', 'sound.tone', String], ['meter', 'timing.meter', Number], ['duckunder', 'duck.under', String], ['echopan', 'echo.pingpong', v => v === 'true']];
(() => { const sel = $('top'); for (let m = 96; m >= 67; m--) { const o = document.createElement('option'); o.value = m; o.textContent = noteName(m); sel.appendChild(o); } })();

function syncUI() {
  $('name').value = piece.name;
  if (document.activeElement !== $('chords')) $('chords').value = piece.chords;
  if (typeof applyPartView === 'function') applyPartView(); // which part the tabs edit
  const pn = typeof selNorm === 'function' ? selNorm() : null, src = id => pn && PART_CTRL[id] && applies(id, pn) ? pn : piece;
  for (const [id, path, fmt] of SLIDERS) { const v = getPath(src(id), path); $(id).value = v; $('o-' + id).textContent = fmt(v); }
  { const self = pn ? pn.id : 'main', others = [['', 'Nothing']].concat([['main', 'Main']], (piece.parts || []).map(x => [x.id, x.name || x.id])).filter(([v]) => v !== self), dk = $('duckunder');
    if ([...dk.options].map(o => o.value + o.textContent).join() !== others.map(([v, t]) => v + t).join()) { dk.textContent = ''; for (const [v, t] of others) { const o = document.createElement('option'); o.value = v; o.textContent = t; dk.appendChild(o); } } }
  for (const [id, path] of SELECTS) $(id).value = String(getPath(src(id), path));
  { const e = getPath(src('echotime'), 'echo'), on = !!(e && e.mix > 0); $('echotime').value = on ? e.time : 'off';
    for (const id of ['echomix', 'echofb', 'echopan']) $(id).closest('.slider, .group').hidden = !on; } // the echo's level and repeats, once it's on
  $('mix').value = piece.mix === 'voices' ? 'voices' : 'parts'; $('tuning').value = piece.tuning === 'just' ? 'just' : 'equal'; // (neither saved at its default)
  { const bars = piece.timing.unit === 'bar'; $(bars ? 'tu-bar' : 'tu-sec').checked = true; $('row-chordsec').hidden = bars; $('row-chordbars').hidden = !bars; }
  for (const L of LAYERS) {
    if (document.activeElement !== $('seed-' + L)) $('seed-' + L).value = fmtSeed(piece.seeds[L]);
    const lk = piece.locks[L]; $('lock-' + L).setAttribute('aria-pressed', String(lk)); $('lock-' + L).textContent = lk ? 'Locked' : 'Unlocked';
    $('roll-' + L).disabled = lk;
    const chip = document.querySelector('.layerlock[data-layer="' + L + '"]');
    chip.setAttribute('aria-pressed', String(lk));
    chip.title = L[0].toUpperCase() + L.slice(1) + (lk ? ' is locked: rerolls keep it. Click to unlock.' : ' is unlocked: Reroll changes it. Click to lock.');
  }
  $('rerollall').disabled = LAYERS.every(L => piece.locks[L]);
  $('v-' + piece.view.mode).checked = true; $('l-' + piece.view.labels).checked = true;
  showVolume();
  updateStatus(); updateUndo(); if (typeof syncLook === 'function') syncLook();
  if (typeof syncVolumeShape === 'function') syncVolumeShape();
}

/* ---------- Build ---------- */
function rebuild(keepTime = true, restartAudio = true) {
  const { items, errors } = parseProgression(piece.chords);
  const msgs = [];
  if (errors.length) msgs.push(['error', 'Couldn\'t read ' + errors.slice(0, 4).join(', ') + (errors.length > 4 ? '…' : '') + '. Try spellings like Emaj9, C#m11, Amaj7/B or =G#6' + (errors.some(x => /^(=|->|→)|\[/.test(x)) ? '; notes go from C-1 to G9 (MIDI 0–127), cents included.' : '.')]);
  if (!items.length) { // nothing valid to play: drop the old build so nothing plays or exports a piece that isn't on screen
    msgs.push(['info', 'Add at least one chord to hear something.']); showErr(msgs);
    if (playing) { stopAudio(0.05); playing = false; setPlayIcon(); }
    built = null; marks = null; offset = 0; $('revoice').hidden = true; updateAvailability(); if (typeof showVideoEstimate === 'function') showVideoEstimate(); return;
  }
  const t = currentT();
  built = buildScore(isFrozen() ? builtFromRealization(piece.realization, piece) : buildPiece(items, piece), items); // the main part, then any others
  marks = zoomMarks(); syncZoomUI(); syncPlays();
  $('revoice').hidden = !isFrozen() && !frozenPads().length;
  if (isFrozen()) { // what a change would re-voice: only the main part; parts of written notes keep them
    const others = piece.parts || [], written = others.filter(x => x && x.preset === 'notes').length;
    const what = !others.length ? 'the piece' : 'the main part', keep = !written ? '' : written === others.length ? '; the other parts keep their written notes' : '; parts of written notes keep them';
    msgs.unshift(['info', (piece.realization.engine === 'custom' ? 'Playing the notes written into this piece, exactly as they are.' : 'Playing the notes saved by engine ' + piece.realization.engine + ', exactly as they were.') + ' Changing the chords, voicing or motion re-voices ' + what + ' with engine ' + ENGINE_VERSION + keep + '.']);
  }
  if (!isFrozen() && frozenPads().length) msgs.unshift(['info', 'Pad parts ' + frozenPads().map(x => x.name).join(', ') + ' play the notes saved by engine ' + frozenPads()[0].realization.engine + ', exactly as they were.']);
  if (built.cut && built.cut.length) msgs.push(['warning', 'Stopped ' + built.cut.join(', ') + ' at ' + LINE_LIMITS.notes.toLocaleString('en-US') + ' notes (' + LINE_LIMITS.total.toLocaleString('en-US') + ' for all lines together), the most a piece can have.']);
  if (built.warnings.length) msgs.push(['warning', 'The voicing rules couldn\'t place ' + built.warnings.join(', ') + ', so those chords use nearest notes.']);
  showErr(msgs);
  offset = keepTime ? Math.min(t, built.total + TAIL) : 0;
  screenCam.snap = true;
  if (playing && !recording && restartAudio) startAudio(offset);
  updateAvailability(); if (typeof showVideoEstimate === 'function') showVideoEstimate();
}
/* Playback and exports need a built piece; a piece file can always be saved (without notes if there are none) */
function updateAvailability() {
  if (built) $('midi-note').textContent = built.N > 15 ? 'one channel per voice (MPE), in ' + Math.ceil(built.N / 15) + ' files of up to 15 voices' : 'one channel per voice (MPE)';
  if (rendering || recording || exporting) return;
  const has = !!built, save = canSave();
  for (const id of ['play', 'restart', 'scrub']) $(id).disabled = !has;
  document.querySelectorAll('[data-export]').forEach(b => b.disabled = !save || (!has && b.dataset.export !== 'json'));
  $('xopen').disabled = !save || exporting;
  for (const id of ['vrender', 'vrecord']) $(id).disabled = !save || !has;
}
// saved notes play exactly as written when they come from another engine, or are marked "custom" (written by hand or by another program)
const isFrozen = () => !!(piece && piece.realization && piece.realization.engine !== ENGINE_VERSION && validRealization(piece.realization));
/* Normalize, and drop a saved realization from this same engine: the settings reproduce it exactly */
/* Normalize, and drop saved notes from this same engine (the main part's and pad parts'): the settings reproduce them exactly */
function prepPiece(p) {
  const q = normalizePiece(p);
  if (q.realization && q.realization.engine === ENGINE_VERSION) delete q.realization;
  for (const pt of q.parts || []) if (pt.realization && pt.preset === 'pad' && pt.realization.engine === ENGINE_VERSION) delete pt.realization;
  return q;
}
// pad parts playing notes saved by another engine
const frozenPads = () => (piece && piece.parts || []).filter(pt => pt.preset === 'pad' && pt.realization && pt.realization.engine !== ENGINE_VERSION && validRealization(pt.realization));
/* Back to this engine: the main part, and the pad parts, which follow the same chords and inherit its voicing settings */
function unfreeze() {
  let any = false;
  if (piece.realization) { delete piece.realization; any = true; }
  for (const pt of piece.parts || []) if (pt.realization && pt.preset === 'pad') { delete pt.realization; any = true; }
  if (any) setStatus('Re-voiced with engine ' + ENGINE_VERSION);
}
/* Notices under the chords, each [kind, text]: 'info' (how the piece works), 'warning' (something was limited or adjusted) or
   'error' (something couldn't be read, or there's nothing to play). A screen reader hears the kind first. */
function showErr(msgs) {
  const box = $('err'); box.textContent = ''; box.hidden = !msgs.length;
  for (const [kind, text] of msgs) { const p = document.createElement('p'); p.className = 'notice ' + kind;
    const k = document.createElement('span'); k.className = 'vh'; k.textContent = ({ info: 'Note: ', warning: 'Warning: ', error: 'Error: ' })[kind];
    p.append(k, text); box.appendChild(p); }
}
let rebuildTimer = null;
const rebuildSoon = () => { clearTimeout(rebuildTimer); rebuildTimer = setTimeout(() => rebuild(true), 180); };

/* ---------- History, draft, status ---------- */
function commit() {
  const s = JSON.stringify(piece);
  if (s === committed) return;
  if (committed !== null) { // up to 100 steps, and no more than about 40 million characters (big pieces of saved notes are megabytes each)
    undoStack.push(committed); let size = undoStack.reduce((a, x) => a + x.length, 0);
    while (undoStack.length > 100 || (undoStack.length > 3 && size > 4e7)) size -= undoStack.shift().length;
  }
  committed = s; redoStack = [];
  updateUndo(); updateStatus(); saveDraftSoon();
}
function applyPiece(p, { record = true, keepTime = false, fresh = false } = {}) {
  piece = prepPiece(p);
  syncUI(); rebuild(keepTime);
  if (fresh) { undoStack = []; redoStack = []; updateUndo(); } // a different piece: undo must not reach back into the previous one (and save over it)
  if (record && !fresh) commit(); else { committed = JSON.stringify(piece); updateStatus(); saveDraftSoon(); }
}
function undo() { if (!undoStack.length) return; redoStack.push(committed); const s = undoStack.pop(); committed = s; piece = normalizePiece(JSON.parse(s)); syncUI(); rebuild(true); saveDraftSoon(); }
function redo() { if (!redoStack.length) return; undoStack.push(committed); const s = redoStack.pop(); committed = s; piece = normalizePiece(JSON.parse(s)); syncUI(); rebuild(true); saveDraftSoon(); }
function updateUndo() { $('undo').disabled = !undoStack.length; $('redo').disabled = !redoStack.length; }
let draftTimer = null;
let draftInDb = false; // known once storage has been checked at start
const saveDraftNow = () => {
  clearTimeout(draftTimer); if (!piece) return;
  const d = { piece, libId: currentLibId, savedJSON };
  if (draftInDb) IDB.set('draft', JSON.parse(JSON.stringify(d))).catch(() => lsSet('cge.draft', JSON.stringify(d)));
  else lsSet('cge.draft', JSON.stringify(d));
};
async function loadDraft() {
  let d = null;
  if (await IDB.ready) { draftInDb = true; try { d = await IDB.get('draft'); } catch (e) { d = null; } }
  if (!d) { try { d = JSON.parse(lsGet('cge.draft') || 'null'); } catch (e) { d = null; } }
  if (draftInDb) try { localStorage.removeItem('cge.draft'); } catch (e) {} // from older versions; it now lives in the database
  return d;
}
function saveDraftSoon() { clearTimeout(draftTimer); draftTimer = setTimeout(saveDraftNow, 600); }
window.addEventListener('pagehide', saveDraftNow);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveDraftNow(); });
let statusNote = '', statusWarn = false;
let statusTimer = null;
/* Event messages fade after a few seconds (warnings stay a little longer), leaving just the save state */
function setStatus(msg, warn = false) {
  statusNote = msg; statusWarn = warn; updateStatus();
  clearTimeout(statusTimer);
  if (msg) statusTimer = setTimeout(() => { statusNote = ''; statusWarn = false; updateStatus(); }, warn ? 9000 : 4500);
}
function updateStatus() {
  const dirty = savedJSON === null ? (currentLibId ? false : true) : JSON.stringify(piece) !== savedJSON;
  const base = currentLibId ? (dirty ? 'Unsaved changes' : 'Saved') : 'Not saved yet';
  $('status').textContent = statusNote ? statusNote + ' · ' + base : base;
  const dot = $('savedot'); dot.className = 'savedot ' + (currentLibId ? (dirty ? 'dirty' : 'saved') : 'new'); dot.title = base; dot.setAttribute('aria-label', base);
  $('status').classList.toggle('warn', statusWarn);
}

/* ---------- Host ----------
   Chord Glide is a self-contained browser page: files download normally and the Library lives in this
   browser's storage. A page that embeds it may define window.CHORD_GLIDE_HOST before this script to send
   saved pieces and files somewhere else. Every field is optional:
     library()        resolves to a store { subscribe(onItems(items, live), onError), put(id|null, body) -> id, remove(id) }, or null
     libraryNote      Library caption when that store is in use; localLibraryNote when it isn't
     saver()          resolves to a function ({ filename, data }) -> Promise, or null; files of several types then go in one .zip
     saveHint         Export caption when the saver is in use
     mp3Encoder       URL of lame.min.js (default: the file beside this page); mp3Error: message if it fails to load
     aboutText        the About page's line about where this copy runs */
const HOST = (typeof window.CHORD_GLIDE_HOST === 'object' && window.CHORD_GLIDE_HOST) || null;

/* ---------- Library (this browser's storage, or the host's store) ---------- */
const lib = { mode: 'loading', items: [], store: null };
let confirmDelete = null;
async function initLibrary() {
  let store = null;
  try { if (HOST && typeof HOST.library === 'function') store = await HOST.library(); } catch (e) { store = null; }
  if (store) {
    try {
      lib.store = store;
      lib.mode = 'host';
      const timer = setTimeout(() => { $('lib-note').textContent = 'Your library is taking a while to load. Pieces will appear when it connects.'; }, 10000);
      store.subscribe((items, live) => {
        if (live) clearTimeout(timer);
        lib.items = items;
        renderLibrary();
      }, async err => { clearTimeout(timer); lib.mode = 'local'; await loadLocal(); renderLibrary(); setStatus('Library storage stopped responding; saving to this browser instead.', true); });
    } catch (e) { lib.mode = 'local'; await loadLocal(); }
  } else { lib.mode = 'local'; await loadLocal(); }
  renderLibrary();
}
let libInDb = false;
async function loadLocal() {
  let old = []; try { old = STORAGE_OK ? JSON.parse(lsGet('cge.library') || '[]') : []; } catch (e) { old = []; }
  if (await IDB.ready) {
    libInDb = true;
    try {
      let items = await IDB.all();
      // a library kept by an older version in localStorage moves into the database, then is removed from localStorage
      if (old.length) { const have = new Set(items.map(x => x.id)); for (const it of old) if (it && it.id && !have.has(it.id)) await IDB.put(it); items = await IDB.all(); try { localStorage.removeItem('cge.library'); } catch (e) {} }
      lib.items = items; return;
    } catch (e) { libInDb = false; }
  }
  if (!STORAGE_OK) { lib.mode = 'none'; lib.items = []; return; }
  lib.items = old;
}
/* Write the whole library to localStorage (the fallback) and read it back; throw if the browser didn't keep it */
function storeLocal(items) {
  const s = JSON.stringify(items);
  try { localStorage.setItem('cge.library', s); } catch (e) { throw Object.assign(new Error('storage'), { code: e && e.name === 'QuotaExceededError' ? 'quota_exceeded' : 'storage_unavailable' }); }
  if (localStorage.getItem('cge.library') !== s) throw Object.assign(new Error('storage'), { code: 'storage_unavailable' });
}
/* Keep one piece, or remove one; the in-memory library changes only once storage has kept the change */
async function putLocal(item) {
  if (libInDb) await IDB.put(item);
  else storeLocal(lib.items.some(x => x.id === item.id) ? lib.items.map(x => x.id === item.id ? item : x) : [...lib.items, item]);
  lib.items = lib.items.some(x => x.id === item.id) ? lib.items.map(x => x.id === item.id ? item : x) : [...lib.items, item];
}
async function removeLocal(id) {
  if (libInDb) await IDB.remove(id); else storeLocal(lib.items.filter(x => x.id !== id));
  lib.items = lib.items.filter(x => x.id !== id);
}
function renderLibrary() {
  $('lib-note').textContent = lib.mode === 'host' ? (HOST.libraryNote || 'Saved by the page that hosts Chord Glide.')
    : lib.mode === 'none' ? (location.protocol === 'file:'
      ? 'This browser won\'t keep saved pieces for a page opened straight from a file, so the library is off. Use Export → Piece file to save your work, and open it again from here. (Another browser, or serving the folder from a local web server, may allow the library.)'
      : 'This browser isn\'t keeping saved pieces for this page, so the library is off. Use Export → Piece file to save your work, and open it again from here.')
    : lib.mode === 'local' ? ((HOST && HOST.localLibraryNote) || 'Saved in this browser\'s storage on this computer. Export piece files to back them up or move them.') : 'Loading your library…';
  const ul = $('lib-list'); ul.textContent = '';
  const items = [...lib.items].sort((a, b) => String(b.modified).localeCompare(String(a.modified)));
  if (!items.length) { const li = document.createElement('li'); li.innerHTML = '<span class="hint">No saved pieces yet. Press Save to keep the one you\'re working on.</span>'; ul.appendChild(li); }
  for (const it of items) {
    const li = document.createElement('li'); if (it.id === currentLibId) li.className = 'current';
    const meta = document.createElement('div'); meta.className = 'meta';
    const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = it.name || 'Untitled piece';
    const dt = document.createElement('div'); dt.className = 'dt'; dt.textContent = it.modified ? new Date(it.modified).toLocaleString() : '';
    meta.append(nm, dt);
    const acts = document.createElement('div'); acts.className = 'acts';
    const open = document.createElement('button'); open.className = 'small'; open.type = 'button'; open.textContent = 'Open';
    open.onclick = () => openFromLibrary(it);
    const del = document.createElement('button'); del.className = 'small danger'; del.type = 'button';
    del.textContent = confirmDelete === it.id ? 'Confirm delete' : 'Delete';
    del.onclick = () => deleteFromLibrary(it);
    acts.append(open, del); li.append(meta, acts); ul.appendChild(li);
  }
}
/* What to say about the engine a piece came from */
function openNote(src) {
  if (isFrozen()) return piece.realization.engine === 'custom' ? ', playing the notes written into this piece' : ', playing the notes saved by engine ' + piece.realization.engine + '. Use “Re-voice with this engine” to update it';
  if (src && src.engine && src.engine !== ENGINE_VERSION) return ' (made with engine ' + src.engine + ' before notes were saved with pieces, so voicings may differ slightly)';
  return '';
}
function openFromLibrary(it) {
  let p;
  try { p = prepPiece(it.piece); } catch (e) { setStatus(e.message, true); return; }
  setPlaying(false);
  currentLibId = it.id;
  savedJSON = JSON.stringify(p);
  applyPiece(p, { fresh: true });
  setStatus('Opened “' + p.name + '”' + openNote(it.piece));
  renderLibrary();
}
async function deleteFromLibrary(it) {
  if (confirmDelete !== it.id) { confirmDelete = it.id; renderLibrary(); setTimeout(() => { if (confirmDelete === it.id) { confirmDelete = null; renderLibrary(); } }, 4000); return; }
  confirmDelete = null;
  try {
    if (lib.mode === 'host') await lib.store.remove(it.id);
    else await removeLocal(it.id);
    if (currentLibId === it.id) { currentLibId = null; savedJSON = null; }
    setStatus('Deleted “' + (it.name || 'Untitled piece') + '”'); renderLibrary();
  } catch (e) { setStatus('Couldn\'t delete that piece (' + (e && e.code || 'error') + ').', true); }
}
async function savePiece(asNew) {
  if (lib.mode === 'none') { setStatus('The library isn\'t available here. Use Export → Piece file to save your work.', true); return; }
  piece.name = safeName($('name').value);
  if (!piece.created) piece.created = new Date().toISOString();
  piece.modified = new Date().toISOString();
  const p = withRealization();
  const body = { name: p.name, modified: p.modified, piece: p };
  try {
    if (lib.mode === 'host') currentLibId = await lib.store.put(!asNew && currentLibId ? currentLibId : null, body);
    else { // nothing changes (not the library, not which piece this is) unless storage keeps it
      const id = asNew || !currentLibId || !lib.items.some(x => x.id === currentLibId) ? 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36) : currentLibId;
      await putLocal(Object.assign({ id }, body));
      currentLibId = id;
    }
    savedJSON = JSON.stringify(piece);
    committed = savedJSON;
    setStatus((asNew ? 'Saved a new copy: “' : 'Saved “') + p.name + '”' + (lib.mode === 'local' ? ' in this browser' : ''));
    renderLibrary(); saveDraftNow();
  } catch (e) {
    const c = e && e.code;
    setStatus(c === 'storage_unavailable' ? 'This browser didn\'t keep the save. Use Export → Piece file to save your work.' : c === 'quota_exceeded' ? 'Your library is full. Delete a piece and try again.' : c === 'invalid_argument' ? 'You can\'t save pieces in this view. Export a piece file instead.' : 'Couldn\'t save (' + (c || 'error') + ').', true);
  }
}

/* ---------- Seeds ---------- */
function reroll(layer) {
  if (piece.locks[layer]) return;
  if (layer !== 'sound') unfreeze();
  piece.seeds[layer] = randSeed();
  if (layer === 'harmony') piece.chords = composeFromSeed(piece.seeds.harmony, defaultChordSec(piece));
}
function afterChange({ keepTime = true } = {}) { syncUI(); rebuild(keepTime); commit(); }

/* ---------- Audio ---------- */
let volume = (() => { const v = parseFloat(lsGet('cge.volume')); return Number.isFinite(v) ? v : 0.6; })();
const irCache = new Map();
function impulse(ctx, seed) {
  const key = seed + ':' + ctx.sampleRate;
  if (irCache.has(key) && irCache.get(key).ctx === ctx) return irCache.get(key).buf;
  const r = mulberry32((seed ^ 0x3C6EF372) >>> 0);
  const len = Math.floor(ctx.sampleRate * 3.4), buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
  if (irCache.size >= 4) irCache.delete(irCache.keys().next().value);
  irCache.set(key, { ctx, buf });
  return buf;
}
/* One graph for live playback, recording and offline export */
const voiceLevel = (N, tone) => 1.5 / N * (TONE_GAIN[tone] || 1);
function periodicWave(ctx, tone) { const tw = toneWave(tone); return ctx.createPeriodicWave(Float32Array.from(tw.real), Float32Array.from(tw.imag)); }
/* Change tone while playing without rebuilding the sound: every voice keeps its glide, and only its waveform and level change.
   The voices dip for a few milliseconds around the swap so the change in waveform doesn't click. */
function swapToneLive(tone) {
  if (!live || !actx || live.tone === tone) return;
  const L = live, now = actx.currentTime, wave = periodicWave(actx, tone), level = voiceLevel(L.levelN, tone) * (L.headroom || 1);
  L.tone = tone;
  const oscs = L.oscs.slice(0, L.mainN), gains = L.gains.slice(0, L.mainN); // the Sound tab is the main part's; other parts keep their own tones
  gains.forEach(g => { g.gain.cancelScheduledValues(now); g.gain.setTargetAtTime(0, now, 0.004); });
  setTimeout(() => {
    if (live !== L) return; // stopped or restarted meanwhile: the new graph already has the new tone
    const t = actx.currentTime;
    oscs.forEach(o => { try { o.setPeriodicWave(wave); } catch (e) {} });
    gains.forEach(g => { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(level, t, 0.006); });
  }, 20);
}
// the soft clip's curve, for a signal halved on the way in (the curve's −1…1 is −2…2): straight up to −3 dBFS, then a tanh
// shoulder that approaches full scale but never reaches it
let clipCurve = null;
function softClipCurve() {
  if (clipCurve) return clipCurve;
  const n = 8193, k = Math.pow(10, -3 / 20), c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 4 - 2, a = Math.abs(x); c[i] = Math.sign(x) * (a <= k ? a : k + (1 - k) * Math.tanh((a - k) / (1 - k))); }
  return (clipCurve = c);
}
/* A part's echo: its sound again ECHO_BEATS[time] beats later, at `mix`, each repeat `feedback` of the one before and a little
   darker; with pingpong the repeats alternate hard left and right (left first). Delays are capped at 4 seconds. */
function addEcho(ctx, inp, out, ec, beat) {
  // (panning a repeat hard to one side folds both channels into it, 1.8 dB more in all than a repeat in place: 0.81 evens that out)
  const dt = Math.min(4, ECHO_BEATS[ec.time] * beat), send = ctx.createGain(); send.gain.value = ec.mix * (ec.pingpong ? 0.81 : 1); inp.connect(send);
  const tap = panTo => { const d = ctx.createDelay(4.5); d.delayTime.value = dt; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 5000; f.Q.value = 0.3; d.connect(f);
    let o = f; if (panTo !== null && ctx.createStereoPanner) { o = ctx.createStereoPanner(); o.pan.value = panTo; f.connect(o); } o.connect(out); const fb = ctx.createGain(); fb.gain.value = ec.feedback; f.connect(fb); return { d, fb }; };
  if (ec.pingpong) { const L = tap(-0.8), R = tap(0.8); send.connect(L.d); L.fb.connect(R.d); R.fb.connect(L.d); }
  else { const C = tap(null); send.connect(C.d); C.fb.connect(C.d); }
}
function buildGraph(ctx, b, from, outs, level, offline, lead = 0.08) {
  const P = b.piece, S = P.sound, N = b.N, T = b.total;
  const span = Math.max(0.05, T - from);
  const master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
  const bus = ctx.createGain(), held = ctx.createGain(); held.connect(bus); // held: voices that sound throughout, which the closing fade ends
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = S.brightness; lp.Q.value = 0.3;
  const wetAmt = S.reverb / 100;
  const dry = ctx.createGain(); dry.gain.value = 1 - wetAmt * 0.35;
  const wet = ctx.createGain(); wet.gain.value = wetAmt;
  const conv = ctx.createConvolver(); conv.buffer = impulse(ctx, P.seeds.sound);
  bus.connect(lp); lp.connect(dry); lp.connect(conv); conv.connect(wet);
  dry.connect(comp); wet.connect(comp); comp.connect(master);
  for (const o of outs) master.connect(o);
  /* Every part's voices. The main part's come first and draw their detune and pan from the same random sequence as before,
     so a piece without other parts sounds exactly as it did; each other part has its own sequence (from its id), its own
     tone, level (dB), pan and width, and, if its voices rest, an envelope on each voice and an optional vibrato. Each part is
     balanced by its own voice count, so a part at 0 dB is about as loud as the main part. */
  const waves = new Map(), waveOf = tone => { if (!waves.has(tone)) waves.set(tone, periodicWave(ctx, tone)); return waves.get(tone); };
  /* Balance 'voices' (as one sound): every voice of every part at the same level, as if the piece were one part of all its voices, so a
     part of six voices is six times as strong as a part of one; each part's level is then a change from that. */
  const equal = P.mix === 'voices';
  const silent = pt => !!(pt.sub.gates && pt.sub.gates.every(g => g && !g.length)); // a part that plays in no section
  const eqN = b.parts.reduce((a, pt) => a + (silent(pt) ? 0 : pt.sub.N), 0) || 1; // the voices that sound
  const parts = b.parts, levelN = equal ? eqN : parts[0].sub.N; // the main part's level, exactly as before (balanced by part)
  const oscs = [], gains = [], moves = [], envs = [], vibs = [], lfos = [];
  const hasBass = P.voicing.bassMode !== 'none';
  /* With other parts, the mix is given headroom: every voice is scaled by one over the sum of the parts' levels (as amplitudes;
     the main part counts as 1), so the parts' peaks can line up without clipping, and a part at −60 dB changes nothing. Measured:
     Three Parts plays about as loud as a one-part piece, with its peaks as rarely near full scale. Then a
     soft clip catches what's left: untouched below −3 dBFS, rounded off above it, never past full scale. (The browser's own
     compressor isn't used as a limiter: it adds make-up gain, and reacts too slowly to catch every peak.) A piece with only
     its main part has neither, so it plays exactly as before. */
  const multi = parts.length > 1;
  const headroom = !multi ? 1 : 1 / (parts.reduce((a, pt) => a + (silent(pt) ? 0 : (equal ? pt.sub.N / eqN : 1) * Math.pow(10, (pt.main ? 0 : pt.sound.level) / 20)), 0) || 1);
  for (const pt of parts) {
    const snd = pt.main ? S : pt.sound;
    // its echo, if it has one: the part's voices reach each destination through one input that also feeds the echo
    const ec = pt.main ? P.echo : pt.echo, vias = new Map();
    const via = to => { if (!ec || !(ec.mix > 0)) return to; if (!vias.has(to)) { const inp = ctx.createGain(); inp.connect(to); addEcho(ctx, inp, to, ec, 60 / P.timing.tempo); vias.set(to, inp); } return vias.get(to); };
    const r = mulberry32(pt.main ? (P.seeds.sound ^ 0xA5A5A5A5) >>> 0 : partSeed(P.seeds.sound, pt.id, 'voices'));
    // each part balanced by its own voice count, then its level: adding a part (or doubling a line) leaves the others as they are
    const lvl = voiceLevel(equal ? eqN : pt.sub.N, snd.tone) * (pt.main ? 1 : Math.pow(10, snd.level / 20)) * headroom;
    let lfo = null;
    if (pt.sub.vibrato) { lfo = ctx.createOscillator(); lfo.frequency.value = pt.sub.vibrato.rate; lfos.push(lfo); }
    for (let lv = 0; lv < pt.sub.N; lv++) {
      const v = pt.first + lv, dz = r() * 2 - 1, pz = r() * 2 - 1;
      const osc = ctx.createOscillator(); osc.setPeriodicWave(waveOf(snd.tone));
      osc.detune.value = dz * snd.detune;
      const mv = pitchMoves(b, v, from); // the glides themselves, so accuracy never depends on the piece's length
      osc.frequency.value = hz(mv[0].p); // set before the clock is read below, so it can never land inside a glide
      const g = ctx.createGain(); g.gain.value = lvl;
      const em = gainMoves(b, v, from); // a voice that rests: its envelope
      let env = null;
      if (em) { env = ctx.createGain(); env.gain.value = em[0].g; osc.connect(env); env.connect(g); } else osc.connect(g);
      const vm = lfo ? vibratoMoves(b, v, from) : null;
      let depth = null;
      if (vm) { depth = ctx.createGain(); depth.gain.value = vm.moves[0].g; lfo.connect(depth); depth.connect(osc.detune); }
      const pan = pt.main ? ((hasBass && lv === 0) ? 0 : pz * (S.width / 100)) : Math.max(-1, Math.min(1, snd.pan + pz * (snd.width / 100) * (1 - Math.abs(snd.pan))));
      const to = em && !pt.sub.held && !(pt.sub.heldV && pt.sub.heldV[lv]) ? bus : held; // a voice that sounds throughout fades with the piece (also one gated to sections, or an echo's that enters late); one with notes ends by its own envelope
      if (ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); pn.pan.value = pan; g.connect(pn); pn.connect(via(to)); }
      else g.connect(via(to));
      oscs.push(osc); gains.push(g); moves.push(mv); envs.push(env ? { p: env.gain, m: em } : null); vibs.push(depth ? { p: depth.gain, m: vm.moves } : null);
    }
  }
  // the volume shape over the piece, if it has one (straight lines in dB)
  let shape = null;
  if (P.volume && P.volume.length) { shape = ctx.createGain(); master.disconnect(); master.connect(shape); for (const o of outs) shape.connect(o); }
  if (multi) { // the soft clip: last, after the volume shape
    // the shaper's curve spans inputs from −1 to 1, so the signal is halved going in: the curve covers −2 to 2 (up to +6 dBFS).
    // No oversampling: its smoothing filter can itself overshoot full scale.
    const half = ctx.createGain(); half.gain.value = 0.5;
    const clip = ctx.createWaveShaper(); clip.curve = softClipCurve(); clip.oversample = 'none';
    const last = shape || master; last.disconnect(); last.connect(half); half.connect(clip); for (const o of outs) clip.connect(o);
  }
  /* Read the clock only now, after the slow work above (reverb, pitch curves), and schedule everything against it.
     If the clock were read first and the work ran past the lead time, each glide would be scheduled to start in the
     past; Chrome then plays it late, or holds the voice at the start pitch set above, so the sound drifts from the picture. */
  const now = offline ? 0 : ctx.currentTime + lead;
  /* Fade in, hold, then the closing fade (FADE). In a piece whose voices all sound throughout, the fade is on the master, after
     the compressor, exactly as it always was. In a piece with lines or saved notes (voices that rest), it's on the voices that
     sound throughout (`held`) instead, so a line's last notes ring out by their own release while the held chord fades; the
     master then just fades in and carries the volume. Started inside the fade (from past the end), pick it up where it is. */
  const M = b.musicEnd !== undefined ? b.musicEnd : T; // the music's end: the fade starts here even when a long release lengthens the piece
  const into = Math.max(0, from - M), fadeLeft = Math.max(0.05, FADE - into), left = Math.max(0, 1 - into / FADE), top = level * left;
  const attack = into > 0 ? Math.min(0.05, fadeLeft / 2) : from > 0 ? 0.15 : 0.4, hold = Math.max(Math.max(0.05, M - from), attack);
  const fadeOnMaster = !envs.some(x => x);
  if (fadeOnMaster) {
    master.gain.setValueAtTime(0, now); master.gain.linearRampToValueAtTime(top, now + attack);
    master.gain.setValueAtTime(top, now + hold); master.gain.linearRampToValueAtTime(0, now + hold + fadeLeft);
  } else {
    master.gain.setValueAtTime(0, now); master.gain.linearRampToValueAtTime(level, now + attack);
    held.gain.setValueAtTime(left, now); held.gain.setValueAtTime(left, now + hold); held.gain.linearRampToValueAtTime(0, now + hold + fadeLeft);
  }
  /* Schedule in two passes: every voice's first second, then the rest. A long piece can need tens of thousands of moves;
     this way only the first pass has to fit inside the lead time, and the rest has a whole second to be scheduled. */
  const at = t => now + (t - from), soon = from + 1, done = new Array(N).fill(0), doneE = new Array(N).fill(0), doneV = new Array(N).fill(0);
  // straight-line moves for a gain: the first sets the value, the rest ramp to theirs
  const lines = (L, k, until) => { for (; k < L.m.length && L.m[k].t < until; k++) { const m = L.m[k]; if (k === 0 || m.t <= L.m[k - 1].t) L.p.setValueAtTime(m.g, at(m.t)); else L.p.linearRampToValueAtTime(m.g, at(m.t)); } return k; };
  const schedule = (v, until) => {
    const f = oscs[v].frequency, mv = moves[v]; let k = done[v];
    for (; k < mv.length && mv[k].t < until; k++) {
      const m = mv[k];
      if (m.kind === 'set') f.setValueAtTime(hz(m.p), at(m.t));
      else if (m.kind === 'ramp') f.exponentialRampToValueAtTime(hz(m.p), at(m.t)); // linear in pitch
      else { // a curve ends a hair early, so rounding never makes it overlap the move after it (which throws, and stops the voice there)
        const s = at(m.t), nx = mv[k + 1], d = Math.min(m.d, nx ? at(nx.t) - s : m.d) - 1e-6;
        if (d > 1e-4) f.setValueCurveAtTime(Float32Array.from(m.ps, hz), s, d); else f.setValueAtTime(hz(m.ps[m.ps.length - 1]), s);
      }
    }
    done[v] = k;
    if (envs[v]) doneE[v] = lines(envs[v], doneE[v], until);
    if (vibs[v]) doneV[v] = lines(vibs[v], doneV[v], until);
  };
  oscs.forEach((osc, v) => { schedule(v, soon); osc.start(now); osc.stop(now + span + TAIL); });
  lfos.forEach(o => { o.start(now); o.stop(now + span + TAIL); });
  if (shape) { // the volume shape, straight lines in dB from where it stands at `from`
    const dbg = db => Math.pow(10, db / 20);
    shape.gain.setValueAtTime(dbg(volumeAt(P, from)), now);
    for (const x of P.volume) if (x.t > from) shape.gain.exponentialRampToValueAtTime(dbg(x.db), at(x.t));
  }
  oscs.forEach((osc, v) => schedule(v, Infinity));
  return { master, oscs, gains, lfos, now, tone: S.tone, mainN: parts[0].sub.N, levelN, headroom, fadeOnMaster };
}
function ensureCtx() { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); return actx; }
function stopAudio(fade = 0.2) {
  if (!live || !actx) return;
  const now = actx.currentTime, g = live.master.gain;
  if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(now); else { g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); }
  g.linearRampToValueAtTime(0, now + fade);
  const L = live; [...L.oscs, ...(L.lfos || [])].forEach(o => { try { o.stop(now + fade + 0.05); } catch (e) {} });
  setTimeout(() => { try { L.master.disconnect(); } catch (e) {} }, (fade + 0.3) * 1000);
  live = null;
}
function startAudio(from, extraOut, lead) {
  ensureCtx(); stopAudio(0.06);
  if (from >= built.total + TAIL - 0.05) from = 0; // at the very end, start over; inside the closing fade, play the rest of it
  live = buildGraph(actx, built, from, extraOut ? [actx.destination, extraOut] : [actx.destination], volume, false, lead);
  startAt = live.now - from;
}
function currentT() { return playing && actx && live ? Math.max(0, actx.currentTime - startAt) : offset; }
function setPlayIcon() { const b = $('play'); b.classList.toggle('playing', playing); b.setAttribute('aria-label', playing ? 'Pause' : 'Play'); b.title = (playing ? 'Pause' : 'Play') + ' (Space)'; }
function setPlaying(on) {
  if (on === playing || !built) return;
  if (on) { if (offset >= built.total + TAIL - 0.05) offset = 0; startAudio(offset); playing = true; }
  else { offset = Math.min(currentT(), built.total + TAIL); stopAudio(); playing = false; }
  setPlayIcon();
}

/* ---------- Drawing ---------- */
const cv = $('cv'), g2 = cv.getContext('2d');
let colors = {}, colorTick = 0, dpr = 1;
const liveColors = () => colors;
function readColors() {
  const cs = getComputedStyle(document.documentElement), v = k => cs.getPropertyValue(k).trim();
  colors = { stage: v('--stage'), ink: v('--ink'), muted: v('--muted'), accent: v('--accent'), rule: v('--rule'), data: v('--font-data'), display: v('--font-display') };
}
function fit() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = cv.getBoundingClientRect();
  const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
  if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; }
}
new ResizeObserver(fit).observe(cv);
/* When auto zoom zooms in and out: the piece's own times if it has them (view.zoom, set on the Export tab), else the
   automatic ones (landmarks()) */
function zoomMarks() { return piece.view.zoom ? Object.assign({}, piece.view.zoom) : landmarks(built); }
// times as m:ss.s, and back (also plain seconds)
const fmtZoom = s => { const m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1); };
function parseZoom(text) { const m = String(text).trim().match(/^(?:(\d+):)?(\d+(?:\.\d*)?|\.\d+)$/); return m ? (m[1] ? +m[1] * 60 : 0) + parseFloat(m[2]) : NaN; }
const ZOOM_KEYS = ['inStart', 'inEnd', 'outStart', 'outEnd'], ZOOM_IDS = ['zin0', 'zin1', 'zout0', 'zout1'];
function syncZoomUI() {
  if (!$('vzoom')) return;
  const custom = !!(piece && piece.view.zoom), L = built ? zoomMarks() : null;
  $('vzoom').value = custom ? 'custom' : 'auto'; $('vzoom-times').hidden = !custom;
  ZOOM_IDS.forEach((id, i) => { if (document.activeElement !== $(id)) $(id).value = L ? fmtZoom(L[ZOOM_KEYS[i]]) : ''; });
  $('vzoom-hint').textContent = !L ? '' : (custom ? 'This piece zooms in and out at these times in Auto view, on the stage and in videos. Times are m:ss or seconds; Now takes the playhead.'
    : 'Auto view zooms in ' + fmtZoom(L.inStart) + '–' + fmtZoom(L.inEnd) + ' and out ' + fmtZoom(L.outStart) + '–' + fmtZoom(L.outEnd) + '. Choose Custom times to set your own. Fast movement sets how a voice moving faster than the zoomed-out picture can show is drawn; zoomed in, every move is drawn.');
}
function setZoom(next) { piece.view.zoom = next; marks = zoomMarks(); screenCam.snap = true; syncZoomUI(); commit(); }
function cameraZ(t, S = null) {
  const m = (S ? S.piece : piece).view.mode;
  if (m === 'scroll') return 1;
  if (m === 'whole') return 0;
  const e = x => x * x * (3 - 2 * x), L = S ? S.marks : marks;
  const a = L.inEnd > L.inStart ? clamp01((t - L.inStart) / (L.inEnd - L.inStart)) : (t >= L.inEnd ? 1 : 0);
  const b = L.outEnd - L.outStart > 0.3 ? clamp01((t - L.outStart) / (L.outEnd - L.outStart)) : 0;
  return e(a) * (1 - e(b));
}
function pitchLabel(p, S = null) {
  if ((S ? S.piece : piece).view.labels === 'hz') return hz(p).toFixed(2) + ' Hz';
  const r = Math.round(p), c = Math.round((p - r) * 100);
  return noteName(r) + (Math.abs(c) >= 3 ? (c > 0 ? ' +' : ' −') + Math.abs(c) + '¢' : '');
}
/* ---------- Trace looks ---------- */
const TRACE_LOOKS = {
  theme:     { name: 'Match interface' },
  phosphor:  { name: 'Phosphor', bg: '#010805', glow: '#22ff7a', core: '#e2ffec', text: '#86ffb8', accent: '#22ff7a' },
  laserred:  { name: 'Laser red', bg: '#070102', glow: '#ff1f36', core: '#ffe8ea', text: '#ff8590', accent: '#ff1f36' },
  laserblue: { name: 'Laser blue', bg: '#01040c', glow: '#2b8cff', core: '#e8f4ff', text: '#86bcff', accent: '#2b8cff' },
  amber:     { name: 'Amber CRT', bg: '#080400', glow: '#ffa01a', core: '#fff3d9', text: '#ffc670', accent: '#ffa01a' },
  aurora:    { name: 'Aurora', bg: '#03060c', stops: ['#00e2a2', '#19c6ff', '#8b6cff', '#ff5ccf'], core: '#ffffff', text: '#a6deff', accent: '#19c6ff' },
  spectrum:  { name: 'Spectrum', bg: '#050507', hue: true, core: '#ffffff', text: '#d4d4e6', accent: '#ffffff' },
  neon:      { name: 'Neon', bg: '#08020e', alt: ['#00f0ff', '#ff2bd6'], core: '#ffffff', text: '#eaa8ff', accent: '#ff2bd6' },
  custom:    { name: 'Custom' }
};
const hexLum = h => { const n = parseInt(h.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const mixHex = (a, b, t) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return '#' + A.map((x, i) => Math.round(x + (B[i] - x) * t).toString(16).padStart(2, '0')).join(''); };
const hslHex = c => { const m = /^hsl\((\d+(?:\.\d+)?),\s*(\d+)%,\s*(\d+)%\)$/.exec(String(c).trim()); if (!m) return null; const h = +m[1] / 360, s2 = +m[2] / 100, l = +m[3] / 100; const f = n => { const k = (n + h * 12) % 12, a = s2 * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }; return '#' + [f(0), f(8), f(4)].map(x => x.toString(16).padStart(2, '0')).join(''); };
const cssHex = c => { const m = /^#([0-9a-f]{6})$/i.exec(String(c).trim()); if (m) return '#' + m[1].toLowerCase(); const s = /^#([0-9a-f]{3})$/i.exec(String(c).trim()); return s ? '#' + s[1].split('').map(x => x + x).join('').toLowerCase() : null; };
/* Resolve a piece's trace look into concrete drawing colors */
function tracePalette(tr, colors = liveColors()) {
  const L = TRACE_LOOKS[tr.look] || TRACE_LOOKS.theme, glow = tr.glow / 100, weight = tr.weight;
  if (tr.look === 'theme') {
    const bg = cssHex(colors.stage) || '#fcfdfb', dark = hexLum(bg) < 0.2;
    return { bg, dark, glow: dark ? glow * 0.6 : 0, weight, text: colors.muted, title: colors.ink, accent: colors.accent, line: () => colors.ink, core: null, vignette: false };
  }
  if (tr.look === 'custom') {
    const c = tr.custom, dark = hexLum(c.bg) < 0.2, two = c.line2 !== c.line;
    return { bg: c.bg, dark, glow: dark ? glow : 0, weight, text: mixHex(c.line, dark ? '#ffffff' : '#000000', 0.25), title: mixHex(c.line, dark ? '#ffffff' : '#000000', 0.55),
      accent: c.line, stops: two ? [c.line, c.line2] : null, line: () => c.line, core: dark ? mixHex(c.line, '#ffffff', 0.85) : null, vignette: dark };
  }
  return { bg: L.bg, dark: true, glow, weight, text: L.text, title: L.core || '#ffffff', accent: L.accent, stops: L.stops || null, vignette: true, core: L.core,
    line: (v, N) => L.hue ? `hsl(${Math.round(190 + 300 * v / Math.max(1, N - 1)) % 360}, 100%, 62%)` : L.alt ? L.alt[v % L.alt.length] : L.glow };
}
/* Stroke one path with a glow: wide faint passes, then the colored line, then a hot core */
function glowStroke(g, path, color, core, pal, d, fade) {
  const w = pal.weight * d;
  if (pal.dark && pal.glow > 0) {
    g.globalCompositeOperation = 'lighter';
    for (const [k, a] of [[13, 0.035], [7, 0.085], [3.4, 0.24]]) { g.strokeStyle = color; g.lineWidth = k * w; g.globalAlpha = a * pal.glow * fade; g.stroke(path); }
    g.strokeStyle = color; g.lineWidth = 1.9 * w; g.globalAlpha = 0.95 * fade; g.stroke(path);
    if (core) { g.strokeStyle = core; g.lineWidth = 0.8 * w; g.globalAlpha = (0.5 + 0.4 * pal.glow) * fade; g.stroke(path); }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  } else {
    g.strokeStyle = color; g.lineWidth = 2.1 * w; g.globalAlpha = fade; g.stroke(path); g.globalAlpha = 1;
  }
}
const bgCache = new Map(); // backgrounds only change with the look and the canvas size, so draw each one once
/* Where a video's title and artist go: the title fitted to the width (one line at 66, or two from 50), the artist below it at
   about 58% of the title's size (15–20 units, shortened if it must be), and the top of the trace pushed down to make room */
function videoTitleLayout(g, S, W, d) {
  const family = (S.colors && S.colors.display) || 'sans-serif', maxW = W - 100 * d;
  const tf = fitTitle(g, S.piece.name, maxW, d, family);
  const baselines = tf.lines.length === 1 ? [66 * d] : tf.lines.map((_, i) => 50 * d + i * tf.size * 1.12);
  let y0 = 110 * d, artist = '', artistSize = 0, artistBaseline = 0;
  if (S.artist) {
    artistSize = Math.max(15 * d, Math.min(20 * d, tf.size * 0.58));
    g.font = `500 ${artistSize}px ${family}`;
    if (g.measureText(S.artist).width > maxW * 0.9) artistSize = Math.max(13 * d, artistSize * maxW * 0.9 / g.measureText(S.artist).width);
    g.font = `500 ${artistSize}px ${family}`; artist = S.artist;
    while (artist.length > 1 && g.measureText(artist).width > maxW * 0.9) artist = artist.slice(0, -2).trimEnd() + '…';
    artistBaseline = baselines[baselines.length - 1] + artistSize * 1.5;
    y0 = Math.max(y0, artistBaseline + 24 * d);
  }
  return { size: tf.size, lines: tf.lines, baselines, artist, artistSize, artistBaseline, y0 };
}
/* The artist line for videos: the name from Settings, if there is one and "Artist name under the title" is ticked */
const videoArtist = () => ($('vartist') && $('vartist').checked) ? artistName() : '';
/* The next event worth naming: skips same-name snapshots less than 0.2 s apart (pieces saved as dense snapshots of every voice),
   so they say what's actually coming. Real chords are never that close, so a repeated chord is still shown. */
function nextEvent(b, idx) {
  const ev = b.events, name = ev[idx].label;
  for (let j = idx + 1; j < ev.length; j++) if (ev[j].label !== name || ev[j].t - ev[j - 1].t >= 0.2) return ev[j];
  return null;
}
/* Lay out a video title in about 90% of maxW (leaving air on the right): 34 units if it fits, down to 26 on one line, else two
   lines (26 down to 20) split where they balance, never starting a line with a dash or colon. One long word shrinks to 20,
   and only then is shortened with an ellipsis. */
function fitTitle(g, text, maxW, d, family) {
  maxW *= 0.9;
  const width = (str, size) => { g.font = `700 ${size}px ${family}`; return g.measureText(str).width; };
  const w34 = width(text, 34 * d);
  if (w34 <= maxW) return { size: 34 * d, lines: [text] };
  if (w34 * 26 / 34 <= maxW) return { size: 34 * d * maxW / w34, lines: [text] };
  const words = text.split(' ').filter(Boolean).reduce((a, w) => { if (a.length && /^[—–\-:|·/]+$/.test(w)) a[a.length - 1] += ' ' + w; else a.push(w); return a; }, []);
  if (words.length > 1) {
    let best = null;
    for (let k = 1; k < words.length; k++) {
      const a = words.slice(0, k).join(' '), b = words.slice(k).join(' '), w = Math.max(width(a, 26 * d), width(b, 26 * d));
      if (!best || w < best.w) best = { w, lines: [a, b] };
    }
    const size = Math.max(20 * d, Math.min(26 * d, 26 * d * maxW / best.w));
    if (best.w * size / (26 * d) <= maxW) return { size, lines: best.lines };
    if (w34 * 20 / 34 > maxW) return { size: 20 * d, lines: best.lines.map(l => shorten(l)) }; // two lines, the too-long one shortened
  }
  if (w34 * 20 / 34 <= maxW) return { size: 34 * d * maxW / w34, lines: [text] };
  return { size: 20 * d, lines: [shorten(text)] };
  function shorten(str) { if (width(str, 20 * d) <= maxW) return str; let t = str; while (t.length > 1 && width(t + '…', 20 * d) > maxW) t = t.slice(0, -1); return t.trimEnd() + '…'; }
}
/* Paint the background over everything right of xa, see-through at xa and solid from xb: what's drawn there fades out to the
   right. Done in thin strips of rising opacity, which needs no extra full-size layer (about 6 ms on a 70 ms software-rendered 1080p frame). */
function fadeToBackground(g, W, H, pal, xa, xb) {
  if (xa >= W) return;
  const bg = backgroundCanvas(W, H, pal);
  const strip = (x0, x1, a) => { x0 = Math.max(0, x0); x1 = Math.min(W, x1); if (x1 <= x0 || a <= 0) return; g.globalAlpha = a;
    if (bg) g.drawImage(bg, x0, 0, x1 - x0, H, x0, 0, x1 - x0, H); else { g.fillStyle = pal.bg; g.fillRect(x0, 0, x1 - x0, H); } };
  const n = Math.max(1, Math.min(48, Math.round((xb - xa) / 3)));
  let prev = Math.round(xa);
  for (let i = 0; i < n; i++) { const next = Math.round(xa + (xb - xa) * (i + 1) / n); strip(prev, next, (i + 0.5) / n); prev = next; }
  strip(Math.max(prev, Math.round(xb)), W, 1);
  g.globalAlpha = 1;
}
function paintBackground(g, W, H, pal) {
  const c = backgroundCanvas(W, H, pal);
  if (c) g.drawImage(c, 0, 0); else { g.fillStyle = pal.bg; g.fillRect(0, 0, W, H); }
}
/* The background with its faint vignette, drawn once per look and size (null for a flat background) */
function backgroundCanvas(W, H, pal) {
  if (!(pal.vignette && pal.glow > 0)) return null;
  const key = W + 'x' + H + pal.bg + pal.accent + pal.glow;
  let c = bgCache.get(key);
  if (!c) {
    c = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H });
    const b = c.getContext('2d');
    b.fillStyle = pal.bg; b.fillRect(0, 0, W, H);
    const r = b.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7); // faint screen glow toward the middle
    r.addColorStop(0, pal.accent); r.addColorStop(1, pal.bg);
    b.globalAlpha = 0.09 * pal.glow; b.fillStyle = r; b.fillRect(0, 0, W, H);
    if (bgCache.size > 6) bgCache.delete(bgCache.keys().next().value);
    bgCache.set(key, c);
  }
  return c;
}
/* Colors tied to pitch (not screen position), so they stay put while the view zooms */
function pitchGradient(g, pal, Y) {
  const grad = g.createLinearGradient(0, Y(40), 0, Y(88)); // E2 to E6
  pal.stops.forEach((c, i) => grad.addColorStop(i / (pal.stops.length - 1), c));
  return grad;
}

/* Shared by the screen and the video recorder. S: an optional snapshot { built, piece, marks, colors } to draw instead of the
   live piece, so a video render keeps drawing exactly what it started with whatever happens in the editor meanwhile. */
/* Each voice's line as drawn, in piece time. Its pitch comes from pitchMoves() (exact: holds, jumps and linear glides as they
   are, eased glides at 120 points a second), from a minute before the start to the end of the closing tail, and it's cut into
   runs where the voice sounds (its gain is 0.02 or more), with the edges of each run found exactly. Each run is a flat list
   [t, p, t, p, …]. Levels of detail are made when first asked for: at level L, the piece is cut into cells of LINE_CELL·2^L
   seconds, and each cell keeps its first, lowest, highest and last points, so nothing within a cell is lost from sight
   (a short note still shows) and the result never depends on where a frame happens to be. Kept per built score. */
const LINE_CELL = 1 / 1024, LINE_LEVELS = 30, LINE_QUIET = 0.02, lineCache = new WeakMap();
function voiceLines(b) {
  let c = lineCache.get(b);
  if (!c) { c = { runs: [], levels: [], make: v => makeRuns(b, v) }; lineCache.set(b, c); }
  return c;
}
// one voice's lines at a level of detail, drawn in a style for busy movement ('range', 'middle' or 'every'): { runs, bands }
function linesAt(c, v, level, style = 'range') {
  if (!c.levels[v]) c.levels[v] = new Map();
  const key = style + level; let r = c.levels[v].get(key);
  if (!r) { r = { runs: [], bands: [] }; for (const run of (c.runs[v] || (c.runs[v] = c.make(v)))) { const t = thinRun(run, LINE_CELL * Math.pow(2, level), style); r.runs.push(...t.lines); r.bands.push(...t.bands); } c.levels[v].set(key, r); }
  return r;
}
function makeRuns(b, v) {
  const E = b.total + TAIL, P = []; // the pitch line: flat [t, p, …], times never going back
  const add = (t, p) => { const n = P.length;
    if (n) { if (t < P[n - 2]) t = P[n - 2]; if (t === P[n - 2] && p === P[n - 1]) return; }
    // a point on the straight line through the two before it adds nothing (saved notes repeat a held pitch many times a second)
    if (n >= 4) { const t0 = P[n - 4], p0 = P[n - 3], t1 = P[n - 2], p1 = P[n - 1];
      if (t1 > t0 && t > t1 && Math.abs(p0 + (p - p0) * (t1 - t0) / (t - t0) - p1) < 1e-6) { P[n - 2] = t; P[n - 1] = p; return; } }
    P.push(t, p); };
  const moves = pitchMoves(b, v, 0, 120), last = () => P[P.length - 1];
  add(-60, moves[0].p);
  for (const m of moves) {
    if (m.kind === 'set') { add(m.t, last()); add(m.t, m.p); }
    else if (m.kind === 'ramp') add(m.t, m.p);
    else { add(m.t, last()); const n = m.ps.length; m.ps.forEach((p, k) => add(m.t + m.d * k / (n - 1), p)); }
  }
  add(Math.max(E, P[P.length - 2]), last());
  addVibrato(P, vibratoMoves(b, v, 0));
  // where the voice sounds
  const gm = gainMoves(b, v, 0), spans = [];
  if (!gm) spans.push([-Infinity, Infinity]);
  else {
    let on = gm[0].g >= LINE_QUIET ? -Infinity : null;
    for (let i = 1; i < gm.length; i++) {
      const a = gm[i - 1], q = gm[i], ua = a.g >= LINE_QUIET, uq = q.g >= LINE_QUIET;
      if (ua === uq) continue;
      const x = q.t > a.t ? a.t + (q.t - a.t) * (LINE_QUIET - a.g) / (q.g - a.g) : q.t;
      if (uq) on = x; else { spans.push([on, x]); on = null; }
    }
    if (on !== null) spans.push([on, Infinity]);
  }
  const t0 = P[0], tEnd = P[P.length - 2], runs = [];
  for (const [s0, e0] of spans) {
    const s = Math.max(s0, t0), e = Math.min(e0, tEnd); if (!(e >= s)) continue;
    const run = [s, lineValue(P, s, true)];
    for (let k = firstAfter(P, s); k < P.length && P[k] < e; k += 2) run.push(P[k], P[k + 1]);
    run.push(e, lineValue(P, e, false));
    runs.push(run);
  }
  return runs;
}
/* A part's vibrato, drawn as it sounds: its depth (in cents, fading in after each note's delay, from vibratoMoves()) times a
   sine at its rate, sampled 12 times a cycle into the line where the depth isn't zero. In place; P is the flat [t, p, …] line. */
function addVibrato(P, vm) {
  if (!vm) return;
  const pts = vm.moves, spans = [];
  for (let i = 1; i < pts.length; i++) if (pts[i - 1].g > 0 || pts[i].g > 0) {
    const last = spans[spans.length - 1];
    if (last && pts[i - 1].t <= last[1] + 1e-9) last[1] = pts[i].t; else spans.push([pts[i - 1].t, pts[i].t]);
  }
  if (!spans.length) return;
  const w = 2 * Math.PI * vm.rate, dt = 1 / (vm.rate * 12), vib = t => polyAt(pts, t) / 100 * Math.sin(w * t);
  const out = []; let s = 0;
  for (let k = 0; k < P.length; k += 2) {
    const t = P[k], p = P[k + 1];
    if (k) { // samples between this point and the one before, inside a span
      const t0 = P[k - 2], p0 = P[k - 1];
      while (s < spans.length && spans[s][1] <= t0) s++;
      for (let j = s; j < spans.length && spans[j][0] < t; j++) {
        const a = Math.max(t0, spans[j][0]), z = Math.min(t, spans[j][1]);
        for (let g = Math.floor(a / dt) * dt + dt; g < z; g += dt) if (g > t0) out.push(g, p0 + (p - p0) * (g - t0) / (t - t0) + vib(g));
      }
    }
    out.push(t, p + (spans.some(([a, z]) => t > a && t < z) ? vib(t) : 0));
  }
  P.length = 0; for (const x of out) P.push(x);
}
// the index (even) of the first point after t (strictly), or P.length
function firstAfter(P, t) { let lo = 0, hi = P.length / 2; while (lo < hi) { const m = (lo + hi) >> 1; if (P[2 * m] <= t) lo = m + 1; else hi = m; } return 2 * lo; }
// the line's value at t: just after t (after = true: at a jump, where it lands) or just before it (where it leaves from)
function lineValue(P, t, after) {
  const n = P.length / 2;
  let lo = 0, hi = n; // first point at or after t (before), or strictly after t (after)
  while (lo < hi) { const m = (lo + hi) >> 1; if (after ? P[2 * m] <= t : P[2 * m] < t) lo = m + 1; else hi = m; }
  if (after) { if (lo === 0) return P[1]; if (lo >= n) return P[2 * n - 1]; const i = 2 * (lo - 1), j = 2 * lo; return P[i + 1] + (P[j + 1] - P[i + 1]) * (t - P[i]) / (P[j] - P[i]); }
  if (lo === 0) return P[1]; if (lo >= n) return P[2 * n - 1];
  const i = 2 * (lo - 1), j = 2 * lo; return P[j] > P[i] ? P[i + 1] + (P[j + 1] - P[i + 1]) * (t - P[i]) / (P[j] - P[i]) : P[j + 1];
}
function thinRun(run, cell, style = 'range') {
  /* Seen from far out, a voice can move faster than the picture can show: a kick diving on every beat, a part jumping octaves
     on every note. A cell is busy where the voice keeps turning back on itself (up and down, by a semitone or more, four times
     or more within four cells either side; cells are 1 to 2 pixels). How busy cells are drawn is the trace look's choice:
     'range' (a faint band over the notes the voice moves between: the lowest and highest in the cell and its neighbours),
     'middle' (one point per cell, the average over it and the two cells either side: a steady line at the middle), or
     'every' (as every other cell). Every other cell (holds, single edges, glides, single spikes, the start and end of every
     note) keeps its first, lowest, highest and last points, which for a line that doesn't turn back is all there is to see.
     Cells are fixed in the piece, so the result is the same in every frame. Returns { lines: [runs], bands: [[t, lo, hi, …]] }. */
  const n = run.length / 2; if (n <= 2) return { lines: [run], bands: [] };
  const cells = []; // { c, k, j, m: [t, average] }
  for (let k = 0; k < n;) { const c = Math.floor(run[2 * k] / cell); let j = k; while (j + 1 < n && Math.floor(run[2 * (j + 1)] / cell) === c) j++; cells.push({ c, k, j, m: cellMean(run, k, j) }); k = j + 1; }
  const last = cells.length - 1;
  // how many times the line turns back by a semitone or more between points k and j (a wobble smaller than that isn't a turn)
  const turns = (k, j) => { let dir = 0, ext = run[2 * k + 1], n = 0;
    for (let x = k + 1; x <= j; x++) { const p = run[2 * x + 1];
      if (dir === 0) { if (Math.abs(p - ext) >= 1) { dir = p > ext ? 1 : -1; ext = p; } continue; }
      if (dir > 0 ? p > ext : p < ext) ext = p; else if (Math.abs(p - ext) >= 1) { n++; dir = -dir; ext = p; } }
    return n; };
  const busy = style === 'every' ? cells.map(() => false)
    : cells.map((q, i) => { let a = i, b = i; while (a > 0 && q.c - cells[a - 1].c <= 4) a--; while (b < last && cells[b + 1].c - q.c <= 4) b++; return turns(cells[a].k, cells[b].j) >= 4; });
  const lines = [], bands = []; let cur = [], band = null, bandEnd = 0;
  const closeBand = () => { const n = band.length; band.push(bandEnd, band[n - 2], band[n - 1]); bands.push(band); band = null; }; // runs on to the end of its last cell
  cells.forEach((q, i) => {
    if (!busy[i] || i === 0 || i === last) { // its first, lowest, highest and last points (a run's own start and end always)
      if (band) closeBand();
      let lo = q.k, hi = q.k; for (let x = q.k + 1; x <= q.j; x++) { if (run[2 * x + 1] < run[2 * lo + 1]) lo = x; if (run[2 * x + 1] > run[2 * hi + 1]) hi = x; }
      for (const x of [...new Set([q.k, lo, hi, q.j])].sort((u, w) => u - w)) cur.push(run[2 * x], run[2 * x + 1]);
      return; }
    if (style === 'middle') {
      let sum = 0, cnt = 0;
      for (let o = i - 2; o <= i + 2; o++) if (o >= 0 && o <= last && Math.abs(cells[o].c - q.c) <= 2) { sum += cells[o].m[1]; cnt++; }
      cur.push(q.m[0], sum / cnt); return; }
    // range: the line stops and a band takes over until the voice calms down
    if (!band) { if (cur.length) lines.push(cur); cur = []; band = []; }
    let lo = Infinity, hi = -Infinity;
    for (let o = i - 1; o <= i + 1; o++) if (o >= 0 && o <= last && Math.abs(cells[o].c - q.c) <= 1) for (let x = cells[o].k; x <= cells[o].j; x++) { const p = run[2 * x + 1]; if (p < lo) lo = p; if (p > hi) hi = p; }
    if (!band.length) band.push(q.c * cell, lo, hi); // from the start of its first cell, then one point per cell
    band.push((q.c + 0.5) * cell, lo, hi); bandEnd = (q.c + 1) * cell;
  });
  if (band) closeBand(); if (cur.length) lines.push(cur);
  return { lines, bands };
}
// the time-weighted average pitch of points k..j of a run, placed at the middle of their time (a plain average if no time passes)
function cellMean(run, k, j) {
  const t0 = run[2 * k], t1 = run[2 * j];
  if (!(t1 > t0)) { let s = 0; for (let i = k; i <= j; i++) s += run[2 * i + 1]; return [t0, s / (j - k + 1)]; }
  let area = 0; for (let i = k; i < j; i++) area += (run[2 * i + 3] + run[2 * i + 1]) / 2 * (run[2 * i + 2] - run[2 * i]);
  return [(t0 + t1) / 2, area / (t1 - t0)];
}
// a band's low and high at t (between its points)
function bandAt(B, t) {
  const n = B.length / 3; let a = 0, z = n; while (a < z) { const m = (a + z) >> 1; if (B[3 * m] <= t) a = m + 1; else z = m; }
  if (a === 0) return [B[1], B[2]]; if (a >= n) return [B[3 * n - 2], B[3 * n - 1]];
  const i = 3 * (a - 1), j = 3 * a, f = B[j] > B[i] ? (t - B[i]) / (B[j] - B[i]) : 1;
  return [B[i + 1] + (B[j + 1] - B[i + 1]) * f, B[i + 2] + (B[j + 2] - B[i + 2]) * f];
}
// each band's part between ta and tb, as [t, lo, hi, …]
function bandsIn(bands, ta, tb) {
  const out = [];
  for (const B of bands) { if (B[B.length - 3] < ta || B[0] > tb) continue;
    const s = Math.max(ta, B[0]), e = Math.min(tb, B[B.length - 3]); if (e < s) continue;
    const part = [s, ...bandAt(B, s)]; for (let k = 0; k < B.length; k += 3) if (B[k] > s && B[k] < e) part.push(B[k], B[k + 1], B[k + 2]); part.push(e, ...bandAt(B, e));
    out.push(part); }
  return out;
}
// draw bands: a faint fill between the lowest and highest notes, with thin edges and no glow
function drawBands(g, bands, ta, tb, X, Y, color, pal, d, fade) {
  const parts = bandsIn(bands, ta, tb); if (!parts.length) return;
  const fill = new Path2D(), edges = new Path2D();
  for (const P of parts) { const n = P.length / 3;
    fill.moveTo(X(P[0]), Y(P[2])); for (let k = 1; k < n; k++) fill.lineTo(X(P[3 * k]), Y(P[3 * k + 2])); for (let k = n - 1; k >= 0; k--) fill.lineTo(X(P[3 * k]), Y(P[3 * k + 1])); fill.closePath();
    edges.moveTo(X(P[0]), Y(P[2])); for (let k = 1; k < n; k++) edges.lineTo(X(P[3 * k]), Y(P[3 * k + 2]));
    edges.moveTo(X(P[0]), Y(P[1])); for (let k = 1; k < n; k++) edges.lineTo(X(P[3 * k]), Y(P[3 * k + 1])); }
  g.save(); g.fillStyle = color; g.strokeStyle = color;
  g.globalAlpha = (pal.dark ? 0.16 : 0.12) * fade; g.fill(fill);
  g.globalAlpha = 0.6 * fade; g.lineWidth = 0.9 * d * pal.weight; g.stroke(edges);
  g.restore();
}
// the lowest and highest pitch the lines (and bands) draw between ta and tb
function runsRange(L, ta, tb) {
  const runs = L.runs; let lo = Infinity, hi = -Infinity, a = 0, z = runs.length;
  for (const P of bandsIn(L.bands, ta, tb)) for (let k = 0; k < P.length; k += 3) { if (P[k + 1] < lo) lo = P[k + 1]; if (P[k + 2] > hi) hi = P[k + 2]; }
  while (a < z) { const m = (a + z) >> 1; const r = runs[m]; if (r[r.length - 2] < ta) a = m + 1; else z = m; }
  for (let i = a; i < runs.length && runs[i][0] <= tb; i++) {
    const r = runs[i], s = Math.max(ta, r[0]), e = Math.min(tb, r[r.length - 2]); if (e < s) continue;
    for (const p of [lineValue(r, s, true), lineValue(r, e, false)]) { if (p < lo) lo = p; if (p > hi) hi = p; }
    for (let k = firstAfter(r, s); k < r.length && r[k] < e; k += 2) { const p = r[k + 1]; if (p < lo) lo = p; if (p > hi) hi = p; }
  }
  return [lo, hi];
}
// add the runs' parts between ta and tb to a path
function traceRuns(path, runs, ta, tb, X, Y) {
  let lo = 0, hi = runs.length; // the first run that ends after ta
  while (lo < hi) { const m = (lo + hi) >> 1; const r = runs[m]; if (r[r.length - 2] < ta) lo = m + 1; else hi = m; }
  for (let i = lo; i < runs.length && runs[i][0] <= tb; i++) {
    const r = runs[i], s = Math.max(ta, r[0]), e = Math.min(tb, r[r.length - 2]);
    if (e < s) continue;
    path.moveTo(X(s), Y(lineValue(r, s, true)));
    for (let k = firstAfter(r, s); k < r.length && r[k] < e; k += 2) path.lineTo(X(r[k]), Y(r[k + 1]));
    path.lineTo(X(e), Y(lineValue(r, e, false)));
  }
}
/* The width of the widest note label a piece shows, at the size it's drawn: measured at moments 0.1 s apart, grouping
   voices as the labels do (a pitch shared by several voices is one label, "×n"), and kept per built score, label setting
   and size, so the playhead stands where those labels fit and stays there. */
const labelRoomCache = new WeakMap();
function labelRoom(g, S, video, narrow, d) {
  const b = S.built, font = `${(video ? 13 : narrow ? 10.5 : 11.5) * d}px ${(S.colors && S.colors.data) || 'monospace'}`, key = font + '|' + S.piece.view.labels;
  let c = labelRoomCache.get(b); if (!c) { c = new Map(); labelRoomCache.set(b, c); }
  if (c.has(key)) return c.get(key);
  const N = b.N, gated = b.voices ? b.voices.map(r => !!(r.b.gates && r.b.gates[r.v])) : new Array(N).fill(false), texts = new Set();
  for (let k = 0; k * 0.1 <= b.total; k++) {
    const t = k * 0.1, groups = new Map();
    for (let v = 0; v < N; v++) { if (gated[v] && gainAt(b, v, t) < 0.02) continue; const p = pitchAt(b, v, t), q = Math.round(p * 100); const gp = groups.get(q); if (gp) gp.n++; else groups.set(q, { p, n: 1 }); }
    groups.forEach(gp => texts.add(pitchLabel(gp.p, S) + (gp.n > 1 ? ' ×' + gp.n : '')));
  }
  g.save(); g.font = font; let w = 0; texts.forEach(s => { w = Math.max(w, g.measureText(s).width); }); g.restore();
  c.set(key, w); return w;
}
function drawScene(g, W, H, d, t, cam, video, S = null) {
  if (!S) S = { built, piece, marks, colors, artist: video ? videoArtist() : '' };
  const b = S.built, N = b.N, T = b.total, C = S.colors;
  const pal = tracePalette(S.piece.view.trace, C);
  const narrow = W / d < 520;
  const labelW = (video ? 150 : narrow ? 86 : 104) * d;
  const E = T + TAIL, te = Math.min(t, E); // the picture runs through the closing fade; the notes hold from T on
  const lay = video ? videoTitleLayout(g, S, W, d) : null; // title (and artist) at the top of a video; the trace starts below them
  const zz = cameraZ(Math.min(t, T + TAIL), S), x0 = video ? 50 * d : (1 - zz) * 18 * d, x1 = W - labelW, y0 = video ? lay.y0 : 22 * d, y1 = H - (video ? 130 : 18) * d;
  paintBackground(g, W, H, pal);
  const tc = Math.min(t, T), idx = eventIndex(b, tc);
  // voices that rest are silent at times: no dot then, and a gap in the line (gated: whether each voice ever rests)
  const gated = b.voices ? b.voices.map(r => !!(r.b.gates && r.b.gates[r.v])) : new Array(N).fill(false), quiet = (v, tt) => gated[v] && gainAt(b, v, tt) < 0.02;
  const cur = []; for (let v = 0; v < N; v++) cur.push(quiet(v, tc) ? null : pitchAt(b, v, tc, idx));
  const z = cameraZ(Math.min(t, T + TAIL), S); // the zoom out can run on into the closing fade
  /* Scrolling, the playhead stands far enough from the right edge for the widest label this piece shows (labelRoom()), and
     no further than it used to (the label column, labelW); zoomed out, the piece runs almost to the edge. Past the playhead,
     the next moments of the piece show faintly, out to the right margin (xR), under the labels. */
  const margin = (video ? 50 : 18) * d, room = Math.min(W - x1 + 14 * d, margin + 12 * d + labelRoom(g, S, video, narrow, d) + 4 * d);
  const xEnd = lerp(W - margin, W - room, z), xR = video ? W - margin : W - (1 - z) * margin;
  const pps = Math.max(34, Math.min(80, (W / d) / 11)) * d;
  const win = (xEnd - x0) / pps;
  /* The range of pitches the zoomed view frames: everything the lines draw over the stretch in view (from voiceLines(), at
     the level of detail they're drawn at), so whatever is drawn fits, a move that repeats (a kick diving on every beat) stays
     in frame, and the range changes only as something enters or leaves the stretch, never with how a frame happens to sample
     it. Voices that are resting don't count. */
  const tA = lerp(0, te - win, z), tB = Math.max(lerp(E, te, z), tA + 0.01);
  const lines = voiceLines(b), ideal = (tB - tA) * 2 * d / (xEnd - x0), busyStyle = S.piece.view.trace.busy || 'range';
  const level = Math.max(0, Math.min(LINE_LEVELS, Math.floor(Math.log2(ideal / LINE_CELL))));
  let lo = Infinity, hi = -Infinity;
  for (let v = 0; v < N; v++) { const r = runsRange(linesAt(lines, v, level, busyStyle), Math.min(te, T) - win, Math.min(te, T)); if (r[0] < lo) lo = r[0]; if (r[1] > hi) hi = r[1]; }
  if (!(lo <= hi)) { lo = cam.slo !== undefined ? cam.slo : b.min; hi = cam.shi !== undefined ? cam.shi : b.max; } // everything resting: hold the view
  const ck = cam.k || 0.1; // how far the view eases toward its target each frame
  // widen quickly when something needs the room, narrow at a third of the pace, so the view doesn't breathe in and out
  const ease = (from, to, widening) => from + (to - from) * (widening ? ck : ck / 3);
  if (cam.snap) { cam.slo = lo; cam.shi = hi; cam.snap = false; } else { cam.slo = ease(cam.slo, lo, lo < cam.slo); cam.shi = ease(cam.shi, hi, hi > cam.shi); }
  let ylo = lerp(b.min, cam.slo, z), yhi = lerp(b.max, cam.shi, z);
  if (yhi - ylo < 12) { const c = (yhi + ylo) / 2; ylo = c - 6; yhi = c + 6; }
  const padY = (y1 - y0) * 0.07;
  const Y = p => y1 - padY - (p - ylo) / (yhi - ylo) * (y1 - y0 - 2 * padY);
  const X = tt => x0 + (xEnd - x0) * (tt - tA) / (tB - tA);
  const px = X(te);
  const M = b.musicEnd !== undefined ? b.musicEnd : T; // the music's end, where the held parts fade
  const env = te <= M ? 1 : Math.max(0, 1 - (te - M) / FADE); // how loud the sound still is
  const grad = pal.stops ? pitchGradient(g, pal, Y) : null;
  const colorOf = v => grad || pal.line(v, N);
  const coreOf = v => pal.core;
  g.lineJoin = 'round'; g.lineCap = 'round';
  /* The lines come from each voice's own moves (voiceLines()), not from samples taken at this frame's spacing, so a note is
     drawn where it starts and stops however short it is, and an edge has the same slope at every zoom. Zoomed out, each line
     is thinned to cells of about 1 to 2 pixels that are fixed in the piece (powers of two of a second), so the picture is the
     same from frame to frame and changes only when the zoom passes one of those sizes. */
  for (const future of [false, true]) {
    const xa = future ? px : x0, xb = future ? Math.max(xEnd, xR) : px;
    if (xb - xa < 0.5) continue;
    const ta = tA + (tB - tA) * (xa - x0) / (xEnd - x0), tb = tA + (tB - tA) * (xb - x0) / (xEnd - x0);
    // what's ahead of a scrolling view isn't framed yet, so it's kept within the trace's band rather than run over the title
    if (future && z > 0) { g.save(); g.beginPath(); g.rect(0, y0 - 6 * d, W, y1 - y0 + 12 * d); g.clip(); }
    for (let v = 0; v < N; v++) {
      const path = new Path2D();
      const L = linesAt(lines, v, level, busyStyle);
      traceRuns(path, L.runs, ta, tb, X, Y);
      glowStroke(g, path, colorOf(v), coreOf(v), pal, d * (video ? 1.12 : 1), future ? 0.3 : 1);
      if (L.bands.length) drawBands(g, L.bands, ta, tb, X, Y, colorOf(v), pal, d * (video ? 1.12 : 1), future ? 0.3 : 1);
    }
    if (future && z > 0) g.restore();
  }
  fadeToBackground(g, W, H, pal, X(M), X(M + FADE)); // the held notes fade out as the sound does
  // the look ahead fades out toward the right margin
  if (z > 0 && xR - xEnd > 1) { const fw = Math.min(90 * d, (xR - xEnd) * 0.7) * z; fadeToBackground(g, W, H, pal, xR - fw, xR); }
  if (z < 0.98) { g.globalAlpha = (1 - z) * 0.8; g.strokeStyle = pal.accent; g.lineWidth = 1.5 * d; g.beginPath(); g.moveTo(px, y0); g.lineTo(px, y1); g.stroke(); g.globalAlpha = 1; }
  // dots and labels
  const groups = new Map();
  cur.forEach((p, v) => { if (p === null) return; const k = Math.round(p * 100); const gp = groups.get(k); if (gp) gp.n++; else groups.set(k, { p, n: 1, v }); });
  const gs = [...groups.values()].sort((a, b2) => b2.p - a.p);
  const r0 = (video ? 5.5 : 4.6) * d;
  // a dot's own colour as rgba, for its glow (looks with a pitch gradient take the colour at the dot's pitch)
  const dotColor = (gp, a = 1) => {
    let hex = pal.stops ? (() => { const f = Math.max(0, Math.min(1, (gp.p - 40) / 48)) * (pal.stops.length - 1), i = Math.min(pal.stops.length - 2, Math.floor(f)); return mixHex(pal.stops[i], pal.stops[i + 1], f - i); })() : pal.line(gp.v, N);
    hex = cssHex(hex) || hslHex(hex) || '#ffffff';
    const n = parseInt(hex.slice(1), 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  };
  for (const gp of gs) {
    const y = Y(gp.p), col = colorOf(gp.v);
    if (pal.dark && pal.glow > 0) { // a soft glow that fades out from the dot, like the lines' glow (not a flat disc)
      const rg = g.createRadialGradient(px, y, r0 * 0.5, px, y, r0 * 3.6);
      rg.addColorStop(0, dotColor(gp)); rg.addColorStop(0.35, dotColor(gp, 0.45)); rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, 0.75 * pal.glow) * env; g.fillStyle = rg;
      g.beginPath(); g.arc(px, y, r0 * 3.6, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    g.globalAlpha = env; g.fillStyle = col; g.beginPath(); g.arc(px, y, r0, 0, Math.PI * 2); g.fill();
    if (pal.core) { g.fillStyle = pal.core; g.beginPath(); g.arc(px, y, r0 * 0.45, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
  }
  g.font = `${(video ? 13 : narrow ? 10.5 : 11.5) * d}px ${C.data || 'monospace'}`;
  g.textBaseline = 'middle';
  let lastY = -1e9; const lx = px + 12 * d, gap = (video ? 15 : 12.5) * d;
  for (const gp of gs) {
    let y = Y(gp.p);
    if (y - lastY < gap) { y = lastY + gap; if (y > H - 4 * d) break; }
    lastY = y;
    const txt = pitchLabel(gp.p, S) + (gp.n > 1 ? ' ×' + gp.n : '');
    const w = g.measureText(txt).width;
    const tx = lx + w > W - 4 * d ? px - 12 * d - w : lx; // near the right edge, put the label on the left of the dot
    { g.globalAlpha = 0.85 * env; g.fillStyle = pal.bg; g.fillRect(tx - 3 * d, y - 7 * d, w + 6 * d, 14 * d); }
    g.globalAlpha = env; g.fillStyle = pal.text; g.fillText(txt, tx, y); g.globalAlpha = 1;
  }
  if (video) {
    const e = b.events[idx], nx = nextEvent(b, idx);
    g.fillStyle = pal.title; g.textBaseline = 'alphabetic';
    // the title fits the frame (see videoTitleLayout); the artist, if shown, sits under it in a smaller, quieter line
    g.font = `700 ${lay.size}px ${C.display || 'sans-serif'}`;
    lay.lines.forEach((ln, i) => g.fillText(ln, x0, lay.baselines[i]));
    if (lay.artist) { g.fillStyle = pal.text; g.font = `500 ${lay.artistSize}px ${C.display || 'sans-serif'}`; g.fillText(lay.artist, x0, lay.artistBaseline); g.fillStyle = pal.title; }
    g.font = `500 ${30 * d}px ${C.display || 'sans-serif'}`;
    g.fillText((e.kind === 'note' && idx > 0 ? '→ ' : '') + e.label, x0, H - 64 * d);
    g.fillStyle = pal.text; g.font = `${14 * d}px ${C.data || 'monospace'}`;
    if (nx) g.fillText('next ' + (nx.kind === 'note' ? '→ ' : '') + nx.label, x0, H - 36 * d);
    const tt = fmtClock(Math.min(t, T + TAIL)) + ' / ' + fmtClock(T + TAIL); // includes the fade, like the player
    const w = g.measureText(tt).width; g.fillText(tt, W - 50 * d - w, H - 36 * d);
  }
  return { cur, idx };
}
/* Small preview of a look for the Settings window */
function drawLookPreview(cnv, tr) {
  const g = cnv.getContext('2d'), W = cnv.width, H = cnv.height, d = W / 220, pal = tracePalette(tr);
  paintBackground(g, W, H, pal);
  const Y = p => H - 8 * d - (p - 40) / 44 * (H - 16 * d);
  const grad = pal.stops ? pitchGradient(g, pal, Y) : null;
  const base = [44, 51, 55, 58, 63, 67, 70, 75, 79], N = base.length;
  g.lineJoin = 'round'; g.lineCap = 'round';
  base.forEach((m, v) => {
    const path = new Path2D();
    for (let x = 0; x <= W; x += 2 * d) {
      const u = x / W, s = u < 0.18 ? 0 : u < 0.32 ? (u - 0.18) / 0.14 : 1, e = s * s * (3 - 2 * s);
      const s2 = u < 0.62 ? 0 : u < 0.74 ? (u - 0.62) / 0.12 : 1, e2 = s2 * s2 * (3 - 2 * s2);
      const p = 84 + (m - 84) * e + ((v % 3) - 1) * 2 * e2;
      if (x === 0) path.moveTo(x, Y(p)); else path.lineTo(x, Y(p));
    }
    glowStroke(g, path, grad || pal.line(v, N), pal.core, pal, d * 0.9, 1);
  });
}
const setText = (el, s) => { if (el.textContent !== s) el.textContent = s; };
function drawEmptyStage() {
  const pal = tracePalette(piece ? piece.view.trace : { look: 'theme', glow: 60, weight: 1 });
  paintBackground(g2, cv.width, cv.height, pal);
  g2.fillStyle = pal.text; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.font = `${14 * dpr}px ${colors.display || 'sans-serif'}`;
  g2.fillText('Add a chord on the Harmony tab to hear the voices', cv.width / 2, cv.height / 2); g2.textAlign = 'start';
  for (const id of ['r-chord', 'r-next', 'r-voices', 'r-range']) setText($(id), '–'); setText($('time'), '0:00 / 0:00');
}
function frame() {
  requestAnimationFrame(frame);
  if (rendering) return; // while rendering a video, the renderer shows its own preview on the stage
  if (!built) { drawEmptyStage(); return; }
  if (colorTick++ % 30 === 0) readColors();
  let t = currentT();
  { const has = !!(built.sections && built.sections.length); if ($('secwrap').hidden === has) { $('secwrap').hidden = !has; if (!has && loopOn) $('secloop').click(); } }
  if (playing && loopOn && !recording) { // looping a section: back to its start at its end
    if (!loopRun || t < loopRun.t0 - 0.05 || t > loopRun.t1 + 0.5) loopRun = sectionRunAt(t); // (after a jump or a change, the section the playhead is in)
    if (loopRun && t >= loopRun.t1) { jumpTo(loopRun.t0); t = loopRun.t0; }
  }
  if (playing && t >= built.total + TAIL) {
    if (recording) { finishRecording(); }
    offset = built.total + TAIL; stopAudio(0.05); playing = false; setPlayIcon(); t = offset; // the clock ends on the full length
  }
  let cur, idx;
  if (recording) {
    // The video is 60 frames a second. On a 120 Hz screen the browser asks for twice that, so skip the
    // in-between ticks rather than drawing frames the recorder throws away.
    const now = performance.now();
    if (now - recording.lastDraw < 1000 / 60 - 2) return;
    recording.lastDraw = now;
  }
  if (recording) { // draw the video frame once, then show it scaled on the stage
    const vc = $('vcanvas'); ({ cur, idx } = drawScene(recording.g, vc.width, vc.height, recording.d, t, recording.cam, true));
    const k = Math.min(cv.width / vc.width, cv.height / vc.height), w = vc.width * k, h = vc.height * k;
    g2.fillStyle = tracePalette(piece.view.trace).bg; g2.fillRect(0, 0, cv.width, cv.height); g2.drawImage(vc, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
    $('vprog').value = Math.min(1, t / (built.total + TAIL));
  } else ({ cur, idx } = drawScene(g2, cv.width, cv.height, dpr, t, screenCam, false));
  const tc = Math.min(t, built.total), e = built.events[idx], nx = nextEvent(built, idx);
  setText($('r-chord'), (e.kind === 'note' && idx > 0 ? '→ ' : '') + e.label);
  $('r-section-wrap').hidden = !e.section; if (e.section) setText($('r-section'), e.section + (sectionPasses(e.section) > 1 ? ' ' + (e.pass + 1) + '/' + sectionPasses(e.section) : ''));
  setText($('r-next'), nx ? (nx.kind === 'note' ? '→ ' : '') + nx.label : 'end');
  setText($('r-voices'), String(built.N));
  const on = cur.filter(p => p !== null), lo = Math.min(...on), hi = Math.max(...on);
  setText($('r-range'), on.length ? noteName(Math.round(lo)) + '–' + noteName(Math.round(hi)) + ' · ' + ((hi - lo) / 12).toFixed(1) + ' oct' : 'resting');
  // the clock and the scrubber both include the closing fade (the picture holds its last frame during it)
  const full = built.total + TAIL;
  setText($('time'), fmtClock(Math.min(t, full)) + ' / ' + fmtClock(full));
  if (document.activeElement !== $('scrub')) $('scrub').value = Math.round(1000 * Math.min(t, full) / full);
}

/* ---------- Files and exports ---------- */
/* Where files go: 'browser' (normal downloads), 'host' (the host's saver), or 'none' */
const HOST_SAVES = !!(HOST && typeof HOST.saver === 'function');
let hostSave = null, saveMode = HOST_SAVES ? 'none' : 'browser';
const canSave = () => saveMode !== 'none';
async function initDownloads() {
  if (HOST_SAVES) { try { hostSave = await HOST.saver(); } catch (e) { hostSave = null; } saveMode = typeof hostSave === 'function' ? 'host' : 'none'; }
  $('xhint').textContent = saveMode === 'browser'
    ? 'Files download straight to your computer. MusicXML shows where the voices settle; the glides live in the MIDI and audio.'
    : (HOST.saveHint || 'Audio, MIDI and MusicXML arrive inside a .zip. MusicXML shows where the voices settle; the glides live in the MIDI and audio.');
  if (!canSave()) { document.querySelectorAll('[data-export], #xopen, #vrecord, #vrender').forEach(b => b.disabled = true); xstatus('Saving files isn\'t available in this view.'); }
}
function xstatus(m) { $('xstatus').textContent = m; }
async function saveFile(filename, data) {
  if (saveMode === 'browser') {
    const blob = data instanceof Blob ? data : new Blob([data]);
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    xstatus('Downloaded ' + filename + '.'); return true;
  }
  if (!hostSave) { xstatus('Saving files isn\'t available in this view.'); return false; }
  try { await hostSave({ filename, data }); xstatus('Saved ' + filename + '.'); return true; }
  catch (e) {
    const c = e && e.code;
    xstatus(c === 'declined' ? 'Save cancelled.' : c === 'rate_limited' ? 'Another save is still waiting for an answer. Try again in a moment.'
      : c === 'too_large' ? 'That file is too large for this destination.' : 'Couldn\'t save the file (' + (c || 'error') + ').');
    return false;
  }
}
/* A copy of the piece that also carries its resolved notes, so it reopens exactly even under a later engine */
function withRealization() {
  const p = JSON.parse(JSON.stringify(piece));
  // the format follows what the piece uses (formatFor()): older versions refuse what they'd play wrongly, and open the rest
  if (p.parts && !p.parts.length) delete p.parts; if (p.volume && !p.volume.length) delete p.volume;
  p.formatVersion = formatFor(p);
  if (isFrozen()) p.realization = piece.realization; else if (built) p.realization = realizationOf(built); else delete p.realization; // no chords, no notes
  if (built && p.parts) { const rz = partRealizations(built); for (const pt of p.parts) if (pt.preset === 'pad' && rz[pt.id]) pt.realization = rz[pt.id]; } // and the pad parts'
  return p;
}
function pieceFile() { const p = withRealization(); p.name = safeName($('name').value); p.exported = new Date().toISOString(); p.app = APP_VERSION; return pieceJson(p) + '\n'; }
async function renderOffline(b) {
  const sr = 48000, len = Math.ceil((b.total + TAIL) * sr);
  const ctx = new OfflineAudioContext(2, len, sr);
  buildGraph(ctx, b, 0, [ctx.destination], 1, true);
  const buf = await ctx.startRendering();
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  let peak = 0; for (let i = 0; i < len; i++) { const a = Math.abs(L[i]), c = Math.abs(R[i]); if (a > peak) peak = a; if (c > peak) peak = c; }
  const k = peak > 0 ? 0.891 / peak : 1; // normalize to −1 dBFS
  const l2 = new Float32Array(len), r2 = new Float32Array(len);
  for (let i = 0; i < len; i++) { l2[i] = L[i] * k; r2[i] = R[i] * k; }
  return { L: l2, R: r2, sr };
}
let lamePromise = null;
function loadLame() {
  if (window.lamejs) return Promise.resolve(window.lamejs);
  const tryLoad = src => new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src;
    s.onload = () => window.lamejs ? res(window.lamejs) : rej(new Error('no encoder'));
    s.onerror = () => { s.remove(); rej(new Error('not found')); };
    document.head.appendChild(s);
  });
  // The encoder is lame.min.js, kept beside this page, so MP3 export works offline and makes no request to another site.
  if (!lamePromise) lamePromise = tryLoad((HOST && HOST.mp3Encoder) || 'lame.min.js')
    .catch(() => { lamePromise = null; throw new Error((HOST && HOST.mp3Error) || 'MP3 export needs lame.min.js in the same folder as this page. It was not found.'); });
  return lamePromise;
}
async function encodeMp3(a, kbps = 192, stop = null) {
  const lame = await loadLame();
  const enc = new lame.Mp3Encoder(2, a.sr, kbps);
  const n = a.L.length, l = new Int16Array(n), r = new Int16Array(n);
  for (let i = 0; i < n; i++) { l[i] = Math.max(-32768, Math.min(32767, a.L[i] * 32767)); r[i] = Math.max(-32768, Math.min(32767, a.R[i] * 32767)); }
  const parts = [];
  for (let i = 0, blk = 0; i < n; i += 1152, blk++) {
    const out = enc.encodeBuffer(l.subarray(i, i + 1152), r.subarray(i, i + 1152)); if (out.length) parts.push(new Uint8Array(out));
    if (blk % 400 === 0) { if (stop && stop()) throw 'cancel'; xstatus((stop ? 'Encoding audio… ' : 'Encoding MP3… ') + Math.round(100 * i / n) + '%'); await (stop ? nextTask() : new Promise(r2 => setTimeout(r2, 0))); }
  }
  const end = enc.flush(); if (end.length) parts.push(new Uint8Array(end));
  return mp3WithInfo(catBytes(parts)); // with an Info frame, so players know the exact length
}
let exporting = false;
async function doExport(kind) {
  if (exporting || (!built && kind !== 'json')) return;
  exporting = true; document.querySelectorAll('[data-export], #xopen').forEach(b => b.disabled = true);
  const name = safeName($('name').value), opts = { tempo: piece.timing.tempo, title: String($('name').value || '').trim() || name, artist: artistName() };
  try {
    if (kind === 'json') { await saveFile(name + '.json', pieceFile()); return; }
    const files = [];
    let audio = null;
    if (kind === 'wav' || kind === 'mp3' || kind === 'all') { xstatus('Rendering audio…'); await new Promise(r => setTimeout(r, 30)); audio = await renderOffline(built); }
    if (kind === 'all') files.push({ name: name + '.json', data: utf8(pieceFile()) });
    if (kind === 'wav' || kind === 'all') files.push({ name: name + '.wav', data: encodeWav24(audio.L, audio.R, audio.sr, opts) });
    let mp3Note = '';
    if (kind === 'mp3' || kind === 'all') {
      try { files.push({ name: name + '.mp3', data: catBytes([id3v2(opts), await encodeMp3(audio)]) }); }
      catch (e) { if (kind === 'mp3') throw e; mp3Note = ' The MP3 was left out: ' + e.message; }
    }
    let midiNote = '';
    if (kind === 'midi' || kind === 'all') {
      const parts = midiGlideFiles(built, opts);
      parts.forEach(m => files.push({ name: name + (parts.length > 1 ? ' (glides, voices ' + m.voices[0] + '–' + m.voices[1] + ').mid' : ' (glides).mid'), data: m.data }));
      if (parts.length > 1) midiNote = ' MIDI with glides is in ' + parts.length + ' files of up to 15 voices each, the most one file can carry.';
    }
    if (kind === 'midichords' || kind === 'all') files.push({ name: name + ' (chords).mid', data: midiChords(built, opts) });
    if (kind === 'musicxml' || kind === 'all') files.push({ name: name + '.musicxml', data: musicXml(built, opts) });
    let partsNote = ''; // which parts the notation exports leave to the audio and MIDI with glides
    if (built.parts.length > 1 && ['midichords', 'musicxml', 'all'].includes(kind)) {
      const rest = built.parts.filter(x => !x.main), names = a => a.map(x => x.name).join(', '), many = a => a.length > 1;
      const silent = rest.filter(mutedPart), pads = rest.filter(x => !mutedPart(x) && !['line', 'pattern', 'copy'].includes(x.preset));
      if (kind !== 'midichords' && pads.length) partsNote += ' MusicXML has a staff for each line, pattern and echo; ' + names(pads) + (many(pads) ? ' follow the chords, so they are' : ' follows the chords, so it is') + ' in the audio and both MIDI files.';
      if (silent.length) partsNote += ' ' + names(silent) + (many(silent) ? ' are' : ' is') + ' silent, so ' + (kind === 'all' ? 'MIDI chords and MusicXML leave' : kind === 'musicxml' ? 'MusicXML leaves' : 'MIDI chords leaves') + (many(silent) ? ' them' : ' it') + ' out.';
    }
    const label = { wav: 'WAV', mp3: 'MP3', midi: 'MIDI glides', midichords: 'MIDI chords', musicxml: 'MusicXML', all: 'all files' }[kind];
    let ok;
    if (saveMode === 'browser' && files.length === 1) ok = await saveFile(files[0].name, new Blob([files[0].data]));
    else { xstatus('Packing…'); ok = await saveFile(name + ' (' + label + ').zip', new Blob([zipStore(files)])); }
    if (ok && (mp3Note || midiNote || partsNote)) xstatus($('xstatus').textContent + mp3Note + midiNote + partsNote);
  } catch (e) { xstatus(e && e.message ? e.message : 'Export failed.'); }
  finally { exporting = false; updateAvailability(); }
}

/* ---------- Video ---------- */
function pickMime() {
  // explicit MP4 codecs first; plain "video/mp4" last (Safari), since some browsers claim it but write empty files
  const c = ['video/mp4;codecs=avc1.42E01F,mp4a.40.2', 'video/mp4;codecs=avc1.4D401F,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  return c.find(m => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || '';
}
const LOCK_SEL = ['.bar', '#library', '.transport', '#p-harmony', '#p-voicing', '#p-motion', '#p-sound', '.partbar', '.tabs'];
function lockUI(on) {
  LOCK_SEL.forEach(s => { const el = document.querySelector(s); if (el) el.inert = on; });
  document.querySelectorAll('[data-export], #xopen, #vaspect, #vsize, #vfps, #vformat, #vquality, #vartist, #tempo, #vzoom, #busy, .vzc input, .znow').forEach(el => el.disabled = on || !canSave());
  if (!on && typeof showArtistOption === 'function' && canSave()) showArtistOption(); // dimmed again if there's no name
  if (!on) updateAvailability();
}
function startRecording() {
  if (rendering) return;
  if (!canSave()) return xstatus('Saving files isn\'t available in this view.');
  const vc = $('vcanvas');
  if (typeof MediaRecorder === 'undefined' || !vc.captureStream) return xstatus('This browser can\'t record video from this page.');
  const mime = pickMime();
  const [w, h] = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080] }[$('vaspect').value];
  vc.width = w; vc.height = h; vc.hidden = false; $('vprog').hidden = false; $('vprog').value = 0;
  setPlaying(false); offset = 0;
  ensureCtx();
  const dest = actx.createMediaStreamDestination();
  const stream = new MediaStream([...vc.captureStream(60).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  let mr;
  // 12 Mbps: YouTube's recommended bitrate for 1080p at 60 fps
  try { mr = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 12e6, audioBitsPerSecond: 192000 } : undefined); }
  catch (e) { vc.hidden = true; $('vprog').hidden = true; return xstatus('This browser can\'t record video from this page.'); }
  recording = { mr, chunks: [], mime: mr.mimeType || mime, g: vc.getContext('2d'), d: Math.min(w, h) / 540, cam: { slo: 50, shi: 80, snap: true }, cancelled: false, lastDraw: 0 };
  const rec = recording;
  mr.ondataavailable = e => { if (e.data && e.data.size) rec.chunks.push(e.data); }; // keeps the final chunk that arrives after stop()
  mr.onstop = async () => {
    $('vrecord').textContent = 'Record live'; lockUI(false); $('vprog').hidden = true; vc.hidden = true;
    if (rec.cancelled) { xstatus('Recording cancelled.'); return; }
    const ext = /mp4/.test(rec.mime) ? 'mp4' : 'webm';
    const blob = new Blob(rec.chunks, { type: rec.mime });
    if (blob.size < 20000) { xstatus('The browser recorded an empty video. Try again, or use a different browser.'); return; }
    xstatus('Saving video…');
    await saveFile(safeName($('name').value) + '.' + ext, blob);
  };
  drawScene(recording.g, w, h, recording.d, 0, recording.cam, true);
  lockUI(true); $('vrecord').textContent = 'Cancel recording'; $('vrender').disabled = true; xstatus('Recording… the piece plays once.');
  // Prepare the whole audio graph first, and give the encoder a moment on the opening frame
  // before anything moves, so the start of the video doesn't stutter.
  startAudio(0, dest, 0.6); playing = true; setPlayIcon();
  mr.start(500);
}
function finishRecording(cancel = false) {
  if (!recording) return;
  const rec = recording; recording = null; rec.cancelled = cancel;
  try { rec.mr.stop(); } catch (e) {}
  if (cancel) { stopAudio(0.1); playing = false; offset = 0; setPlayIcon(); }
}

/* ---------- Video: rendered frame by frame ----------
   Instead of filming the canvas as it plays, draw every frame at its exact time and hand it to the browser's
   video encoder, with the audio from the same renderer as the WAV export. Nothing can be dropped, however
   busy the computer is, and the file gets a proper index, so it plays and seeks cleanly everywhere. */
let rendering = null;
const CAN_RENDER = typeof VideoEncoder === 'function' && typeof AudioEncoder === 'function' && typeof VideoFrame === 'function' && typeof AudioData === 'function';
const VIDEO_SIZES = { 1080: { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080] }, 1440: { '16:9': [2560, 1440], '9:16': [1440, 2560], '1:1': [1440, 1440] } };
// Standard follows YouTube's recommended upload bitrates (8 / 12 Mbps at 1080p, 16 / 24 at 1440p, for 30 / 60 fps); High doubles them
function videoBitrate(size, fps, w, h, quality) {
  const base = { 1080: { 30: 8e6, 60: 12e6 }, 1440: { 30: 16e6, 60: 24e6 } }[size][fps];
  const full = size === 1440 ? 2560 * 1440 : 1920 * 1080;
  return Math.round(base * Math.min(1, (w * h) / full) * (quality === 'high' ? 2 : 1));
}
function avcCodecs(w, h, fps) { // H.264 High profile at the lowest level that fits, then Main and Baseline
  const mbs = Math.ceil(w / 16) * Math.ceil(h / 16), rate = mbs * fps;
  const levels = [[0x28, 8192, 245760], [0x2A, 8704, 522240], [0x32, 22080, 589824], [0x33, 36864, 983040], [0x34, 36864, 2073600]].filter(([, f, r]) => mbs <= f && rate <= r).map(([l]) => l.toString(16).toUpperCase());
  return ['6400', '4D00', '42E0'].flatMap(p => levels.map(l => 'avc1.' + p + l));
}
async function pickVideoConfig(format, w, h, fps, bitrate) {
  const codecs = format === 'mp4' ? avcCodecs(w, h, fps) : (w * h > 2228224 ? ['vp09.00.50.08', 'vp09.00.51.08', 'vp8'] : ['vp09.00.41.08', 'vp09.00.50.08', 'vp8']);
  for (const codec of codecs) {
    const config = { codec, width: w, height: h, bitrate, framerate: fps, latencyMode: 'quality', ...(format === 'mp4' ? { avc: { format: 'annexb' } } : {}) };
    try { if ((await VideoEncoder.isConfigSupported(config)).supported) return config; } catch (e) {}
  }
  return null;
}
const tryAudioCodec = async (codec, bitrate) => { const config = { codec, sampleRate: 48000, numberOfChannels: 2, bitrate }; try { return typeof AudioEncoder !== 'undefined' && (await AudioEncoder.isConfigSupported(config)).supported ? config : null; } catch (e) { return null; } };
let aacOk = true; // whether this browser can encode AAC; found out by probeRendering
async function pickAudioConfig(format) {
  // H.264: AAC in an MP4 if the browser can encode it. If not, a QuickTime .mov with uncompressed 16-bit audio, which QuickTime,
  // VLC, editors and YouTube all play. (QuickTime won't play MP3 or Opus inside an MP4.)
  // WebM: Opus.
  if (format === 'mp4') {
    const aac = await tryAudioCodec('mp4a.40.2', 320000);
    return aac ? { kind: 'aac', config: aac } : { kind: 'pcm', config: { bitrate: 1536000 } };
  }
  const opus = await tryAudioCodec('opus', 256000); return opus ? { kind: 'opus', config: opus } : null;
}
/* How many samples an audio encoder shifts its output by (AAC encoders start with ~1,000–2,000 samples of priming).
   Encodes a short noise burst, decodes it, and finds the burst by correlation. 0 if it can't tell; the MP4's edit list skips this many. */
async function codecDelay(config) {
  try {
    const sr = config.sampleRate, ch = config.numberOfChannels, n = 4096, maxLag = 4096, total = Math.round(sr / 2);
    const ref = new Float32Array(n); let seed = 12345;
    for (let k = 0; k < n; k++) { seed = (seed * 1103515245 + 12345) >>> 0; ref[k] = ((seed >>> 8) / 8388608 - 1) * 0.5 * Math.sin(Math.PI * k / n); }
    const buf = new Float32Array(total * ch); for (let c = 0; c < ch; c++) buf.set(ref, c * total);
    const chunks = []; let desc = null, err = null;
    const enc = new AudioEncoder({ output: (chunk, meta) => { chunks.push(chunk); if (!desc && meta && meta.decoderConfig && meta.decoderConfig.description) desc = meta.decoderConfig.description; }, error: e => { err = e; } });
    enc.configure(config);
    const ad = new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: total, numberOfChannels: ch, timestamp: 0, data: buf });
    enc.encode(ad); ad.close(); await enc.flush(); enc.close();
    if (err || !chunks.length) return 0;
    const parts = [];
    const dec = new AudioDecoder({ output: a => { const o = { planeIndex: 0, format: 'f32-planar' }, f = new Float32Array(a.allocationSize(o) / 4); a.copyTo(f, o); parts.push(f); a.close(); }, error: e => { err = e; } });
    dec.configure({ codec: config.codec, sampleRate: sr, numberOfChannels: ch, ...(desc ? { description: desc } : {}) });
    for (const c of chunks) dec.decode(c);
    await dec.flush(); dec.close();
    if (err) return 0;
    const out = new Float32Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
    if (out.length < n + maxLag) return 0;
    let best = 0, bestLag = 0; const eRef = ref.reduce((a, x) => a + x * x, 0);
    for (let lag = 0; lag <= maxLag; lag++) { let sum = 0; for (let k = 0; k < n; k++) sum += ref[k] * out[k + lag]; if (sum > best) { best = sum; bestLag = lag; } }
    let eOut = 0; for (let k = 0; k < n; k++) eOut += out[k + bestLag] * out[k + bestLag];
    return best / Math.sqrt(eRef * eOut) > 0.7 ? bestLag : 0; // only trust a clear match
  } catch (e) { return 0; }
}
// the file extension and type for a render: H.264 without AAC goes in a QuickTime .mov
const videoContainer = (format, audioKind) => format === 'webm' ? { ext: 'webm', type: 'video/webm' } : audioKind === 'pcm' ? { ext: 'mov', type: 'video/quicktime' } : { ext: 'mp4', type: 'video/mp4' };
// a yield that background tabs don't throttle the way they throttle timers
const nextTask = (() => { const ch = new MessageChannel(), q = []; ch.port1.onmessage = () => { const r = q.shift(); if (r) r(); }; return () => new Promise(r => { q.push(r); ch.port2.postMessage(0); }); })();
const bytesOf = b => b instanceof ArrayBuffer ? new Uint8Array(b.slice(0)) : new Uint8Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
async function drain(enc, max) { while (enc.encodeQueueSize > max) await Promise.race([new Promise(r => enc.addEventListener('dequeue', r, { once: true })), new Promise(r => setTimeout(r, 50))]); }
function videoEstimate() { // megabytes the finished file will take (and roughly what is held in memory while rendering)
  if (!built) return 0;
  const o = videoOpts(), [w, h] = VIDEO_SIZES[o.size][o.aspect];
  const audioBits = o.format === 'mp4' && !aacOk ? 1536000 : 320000; // uncompressed audio in a .mov where there's no AAC
  return (videoBitrate(o.size, o.fps, w, h, o.quality) + audioBits) * (built.total + TAIL) / 8 / 1048576;
}
function showVideoEstimate() {
  if (!CAN_RENDER) return;
  const mb = videoEstimate(), big = mb > 1000;
  $('vest').textContent = mb ? 'About ' + (mb >= 1000 ? (mb / 1024).toFixed(1) + ' GB' : Math.max(1, Math.round(mb)) + ' MB') + ' for this piece' + (big ? '. The whole video is held in memory until it\'s saved, so on a computer with 8 GB of RAM, choose Standard or 1080p.' : '.') : '';
  $('vest').classList.toggle('warn', big);
}
let bigRenderOk = 0;
function videoOpts() { return { aspect: $('vaspect').value, size: +$('vsize').value, fps: +$('vfps').value, format: $('vformat').value, quality: $('vquality').value, artist: $('vartist').checked }; }
function saveVideoOpts() { lsSet('cge.video', JSON.stringify(videoOpts())); }
function setRenderUI(on) {
  $('vrender').textContent = on ? 'Cancel render' : 'Render video'; $('vprog').hidden = !on; if (on) $('vprog').value = 0;
  if (on) $('vrecord').disabled = true;
  lockUI(on); // when turning off, this also restores what's available
}
async function renderVideo() {
  if (!canSave() || rendering || recording || !built) return;
  if (videoEstimate() > 1000 && Date.now() - bigRenderOk > 10000) { bigRenderOk = Date.now(); return xstatus('This video will be about ' + (videoEstimate() / 1024).toFixed(1) + ' GB, all held in memory while it renders. Click Render video again within 10 seconds to go ahead.'); }
  bigRenderOk = 0;
  const o = videoOpts(), [w, h] = VIDEO_SIZES[o.size][o.aspect], fps = o.fps;
  const bitrate = videoBitrate(o.size, fps, w, h, o.quality);
  const vconf = await pickVideoConfig(o.format, w, h, fps, bitrate);
  if (!vconf) return xstatus('This browser can\'t encode ' + (o.format === 'mp4' ? 'H.264 (MP4)' : 'VP9 (WebM)') + ' at ' + o.size + 'p ' + fps + ' fps. Try the other format or size, or Record live.');
  const aconf = await pickAudioConfig(o.format);
  if (!aconf) return xstatus('This browser can\'t encode audio for video. Use Record live instead.');
  // a frozen copy of everything the frames are drawn from: undo or edits during the render can't change the video
  const snap = { built, piece: JSON.parse(JSON.stringify(piece)), marks: Object.assign({}, marks), colors: Object.assign({}, colors), artist: videoArtist() };
  const fileName = safeName(snap.piece.name);
  const rec = rendering = { cancelled: false, error: null, onCancel: null };
  const cancelled = new Promise(r => { rec.onCancel = r; });
  setPlaying(false); setRenderUI(true);
  let wake = null; try { if (navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); } catch (e) {}
  const started = performance.now();
  let venc = null, aenc = null;
  const fail = e => { if (!rec.error) rec.error = e; };
  try {
    // 1. audio: the same render as the WAV export, compressed to AAC or Opus, or kept as 16-bit PCM for a .mov
    xstatus('Rendering audio…');
    await nextTask();
    const pcm = await Promise.race([renderOffline(snap.built), cancelled]);
    if (rec.cancelled) throw 'cancel';
    let aSamples = [], aDesc = null, aDelay = 0;
    if (aconf.kind === 'aac') aDelay = await Promise.race([codecDelay(aconf.config), cancelled]); // priming for the edit list to skip
    if (rec.cancelled) throw 'cancel';
    if (aconf.kind === 'pcm') { // interleaved 16-bit little-endian, in blocks of 1024 frames that all share one buffer
      const len = pcm.L.length, buf = new ArrayBuffer(len * 4), dv = new DataView(buf), q = x => Math.max(-32768, Math.min(32767, Math.round(x * 32767)));
      for (let i = 0; i < len; i++) { dv.setInt16(4 * i, q(pcm.L[i]), true); dv.setInt16(4 * i + 2, q(pcm.R[i]), true); }
      for (let i = 0; i < len; i += 1024) { const n = Math.min(1024, len - i); aSamples.push({ data: new Uint8Array(buf, 4 * i, 4 * n), frames: n }); }
    } else {
    aenc = new AudioEncoder({ output: (chunk, meta) => {
      const d = new Uint8Array(chunk.byteLength); chunk.copyTo(d);
      aSamples.push({ data: d, ts: chunk.timestamp / 1e6, duration: chunk.duration ? chunk.duration / 1e6 : 0 });
      if (!aDesc && meta && meta.decoderConfig && meta.decoderConfig.description) aDesc = bytesOf(meta.decoderConfig.description);
    }, error: fail });
    aenc.configure(aconf.config);
    const len = pcm.L.length, block = 4800;
    for (let i = 0; i < len; i += block) {
      const n = Math.min(block, len - i), buf = new Float32Array(n * 2);
      buf.set(pcm.L.subarray(i, i + n), 0); buf.set(pcm.R.subarray(i, i + n), n);
      const ad = new AudioData({ format: 'f32-planar', sampleRate: pcm.sr, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(i / pcm.sr * 1e6), data: buf });
      aenc.encode(ad); ad.close();
      if (aenc.encodeQueueSize > 16) await drain(aenc, 8);
      if (rec.error) throw rec.error;
    }
    await Promise.race([aenc.flush(), cancelled]); if (rec.cancelled) throw 'cancel';
    aenc.close(); aenc = null;
    // fill in any missing durations from the timestamps (or the codec's frame length)
    const frameLen = aconf.kind === 'aac' ? 1024 / 48000 : 0.02;
    aSamples.forEach((a, i) => { if (!a.duration) a.duration = i + 1 < aSamples.length ? Math.max(1e-4, aSamples[i + 1].ts - a.ts) : frameLen; });
    }

    // 2. video: every frame drawn at its exact time
    const nFrames = Math.ceil((snap.built.total + TAIL) * fps);
    const vSamples = [], avc = {}; let reordered = false, lastTs = -1, vDesc = null;
    venc = new VideoEncoder({ output: (chunk, meta) => {
      if (!vDesc && meta && meta.decoderConfig && meta.decoderConfig.description) vDesc = bytesOf(meta.decoderConfig.description);
      let d = new Uint8Array(chunk.byteLength); chunk.copyTo(d);
      if (o.format === 'mp4' && !vDesc) d = avcFrame(d, avc); // to MP4's length-prefixed form now, so only one copy is ever kept
      if (chunk.timestamp <= lastTs) reordered = true; lastTs = Math.max(lastTs, chunk.timestamp);
      vSamples.push({ data: d, key: chunk.type === 'key', pts: chunk.timestamp / 1e6 });
    }, error: fail });
    venc.configure(vconf);
    const vc = $('vcanvas'); vc.width = w; vc.height = h;
    const g = vc.getContext('2d'), d = Math.min(w, h) / 540;
    const cam = { slo: 50, shi: 80, snap: true, k: 1 - Math.pow(0.9, 60 / fps) }; // eases at the same speed per second as the 60 fps screen
    let lastShow = 0;
    for (let f = 0; f < nFrames; f++) {
      if (rec.cancelled) throw 'cancel';
      if (rec.error) throw rec.error;
      drawScene(g, w, h, d, f / fps, cam, true, snap);
      const frame = new VideoFrame(vc, { timestamp: Math.round(f * 1e6 / fps), duration: Math.round(1e6 / fps), alpha: 'discard' });
      venc.encode(frame, { keyFrame: f % (2 * fps) === 0 }); // a keyframe every 2 seconds keeps seeking quick
      frame.close();
      if (venc.encodeQueueSize > 6) await drain(venc, 3);
      const now = performance.now();
      if (now - lastShow > 120 || f === nFrames - 1) { // progress and a preview on the stage, a few times a second
        lastShow = now;
        const done = (f + 1) / nFrames, spent = (now - started) / 1000, left = spent / done - spent;
        $('vprog').value = done;
        xstatus('Rendering video… ' + Math.floor(done * 100) + '%' + (done > 0.03 ? ' · about ' + fmtClock(left) + ' left' : '') + (document.hidden ? ' · it\'s faster with this tab in front' : ''));
        const k = Math.min(cv.width / w, cv.height / h), pw = w * k, ph = h * k;
        g2.fillStyle = tracePalette(snap.piece.view.trace, snap.colors).bg; g2.fillRect(0, 0, cv.width, cv.height); g2.drawImage(vc, (cv.width - pw) / 2, (cv.height - ph) / 2, pw, ph);
        await nextTask();
      }
    }
    await Promise.race([venc.flush(), cancelled]); if (rec.cancelled) throw 'cancel';
    venc.close(); venc = null;
    if (vSamples.length !== nFrames) throw new Error('The encoder returned ' + vSamples.length + ' of ' + nFrames + ' frames.');
    if (!reordered) vSamples.forEach(s => { delete s.pts; }); // constant frame rate: frame i is at i / fps

    // 3. package
    if (rec.cancelled) throw 'cancel';
    xstatus('Saving video…');
    const audio = { codec: aconf.kind, sampleRate: 48000, channels: 2, bitrate: aconf.config.bitrate, description: aDesc, samples: aSamples, delay: aDelay, length: pcm.L.length };
    if (o.format === 'mp4' && !vDesc) { if (!avc.sps || !avc.pps) throw new Error('The video encoder gave no H.264 parameter sets.'); vDesc = avcConfig(avc.sps, avc.pps); }
    const video = { codec: vconf.codec.startsWith('vp8') ? 'vp8' : 'vp9', width: w, height: h, fps, description: o.format === 'mp4' ? vDesc : null, samples: vSamples };
    const box = videoContainer(o.format, aconf.kind);
    const meta = { title: String(snap.piece.name || '').trim() || fileName, artist: artistName() };
    const parts = o.format === 'mp4' ? mp4Mux({ video, audio, quicktime: box.ext === 'mov', meta }) : webmMux({ video, audio, meta });
    const blob = new Blob(parts, { type: box.type });
    const secs = ((performance.now() - started) / 1000).toFixed(0);
    if (await saveFile(fileName + '.' + box.ext, blob))
      xstatus('Saved ' + fileName + '.' + box.ext + ' (' + w + '×' + h + ', ' + fps + ' fps, ' + (blob.size / 1048576).toFixed(0) + ' MB) in ' + secs + ' s.' + (box.ext === 'mov' ? ' It\'s a QuickTime .mov with uncompressed audio, because this browser can\'t encode AAC for an MP4.' : ''));
  } catch (e) {
    xstatus(e === 'cancel' ? 'Render cancelled.' : 'The video couldn\'t be rendered: ' + (e && e.message ? e.message : e));
  } finally {
    for (const enc of [venc, aenc]) if (enc && enc.state !== 'closed') { try { enc.close(); } catch (e) {} }
    if (wake) wake.release().catch(() => {});
    rendering = null; setRenderUI(false); screenCam.snap = true;
  }
}
// what this browser can render; unsupported choices are marked, and without encoders only Record live is offered
async function probeRendering() {
  if (!CAN_RENDER) { document.querySelector('.video-box').classList.add('no-render'); $('vhint').textContent = 'Records the piece in real time with sound. Keep this tab in front while it records. (Frame-by-frame rendering needs Chrome, Edge or Safari.)'; return; }
  for (const opt of $('vformat').options) {
    const ok = !!(await pickVideoConfig(opt.value, 1920, 1080, 30, 8e6));
    if (!ok) { opt.textContent += ' (not supported here)'; opt.disabled = true; }
  }
  // without AAC, H.264 renders are saved as QuickTime .mov files with uncompressed audio: say so on the menu
  aacOk = !!(await tryAudioCodec('mp4a.40.2', 320000));
  const h264 = [...$('vformat').options].find(x => x.value === 'mp4');
  if (h264 && !aacOk && !h264.disabled) h264.textContent = 'MOV (H.264)';
  showVideoEstimate();
  if ($('vformat').selectedOptions[0] && $('vformat').selectedOptions[0].disabled) { const ok = [...$('vformat').options].find(x => !x.disabled); if (ok) $('vformat').value = ok.value; else document.querySelector('.video-box').classList.add('no-render'); }
}
{ // remembered video choices (this browser only; not part of the piece)
  try { const v = JSON.parse(lsGet('cge.video') || 'null'); if (v) for (const [id, k] of [['vaspect', 'aspect'], ['vsize', 'size'], ['vfps', 'fps'], ['vformat', 'format'], ['vquality', 'quality']]) if (v[k] !== undefined && [...$(id).options].some(x => x.value == v[k])) $(id).value = String(v[k]); } catch (e) {}
  for (const id of ['vaspect', 'vsize', 'vfps', 'vformat', 'vquality']) $(id).addEventListener('change', () => { saveVideoOpts(); showVideoEstimate(); });
  // auto zoom times: Automatic, or this piece's own (starting from the automatic ones)
  $('vzoom').addEventListener('change', () => { if (!built) return; if ($('vzoom').value === 'custom') { const L = landmarks(built), z = {}; ZOOM_KEYS.forEach(k => { z[k] = Math.round(L[k] * 10) / 10; }); setZoom(z); } else setZoom(undefined); });
  const zoomField = (i, val) => { if (!piece.view.zoom || !Number.isFinite(val) || val < 0) { syncZoomUI(); return; }
    const z = Object.assign({}, piece.view.zoom), v = ZOOM_KEYS.map(k => z[k]); v[i] = Math.round(val * 10) / 10;
    for (let k = i + 1; k < 4; k++) v[k] = Math.max(v[k], v[k - 1]); for (let k = i - 1; k >= 0; k--) v[k] = Math.min(v[k], v[k + 1]); // keep them in order around the one changed
    ZOOM_KEYS.forEach((k, j) => { z[k] = v[j]; }); setZoom(z); };
  ZOOM_IDS.forEach((id, i) => { $(id).addEventListener('change', () => zoomField(i, parseZoom($(id).value))); $(id).addEventListener('keydown', e => { if (e.key === 'Enter') $(id).blur(); }); });
  document.querySelectorAll('.znow').forEach(btn => btn.addEventListener('click', () => zoomField(+btn.dataset.z, currentT())));
  try { const v = JSON.parse(lsGet('cge.video') || 'null'); if (v && typeof v.artist === 'boolean') $('vartist').checked = v.artist; } catch (e) {}
  $('vartist').addEventListener('change', saveVideoOpts);
  showArtistOption();
  $('vrender').addEventListener('click', () => { if (rendering) { rendering.cancelled = true; rendering.onCancel(); } else renderVideo(); });
  probeRendering();
}

/* ---------- Wiring ---------- */
/* ---------- Parts ----------
   The part bar above the tabs chooses which part the tabs edit. The main part is the piece's own voices; `piece.parts`
   holds the others. With an added part chosen, the tabs' controls that belong to a part (voices and voicing, departure
   order and stagger, tone, detune and width) edit that part; each tab shows that part's own settings at the top (its line,
   doubling, portamento and vibrato, level, pan and envelope); and what every part shares (the chords, chord length, glide
   time and curve, reverb, brightness, volume shape and seeds) sits under "Whole piece". Edits rebuild as you go and are
   committed for undo when a control is let go. A part's id never changes once made, so renaming it keeps its seeds. */
let selPart = 'main'; // the part the tabs edit: 'main' or a part's id
const STARTS = {
  melody: { name: 'Melody', preset: 'line', step: '1/8', transpose: [0], portamento: 0.04, vibrato: { cents: 15, rate: 5.5, delay: 0.35 },
    sound: { tone: 'triangle', level: -1, pan: 0.15, width: 20, detune: 3 }, envelope: { attack: 0.02, decay: 0.3, sustain: 0.7, release: 0.2 } },
  bass: { name: 'Bass', preset: 'line', step: '1/4', transpose: [0], portamento: 0,
    sound: { tone: 'saw', level: -5, pan: 0, width: 0, detune: 3 }, envelope: { attack: 0.005, decay: 0.25, sustain: 0.55, release: 0.08 } },
  pad: { name: 'Pad', preset: 'pad', voices: 4, sound: { tone: 'bowed', level: -6, pan: 0, width: 70 } },
  basspattern: { name: 'Bass pattern', preset: 'pattern', pattern: "R R'", step: '1/8', from: 36, transpose: [0], portamento: 0,
    sound: { tone: 'saw', level: -6, pan: 0, width: 0, detune: 3 }, envelope: { attack: 0.004, decay: 0.18, sustain: 0.45, release: 0.05, curve: 'exp' } },
  kick: { name: 'Kick', preset: 'pattern', pattern: 'C1', step: '1/4', from: 24, transpose: [0], portamento: 0, drop: { semis: 36, time: 0.12 },
    sound: { tone: 'pure', level: -2, pan: 0, width: 0, detune: 0 }, envelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.05, curve: 'exp' } },
  arpeggio: { name: 'Arpeggio', preset: 'pattern', pattern: '1 2 3 4 3 2', step: '1/16', from: 60, transpose: [0], portamento: 0,
    sound: { tone: 'square', level: -9, pan: -0.25, width: 30, detune: 3 }, envelope: { attack: 0.003, decay: 0.12, sustain: 0.35, release: 0.05, curve: 'exp' } }
};
const STEP_NAMES = [['1/1', 'Whole notes'], ['1/2', 'Half notes'], ['1/4', 'Quarter notes'], ['1/8', 'Eighth notes'], ['1/16', 'Sixteenth notes'], ['1/32', 'Thirty-second notes'],
  ['1/4t', 'Quarter-note triplets'], ['1/8t', 'Eighth-note triplets'], ['1/16t', 'Sixteenth-note triplets']];
const fmtDb = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(Number.isInteger(v) ? 0 : 1) + ' dB';
const fmtPan = v => Math.abs(v) < 0.005 ? 'center' : (v < 0 ? 'left ' : 'right ') + Math.round(Math.abs(v) * 100);
const fmtSec = v => v < 1 ? Math.round(v * 1000) + ' ms' : (+v).toFixed(2) + ' s';
const toneName = t => { const o = $('tone').querySelector('option[value="' + t + '"]'); return o ? o.textContent.replace(/ \(.*\)$/, '') : t; };
const partsList = () => piece.parts || (piece.parts = []);
const partRoom = () => ({ voices: REALIZATION_LIMITS.voices - (built ? built.N : piece.voices), parts: MAX_PARTS - (piece.parts || []).length });
function uniquePartId(name) {
  const used = new Set(['main', ...(piece.parts || []).map(x => x.id)]), base = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20) || 'part';
  let id = base; for (let k = 2; used.has(id); k++) id = base + '-' + k;
  return id;
}
/* A new line part starts from the chords, so it plays in key straight away: the bass note of each chord, or a chord tone
   (usually the third) an octave and more above middle C, held for the chord's length */
function starterLine(kind) {
  const items = parseProgression(piece.chords).items, beat = 60 / piece.timing.tempo, stepBeats = kind === 'bass' ? 1 : 0.5;
  if (!items.length) return kind === 'bass' ? 'C2:4' : 'E5:8';
  const ev = built && built.main.events.length === items.length ? built.main.events : null;
  let used = 0; // steps so far: the last note takes exactly what's left, so the line ends with the chords
  return items.map((it, k) => {
    const len = ev ? (k + 1 < ev.length ? ev[k + 1].t : built.main.total) - ev[k].t : (itemSeconds(it, piece) || defaultChordSec(piece));
    const last = ev && k === items.length - 1;
    const steps = last ? Math.max(0.01, Math.round((built.main.total / beat / stepBeats - used) * 100) / 100) : Math.max(0.25, Math.round(len / beat / stepBeats * 4) / 4);
    used += steps;
    const pc = it.kind === 'note' ? ((Math.round(it.midi) % 12) + 12) % 12 : kind === 'bass' ? it.bass : it.pcs[Math.min(1, it.pcs.length - 1)];
    return noteName(placeBass(pc, kind === 'bass' ? 36 : 72)) + ':' + steps;
  }).join(' | ');
}
/* The tabs' controls that belong to a part, and which kinds of part have them */
const PART_CTRL = { voices: 'pad', continuity: 'pad', coverage: 'pad', stacking: 'pad', spacing: 'pad', variation: 'pad', spread: 'pad', top: 'pad', bassoct: 'pad', bassmode: 'pad', order: 'pad', stagger: 'pad', tone: 'all', detune: 'all', width: 'all', breathedepth: 'pad', breathetime: 'pad', duckunder: 'all', duckdepth: 'all', ducktime: 'all', echotime: 'all', echomix: 'all', echofb: 'all', echopan: 'all' };
const applies = (id, n) => PART_CTRL[id] === 'all' || (PART_CTRL[id] === 'pad' && n.preset === 'pad');
['chords', 'seed-harmony', 'tu-sec', 'chordsec', 'chordbars', 'tempo', 'meter', 'seed-voicing', 'seed-motion', 'glide', 'easing', 'seed-sound', 'reverb', 'brightness', 'mix', 'tuning', 'vshape']
  .forEach(id => { const w = $(id).closest('.tabpanel > *'); if (w) w.dataset.whole = ''; }); // shared by every part
const selRaw = () => selPart === 'main' ? null : (piece.parts || []).find(x => x.id === selPart) || null;
// the chosen part with every setting filled in (only it is normalized, so a large piece of saved notes isn't copied each time)
const selNorm = () => { const raw = selRaw(); if (!raw) return null; try { return (normalizePiece(Object.assign({}, piece, { realization: undefined, parts: [raw] })).parts || [])[0] || null; } catch (e) { return null; } };
const partTarget = id => (PART_CTRL[id] && selRaw()) || piece; // where a tab control writes
const setDeep = (o, path, v) => { const ks = path.split('.'), last = ks.pop(); ks.reduce((a, k) => (a[k] && typeof a[k] === 'object') ? a[k] : (a[k] = {}), o)[last] = v; };
function addPart(kind) {
  if (kind === 'echo') { // a copy of the chosen part, or of the first line or pattern
    const src = selRaw() && selRaw().preset !== 'copy' ? selRaw() : (piece.parts || []).find(x => x.preset === 'line' || x.preset === 'pattern');
    if (!src) return;
    const sn = (built && built.parts.find(x => x.id === src.id)) || src, part = { name: (src.name || src.id) + ' echo', preset: 'copy', of: src.id, delay: 0.75, shift: 0,
      sound: { tone: (sn.sound && sn.sound.tone) || piece.sound.tone, level: ((sn.sound && sn.sound.level) || 0) - 7, pan: -0.5, width: 20, detune: 3 } };
    part.id = uniquePartId(part.name); partsList().push(part); selPart = part.id; closePops(); rebuild(true); commit(); syncUI(); return;
  }
  const part = JSON.parse(JSON.stringify(STARTS[kind]));
  if (part.preset === 'line') part.line = starterLine(kind);
  part.id = uniquePartId(part.name);
  const firstRhythm = part.preset === 'pattern' && !(piece.parts || []).some(x => x.preset === 'pattern'); // (a kick is a pattern too)
  partsList().push(part); selPart = part.id;
  closePops(); rebuild(true); commit(); syncUI();
  if (firstRhythm && piece.timing.unit !== 'bar') offerBars();
}
/* The first rhythm part in a piece kept in seconds: offer to keep time in bars instead, so chords change on the beat. The chord
   length converts at the current tempo, as the Time switch does, so nothing you hear changes until you set a whole number of bars. */
function offerBars() {
  const T = piece.timing, bars = T.chordSec / (60 / T.tempo * T.meter);
  $('barsoffer-text').textContent = 'Patterns follow the beat. This piece keeps time in seconds (' + T.chordSec.toFixed(1) + ' s a chord, ' + (Math.round(bars * 100) / 100) + ' bars at ' + T.tempo + ' BPM), so chords can change between beats. Keep time in bars instead?';
  $('barsoffer').hidden = false;
}
$('barsoffer-yes').addEventListener('click', () => { $('barsoffer').hidden = true; $('tu-bar').checked = true; $('tu-bar').dispatchEvent(new Event('change')); });
$('barsoffer-no').addEventListener('click', () => { $('barsoffer').hidden = true; });
// short, so the menu fits a phone: the name and the kind of part
function partLabel(n, raw) {
  if (!n) return (raw.name || raw.id) + ' (left out)';
  if (n.preset === 'line' && parseLine(n.line, n.transpose, fallOf(n)).errors.length) return n.name + ' (line: check it)';
  if (n.preset === 'pattern' && parsePattern(n.pattern).errors.length) return n.name + ' (pattern: check it)';
  // an echo's source, looked up in the piece itself (the last build can be a step behind: the menu is drawn before a rebuild)
  const pid = x => String(x.id || x.name || x.preset || 'line').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'part';
  if (n.preset === 'copy' && !(piece.parts || []).some(x => x && x.preset !== 'copy' && pid(x) === n.of)) return n.name + ' (echo: no source)';
  return n.name + ' (' + { pad: 'pad', line: 'line', notes: 'saved notes', pattern: 'pattern', copy: 'echo' }[n.preset] + ')';
}
/* The part bar: the menu of parts, and what can be done to the chosen one */
/* Plays in: the sections the chosen part (or the main part) plays in. All sections is the default (no list saved). */
/* Sections on the player bar: jump to any stretch of a section as it falls in time, or loop the one that's playing. For
   listening only: neither is saved with the piece. */
let loopOn = false, loopRun = null;
const sectionRunAt = t => (built && built.sections || []).find(r => t >= r.t0 - 1e-6 && t < r.t1 - 1e-6) || null;
function jumpTo(t) { offset = t; screenCam.snap = true; if (playing) startAudio(offset); }
function fillSections() {
  const list = $('seclist'), runs = built && built.sections || [], here = sectionRunAt(currentT());
  list.textContent = '';
  const item = (label, t, on) => { const b = document.createElement('button'); b.type = 'button'; if (on) b.classList.add('on');
    const n = document.createElement('span'); n.textContent = label; const w = document.createElement('span'); w.className = 'when'; w.textContent = fmtClock(t);
    b.append(n, w); b.addEventListener('click', () => { jumpTo(t); loopRun = sectionRunAt(t); setPop(secPop, secBtn, false); }); list.appendChild(b); };
  if (runs.length && runs[0].t0 > 0.01) item('Start', 0, !here && currentT() < runs[0].t0);
  for (const r of runs) item(r.name + (sectionPasses(r.name) > 1 ? ' ' + (r.pass + 1) + '/' + sectionPasses(r.name) : ''), r.t0, here === r);
}
$('secloop').addEventListener('change', () => { loopOn = $('secloop').checked; loopRun = loopOn ? sectionRunAt(currentT()) : null; $('secbtn').classList.toggle('looping', loopOn); });
const sectionPasses = name => { const s = built && built.sections ? built.sections.filter(r => r.name === name) : []; return s.length ? Math.max(...s.map(r => r.pass)) + 1 : 1; };
function syncPlays() {
  const names = built && built.sections ? [...new Set(built.sections.map(r => r.name))] : [];
  $('plays-box').hidden = !names.length; if (!names.length) return;
  const tgt = selRaw() || piece, pl = Array.isArray(tgt.plays) ? tgt.plays : null, box = $('plays');
  $('plays-lbl').textContent = (selRaw() ? (selRaw().name || selRaw().id) : 'Main part') + ' plays in';
  box.replaceChildren();
  const chip = (text, on, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'small'; b.textContent = text; b.setAttribute('aria-pressed', String(on)); b.addEventListener('click', fn); box.appendChild(b); };
  chip('All sections', !pl, () => { delete tgt.plays; playsChanged(tgt); });
  for (const n of names) chip(n, !pl || pl.includes(n), () => {
    const cur = Array.isArray(tgt.plays) ? tgt.plays.slice() : names.slice(), k = cur.indexOf(n);
    if (k >= 0) cur.splice(k, 1); else cur.push(n);
    if (names.every(x => cur.includes(x))) delete tgt.plays; else tgt.plays = names.filter(x => cur.includes(x)).concat(cur.filter(x => !names.includes(x))); // in the piece's order (keeping names not in it now)
    playsChanged(tgt); });
  const missing = pl ? pl.filter(x => !names.includes(x)) : [];
  $('plays-hint').textContent = (pl && !pl.some(x => names.includes(x)) ? 'This part plays in none of these sections, so it is silent. ' : '') + 'Which sections this part plays in. Outside them it rests, coming in and out by its envelope.' + (missing.length ? ' Also kept for sections not in the chords now: ' + missing.join(', ') + '.' : '');
}
function playsChanged(tgt) { rebuild(true); syncPlays(); if (tgt !== piece) refreshPartBar(); commit(); }
function refreshPartBar() {
  const sel = $('partsel'), raws = piece.parts || [];
  let norm = []; try { norm = raws.length ? (normalizePiece(Object.assign({}, piece, { realization: undefined })).parts || []) : []; } catch (e) { norm = []; }
  const opts = [['main', 'Main']].concat(raws.map(r => [r.id, partLabel(norm.find(x => x.id === r.id), r)]));
  if (sel.options.length !== opts.length || opts.some(([v, t], k) => sel.options[k].value !== v || sel.options[k].textContent !== t)) {
    sel.textContent = ''; for (const [v, t] of opts) { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); }
  }
  sel.value = selPart;
  const k = raws.findIndex(x => x.id === selPart), raw = raws[k], room = partRoom();
  $('partmore').disabled = !raw; if (!raw) $('morepop').hidden = true;
  if (raw && document.activeElement !== $('partname')) $('partname').value = raw.name || raw.id;
  $('partup').disabled = k <= 0; $('partdown').disabled = k < 0 || k >= raws.length - 1;
  const n = raw && norm.find(x => x.id === raw.id);
  $('partdup').disabled = !n || room.parts <= 0 || room.voices < partVoices(n, norm);
  // an echo copies the chosen part (or the first line or pattern), and needs as many voices as it has
  const echoSrc = raw && raw.preset !== 'copy' ? n : norm.find(x => x.preset === 'line' || x.preset === 'pattern');
  document.querySelectorAll('[data-addpart]').forEach(b => { const kind = b.dataset.addpart, need = kind === 'pad' ? STARTS.pad.voices : kind === 'echo' ? (echoSrc ? partVoices(echoSrc, norm) : Infinity) : 1; b.disabled = room.parts <= 0 || room.voices < need; });
  $('addecho').querySelector('small').textContent = echoSrc ? (echoSrc.name || echoSrc.id) + ' again, later and moved' : 'add a melody or pattern first, then echo it';
  $('parts-room').hidden = !(room.parts <= 0 || room.voices < 4);
  $('parts-room').textContent = room.parts <= 0 ? 'A piece can have up to ' + MAX_PARTS + ' parts besides the main one.' : 'Room for ' + room.voices + ' more voice' + (room.voices === 1 ? '' : 's') + ' (' + REALIZATION_LIMITS.voices + ' in all).';
}
/* Show the tabs for the chosen part: which controls apply, what the tabs are called, and the part's own settings */
function applyPartView() {
  if (selPart !== 'main' && !selRaw()) selPart = 'main'; // gone: another piece opened, or undone
  if (built) syncPlays();
  const n = selNorm(), on = !!n;
  document.querySelector('.rack').classList.toggle('on-part', on);
  document.querySelectorAll('.sect.whole').forEach(x => { x.hidden = !on; });
  for (const id of Object.keys(PART_CTRL)) $(id).closest('.tabpanel > *').hidden = on && !applies(id, n);
  const line = on && n.preset === 'line', pat = on && n.preset === 'pattern', notes = on && n.preset === 'notes', echo = on && n.preset === 'copy';
  $('t-harmony').textContent = line ? 'Line' : pat ? 'Pattern' : notes ? 'Notes' : echo ? 'Echo' : 'Harmony';
  $('t-voicing').textContent = line || pat ? 'Voices' : 'Voicing';
  $('t-voicing').classList.toggle('dim', notes || echo); $('t-motion').classList.toggle('dim', notes || echo);
  $('partsel-hint').textContent = on ? 'The tabs below edit ' + n.name + '. Settings shared by every part are under Whole piece.' : 'The tabs below edit the main part.';
  renderPartBlocks(n);
  refreshPartBar();
}
let peSeq = 0;
const mk = (tag, props = {}, kids = []) => { const e = document.createElement(tag); Object.assign(e, props); kids.forEach(c => e.append(c)); return e; };
/* The chosen part's own settings, at the top of each tab */
function renderPartBlocks(n) {
  const blocks = { harmony: $('pp-harmony'), voicing: $('pp-voicing'), motion: $('pp-motion'), sound: $('pp-sound') };
  const keep = Object.values(blocks).find(b => b.contains(document.activeElement)); // don't rebuild under the cursor
  if (keep && n && keep.dataset.part === n.id) return;
  for (const b of Object.values(blocks)) { b.textContent = ''; b.hidden = true; b.dataset.part = n ? n.id : ''; }
  if (!n) return;
  const raw = selRaw();
  // a control writes only its own setting (the rest keep their defaults, or for a pad, the main part's), so choosing a part changes nothing
  const own = key => (raw[key] && typeof raw[key] === 'object' && !Array.isArray(raw[key])) ? raw[key] : (raw[key] = {});
  const changed = () => { rebuildSoon(); refreshPartBar(); };
  const field = (label, input, extra = []) => { const id = 'pe' + (++peSeq); input.id = id; return mk('div', { className: 'group' }, [mk('label', { htmlFor: id, textContent: label }), input, ...extra]); };
  const slider = (label, min, max, step, val, fmt, set) => {
    const id = 'pe' + (++peSeq), out = mk('output'), inp = mk('input', { type: 'range', id, min, max, step });
    inp.value = val; out.textContent = fmt(+val);
    inp.addEventListener('input', () => { set(+inp.value); out.textContent = fmt(+inp.value); changed(); });
    inp.addEventListener('change', commit);
    return mk('div', { className: 'slider' }, [mk('label', { htmlFor: id, textContent: label }), out, inp]);
  };
  const select = (label, html, val, set) => { const sel = mk('select', { innerHTML: html }); sel.value = String(val); sel.addEventListener('change', () => { set(sel.value); rebuild(true); refreshPartBar(); commit(); }); return field(label, sel); };
  const check = (label, val, set) => { const cb = mk('input', { type: 'checkbox', checked: !!val }); cb.addEventListener('change', () => { set(cb.checked); rebuild(true); refreshPartBar(); commit(); }); return mk('label', {}, [cb, ' ' + label]); };
  const opts = list => list.map(([v, t]) => '<option value="' + v + '">' + t + '</option>').join('');
  const sect = t => mk('p', { className: 'sect', textContent: t });
  const put = (key, ...els) => { if (els.length) { blocks[key].append(...els); blocks[key].hidden = false; } };
  if (n.preset === 'pattern') {
    const ta = mk('textarea', { value: raw.pattern !== undefined ? raw.pattern : n.pattern, spellcheck: false }), err = mk('p', { className: 'err' });
    const showErr = () => { const e = parsePattern(ta.value).errors; err.hidden = !e.length; err.textContent = e.length ? 'Can\'t read ' + e.slice(0, 4).join(', ') + (e.length > 4 ? '…' : '') + '. Steps are R, B or a number, with \' or , for octaves, . to hold, - to rest, and a length after a colon (R:2).' : ''; };
    ta.addEventListener('input', () => { raw.pattern = ta.value; showErr(); changed(); }); ta.addEventListener('change', commit); showErr();
    const start = mk('input', { type: 'number', min: 0, step: 0.5, value: n.start });
    start.addEventListener('input', () => { raw.start = Math.max(0, +start.value || 0); changed(); }); start.addEventListener('change', commit);
    const lows = []; for (let m = 24; m <= 84; m++) lows.push([m, noteName(m)]);
    put('harmony', field('Pattern', ta, [err, mk('p', { className: 'hint', innerHTML: 'Each step takes its note from the chord playing as it starts. <code>R</code> is the root and <code>B</code> the bass note, and <code>3rd</code>, <code>5th</code>, <code>7th</code> are the chord\'s third, fifth and seventh; <code>1</code>, <code>2</code>, <code>3</code>… are chord tones counting up from the lowest note below, on into the next octave. <code>\'</code> raises a step an octave and <code>,</code> lowers one; <code>.</code> holds, <code>-</code> rests, and <code>:2</code> makes a step two long; <code>~</code> before a step slides into it and <code>@0.6</code> after it strikes it softer. A note name like <code>C1</code> is that note whatever the chord. It loops until the music ends. Try <code>R R\'</code> for an octave bass, or <code>1 2 3 4 3 2</code> for an arpeggio. In a piece with sections, <code>[B]</code> starts the steps for section B, and <code>[A A2]</code> steps for both; steps before any marker play everywhere else.' })]),
      mk('div', { className: 'two' }, [select('Step', opts(STEP_NAMES), n.step, v => { raw.step = v; }), select('Lowest note', opts(lows), n.from, v => { raw.from = +v; })]),
      mk('div', { className: 'two' }, [field('Start (beats)', start), mk('div', { className: 'checks' }, [check('Legato (join notes)', n.legato, v => { raw.legato = v; }), check('Never stops', n.nonstop, v => { if (v) raw.nonstop = true; else delete raw.nonstop; })])]), mk('p', { className: 'hint', textContent: 'Never stops: its voices sound from start to end as one tone each, like a single instrument changing notes. Rests hold the note before, and outside its sections (or before its first note and after its last) its voices join the chords in their own range.' }));
  }
  if (n.preset === 'line' || n.preset === 'pattern') {
    if (n.preset === 'line') {
    const ta = mk('textarea', { value: raw.line || '', spellcheck: false }), err = mk('p', { className: 'err' });
    const showErr = () => { const e = parseLine(ta.value, raw.transpose || n.transpose, fallOf(n)).errors; err.hidden = !e.length; err.textContent = e.length ? 'Can\'t read ' + e.slice(0, 4).join(', ') + (e.length > 4 ? '…' : '') + '. Notes look like C4, F#3 or D3+33, with a length in steps after a colon (G4:2); a rest is - (or -:4). Notes out of range (MIDI 0–127, after the doubling on the Voices tab, and from the top of a pitch drop) play as rests.' : ''; };
    ta.addEventListener('input', () => { raw.line = ta.value; showErr(); changed(); }); ta.addEventListener('change', commit); showErr();
    const start = mk('input', { type: 'number', min: 0, step: 0.5, value: n.start });
    start.addEventListener('input', () => { raw.start = Math.max(0, +start.value || 0); changed(); }); start.addEventListener('change', commit);
    put('harmony', field('Line', ta, [err, mk('p', { className: 'hint', innerHTML: 'One note per step unless it says otherwise: <code>G4:2</code> lasts two steps, <code>-</code> is a rest, and <code>|</code> is just for reading. <code>~G4</code> slides into a note without a new attack, and <code>G4@0.6</code> (or <code>@60%</code>) strikes it softer. <code>G4:2/0.4</code> glides into a note over 0.4 seconds without a new attack (<code>/0.4l</code> in a straight line, <code>/0</code> a jump), and a note can carry cents to a thousandth: <code>G4-21.506</code>. In a piece with sections, <code>[B]</code> starts the notes for section B, and <code>[A A2]</code> notes for both; notes before any marker play everywhere else, and a section\'s key change moves the notes too. The chords it plays over are under Whole piece.' })]),
      mk('div', { className: 'two' }, [select('Step', opts(STEP_NAMES), n.step, v => { raw.step = v; }), field('Start (beats)', start)]),
      mk('div', { className: 'checks' }, [check('Repeat to the end', n.repeat, v => { raw.repeat = v; }), check('Legato (join notes)', n.legato, v => { raw.legato = v; }), check('Never stops', n.nonstop, v => { if (v) raw.nonstop = true; else delete raw.nonstop; })]), mk('p', { className: 'hint', textContent: 'Never stops: its voices sound from start to end as one tone each, like a single instrument changing notes. Rests hold the note before, and outside its sections (or before its first note and after its last) its voices join the chords in their own range.' }));
    }
    const tr = mk('input', { type: 'text', value: n.transpose.join(', '), autocomplete: 'off', spellcheck: false });
    tr.addEventListener('input', () => { const v = tr.value.split(/[\s,]+/).filter(Boolean).map(Number).filter(Number.isFinite).slice(0, 8); raw.transpose = v.length ? v : [0]; changed(); }); tr.addEventListener('change', commit);
    put('voicing', field('Voices at (semitones)', tr, [mk('p', { className: 'hint', innerHTML: 'One voice per number, all singing the line: <code>0</code> is one voice, <code>0,&nbsp;-12</code> adds an octave below, <code>0,&nbsp;7</code> a fifth above.' })]));
    put('motion', slider('Portamento', 0, 4, 0.005, n.portamento, fmtSec, v => { raw.portamento = v; }),
      select('Glide shape', opts([['smooth', 'Smooth'], ['straight', 'Straight'], ['arc', 'Arc: out, then in (curves and circles)']]), n.glideShape, v => { raw.glideShape = v; }),
      mk('p', { className: 'hint', innerHTML: 'A slide (<code>~</code>) glides for up to the whole note. With Arc, each run of slides alternates a curve that leaves steeply with one that arrives steeply: <code>C4 ~E4 ~C4</code> with a long portamento draws the top of a circle.' }),
      sect('Vibrato'),
      slider('Depth', 0, 60, 1, n.vibrato.cents, v => v ? v + ' ¢' : 'off', v => { own('vibrato').cents = v; }),
      slider('Rate', 1, 10, 0.1, n.vibrato.rate, v => v.toFixed(1) + ' Hz', v => { own('vibrato').rate = v; }),
      slider('Delay', 0, 2, 0.05, n.vibrato.delay, fmtSec, v => { own('vibrato').delay = v; }),
      sect('Pitch drop'),
      slider('Drop', -24, 48, 1, n.drop.semis, v => v ? (v > 0 ? 'from ' + v + ' st above' : 'from ' + -v + ' st below') : 'off', v => { own('drop').semis = v; }),
      slider('Fall time', 0.01, 1, 0.005, n.drop.time, fmtSec, v => { own('drop').time = v; }),
      mk('p', { className: 'hint', textContent: 'Each note starts this far from its pitch and falls onto it, fast then settling: with a short envelope, a kick (36 semitones over about 0.12 s).' }));
  } else if (n.preset === 'copy') {
    const srcs = (piece.parts || []).filter(x => x.preset !== 'copy' && x.id !== n.id).map(x => [x.id, x.name || x.id]);
    const delay = mk('input', { type: 'number', min: 0, max: 64, step: 0.25, value: n.delay }), shift = mk('input', { type: 'number', min: -48, max: 48, step: 1, value: n.shift });
    delay.addEventListener('input', () => { raw.delay = Math.max(0, Math.min(64, +delay.value || 0)); changed(); }); delay.addEventListener('change', commit);
    shift.addEventListener('input', () => { raw.shift = Math.round(Math.max(-48, Math.min(48, +shift.value || 0))); changed(); }); shift.addEventListener('change', commit);
    const srcN = (() => { const s0 = (piece.parts || []).find(x => x.id === n.of); try { return s0 ? partVoices(normalizePiece(Object.assign({}, piece, { realization: undefined, parts: [s0] })).parts[0]) : 1; } catch (e) { return 1; } })();
    const vopts = [['0', 'All (' + srcN + ')']]; for (let k = 1; k < srcN; k++) vopts.push([String(k), 'The first ' + (k === 1 ? 'one' : k)]);
    put('harmony', select('Copy of', opts(srcs.length ? srcs : [['', '(no other parts)']]), n.of, v => { raw.of = v; }),
      mk('div', { className: 'two' }, [field('Delay (beats)', delay), field('Shift (semitones)', shift)]),
      select('Voices', opts(vopts), String(n.voices || 0), v => { if (+v > 0) raw.voices = +v; else delete raw.voices; }),
      mk('p', { className: 'hint', textContent: 'Plays the other part\'s notes again, later and moved, with its own tone, level and pan: 0.75 beats is a dotted eighth, 12 semitones an octave. It uses the other part\'s envelope, glides and vibrato.' }));
  } else if (n.preset === 'notes') {
    put('harmony', mk('p', { className: 'hint', textContent: 'Saved notes for ' + n.realization.N + ' voices, written into the piece file, played exactly as written.' }));
  } else {
    put('harmony', mk('p', { className: 'hint', textContent: 'This pad follows the chords under Whole piece, with its own voices and voicing (Voicing tab), departure order (Motion tab) and sound, and its own random choices.' }));
  }
  put('sound', slider('Level', -30, 6, 0.5, n.sound.level, fmtDb, v => { own('sound').level = v; }),
    slider('Pan', -1, 1, 0.05, n.sound.pan, fmtPan, v => { own('sound').pan = v; }));
  if (n.preset !== 'pad' && n.preset !== 'copy') put('sound', sect('Envelope'),
    slider('Attack', 0.001, 2, 0.001, n.envelope.attack, fmtSec, v => { own('envelope').attack = v; }),
    slider('Decay', 0, 3, 0.01, n.envelope.decay, fmtSec, v => { own('envelope').decay = v; }),
    slider('Sustain', 0, 1, 0.01, n.envelope.sustain, v => Math.round(v * 100) + '%', v => { own('envelope').sustain = v; }),
    slider('Release', 0.005, 5, 0.005, n.envelope.release, fmtSec, v => { own('envelope').release = v; }),
    select('Decay and release', opts([['linear', 'Straight'], ['exp', 'Natural: fast, then fading away']]), n.envelope.curve, v => { own('envelope').curve = v; }));
}
/* The part bar's menus */
function closePops() { for (const [pop, btn] of [['addpop', 'partadd'], ['morepop', 'partmore']]) { $(pop).hidden = true; $(btn).setAttribute('aria-expanded', 'false'); } }
function togglePop(pop, btn) { const open = $(pop).hidden; closePops(); if (open) { refreshPartBar(); $(pop).hidden = false; $(btn).setAttribute('aria-expanded', 'true'); const f = $(pop).querySelector('input, button:not([disabled])'); if (f) f.focus(); } }
$('partadd').addEventListener('click', () => togglePop('addpop', 'partadd'));
$('partmore').addEventListener('click', () => togglePop('morepop', 'partmore'));
document.addEventListener('click', e => { if (!e.target.closest('.partbar')) closePops(); });
document.querySelector('.partbar').addEventListener('keydown', e => { if (e.key === 'Escape') { closePops(); $('partsel').focus(); } });
document.querySelectorAll('[data-addpart]').forEach(b => b.addEventListener('click', () => addPart(b.dataset.addpart)));
$('partsel').addEventListener('change', () => { selPart = $('partsel').value; syncUI(); });
$('partname').addEventListener('input', () => { const raw = selRaw(); if (raw) { raw.name = $('partname').value; refreshPartBar(); applyPartView(); } });
$('partname').addEventListener('change', commit);
const movePart = d => { const ps = piece.parts, k = ps.findIndex(x => x.id === selPart), j = k + d; if (k < 0 || j < 0 || j >= ps.length) return; [ps[k], ps[j]] = [ps[j], ps[k]]; rebuild(true); commit(); syncUI(); };
$('partup').addEventListener('click', () => movePart(-1));
$('partdown').addEventListener('click', () => movePart(1));
$('partdup').addEventListener('click', () => { const raw = selRaw(); if (!raw) return; const c = JSON.parse(JSON.stringify(raw)); c.name = (raw.name || raw.id) + ' copy'; c.id = uniquePartId(c.name); piece.parts.splice(piece.parts.indexOf(raw) + 1, 0, c); selPart = c.id; closePops(); rebuild(true); commit(); syncUI(); });
$('partdel').addEventListener('click', () => { const k = (piece.parts || []).findIndex(x => x.id === selPart); if (k < 0) return; piece.parts.splice(k, 1); if (!piece.parts.length) delete piece.parts; selPart = 'main'; closePops(); rebuild(true); commit(); syncUI(); });

/* The volume shape: a few shapes over the piece's current length (straight lines in dB) */
const SHAPES = {
  fadein: T => [{ t: 0, db: -36 }, { t: T * 0.25, db: 0 }],
  crescendo: T => [{ t: 0, db: -15 }, { t: T, db: 0 }],
  swell: T => [{ t: 0, db: -12 }, { t: T * 0.65, db: 0 }, { t: T, db: -9 }],
  fadeout: T => [{ t: 0, db: 0 }, { t: T * 0.7, db: 0 }, { t: T, db: -30 }]
};
const shapeAt = (name, T) => SHAPES[name](T).map(x => ({ t: Math.round(x.t * 100) / 100, db: x.db }));
function syncVolumeShape() {
  const v = piece.volume, T = built ? built.total : 0, sel = $('vshape');
  let name = 'none';
  if (v && v.length) name = Object.keys(SHAPES).find(k => JSON.stringify(shapeAt(k, T)) === JSON.stringify(v)) || 'custom';
  sel.querySelector('option[value="custom"]').hidden = name !== 'custom';
  sel.value = name; sel.disabled = !built;
  $('vshape-hint').textContent = name === 'custom' ? 'A shape from the piece file, or one set for a different length. Choose a shape to set it for the piece as it is now.' : 'A shape over the whole piece, on top of the volume control. Set for the piece\'s current length.';
}
$('vshape').addEventListener('change', () => {
  const v = $('vshape').value;
  if (v === 'none') delete piece.volume; else if (SHAPES[v] && built) piece.volume = shapeAt(v, built.total);
  rebuild(true); commit(); syncVolumeShape();
});

const STRUCTURAL = new Set(['tuning', 'chordsec', 'chordbars', 'voices', 'continuity', 'coverage', 'stacking', 'spacing', 'variation', 'spread', 'glide', 'stagger', 'top', 'bassoct', 'bassmode', 'easing', 'order']);
for (const [id, path, fmt] of SLIDERS) {
  const el = $(id);
  el.addEventListener('input', () => {
    const tgt = partTarget(id); // the chosen part, for a control that belongs to a part
    if (STRUCTURAL.has(id) || (id === 'tempo' && usesMusicalTime(piece))) { if (tgt === piece) unfreeze(); else delete tgt.realization; }
    const v = id === 'voices' ? parseInt(el.value, 10) : parseFloat(el.value);
    setDeep(tgt, path, v);
    $('o-' + id).textContent = fmt(v);
    rebuildSoon(); updateStatus(); if (tgt !== piece) refreshPartBar();
  });
  el.addEventListener('change', commit);
}
// Echo: Off, or a note length; turning it on starts at 35% with a few repeats
$('echotime').addEventListener('change', () => {
  const tgt = partTarget('echotime'), v = $('echotime').value, cur = getPath(tgt === piece ? piece : (selNorm() || {}), 'echo') || {};
  if (v === 'off') setDeep(tgt, 'echo.mix', 0); else { setDeep(tgt, 'echo.time', v); if (!(cur.mix > 0)) setDeep(tgt, 'echo.mix', 0.35); }
  rebuild(true); syncUI(); if (tgt !== piece) refreshPartBar(); commit();
});
for (const [id, path, conv] of SELECTS) $(id).addEventListener('change', () => {
  const tgt = partTarget(id);
  if (STRUCTURAL.has(id) || (id === 'meter' && usesMusicalTime(piece))) { if (tgt === piece) unfreeze(); else delete tgt.realization; } setDeep(tgt, path, conv($(id).value));
  if (tgt !== piece) { rebuild(true); refreshPartBar(); commit(); return; }
  const swap = id === 'tone' && playing && !recording && live; // tone doesn't change any pitch, so the running voices can just change waveform
  rebuild(true, !swap); if (swap) swapToneLive(piece.sound.tone);
  commit();
});
/* Time: chords without a length of their own last chordSec seconds, or chordBars bars. Switching converts the length at the
   current tempo, so what you hear doesn't change (lengths outside the slider's range are brought into it). */
document.querySelectorAll('input[name=timeunit]').forEach(r => r.addEventListener('change', () => {
  const T = piece.timing, bar = 60 / T.tempo * T.meter;
  if (r.value === 'bar') T.chordBars = Math.min(32, Math.max(0.25, T.chordSec / bar)); else T.chordSec = Math.min(12, Math.max(1.5, T.chordBars * bar));
  T.unit = r.value; unfreeze(); syncUI(); rebuild(true); commit();
}));
$('chords').addEventListener('input', () => { unfreeze(); piece.chords = $('chords').value; rebuildSoon(); updateStatus(); saveDraftSoon(); });
$('chords').addEventListener('change', commit);
$('name').addEventListener('input', () => { piece.name = $('name').value; updateStatus(); saveDraftSoon(); });
$('name').addEventListener('change', () => { piece.name = safeName($('name').value); $('name').value = piece.name; commit(); });
for (const L of LAYERS) {
  $('seed-' + L).addEventListener('change', () => {
    const v = parseSeed($('seed-' + L).value);
    if (v === null) { $('seed-' + L).value = fmtSeed(piece.seeds[L]); return; }
    if (L !== 'sound' && v !== piece.seeds[L]) unfreeze();
    piece.seeds[L] = v; afterChange();
  });
  $('lock-' + L).addEventListener('click', () => { piece.locks[L] = !piece.locks[L]; syncUI(); commit(); });
  $('roll-' + L).addEventListener('click', () => { reroll(L); afterChange(); });
}
document.querySelectorAll('.layerlock').forEach(b => b.addEventListener('click', () => { const L = b.dataset.layer; piece.locks[L] = !piece.locks[L]; syncUI(); commit(); }));
$('rerollall').addEventListener('click', () => {
  const open = LAYERS.filter(L => !piece.locks[L]);
  if (!open.length) { setStatus('Every layer is locked. Unlock one to reroll it.'); return; }
  open.forEach(reroll); afterChange(); setStatus('Rerolled ' + open.join(', '));
});
document.querySelectorAll('input[name=view]').forEach(r => r.addEventListener('change', () => { piece.view.mode = r.value; screenCam.snap = true; commit(); }));
document.querySelectorAll('input[name=labels]').forEach(r => r.addEventListener('change', () => { piece.view.labels = r.value; commit(); }));
/* Listening volume: in the player bar, remembered in this browser, never saved with a piece */
let unmuteTo = null; // the volume to return to after muting
const hoverUI = matchMedia('(hover: hover) and (pointer: fine)'); // mouse: hover shows the slider and a click mutes, like a video player
function showVolume() {
  $('vol').value = volume; $('o-vol').textContent = pct(volume * 100);
  const m = volume <= 0.001;
  for (const b of [$('volbtn'), $('mute')]) { b.classList.toggle('muted', m); b.classList.toggle('quiet', !m && volume < 0.4); }
  $('volbtn').setAttribute('aria-label', (hoverUI.matches ? (m ? 'Unmute' : 'Mute') : 'Volume') + (m ? ' (muted)' : ', ' + pct(volume * 100)));
  $('mute').setAttribute('aria-label', m ? 'Unmute' : 'Mute'); $('mute').title = (m ? 'Unmute' : 'Mute') + ' (M)';
}
function setVolume(v) {
  volume = Math.max(0, Math.min(1, v)); lsSet('cge.volume', String(volume)); showVolume();
  if (live && actx) { const now = actx.currentTime, g = live.master.gain; if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(now); else g.cancelScheduledValues(now); g.setTargetAtTime(volume, now, 0.03);
    if (live.fadeOnMaster) { // the closing fade is on the master too, so set it up again from the new volume
      const end = startAt + (built ? built.total : 0);
      if (end > now + 0.2) { g.setValueAtTime(volume, end); g.linearRampToValueAtTime(0, end + FADE); }
      else if (end + FADE > now) { g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(volume * Math.max(0, (end + FADE - now) / FADE), now + 0.03); g.linearRampToValueAtTime(0, end + FADE); }
    } // otherwise it's on the held voices, and runs on by itself
  }
}
function toggleMute() { if (volume > 0.001) { unmuteTo = volume; setVolume(0); } else setVolume(unmuteTo || 0.6); }
$('vol').addEventListener('input', () => { unmuteTo = null; setVolume(+$('vol').value); });
$('mute').addEventListener('click', toggleMute);
$('play').addEventListener('click', () => setPlaying(!playing));
$('restart').addEventListener('click', () => { offset = 0; screenCam.snap = true; if (playing) startAudio(0); });
$('scrub').addEventListener('input', () => { if (!built) return; offset = (built.total + TAIL) * $('scrub').value / 1000; screenCam.snap = true; if (playing) startAudio(offset); });
$('save').addEventListener('click', () => savePiece(false));
$('saveas').addEventListener('click', () => savePiece(true));
$('libtoggle').addEventListener('click', () => { const lb = $('library'); lb.hidden = !lb.hidden; $('libtoggle').setAttribute('aria-expanded', String(!lb.hidden)); });
$('newpiece').addEventListener('click', () => {
  setPlaying(false);
  const p = defaultPiece();
  const dl = defaultLook(); if (dl) p.view.trace = dl;
  for (const L of LAYERS) p.seeds[L] = randSeed();
  p.chords = composeFromSeed(p.seeds.harmony, defaultChordSec(normalizePiece(p)));
  p.created = new Date().toISOString();
  currentLibId = null; savedJSON = null;
  applyPiece(p, { fresh: true }); setStatus('New piece written from a fresh harmony seed');
});
$('revoice').addEventListener('click', () => { unfreeze(); afterChange(); });
$('undo').addEventListener('click', undo);
$('redo').addEventListener('click', redo);
$('importbtn').addEventListener('click', () => $('importfile').click());
$('importfile').addEventListener('change', async () => {
  const f = $('importfile').files[0]; $('importfile').value = '';
  if (!f) return;
  try {
    let obj; try { obj = JSON.parse(await f.text()); } catch (e) { obj = null; }
    if (!obj || (obj.format !== PIECE_FORMAT && typeof obj.chords !== 'string')) throw new Error('That file isn\'t a Chord Glide piece.');
    prepPiece(obj); // throws for a newer format
    setPlaying(false); currentLibId = null; savedJSON = null;
    applyPiece(obj, { fresh: true });
    setStatus('Opened “' + piece.name + '” from a file' + openNote(obj) + '. Save to keep it in your library.');
  } catch (e) { setStatus(e && e.message ? e.message : 'That file isn\'t a Chord Glide piece.', true); }
});
EXAMPLES.forEach(ex => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'small'; b.textContent = ex.name;
  b.onclick = () => { setPlaying(false); currentLibId = null; savedJSON = null; applyPiece(examplePiece(ex), { fresh: true }); setStatus('Opened the example “' + ex.name + '”'); };
  $('examples').appendChild(b);
});
document.querySelectorAll('[data-export]').forEach(b => b.addEventListener('click', () => { closeExportMenu(true); doExport(b.dataset.export); }));
/* The export menu: Export opens a list of formats; choosing one saves it. Arrow keys move through the list, Escape or a click
   elsewhere closes it. */
function openExportMenu() { $('xlist').hidden = false; $('xopen').setAttribute('aria-expanded', 'true'); const first = [...$('xlist').querySelectorAll('button:not(:disabled)')][0]; if (first) first.focus(); }
function closeExportMenu(refocus) { if ($('xlist').hidden) return; $('xlist').hidden = true; $('xopen').setAttribute('aria-expanded', 'false'); if (refocus) $('xopen').focus(); }
$('xopen').addEventListener('click', () => $('xlist').hidden ? openExportMenu() : closeExportMenu(false));
$('xlist').addEventListener('keydown', e => {
  const items = [...$('xlist').querySelectorAll('button:not(:disabled)')], i = items.indexOf(document.activeElement);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = items.length; if (n) items[(i + (e.key === 'ArrowDown' ? 1 : n - 1) + n) % n].focus(); }
  else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); if (items.length) items[e.key === 'Home' ? 0 : items.length - 1].focus(); }
  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeExportMenu(true); }
  else if (e.key === 'Tab') closeExportMenu(false);
});
document.addEventListener('pointerdown', e => { if (!$('xlist').hidden && !e.target.closest('.xmenu')) closeExportMenu(false); });
$('vrecord').addEventListener('click', () => recording ? finishRecording(true) : startRecording());
const tabs = [...document.querySelectorAll('.rack [role=tab]')]; // the controls panel only; the Guide has its own tabs
function selectTab(tab) { tabs.forEach(t => { const on = t === tab; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; $(t.getAttribute('aria-controls')).hidden = !on; }); }
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; selectTab(n); n.focus(); } });
});
document.addEventListener('keydown', e => {
  if (rendering) return; // the render works from a snapshot, but editing mid-render would only confuse
  const tag = (e.target.tagName || '').toLowerCase(), typing = tag === 'input' || tag === 'textarea' || tag === 'select';
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); savePiece(false); }
  else if ((e.metaKey || e.ctrlKey) && e.key === ',') { e.preventDefault(); if (!settingsDlg.open) $('settingsbtn').click(); }
  else if (e.key === ' ' && !typing && tag !== 'button' && !recording) { e.preventDefault(); setPlaying(!playing); }
});

/* Drop the divider on any bar group that starts a wrapped line */
const barGroups = [...document.querySelectorAll('.bar-row > .grp')];
function markLineStarts() { let top = null; barGroups.forEach(g => { g.classList.remove('linestart'); }); barGroups.forEach(g => { const t = g.offsetTop; g.classList.toggle('linestart', top !== null && t > top + 4); if (top === null || t > top + 4) top = t; }); }
new ResizeObserver(markLineStarts).observe(document.querySelector('.bar-row'));
/* ---------- Theater, full screen, about ---------- */
const stageEl = document.querySelector('.stage'), layoutEl = document.querySelector('.layout');
function setTheater(on) {
  layoutEl.classList.toggle('theater', on);
  $('theater').setAttribute('aria-pressed', String(on));
  lsSet('cge.theater', on ? '1' : '0');
  screenCam.snap = true;
}
const isFull = () => document.fullscreenElement === stageEl || stageEl.classList.contains('pseudo-fs');
async function setFull(on) {
  if (on) {
    try { if (stageEl.requestFullscreen) { await stageEl.requestFullscreen(); } else throw new Error('none'); }
    catch (e) { stageEl.classList.add('pseudo-fs'); document.documentElement.style.overflow = 'hidden'; } // browser refused: cover the page instead
  } else {
    if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch (e) {} }
    stageEl.classList.remove('pseudo-fs'); document.documentElement.style.overflow = '';
  }
  updateFull();
}
function updateFull() { const b = $('fullscreen'), on = isFull(); b.classList.toggle('on', on); b.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen'); b.title = (on ? 'Exit full screen' : 'Full screen') + ' (F)'; screenCam.snap = true; }
/* view options popup */
const viewPop = $('viewpop'), viewBtn = $('viewbtn'), volPop = $('volpop'), volBtn = $('volbtn'), secPop = $('secpop'), secBtn = $('secbtn');
const POPS = [[viewPop, viewBtn], [volPop, volBtn], [secPop, secBtn]];
function setPop(pop, btn, open) {
  if (open) POPS.forEach(([p, b]) => { if (p !== pop && !p.hidden) setPop(p, b, false); });
  pop.hidden = !open; btn.setAttribute('aria-expanded', String(open));
  pop.style.transform = '';
  if (open) { // popups are centred over their button, then nudged sideways to stay inside the stage and the window
    const r = pop.getBoundingClientRect(), st = stageEl.getBoundingClientRect(), m = 8;
    const lo = Math.max(m, st.left + m), hi = Math.min(innerWidth - m, st.right - m);
    const dx = r.width > hi - lo ? lo - r.left : r.left < lo ? lo - r.left : r.right > hi ? hi - r.right : 0;
    if (dx) pop.style.transform = 'translateX(calc(-50% + ' + dx + 'px))';
    // a long list (Sections) shortens to fit above its button on a short screen, then the page scrolls to show the rest
    const list = pop.querySelector('.seclist');
    if (list) {
      list.style.maxHeight = '';
      const over = m - pop.getBoundingClientRect().top;
      if (over > 0) list.style.maxHeight = Math.max(96, list.clientHeight - over) + 'px';
      const top = pop.getBoundingClientRect().top;
      if (top < m) scrollBy(0, top - m);
    }
  }
}
const setViewPop = open => setPop(viewPop, viewBtn, open);
for (const [pop, btn] of POPS) {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    if (pop === volPop && hoverUI.matches) { toggleMute(); return; } // with a mouse, the speaker mutes; hovering shows the slider
    if (pop === secPop && pop.hidden) fillSections();
    setPop(pop, btn, pop.hidden); if (!pop.hidden && pop === volPop) $('vol').focus();
  });
  document.addEventListener('pointerdown', e => { if (!pop.hidden && !pop.contains(e.target) && !btn.contains(e.target)) setPop(pop, btn, false); });
}
{ // Volume with a mouse: the slider appears while the pointer or keyboard focus is on the speaker or the slider
  const wrap = volBtn.parentElement; let hideTimer = null;
  const show = () => { if (!hoverUI.matches) return; clearTimeout(hideTimer); if (volPop.hidden) setPop(volPop, volBtn, true); };
  const hideSoon = () => { if (!hoverUI.matches) return; clearTimeout(hideTimer); hideTimer = setTimeout(() => { if (!wrap.matches(':hover') && !wrap.querySelector(':focus-visible')) setPop(volPop, volBtn, false); }, 350); }; // stays open for keyboard focus, not for a mouse click
  wrap.addEventListener('pointerenter', show); wrap.addEventListener('pointerleave', hideSoon);
  wrap.addEventListener('focusin', show); wrap.addEventListener('focusout', hideSoon);
  $('vol').addEventListener('pointerup', hideSoon);
  const label = () => { volBtn.title = hoverUI.matches ? 'Mute (M)' : 'Volume (M mutes)'; showVolume(); };
  label(); hoverUI.addEventListener('change', label);
}
function cycleView() { const order = ['auto', 'scroll', 'whole']; piece.view.mode = order[(order.indexOf(piece.view.mode) + 1) % 3]; $('v-' + piece.view.mode).checked = true; screenCam.snap = true; commit();
  setStatus('View: ' + { auto: 'auto zoom', scroll: 'scrolling', whole: 'whole piece' }[piece.view.mode]); }
document.addEventListener('fullscreenchange', updateFull);
$('theater').addEventListener('click', () => setTheater(!layoutEl.classList.contains('theater')));
$('fullscreen').addEventListener('click', () => setFull(!isFull()));
/* ---------- Guide: six pages with a sidebar (tabs across the top on phones) ---------- */
const aboutDlg = $('about');
const guideTabs = [...document.querySelectorAll('#about .guide-nav [role=tab]')];
{ // the tabs run down the side, or across the top on narrow screens (same breakpoint as the CSS)
  const nav = document.querySelector('#about .guide-nav'), narrow = matchMedia('(max-width: 640px)');
  const orient = () => nav.setAttribute('aria-orientation', narrow.matches ? 'horizontal' : 'vertical');
  orient(); narrow.addEventListener('change', orient);
}
function showGuidePage(k, focusTab) {
  guideTabs.forEach(t => { const on = t.dataset.page === k; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; $('g-' + t.dataset.page).hidden = !on; if (on && focusTab) t.focus(); if (on) t.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });
  $('guide-pages').scrollTop = 0;
  lsSet('cge.guide', k);
  if (k === 'math') initMathWidgets();
}
/* The top-bar tour borrows the real icons, so it always matches the bar */
(() => {
  document.querySelectorAll('.barmap .mini[data-icon]').forEach(m => {
    const src = $(m.dataset.icon); if (!src) return;
    const svg = src.querySelector('svg'); if (svg) m.appendChild(svg.cloneNode(true));
    if (src.classList.contains('primary')) m.classList.add('primary');
    if (m.dataset.icon === 'rerollall') { m.classList.add('wide'); m.append('Reroll'); }
  });
  const lockSvg = document.querySelector('.layerlock svg');
  document.querySelectorAll('.barmap .mini-lock').forEach(m => { m.prepend(lockSvg.cloneNode(true)); });
})();
// About page: say what this particular copy touches on the network
$('about-where').textContent = (HOST && HOST.aboutText) || (location.protocol === 'file:'
  ? 'This copy runs from a file on your computer. Exported files download straight to your computer. Your Library and settings stay in this browser\'s storage until you clear them, and with lame.min.js beside the page it makes no network requests at all.'
  : 'This copy is served from a website. Exported files download straight to your computer. Your Library and settings stay in this browser\'s storage until you clear them. Like any website, its host may keep standard logs of page requests, such as IP addresses, but Chord Glide sends nothing back.');
function openGuide(k) { if (!aboutDlg.open) aboutDlg.showModal(); showGuidePage(k || lsGet('cge.guide') || 'how'); }
document.querySelectorAll('[data-about]').forEach(b => b.addEventListener('click', () => openGuide(b.dataset.about)));
document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => showGuidePage(b.dataset.goto, true)));
guideTabs.forEach((t, i) => {
  t.addEventListener('click', () => showGuidePage(t.dataset.page));
  t.addEventListener('keydown', e => {
    const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (d) { e.preventDefault(); showGuidePage(guideTabs[(i + d + guideTabs.length) % guideTabs.length].dataset.page, true); }
  });
});
/* The math page's small tools */
let mathReady = false;
function initMathWidgets() {
  readColors();
  drawCurveDemo();
  if (mathReady) return; mathReady = true;
  const nIn = $('gm-n');
  const showN = () => {
    const n = +nIn.value, st = n - 69, f = hz(n);
    $('gm-n-out').textContent = noteName(n) + ' · n = ' + n;
    $('gm-n-calc').textContent = '440 × 2^((' + n + ' − 69) ÷ 12) = 440 × 2^(' + (st / 12).toFixed(3).replace(/\.?0+$/, '').replace('-', '−') + ') = 440 × ' + Math.pow(2, st / 12).toFixed(4) + ' = ' + f.toFixed(2) + ' Hz';
  };
  nIn.addEventListener('input', showN); showN();
  $('gm-play').addEventListener('click', () => {
    const ctx = ensureCtx(), t = ctx.currentTime + 0.02, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = hz(+nIn.value);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25 * volume, t + 0.03); g.gain.setValueAtTime(0.25 * volume, t + 0.7); g.gain.linearRampToValueAtTime(0, t + 1.1);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 1.2);
  });
  const cIn = $('gm-chord');
  const showChord = () => {
    const it = parseItem(cIn.value.replace(/\s+/g, ''));
    if (!it || it.kind !== 'chord') { $('gm-chord-out').textContent = 'Try a name like Cmaj7, Am9, F#m11, Bb7sus4 or Dadd9/F#.'; drawKeys([], -1, -1); return; }
    const flats = /^[A-G]b/.test(it.label), names = flats ? FLAT : SHARP;
    const order = [...it.pcs].sort((a, b) => ((a - it.root + 12) % 12) - ((b - it.root + 12) % 12));
    const IV = ['root', 'minor 2nd (♭9)', '9th', 'minor 3rd', 'major 3rd', '4th (11th)', '♯11 / ♭5', '5th', '♯5 (♭13)', '6th (13th)', 'minor 7th', 'major 7th'];
    $('gm-chord-out').textContent = it.label + ' = ' + order.map(pc => names[pc].replace('#', '♯').replace(/([A-G])b/, '$1♭') + ' (' + IV[(pc - it.root + 12) % 12] + ')').join(', ')
      + (it.bass !== it.root ? '. Bass note: ' + names[it.bass].replace('#', '♯').replace(/([A-G])b/, '$1♭') : '');
    drawKeys(it.pcs, it.root, it.bass);
  };
  cIn.addEventListener('input', showChord); showChord();
}
/* One octave of piano keys with the chord's notes lit; the root is marked */
function drawKeys(pcs, root, bass) {
  const W = 26, H = 96, BW = 16, BH = 58, white = [0, 2, 4, 5, 7, 9, 11], black = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 };
  let svg = `<svg viewBox="0 0 ${W * 7 + 2} ${H + 2}" role="img">`;
  // real piano colors in every theme; lit keys use the accent, the root gets a dot
  const acc = cssHex(colors.accent) || '#2a4fd4', dot = hexLum(acc) > 0.3 ? '#111111' : '#ffffff';
  white.forEach((pc, i) => { const on = pcs.includes(pc); svg += `<rect x="${1 + i * W}" y="1" width="${W - 2}" height="${H}" rx="3" fill="${on ? acc : '#f6f6f3'}" stroke="#8a8a86"/>` + (pc === root ? `<circle cx="${1 + i * W + (W - 2) / 2}" cy="${H - 12}" r="4" fill="${dot}"/>` : ''); });
  for (const [pc, i] of Object.entries(black)) { const p = +pc, on = pcs.includes(p), x = 1 + (i + 1) * W - BW / 2 - 1; svg += `<rect x="${x}" y="1" width="${BW}" height="${BH}" rx="2" fill="${on ? acc : '#1c1c1e'}" stroke="#3a3a3c"/>` + (p === root ? `<circle cx="${x + BW / 2}" cy="${BH - 10}" r="3.5" fill="${dot}"/>` : ''); }
  $('gm-keys').innerHTML = svg + '</svg>';
}
function drawCurveDemo() {
  const c = $('gm-curve'); if (!c) return;
  const g = c.getContext('2d'), W = c.width, H = c.height, m = 34, sx = x => m + x * (W - 2 * m), sy = y => H - m - y * (H - 2 * m);
  g.clearRect(0, 0, W, H);
  g.strokeStyle = colors.rule; g.lineWidth = 1.5; g.strokeRect(sx(0), sy(1), sx(1) - sx(0), sy(0) - sy(1));
  g.setLineDash([6, 6]); g.strokeStyle = colors.muted; g.beginPath(); g.moveTo(sx(0), sy(0)); g.lineTo(sx(1), sy(1)); g.stroke(); g.setLineDash([]);
  g.strokeStyle = colors.accent; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath();
  for (let i = 0; i <= 100; i++) { const x = i / 100, y = x * x * (3 - 2 * x); if (!i) g.moveTo(sx(x), sy(y)); else g.lineTo(sx(x), sy(y)); }
  g.stroke();
  g.fillStyle = colors.muted; g.font = `22px ${colors.data || 'monospace'}`;
  g.fillText('start', sx(0) - 4, H - 6); g.fillText('end', sx(1) - 36, H - 6);
  g.save(); g.translate(18, sy(0.5) + 50); g.rotate(-Math.PI / 2); g.fillText('how far along', 0, 0); g.restore();
  g.fillStyle = colors.ink; g.fillText('slow', sx(0.08), sy(0.22)); g.fillText('fast', sx(0.6), sy(0.36)); g.fillText('settles', sx(0.55), sy(0.93));
}
$('about-close').addEventListener('click', () => aboutDlg.close());
$('guidebtn').addEventListener('click', () => openGuide());
aboutDlg.addEventListener('click', e => { if (e.target === aboutDlg) aboutDlg.close(); }); // click on the backdrop
document.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase();
  for (const [pop, btn] of POPS) if (e.key === 'Escape' && !pop.hidden) { setPop(pop, btn, false); btn.focus(); return; }
  if (rendering && e.key !== '?') return;
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.metaKey || e.ctrlKey || e.altKey || aboutDlg.open || settingsDlg.open || recording) return;
  if (e.key === 'v' || e.key === 'V') { e.preventDefault(); cycleView(); return; }
  if (e.key === 'm' || e.key === 'M') { e.preventDefault(); toggleMute(); return; }
  if (e.key === '?') { e.preventDefault(); openGuide(); return; }
  if (e.key === 'l' || e.key === 'L') { e.preventDefault(); $('libtoggle').click(); return; }
  if (e.key === 't' || e.key === 'T') { e.preventDefault(); setTheater(!layoutEl.classList.contains('theater')); }
  else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); setFull(!isFull()); }
  else if (e.key === 'Escape' && stageEl.classList.contains('pseudo-fs')) setFull(false);
});
if (lsGet('cge.theater') === '1') setTheater(true);

/* ---------- Settings: trace looks and interface themes ---------- */
const UI_THEMES = [
  ['system', 'Match device', 'Light or dark, following your device', ['#F3F5F2', '#0D0F0E', '#2A4FD4']],
  ['cloud', 'Cloud', 'Soft grey-white with deep teal', ['#EFEEEA', '#1C1E21', '#0E6E72']],
  ['ice', 'Ice', 'Powder blue and charcoal', ['#E6EDF2', '#1D242B', '#2D6BB0']],
  ['paper', 'Paper', 'Clean light grey with cobalt', ['#F3F5F2', '#121513', '#2A4FD4']],
  ['graphite', 'Graphite', 'Neutral dark with periwinkle', ['#141715', '#E7ECE8', '#8299FF']],
  ['teal', 'Deep Teal', 'Dark teal with jelly mint', ['#0A1F22', '#DFF0EE', '#52DCCB']],
  ['black', 'Studio Black', 'True black with electric fuchsia', ['#000000', '#EDEDED', '#FF3DAA']],
  ['cocoa', 'Cocoa', 'Dark chocolate with teal', ['#1C1511', '#F0E6D8', '#52BDB2']]
];
const LOOK_DESC = { theme: 'Plain lines in the interface colors', phosphor: 'Green oscilloscope glow', laserred: 'White-hot core, red light', laserblue: 'White-hot core, blue light',
  amber: 'Warm vintage monitor', aurora: 'Teal to violet to pink, by pitch', spectrum: 'A rainbow across the voices', neon: 'Cyan and magenta voices', custom: 'Your own colors' };
function applyUiTheme(k) {
  if (k === 'system') document.documentElement.removeAttribute('data-ui'); else document.documentElement.setAttribute('data-ui', k);
  lsSet('cge.ui', k); readColors(); screenCam.snap = true;
  if (!lsGet('cge.accent')) $('accent-custom').value = cssHex(getComputedStyle(document.documentElement).getPropertyValue('--accent')) || '#888888';
  document.querySelectorAll('#uithemes .swatch').forEach(el => el.classList.toggle('on', el.dataset.k === k));
  if (settingsDlg.open) drawLookPreviews();
}
const settingsDlg = $('settings');
function buildSettings() {
  const ui = $('uithemes'), cur = lsGet('cge.ui') || 'system';
  for (const [k, name, desc, chips] of UI_THEMES) {
    const lab = document.createElement('label'); lab.className = 'swatch'; lab.dataset.k = k;
    lab.innerHTML = `<input type="radio" name="uitheme" value="${k}"><span class="chips"><span style="background:${chips[0]}"></span><span style="background:${chips[0]};color:${chips[1]}">Aa</span><span style="background:${chips[2]}"></span></span><span class="nm"></span><span class="ds"></span>`;
    lab.querySelector('.nm').textContent = name; lab.querySelector('.ds').textContent = desc;
    const inp = lab.querySelector('input'); inp.checked = k === cur; lab.classList.toggle('on', k === cur);
    inp.addEventListener('change', () => applyUiTheme(k));
    ui.appendChild(lab);
  }
  const lk = $('looks');
  for (const k of LOOKS) {
    const lab = document.createElement('label'); lab.className = 'swatch'; lab.dataset.k = k;
    lab.innerHTML = `<input type="radio" name="look" value="${k}"><canvas width="440" height="192" aria-hidden="true"></canvas><span class="nm"></span><span class="ds"></span>`;
    lab.querySelector('.nm').textContent = TRACE_LOOKS[k].name; lab.querySelector('.ds').textContent = LOOK_DESC[k];
    lab.querySelector('input').addEventListener('change', () => setLook({ look: k }, true));
    lk.appendChild(lab);
    const o = document.createElement('option'); o.value = k; o.textContent = TRACE_LOOKS[k].name; $('lookq').appendChild(o);
  }
}
function setLook(patch, record) {
  const tr = piece.view.trace;
  if (patch.custom) Object.assign(tr.custom, patch.custom); else Object.assign(tr, patch);
  syncLook(); screenCam.snap = true;
  if (record) commit(); else { updateStatus(); saveDraftSoon(); }
}
function drawLookPreviews() {
  document.querySelectorAll('#looks .swatch').forEach(el => drawLookPreview(el.querySelector('canvas'), Object.assign({}, piece.view.trace, { look: el.dataset.k })));
}
function syncLook() {
  const tr = piece.view.trace;
  document.querySelectorAll('#looks .swatch').forEach(el => { const on = el.dataset.k === tr.look; el.classList.toggle('on', on); el.querySelector('input').checked = on; });
  $('lookq').value = tr.look;
  $('glowamt').value = tr.glow; $('o-glowamt').textContent = Math.round(tr.glow) + '%';
  const bz = tr.busy || 'range'; $('busy').value = bz; $('busys').value = bz; $('b-' + bz).checked = true; $('lineweight').value = tr.weight; $('o-lineweight').textContent = (+tr.weight).toFixed(2) + '×';
  $('c-line').value = tr.custom.line; $('c-line2').value = tr.custom.line2; $('c-bg').value = tr.custom.bg;
  $('customcolors').hidden = $('customhint').hidden = tr.look !== 'custom';
  if (settingsDlg.open) drawLookPreviews();
}
$('settingsbtn').addEventListener('click', () => { settingsDlg.showModal(); syncLook(); drawLookPreviews(); showSettingsPage(lsGet('cge.settings') || 'look'); });
/* Settings pages, chosen from a sidebar like the Guide's (tabs across the top on narrow screens) */
const settingsTabs = [...document.querySelectorAll('#settings-nav [role=tab]')];
{ const nav = $('settings-nav'), narrow = matchMedia('(max-width: 640px)');
  const orient = () => nav.setAttribute('aria-orientation', narrow.matches ? 'horizontal' : 'vertical'); orient(); narrow.addEventListener('change', orient); }
function showSettingsPage(k, focusTab) {
  if (!settingsTabs.some(t => t.dataset.spage === k)) k = 'look';
  settingsTabs.forEach(t => { const on = t.dataset.spage === k; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; $('s-' + t.dataset.spage).hidden = !on; if (on && focusTab) t.focus(); });
  $('settings-pages').scrollTop = 0; lsSet('cge.settings', k);
  if (k === 'look') drawLookPreviews();
}
settingsTabs.forEach((t, i) => {
  t.addEventListener('click', () => showSettingsPage(t.dataset.spage));
  t.addEventListener('keydown', e => { const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key]; if (d) { e.preventDefault(); showSettingsPage(settingsTabs[(i + d + settingsTabs.length) % settingsTabs.length].dataset.spage, true); } });
});
$('settings-close').addEventListener('click', () => settingsDlg.close());
settingsDlg.addEventListener('click', e => { if (e.target === settingsDlg) settingsDlg.close(); });
$('lookq').addEventListener('change', () => setLook({ look: $('lookq').value }, true));
$('glowamt').addEventListener('input', () => setLook({ glow: +$('glowamt').value }, false));
for (const id of ['busy', 'busys']) $(id).addEventListener('change', () => setLook({ busy: $(id).value }, true)); // the same setting in three places: the video settings, Settings and the view menu
document.querySelectorAll('input[name=busyq]').forEach(r => r.addEventListener('change', () => setLook({ busy: r.value }, true)));
$('lineweight').addEventListener('input', () => setLook({ weight: +$('lineweight').value }, false));
['glowamt', 'lineweight', 'c-line', 'c-line2', 'c-bg'].forEach(id => $(id).addEventListener('change', commit));
[['c-line', 'line'], ['c-line2', 'line2'], ['c-bg', 'bg']].forEach(([id, key]) => $(id).addEventListener('input', () => setLook({ custom: { [key]: $(id).value.toLowerCase() } }, false)));
$('lookdefault').addEventListener('click', () => { lsSet('cge.look', JSON.stringify(piece.view.trace)); $('lookdefault-note').textContent = 'New pieces and examples will start with this look.'; });
buildSettings();
/* accent color: per device, layered over any theme */
const ACCENTS = [['#ff3daa', 'Fuchsia'], ['#22d3ee', 'Cyan'], ['#52dccb', 'Mint'], ['#a3e635', 'Lime'], ['#ffb020', 'Amber'], ['#ff6b57', 'Coral'], ['#9b7bff', 'Violet'], ['#3b6bff', 'Cobalt'], ['#e8e8ea', 'Silver']];
function applyAccent(hex) {
  const root = document.documentElement.style;
  if (hex) { root.setProperty('--accent', hex); root.setProperty('--accent-ink', hexLum(hex) > 0.3 ? '#0a0a0b' : '#ffffff'); lsSet('cge.accent', hex); }
  else { root.removeProperty('--accent'); root.removeProperty('--accent-ink'); lsSet('cge.accent', ''); }
  document.querySelectorAll('.accent-chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.c === hex)));
  $('accent-default').setAttribute('aria-pressed', String(!hex));
  $('accent-custom').value = hex || cssHex(getComputedStyle(document.documentElement).getPropertyValue('--accent')) || '#888888';
  readColors(); if (settingsDlg.open) drawLookPreviews();
}
(() => {
  const box = $('accents'), first = $('accent-default').nextSibling;
  for (const [c, name] of ACCENTS) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'accent-chip'; b.dataset.c = c; b.style.background = c;
    b.setAttribute('aria-label', name); b.title = name; b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => applyAccent(c)); box.insertBefore(b, first);
  }
  $('accent-default').addEventListener('click', () => applyAccent(''));
  $('accent-custom').addEventListener('input', () => applyAccent($('accent-custom').value.toLowerCase()));
  { const a = $('artist'); a.value = artistName(); a.addEventListener('input', () => { artistTyped = a.value; lsSet('cge.artist', a.value.trim().slice(0, 80)); showArtistOption(); }); }
})();

/* ---------- Start ---------- */
{ const k = lsGet('cge.ui'); if (k && k !== 'system') document.documentElement.setAttribute('data-ui', k); }
applyAccent(cssHex(lsGet('cge.accent') || '') || '');
readColors(); fit(); selectTab(tabs[0]);
(async () => {
  const draft = await loadDraft();
  let ok = false;
  if (draft && draft.piece) { try { currentLibId = draft.libId || null; savedJSON = draft.savedJSON || null; applyPiece(draft.piece, { record: false }); setStatus('Picked up where you left off'); ok = true; } catch (e) { currentLibId = null; savedJSON = null; } }
  if (!ok) applyPiece(examplePiece(EXAMPLES[0]), { record: false });
  requestAnimationFrame(frame); // drawing starts once there's a piece
})();
initLibrary();
initDownloads();
