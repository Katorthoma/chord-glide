# Chord Glide to-do

Planned work, roughly in order. Engine versions change only when a voicing can change.

## The goal: parts

Two pieces written outside the app show what the engine is missing. **Bounce of the Spheres** (a 2:03 dance piece in 21 voices) and the **Deep Note study** (30 voices) both had to be computed by scripts and pasted in as thousands of saved snapshots, because the engine can't express them:

- Every voice sounds all the time: a voice can't rest, start a note or change its own level. The kick was two voices diving 36 semitones on each beat; the hi-hat was a voice jumping octaves.
- Every voice shares one tone: bass, kick, strings and whistle were all Saw.
- There is no rhythm: the engine knows chords and glides, not melodies, arpeggios, bass patterns or echoes.
- Saved notes are frozen: changing the Chords, Voicing or Motion tabs throws them away.
- Deep Note needed glides far longer than 5 seconds, cents, 30 voices, voices crossing, a wandering start and a long swell.

**The test of the design:** both pieces can be written as short piece files (tens of lines, no saved notes) that the engine turns into the same music.

### Design

The chord progression stays the harmonic spine. A piece is made of **parts**; a part is a group of voices with:

- a **pitch source**: one of a small set of generators (below);
- its own **sound**: tone, level, pan and width (reverb and brightness stay piece-wide: they are the room);
- **gain over time**: an envelope per note plus automation. This is the centre of the design, as important as pitch. With it, voices can rest, notes can attack and release, Harp can pluck, Chime can ring, pads can swell, parts can enter and leave, and Deep Note gets its crescendo;
- later, **automation** of pan and filter as well.

So the engine works in terms of pitch(t), gain(t), pan(t) and timbre(t) per voice, not in terms of musical roles.

**Generators** (engine primitives):
- **Chord-following:** today's voice-leading engine (the existing Voicing and Motion settings).
- **Chord-relative pattern:** steps that pick chord tones (`R` bass note, `R'` an octave up, `1`–`n` positions in a close voicing, `.` hold, `-` rest).
- **Written line:** explicit notes with durations in steps, rests, portamento and vibrato.
- **Copy:** another part, transformed (delayed, transposed, panned, quieter).
- **Pitch envelope:** a fast pitch drop per hit.
- **Stochastic:** voices wander in a register, then converge on a target.

**Presets** (what the interface offers; each is a generator plus settings):
Pad = chord-following + sustained envelope; Bass = chord-relative pattern; Arpeggio = chord-tone pattern; Melody = written line; Echo = copy; Kick = pitch envelope + short amplitude envelope; Swarm = stochastic → chord-following.

```
parts: [
  { id: "strings", preset: "pad",      voices: 5, sound: { tone: "bowed", level: 0, width: 60 }, envelope: { attack: 0.4, release: 1.2 }, voicing: {…}, motion: {…} },
  { id: "bass",    preset: "bass",     voices: 2, sound: { tone: "saw", level: -3 }, pattern: "R R' R R' R R' R R'", step: "1/8" },
  { id: "tune",    preset: "melody",   voices: 2, transpose: [0, -12], line: "G4:2 C5:2 E5:2 G5:2 C6:3 B5:1 …", portamento: 0.02, vibrato: { cents: 12, rate: 6, delay: 0.25 } },
  { id: "echo",    preset: "echo",     of: "tune", delay: "3/16", pan: -0.6, level: -6 },
  { id: "kick",    preset: "kick",     rhythm: "x . . . x . . . x . . . x . . .", step: "1/16", drop: 36, decay: 0.15 },
  { id: "swarm",   preset: "swarm",    voices: 30, register: ["C3", "C5"], wander: 2.5, until: 1 }
]
```

**Requirements:**
- **Duration never decides pitch accuracy.** Glides are scheduled as curves (a linear-in-pitch glide is an exact exponential ramp in frequency); sampling happens only for eased glides, only during the glide.
- **Seeds are derived per part:** from the piece seed, the part's id and the subsystem (pattern, voicing, modulation, sound), with a stable hash, so adding or removing a part never rerolls another.
- **The file stores intent, not results.** A format-4 piece stores what was asked for (patterns, lines, settings). Saved notes remain an optional frozen performance, for exact reproduction across engine versions and for pieces written by other programs; they can say which part each voice belongs to and carry rests.
- **Format 3 still works.** A format-3 piece opens as a single Pad part and must voice identically (regression test). Older versions refuse format-4 files, as they already refuse newer formats.
- **Exports say what they can carry:** audio and video: everything; MPE MIDI: pitch-continuous parts, split into groups of 15; standard MIDI: note parts; MusicXML: notation-compatible parts (melody, bass, pattern parts); JSON: everything. For example: "6 of 8 parts are notation-compatible. Swarm and Kick are left out of MusicXML."
- **Not a DAW.** No timeline of hand-placed clips. Chord Glide stays algorithmic continuous motion: enough structure to compose, not a way to edit every sample. The engine should absorb the musical ideas in the Bounce script, not offer a screen for writing 7,916 snapshots.

