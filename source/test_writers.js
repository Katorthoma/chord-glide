const fs = require('fs'), path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8') + fs.readFileSync(path.join(__dirname, 'writers.js'), 'utf8');
const W = new Function(SRC + '; return {parseProgression, buildPiece, defaultPiece, normalizePiece, zipStore, encodeWav24, midiWithGlides, midiChords, musicXml};')();
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
