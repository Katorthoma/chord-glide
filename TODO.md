# Chord Glide to-do

Planned work, roughly in order. Engine versions change only when a voicing can change.

## 4.1: features

From the 30-voice glide studies:
- [ ] Up to 30 voices in the editor (MIDI with glides already splits into files of 15)
- [ ] Pinned notes with cents, e.g. `D3+33`
- [ ] An option for voices to cross when moving between pinned voicings
- [ ] Glides longer than 5 seconds
- [ ] A volume shape over the piece (fade in, swell, fade out)
- [ ] Motion that can continue through the closing fade

From the earlier roadmap:
- [ ] Voice pinning
- [ ] Density automation
- [ ] Chord Lab
- [ ] Render video in the background (a worker), so long videos use less memory

## Tone ideas (researched)

- [ ] FM Brass: Chowning FM, carrier and modulator equal, index about 3 (Bessel-function harmonics)
- [ ] FM Reed: Chowning odd-ratio FM (1:2, index about 2), odd harmonics with a hump near the 5th
- [ ] Harp: plucked-string spectrum sin(nπp)/n², plucked at p = 1/7
- [ ] Octaves: partials only at octaves (1, 2, 4, 8, 16) under a bell curve, after Shepard and Risset
- [ ] Buzz (optional): every harmonic equal, for use with Brightness
- [ ] Choir (4.1): a source with fixed formant filters, e.g. "ah" near 730, 1090 and 2440 Hz
- [ ] Bell (4.1): inharmonic partials, e.g. church-bell ratios 0.5, 1, 1.2, 1.5, 2 … or Risset's bell

## Done

- [x] 4.0.2: seven new tones (Triangle, Square, Pulse, Saw, Organ, Bowed, Cello), gain-matched to Soft and tested
- [x] 4.0.2: limits on saved notes; `"engine": "custom"`; MIDI glides split into files of up to 15 voices; readable piece files; MP3 Info frame; `TAIL`/`FADE` constants throughout

## Housekeeping

- [ ] Replace `source/apple-touch-icon.png`, `source/og-image.jpg` and `source/logo.svg` with exports from my own design tool (they carry embedded provenance metadata from a file transfer).