**Time:** rhythm parts follow a beat grid set by the piece's tempo. Chord lengths keep an explicit unit (see Decisions).

**Interface:** Harmony, Parts (a list; selecting a part shows only its controls), Sound, and Export, with automation kept small.

**Versions:** file format 4. The engine stays 3.1: its version changes only when an existing voicing can change, and the main part voices exactly as before.

### Decisions

- **Chord-length units are explicit and never change meaning on their own.** `Amaj9:6` stays 6 seconds, as in every existing file. New syntax for musical time: `Amaj9:2bar`, `Amaj9:3beat`. The piece has a time setting (seconds or bars); adding the first rhythm part offers to switch to bars, converting the current lengths at the current tempo so nothing audible changes, and the offer can be declined. Rhythm parts always follow the beat grid: in a piece kept in seconds, a chord change can fall between beats, and a pattern picks up the new chord at its next step.
- **4.1 automates gain only, on general machinery.** Gain over time covers note envelopes, rests, per-part level and the volume shape over the piece. Fixed pan per part is a part setting in 4.1; moving pan and filter wait for 4.3. Automation is built as a named setting plus a curve, scheduled the same way as pitch moves (`pitchMoves()`), so pan and filter later are two more names, not new code paths.

### Plan

- **4.1, the language:**
  - [x] Full pitch accuracy at any length: glides scheduled as curves, not a whole-piece sample grid (playback sampled pitch half as finely past 120 seconds)
  - [x] Up to 32 voices in the editor (MIDI with glides already splits into files of 15)
  - [x] Glides up to 12 seconds
  - [x] Pitches with cents, e.g. `D3+33`
  - [x] Parts with their own voices, tone, level, pan and width; per-part seeds; format 4 with format-3 compatibility
  - [x] Gain over time: envelopes and rests, and a volume shape over the piece
  - [x] A basic written-line part (proof that a voice can attack, move, sustain, release, rest and attack again), with a fixture piece of one pad, one bass and one melody
  - [x] Saved notes as an optional cache, with parts and rests
  - [x] Export capability messages
  - [x] Interface for parts
- **4.2, musical generators.** Acceptance: Bounce of the Spheres and Fold as short native piece files (no saved notes), and Glass Tide in parts (below); the Deep Note study waits for 4.3's Swarm.
  - [x] Beat grid; chord lengths in bars and beats (`:2bar`, `:3beat`); a Time setting (seconds or bars) that converts the chord length at the current tempo; tempo and beats per bar on the Harmony tab; file format 5 for pieces that use them
  - [x] The offer to switch a piece to bars when its first rhythm part is added
  - [x] Arc glides: a glide that follows an arc rather than a straight line or an S-curve (Fold's dotted circles)
  - [x] Fold rewritten as a native piece file (84 KB, from 2.3 MB of saved notes): 22 written lines (arc glides for the dotted circles, straight glides for the hexagons and diamonds, pitch-drop ticks for floor and ceiling) in 9 sections; the same picture as the original, and within 0.6 dB in every frequency band. An example in the Library
  - [x] Bass and arpeggio patterns (chord-relative steps, fixed notes), copies (echo), rhythmic gates, pitch-drop percussion (kick)
  - [x] MIDI note-ons per part; MusicXML for notation-compatible parts
  - [x] Bounce of the Spheres rewritten as a short piece file (7 KB, from 1.1 MB of saved notes): 24 voices in 11 parts that never stop, every voice equal, in 10 sections, with the Build converging on A, a ping-pong echo, the Breakdown's whistle canon and a sine sub under the bass; within about 1.5 dB of the original above 120 Hz, with a deliberately deeper low end. An example in the Library
  - [x] Per-note loudness: a velocity for each note in lines and saved notes, so a part's notes can differ (quiet drips, accented downbeats, a big final chord) without splitting it into parts by level
  - [x] (as breathing at chord changes) Shaping a held note: a gain curve within a note (a pad breathing at a chord change, an armonica re-bowed between notes)
  - [x] Curved decays: exponential envelope segments, so plucks and rings die away naturally rather than in straight lines
  - [x] Glass Tide in 4.2, as two arrangements of saved notes in parts rather than a short generated file: a struck-glass arrangement (725 KB: decays, per-note loudness, breathing, ducking) and a one-tone version (24 glass voices in 12 pairs) that matches the original to within half a dB in every band. A generated version (just intonation, parts that never stop) drifted like the original but couldn't reproduce its sound, which depends on the exact phase of voices doubled at the same pitch
  - [x] Sections: headers in the chords (`[Groove x2 +2]`: name, repeat, key change) and Plays in for each part, the main part included. and text by section in lines and patterns (`[B]` in the text), with key changes moving written lines. and the Sections button on the player bar, to jump to a section and loop the one that's playing
  - [x] (was) Sections: named runs of chords with repeat and transpose (a key change), each saying which parts play and how (on, off or a level; which bass or arpeggio pattern), so a piece has an arrangement (intro, groove, theme, breakdown, drop) without hand-placed clips. Start at a section and loop it while editing. This is most of what Bounce's structure needs
  - [x] Slide into one note: `~G5:2` in a line glides from the note before without a new attack, so legato can be per note as well as per part
  - [x] Ducking: a part's level dips under another part's hits and recovers (pads pumping under the kick), as gain automation driven by the other part's notes
  - [x] Echo as a sound setting as well as a copied part: a tempo-synced delay (eighth, dotted eighth, quarter; alternating left and right) per part, for echoes that needn't be drawn
  - [x] MIDI with glides: section and chord names as markers, and a General MIDI program per part chosen from its tone
- **4.2.1:**
  - [ ] Echo's tail: with high feedback, repeats near the end can still be well above silence when playback and export stop (the music's end plus 3 s); lengthen the tail to fit the echo's decay, or limit feedback so the repeats die away within it
- **4.3, generative motion:**
  - [ ] Arrangement grid under the stage (the chosen layout, A): a row for each part (name, kind, a level meter, mute and solo) and a column for each section in time order, sized by its length, with the playhead; each cell shows whether the part plays there, rests on the chords (Never stops) or is silent, and a click changes it; clicking a part's name edits it in the tabs, and clicking a section jumps there (again to loop it). It replaces the part menu, the Plays in chips and the Sections button, and folds away. On a phone the grid scrolls sideways under pinned part names, rows are 44 px tall, and a part's settings slide up as a sheet
  - [ ] Help text behind (?) buttons: hints longer than a line (Chords, Line, Pattern and others) open in place from a (?) beside their label, with a Show help text switch in Settings, Interface
  - [ ] Swarm: stochastic wander, convergence and divergence
  - [ ] Per-voice modulation; pan and filter automation
  - [ ] An option for voices to cross when moving between pinned voicings
  - [ ] Motion that can continue through the closing fade
  - [ ] The Deep Note study rewritten as a short piece file

From the earlier roadmap:
- [ ] Voice pinning
- [ ] Density automation
- [ ] Chord Lab: a library of progressions by style and key (spelled for the key, so Bb in C becomes Db in Eb), searchable ("jazz in C", "A minor", "starting on Am"), with each chord ranked so a progression can be shortened or lengthened and keep its main chords
- [ ] Filter sweeps over a section (rising or falling brightness), with pan and filter automation in 4.3
- [ ] Paste a piece as text, ignoring anything around the JSON (as an AI's reply has), and a guide section on the piece format for people who have an AI write pieces
- [ ] A wheel view: the sounding notes on one spoke, low at the centre and high at the rim, their trails sweeping round and fading before they come back
- [ ] Render video in the background (a worker), so long videos use less memory

## Tone ideas (researched)

- [ ] FM Reed: Chowning odd-ratio FM (1:2, index about 2), odd harmonics with a hump near the 5th
- [ ] Buzz (optional): every harmonic equal, for use with Brightness
- [ ] Choir: a source with fixed formant filters, e.g. "ah" near 730, 1090 and 2440 Hz
- [ ] Bell: inharmonic partials, e.g. church-bell ratios 0.5, 1, 1.2, 1.5, 2 … or Risset's bell
- [ ] Noise: filtered noise for hi-hats and breath (needs parts and envelopes)

## Done

- [x] 4.1: parts (pad, written line, saved notes) with their own voices and sound; gain over time (envelopes, rests, volume shape); per-part seeds; file format 4; the Parts tab; Three Parts example
- [x] 4.0.5: pitch accuracy independent of length; up to 32 voices; glides up to 12 s; cents in note names
- [x] 4.0.4: live tone swap; playback scheduled after the slow work; no heat haze on the unplayed part; MIDI glides within 5 cents; saved-notes snapshot limit; tone-level tool
- [x] 4.0.3: five more tones (Brass, Harp, Octaves, Chime, Air), gain-matched and tested; tone menu in four groups
- [x] 4.0.2: seven new tones (Triangle, Square, Pulse, Saw, Organ, Bowed, Cello), gain-matched to Soft and tested
- [x] 4.0.2: limits on saved notes; `"engine": "custom"`; MIDI glides split into files of up to 15 voices; readable piece files; MP3 Info frame; `TAIL`/`FADE` constants throughout

## Housekeeping

- [x] Strip the embedded provenance metadata from `source/apple-touch-icon.png` and `source/og-image.jpg` (done in 4.2: only the metadata blocks removed, the pixels unchanged)
- [ ] Replace `source/apple-touch-icon.png`, `source/og-image.jpg` and `source/logo.svg` with exports from my own design tool
