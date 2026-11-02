# Chord Glide 4.0.4 · 2 Nov 2026

Engine 3.1 and file format 3 are unchanged.

- **Live tone swap.** Changing tone while playing now changes each running voice's waveform and level in place (`swapToneLive()`, with a few milliseconds' dip around the swap so it doesn't click) instead of rebuilding the sound. A tone changes no pitch, so the glides carry on untouched.
- **Playback stays in time after any rebuild.** `buildGraph()` read the audio clock first and then generated the reverb and every voice's pitch curve. When that work took longer than the 0.08 s lead (a busy moment in Chrome), the glides were scheduled to start in the past; Chrome then played them late or held voices on a chord, and setting each voice's start pitch separately put a fixed value inside its own glide. The clock is now read after all of that work, just before scheduling, so the start pitch is always set before the glide begins. Measured in Chromium with the rebuild artificially slowed by 400 ms: voices were up to 794 cents from the piece before, within the measurement's noise (about 3 cents) after.
- **No heat haze on the unplayed part.** Lines were sampled every 2 pixels starting from the playhead, which moves a fraction of a pixel each frame, so a line that wiggles faster than the sampling looked different every frame. Samples are now taken at fixed moments of the piece. On an 11-voice piece of saved notes 0.05 s apart, the unplayed part changed on 17% of its pixels between frames 50 ms apart; it now changes on none.
- **MIDI glides within 5 cents again.** `midiWithGlides()` walks each glide one MIDI tick at a time at the tick's exact time, instead of every 0.5 ms with each bend then rounded to a tick. A bend goes out when the curve would pass 2 cents (was 3) by the end of the tick, carrying the pitch at the middle of the tick. Worst error, measured exactly at every event: 2.3 cents on the test piece (was 6.5), 3.2 cents for glides beyond the bend range (was 8.8); at 30 BPM, where a tick lasts about 2 ms, up to 6.2 cents for the fastest glides (was 8.8). The test now measures at every event instead of on a 4,000-point grid, which could miss the peaks, and checks 5 cents (7 at 30 BPM).
- **Saved notes:** at most 75,000 snapshots (an hour at 20 a second), so a one-voice file with millions of snapshots is refused with a reason; `N` and `total` must be numbers, so a length written as text (`"28"`) can't later be joined as text instead of added.
- **`tools/measure-tone-levels.js`** renders the opening piece in every tone and measures EBU R128 loudness in the browser (no ffmpeg), printing the gain that would match each tone to Soft. It needs Playwright and is not part of releases. It agrees with the ffmpeg measurements behind the current gains to about 0.1 dB.
- **Octaves** is described as inspired by Shepard's and Risset's octave stacks rather than "after" them: a true Shepard tone keeps its bell curve fixed in absolute frequency.
- **About** says where to share what you make: noizgenie.com. The README's test count is current, and it lists `tools/` and `TODO.md`.

# Chord Glide 4.0.3 · 2 Nov 2026

Engine 3.1 and file format 3 are unchanged. Pieces using a new tone open in older versions with the default tone (Soft).

- **Five more tones**, each a formula for harmonic n (in `TONES`, with tests):
  - **Brass:** Chowning FM with carrier = modulator and index 3; harmonic n is J(n−1, 3) + (−1)ⁿ·J(n+1, 3), the upper sideband plus the reflected lower one (20). `besselJ()` is a power series, checked against published values.
  - **Harp:** a string plucked at 1/7 of its length, sin(nπ/7)/n², so harmonics 7, 14, 21 and 28 vanish (32). Held steady: tones have no envelope yet.
  - **Octaves:** only harmonics 1, 2, 4, 8, 16 and 32, under a bell curve on log₂ n centred one octave up (σ = 1.2 octaves), inspired by Shepard's and Risset's octave stacks (theirs keep the bell curve fixed in absolute frequency; this one moves with the note).
  - **Chime:** only the Fibonacci harmonics 1, 2, 3, 5, 8, 13, 21, each 1/φ of the one before.
  - **Air:** a near-pure fundamental, 2nd harmonic at −20 dB, 3rd at −30 dB, and a flat −40 dB shelf over harmonics 5–20.
- **Grouped tone menu:** Gentle (Pure, Soft, Warm, Air), Classic waves (Triangle, Square, Pulse, Saw), Instruments (Reed, Organ, Brass, Harp, Bowed, Cello) and Spectral (Glass, Chime, Octaves). Stored tone names are unchanged.
- **Level matching.** Gains for the new tones (Brass 0.79, Harp 1.16, Chime 1.11, Octaves and Air 1) bring the reference piece to Soft's EBU R128 loudness within 0.3 dB; every gain-matched tone is now within 0.4 dB.
- **Tests** for each formula: the Brass sidebands against known Bessel values, the Harp notches and 1/n² slope, Octaves only at powers of 2, Chime only at Fibonacci numbers with 1/φ steps, and the Air levels.

# Chord Glide 4.0.2 · 1 Nov 2026

Engine 3.1 and file format 3 are unchanged. Pieces using a new tone open in older versions with the default tone (Soft).

- **Seven new tones**, each a formula for the strength of harmonic n (`TONES`, now in `engine.js` so they can be tested; `toneWave()` gives the cosine and sine arrays for `createPeriodicWave`):
  - **Triangle:** odd harmonics at 1/n², alternating in sign (31 harmonics).
  - **Square:** odd harmonics at 1/n (31).
  - **Pulse:** a true centred 25% pulse: cosine terms sin(nπ/4)/n, so every 4th harmonic is missing (32). (An early 4.0.2 build put these in the sine terms, which gives the same harmonics but a 50% waveform; caught in review.)
  - **Saw:** every harmonic at 1/n (32).
  - **Organ:** drawbars 8', 4', 2⅔', 2', 1⅓' and 1' (harmonics 1, 2, 3, 4, 6, 8) set to 8-6-5-4-3-2, 3 dB a step.
  - **Bowed:** a saw with harmonics 2–5 lifted by a resonance, (1/n)·(1 + 0.9·e^(−(n−3.5)²/3)) (16).
  - **Cello:** a bowed-string-inspired spectrum: sin(nπ/9)/n, giving notches at multiples of the 9th harmonic (as from bowing at 1/9 of the length), a body resonance around harmonics 3–5, ×(1 + 0.6·e^(−(n−4)²/3)), and a gradual roll-off, ×e^(−n/28) (40).
  - Checked two ways: a sustained C3 measured in the browser (missing harmonics 60 dB or more down, the rest following their formulas), and new engine tests that check every formula, build one cycle of Pulse and measure it high for 25% of the cycle, and confirm the original five tones are unchanged.
- **Level matching.** Each new tone has a gain (`TONE_GAIN`) measured so a reference piece at default settings reaches Soft's EBU R128 loudness (all within 0.4 dB). Brightness, register and voicing change each tone's level differently, so this keeps tone changes reasonably consistent rather than exact. The original five tones are untouched, so existing pieces sound exactly as before.
- **MIDI glides above 15 voices.** `midiGlideFiles()` splits a piece with more than 15 voices into files of up to 15 (MPE lower zone: 15 member channels), named "(glides, voices 1–15)", "(glides, voices 16–30)" and so on, with matching titles. The export button says so for such pieces, and so does the status line after exporting. Before, voices beyond 15 were silently left out. The command-line exporter does the same.
- **Limits on saved notes.** `validRealization()` now caps saved notes at 64 voices, 60 minutes and 2,000,000 notes in all (voices × snapshots), with every pitch in MIDI range 0–127. A piece file beyond those is refused with the reason (`realizationTooLarge()`), rather than being allowed to freeze the page. Broken saved notes are still dropped quietly, as before.
- **`"engine": "custom"`.** Saved notes written by hand or by another program can say so: they always play exactly as written, and the app says "Playing the notes written into this piece". Before, such files had to claim an older engine.
- **Readable piece files.** `pieceJson()` saves pieces indented, with each list of plain values on one line, so a 30-voice snapshot is one line instead of 30.
- **MP3 length.** `mp3WithInfo()` puts an Info frame (the constant-bitrate Xing header) in front of exported MP3s, with the frame count, byte count and an even seek table, so players show the exact length instead of estimating it. ffprobe and ffmpeg read it without warnings.
- **`TAIL` and `FADE` everywhere.** The 3-second tail and 2.8-second fade were still written as numbers in the audio graph, the offline render and the volume control; they now all use the constants.

# Chord Glide 4.0.1 · 1 Nov 2026

Engine 3.1 and file format 3 are unchanged.

- **The picture shows the fade.** The stage's timeline now runs to `built.total + TAIL`: zoomed out, the piece spans the full length, and scrolling keeps going after the last change. During the tail the notes hold their final pitches (pitch is evaluated at no later than `built.total`), the lines fade into the background across the 2.8 s audio fade (`fadeToBackground`, thin strips of rising opacity; about 6 ms on a 70 ms software-rendered 1080p frame), and the dots and labels dim with the same envelope. Videos get the same frames. Before, the drawing stopped at the last change while three seconds of sound played on.
- **The clock and scrubber count the fade.** Every piece ends with a 3-second tail (`TAIL`): the master fades over 2.8 s and the reverb rings out. Playback, exports and videos already ran through it, but the clock and scrubber stopped at the last change, so they sat at 0:28 for three seconds of audible sound. Both now cover the full length (0:31 / 0:31 at the end), in the player and in the video overlay; the picture holds its last frame during the fade. When playback finishes it rests at the full length.
- **Playing from inside the fade.** Scrubbing into the fade, or pausing and resuming there, plays the rest of it: `buildGraph` starts the master at the level the fade had reached and fades out over the time left. Only the very end starts over.
- **Name on exports.** A new Settings field, "Artist name", stored only in this browser (`cge.artist`, kept in memory if storage is unavailable) and never in piece files. Empty by default, which writes no name anywhere. When set, it goes into every export with the piece name as the title (the real name, not the file-safe one): WAV gets a `LIST/INFO` chunk (`INAM`, `IART`) between `fmt ` and `data`; MP3 gets an ID3v2.3 tag (`TIT2`, `TPE1`, UTF-16) from the new `id3v2()`; MP4 gets `moov/udta/meta/ilst` with `©nam` and `©ART`; MOV gets classic QuickTime text atoms (`moov/udta/©nam`, `©ART`); WebM gets `Tags` (`TITLE`, `ARTIST`, listed in the seek head) and a title in `Info`; MIDI gets the artist as a copyright notice (`FF 02`); MusicXML gets `<creator type="composer">`. The command-line exporter takes `--artist <name>`. Checked with ffprobe in every format (title and artist read back, no warnings) and covered by 9 new writer tests, including that nothing is added when the fields are empty.
- **Artist under the title in videos.** When an artist name is set, rendered and recorded videos show it under the title in a smaller, muted line (about 58% of the title's size, 15–20 units, shortened only if it must be), and the trace starts a little lower to make room (`videoTitleLayout`). A tick box beside Render video, **Artist name under the title**, decides it for each render; it's remembered with the other video choices, dimmed with a pointer to Settings while there's no name, and part of the render snapshot. It controls only the picture, not the file's tags.
- **Video titles fit the frame.** `fitTitle` keeps the title at 34 units when it fits in about 90% of the width, shrinks it to as little as 26 on one line, then wraps it onto two balanced lines (26 down to 20), keeping a dash or colon at the end of the first line. A single long word shrinks to 20 before anything is shortened with an ellipsis. Portrait and square videos (540 units wide) used to run long names to the edge; landscape titles of normal length are unchanged.
- **Next-chord label with dense snapshots.** `nextEvent` skips same-name events less than 0.2 s apart, so a piece saved as snapshots says "D → end" instead of "D → D" during its hold. Real chords are never that close, so a repeated chord still shows.
- **Volume during the fade.** Changing the volume during the closing fade used to cancel it, so the chord came back at full volume until the oscillators stopped. It now keeps fading from the new level.
- **Auto zoom with dense snapshots.** `landmarks` finds the last arrival by skipping trailing events where no voice moves a quarter of a semitone or more (a repeated chord, which moves nothing, still counts). Pieces saved as dense snapshots, such as a realization that shimmers to the end, zoomed in and never back out, because the last snapshot landed after the end. They now zoom out once their voices settle. Ordinary pieces are unaffected: 912 seeded and hand-written progressions at 5, 11 and 15 voices give identical landmarks. Two engine tests cover it. Voicing is unchanged, so `ENGINE_VERSION` stays 3.1.
- `TAIL` is now defined beside the playback state at the top of `app.js`, before anything that uses it.

# Chord Glide 4.0 · 1 Nov 2026

Engine 3.1 and file format 3 are unchanged, so every piece sounds exactly as before.

- **Rendered video.** Render video draws every frame at its exact time (frame *n* at *n* ÷ fps seconds) with the same drawing code as the stage, and encodes it with the browser's WebCodecs encoders. The audio is the same render as the WAV export. Nothing can be dropped however busy the computer is, so there are no stutters and no video freezing while the sound carries on.
  - **Formats:** MP4 with H.264 video (High profile preferred, falling back to Main or Baseline) and AAC audio, or, where the browser can't encode AAC, a QuickTime .mov with H.264 and uncompressed 16-bit audio (QuickTime won't play MP3 or Opus inside an MP4; the menu then reads MOV and the size estimate allows for the larger audio), or WebM with VP9 video (VP8 where VP9 isn't available) and Opus. Sizes 1080p and 1440p in all three shapes, at 60 or 30 fps. Standard uses YouTube's recommended bitrates for landscape and portrait (8 / 12 Mbps at 1080p, 16 / 24 Mbps at 1440p, for 30 / 60 fps), scaled down by area for square video; High doubles them. The codec level is chosen to fit the size and frame rate.
  - **Files:** a keyframe every 2 seconds. MP4 puts its index first, so it plays and seeks straight away; WebM includes the duration, Cues (a seek index) and a seek head.
  - **While rendering:** progress and time left, a preview on the stage, Cancel, and the screen kept awake. Rendering keeps going in a background tab, more slowly.
  - **Renders from a snapshot.** The piece, its look and the theme colours are copied when rendering starts, and every frame and the audio come from that copy. Editing, undo and the playback and view shortcuts do nothing while it renders.
  - **Size estimate** under the controls. A render that will be over 1 GB (the whole video is held in memory until it's saved) asks for a second click first.
  - **Cancel** takes effect at once at every stage, including while the audio renders.
  - Choices are remembered in this browser. Formats the browser can't encode are marked, and without WebCodecs only Record live is offered.
- **New writers** in `writers.js`: `mp4Mux` and `webmMux`, written for this project, with no dependencies. MP4 audio can be AAC or Opus; with `quicktime: true` it writes a QuickTime .mov, which can also carry 16-bit PCM ('sowt'). AAC encoders start with ~1,000–2,000 samples of priming, which would put the sound slightly behind the picture: each render measures the encoder's delay (encoding and decoding a short noise burst and finding it by correlation), and the MP4 gets an edit list that skips exactly that many samples and ends at the real sound. They take H.264 with start codes or length-prefixed with an avcC record, and handle reordered frames. Frames are converted as they arrive and the writers reference them rather than copying, so only one copy of the video is held in memory. Validated with ffprobe and a full ffmpeg decode with warnings on (no warnings): exact frame counts, evenly spaced frames, matching audio length and exact seeking. The MP4 header boxes were compared with an ffmpeg-written file from the same streams and match in size and layout, and the .mov's audio and handler boxes match an ffmpeg-written .mov byte for byte, with the decoded audio bit-identical to the input; `test_writers.js` checks their exact sizes, the display matrix and the language code.
- **Record live** (the real-time recorder) stays for browsers without WebCodecs.
- **Glowing dots.** On dark looks, each voice's dot now has a soft glow that fades out, in its own colour (the colour at its pitch, for gradient looks), instead of a flat see-through disc.
- **No valid chords, no old piece.** If the chord list becomes empty or unreadable, the previous build is dropped: playback stops, the stage says to add a chord, and audio, MIDI, MusicXML and video exports are unavailable until there's something to export. A piece file can still be saved, without notes.
- **Undo stays within one piece.** New, Open, Import and the examples start a fresh history, so undo can no longer bring back a different piece and save it over the one that's open.
- **MIDI glides wider than the bend range** (±48 semitones) now hand over to a new note near the current pitch, as many times as needed. Before, the handover jumped straight to the target, so an extreme glide such as C0 to G9 could be off by up to 19 semitones on the way. Normal voicings never come close to this range.
- **The release script runs the writer tests too**, which now also check composition offsets for reordered frames and decode the MIDI glide file to confirm it follows the engine's curve (within 10 cents), including an extreme C0 → G9 → C1 glide.
- **LICENSE** is the standard MIT text alone, so GitHub recognises it; the lamejs note is in `LICENSES/` and the README.
- The reverb impulse cache keeps the last four sounds instead of every one used. The About page only says exports download straight to your computer where that's true.
- **`test_writers.js`** checks the structure of both containers and exits with an error if a check fails.
- The view's easing toward its target is set per frame (`cam.k`), so 30 fps renders ease at the same speed in seconds as 60 fps.

# Chord Glide 3.9.1 · 1 Nov 2026

- **Full glow in videos again.** 3.9 drew the glow at half resolution with fewer, simpler passes. Side by side in real recordings the halo was visibly thinner, and videos came out duller and much smaller (about 2 Mbps instead of 8). The glow drawing is back to 3.8's, byte for byte.
- **Kept from 3.9:** each recording frame is drawn once and mirrored on the stage, the background is cached, and the audio is prepared before recording with a 0.6 s lead-in.
- **No wasted frames on 120 Hz screens.** While recording, drawing is capped at the video's 60 frames a second instead of the screen's refresh rate.
- **12 Mbps video** (was 8), YouTube's recommended bitrate for 1080p at 60 fps.

# Chord Glide 3.9 · 1 Nov 2026

Engine 3.1 and file format 3 are unchanged.

- **Smoother video.**
  - While recording, each frame is drawn once, on the video canvas, and shown scaled on the stage. Before, the stage and the video were both drawn every frame.
  - The soft glow is drawn on a half-resolution layer and added in one step, with a lighter path (every fourth point, bevel joins, two passes instead of three). The sharp line and its core are unchanged.
  - The background and its vignette are drawn once per look and size, then reused.
  - Measured on a 1920 × 1080 Aurora video of a 5-minute piece (software rendering, so the absolute times are slower than on a real GPU): a full recording frame went from 153 to 58 ms in the opening whole view, 93 to 39 ms mid-zoom, and 39 to 30 ms while scrolling.
  - The audio graph is built before recording starts, and playback begins 0.6 s later, so the encoder starts on a still opening frame instead of during the busiest moment.
- **Volume in the player bar**, working like a video player's. With a mouse, hovering over the speaker shows the slider and clicking the speaker mutes or unmutes; on a touch screen, tapping it opens the slider. The panel has a speaker icon that mutes, the slider and the percentage, all fixed in size so nothing shifts. Dragging to 0 also mutes, and the icons show muted and quiet states. **M** mutes and unmutes. It left the Sound tab, and it's still remembered in this browser and never saved with a piece.
- Opening one player-bar popup closes the other; Escape and clicking outside close them.

# Chord Glide 3.8.4 · 1 Nov 2026

- **Website and source links.** `source/site.json` points at https://chord-glide.noizgenie.com, so link previews now include the preview image and the page gives its canonical address. The About page links to the website and to the source code on GitHub, and the README links to the website.

# Chord Glide 3.8.3 · 1 Nov 2026

- **Link previews.** The website build adds Open Graph and Twitter card tags, so a shared link shows the name, description and a 1200 × 630 preview image (`source/og-image.jpg`, glide traces drawn by the engine) in Discord, Slack, iMessage and social sites. Discord's embed bar uses the theme colour.
- **Site address.** Preview images need the site's full address: set `"url"` in `source/site.json`, or `SITE_URL` for one build. Without it the build still works and says that previews will have no image.
- **Both pages** now carry a description for search results and a theme colour.
- **`.gitignore`** keeps ignoring piece files (`*.json`) but lets `source/site.json` through.

# Chord Glide 3.8.2 · 1 Nov 2026

Fixes from a review of 3.8. Engine 3.1 and file format 3 are unchanged.

- **Privacy wording.** The About page states what Chord Glide itself does (no accounts, analytics, tracking or cookies; nothing uploaded) and then, in a line that depends on where the copy runs, where the Library and settings are kept.
- **No hosting assumptions in the code.** Chord Glide is a plain browser page: downloads, this browser's storage, and the encoder beside the page. A page that embeds it can optionally define `window.CHORD_GLIDE_HOST` to route saved pieces and files elsewhere; the hook is documented at the top of the Host section in `source/app.js`, and nothing in this repository uses it.
- **Guide tabs** report `aria-orientation` correctly: vertical down the side, horizontal across the top on narrow screens.
- **`node source/release.js`** makes a clean release zip: it runs the tests, builds, copies only the release files into `releases/chord-glide-<version>/`, and zips that, so `.git`, `.DS_Store`, `__MACOSX`, piece files and exports can never end up in it.
- The changelog no longer refers to where earlier test copies were hosted.

# Chord Glide 3.8.1 · 1 Nov 2026

- **Top bar layouts for smaller screens**, chosen by the width of the page with container queries:
  - **Wide** (1140 px and up): one row, as before.
  - **Medium**: piece, file, edit and windows on the first row; layer locks and Reroll together on the second. Before, Settings and Guide could wrap onto a line of their own.
  - **Phone** (600 px and down): name with Settings and Guide; file, edit and Reroll; then the four locks as equal columns with their full names, instead of H, V, M and S.
  - Below 357 px the icon buttons narrow slightly, below 340 px the lock icons hide (locked layers stay filled), and below 300 px Reroll shows only its icon.
- Reroll moved into its own group in the markup, and has an accessible name for when its label is hidden.
- **Rack tabs** can shrink, which removes a 3-pixel sideways scroll at 320 px.

# Chord Glide 3.8 · 1 Nov 2026

- **Engine history in the Guide.** Version history now covers the app, and a new Engine history page gives the technical detail of each engine version: search ranges, cost weights and how the controls set them, seeding, bass modes, motion timing, saved notes, and the piece file format. In Version history, the releases that changed the engine carry a tag that opens Engine history.
- Engine versions so far, for reference:

  | Engine | Since app | Summary |
  |---|---|---|
  | 1 | 1 | Semitone glides, DP voice leading with no crossings, bass C2–B2 |
  | 2 | 2 | 12-bit chord-tone coverage, Fisher–Yates shuffles, slash-chord fix, retry then warn |
  | 3.0 | 3 | Four per-chord seeded streams, controls set the cost weights, bass modes, register, per-voice motion |
  | 3.1 | 3.1 | Hard top-note ceiling, nearest bass stays in the chord, saved realizations |

# Chord Glide 3.7 · 1 Nov 2026

- **A logo.** Voices fanning out from one note, in the Aurora colors. It's the browser tab icon, sits beside the name in the header, and heads the README. `source/logo.svg` is the master; the website build also gets `apple-touch-icon.png` for phone home screens.
- **Header.** The version line credits Noizgenie instead of showing a date, and the description is now one line: "Write chords and hear them as gliding voices. Lock what you like and reroll the rest."
- **The build puts the title and tab icon in the page's `<head>`.**

# Chord Glide 3.6.1 · 1 Nov 2026

- **About page links.** "Read the MIT License" opens the full license text in place, so it works offline. lamejs, LAME and the LGPL-3.0 link to their sites in a new tab, sending no referrer. The link to LAME's site is one the LAME notice asks for.
- **Guide links.** Version history ends with "Next: About", and About ends with a link back to How it works.

# Chord Glide 3.6 · 1 Nov 2026

- **About page in the Guide.** It covers privacy (no accounts, analytics, tracking or cookies; everything stays in your browser), the MIT License, and credit for lamejs. One line changes with where the copy runs: from a file or from a website.
- **A website build.** `node source/build.js` now also writes `dist/`, ready for Cloudflare Pages or any static host. It includes a `_headers` file with a strict content security policy: the page may only run its own inline script, identified by hash, and load files from its own site. The build recomputes the hash every time, so it stays correct as the code changes.
- **`.gitignore`** also leaves out piece files (`*.json`) and `dist/`.

# Chord Glide 3.5.4 · 1 Nov 2026

- **New name: Chord Glide.** The app was called Chord Glide Engine. The page title, heading, messages, MusicXML credit, README and file names all use the new name. The app file is now `Chord Glide.html` and the command-line exporter is `cli/chord-glide-export.js`.
- **By Noizgenie, under the MIT License** (`LICENSE`). lamejs keeps its own LGPL-3.0 license.
- **Nothing else changed.** Engine 3.1 and file format 3 are the same, so pieces sound exactly as before. Browser settings and the Library carry over, because their storage keys didn't change.
- **Original test data (source only).** The voicing regression test now uses an F-major passage written for this project, checked against engine 3.1 at voicing seed 1, and other seeds for valid chord tones. The voicing-controls test uses a new progression too.

# Chord Glide Engine 3.5.3 · 1 Nov 2026

Fixes from a review of 3.5.2. Engine 3.1 and file format 3 are unchanged.

- **Corrected The math, step 11.** Gliding evenly in hertz rushes at the bottom and slows at the top (over an octave from C, the halfway point in hertz is already G, seven semitones up). The page had this backwards. The engine was always right; only that sentence changed.
- **Status messages fade.** Event messages such as "Saved 'Slow Orbit'" clear after about 4.5 seconds (warnings after 9), leaving just the save state, so you no longer see "Saved … · Unsaved changes".
- **No network requests.** MP3 export only uses `lame.min.js` from beside the page, and says so if the file is missing. It no longer falls back to a CDN.
- **The build keeps the command-line copies in sync.** `source/build.js` copies `engine.js` and `writers.js` into `cli/`.
- **`test_writers.js` creates the output folder** if it doesn't exist.
- **README:** a precise privacy claim, and how to zip a release without macOS metadata.

# Chord Glide Engine 3.5.2 · 1 Nov 2026

- **A tour of the top bar.** How it works now starts with a tour of the bar, showing each control's real icon (copied from the bar, so they always match). It covers the Library, the piece name and save dot, file actions, Undo and Redo, the layer locks, Reroll, and Settings and the Guide. The layer locks get the most detail: what locked and unlocked look like, what each layer covers when rerolled, and a worked example. The other steps are renumbered 2 to 9.

# Chord Glide Engine 3.5.1 · 1 Nov 2026

- **One Guide link.** The controls panel ends with a single "Read the Guide" link and the hint "or press ? anytime", on one line, instead of four links that wrapped. The Guide reopens on the page you last read.

# Chord Glide Engine 3.5 · 1 Nov 2026

- **DAW-style top bar,** grouped by job like a DAW control bar:
  - **Piece:** a Library button, the piece name (edit it in place) and a save indicator: hollow means never saved, green means saved, amber means unsaved changes.
  - **File:** New, Save, Save as new.
  - **Edit:** Undo, Redo.
  - **Layers:** lock buttons for harmony, voicing, motion and sound beside Reroll, mirroring the seed locks on each tab. Reroll is disabled when every layer is locked.
  - **Windows:** Settings and the Guide.
  - All icons have tooltips with their shortcuts. Status messages sit on a slim line below. On narrow screens the lock buttons shorten to H, V, M and S, and wrapped rows drop their dividers.
- **New shortcuts:** `?` opens the Guide, `⌘,` / `Ctrl+,` opens Settings, and `L` shows or hides the Library.
- **Guide pages restyled.** How it works, Shortcuts and Version history now match The math: a lead paragraph, badged headings, bold key terms, aligned key lists, and version badges with titles. The math is unchanged.
- **Fix:** choosing a Guide page no longer empties the controls panel behind it. The controls panel's tab code had also been picking up the Guide's tabs.

# Chord Glide Engine 3.4 · 1 Nov 2026

- **The Guide.** How it works, The math, Shortcuts and Version history now open in one window with a sidebar (tabs on a phone). Each page is separate; Next buttons and the arrow keys move between them, and the window remembers the last page you read. The four links sit at the bottom of the controls panel.
- **The math, step by step.** A new beginner's page in 13 steps, written for people with little music theory or math:
  - frequency and hertz
  - octaves as doubling
  - twelve equal steps
  - note numbers
  - the formula f(n) = 440 × 2^((n − 69) ÷ 12), read from the inside out
  - cents
  - chords as sets of note names
  - voicings
  - voice leading and how the engine scores it (including dynamic programming, explained without jargon)
  - the bass rule
  - the smoothstep glide, and why gliding happens in note numbers rather than hertz
  - seeds
  - the whole pipeline
- **Interactive tools on the math page:**
  - a note slider that shows the formula worked out and plays the note
  - a chord explorer that names each note's role and lights it on a piano keyboard
  - a voice-leading diagram (C major to A minor)
  - a plot of the glide curve against a straight line

# Chord Glide Engine 3.3.2 · 1 Nov 2026

Fixes from a review of 3.1. Engine and file format are unchanged (engine 3.1, format 3).

- **Honest local library.** At startup the page writes, reads and deletes a test value. If the browser refuses storage, or doesn't keep it (which can happen for pages opened straight from a file), the library turns off and says so. Every save is also read back to confirm it stuck. The page no longer appears to save when nothing was kept. Export → Piece file remains the dependable way to save.
- **Accurate opening messages.** A piece from an older engine with saved notes now opens with "playing the notes saved by engine X. Use 'Re-voice with this engine' to update it." The "may differ slightly" warning now appears only for old files without saved notes, where it's true.
- **Stricter checks on saved notes.** Every target must be a number. Every start time, glide time, departure offset and glide duration must be a nonnegative number. Chord times must not go backwards. A file that fails these checks re-voices from its settings instead.
- **Licenses.** `LICENSES/` now has the lamejs notice (author and source credited) plus the full LGPL-3.0 and GPL-3.0 texts. The old `LAME-LICENSE.txt` moved into `LICENSES/lamejs-NOTICE.txt`. Chord Glide Engine's own code is still unlicensed; that's your choice to make.
- **Source of truth.** `source/head.html` no longer loads Google Fonts, and the new `source/build.js` builds the HTML from `source/` (refusing external fonts).
- **Tests.** `test_writers.js` uses a temporary folder when none is given. Engine tests: 32 pass.

# Chord Glide Engine 3.3.1 · 1 Nov 2026

- **Accent color** (Settings → Interface): nine presets (fuchsia, cyan, mint, lime, amber, coral, violet, cobalt, silver), a custom color picker, or the theme's default. It's saved per device and layered over any theme. Text on accent-colored buttons switches between black and white automatically for contrast.
- **Links moved.** How it works, Shortcuts and Version history now sit at the bottom of the controls panel instead of floating below the page.
- **Fix:** cards in the Settings window no longer scroll over its title bar.

# Chord Glide Engine 3.3 · 1 Nov 2026

- **Settings window** (Settings button in the piece bar).
- **Trace looks.** Each look draws the lines with layered glow and a white-hot core, on its own dark screen with a faint center glow:
  - Phosphor (green oscilloscope)
  - Laser red
  - Laser blue
  - Amber CRT
  - Aurora (teal to violet to pink, tied to pitch, so a voice changes color as it glides)
  - Spectrum (a rainbow across the voices)
  - Neon (cyan and magenta voices)
  - Custom: line color, optional second color that blends from low notes to high, and background
  - Match interface: the plain look, as before
- **Look controls.** Glow and Line weight sliders. The look is saved with the piece, and video exports use it. "Use this look for new pieces" sets the starting look for new pieces and examples. There's also a quick look picker in the view popup.
- **Interface themes**, saved per device: Match device (the default), Cloud (inspired by Pantone's 2026 Cloud Dancer, with deep teal), Ice, Paper, Graphite, Deep Teal (the 2026 teal trend, with jelly mint), Studio Black (true black with electric fuchsia) and Cocoa.
- **Piece files** gain `view.trace`, which is checked and filled in on load. File format 3 and engine 3.1 are unchanged, so voicings are unaffected.

# Chord Glide Engine 3.2.3 · 1 Nov 2026

- **Icon transport bar:** play and pause, back to the start, view options (eye), theater, and full screen (its icon flips when you're in full screen). Each button has a tooltip naming its shortcut.
- **View popup:** the view (auto zoom, scrolling, whole piece) and label (notes, Hz) choices moved into a popup behind the view button. Esc or a click outside closes it, and it stays on screen on phones.
- **V shortcut:** cycles through the three views.

# Chord Glide Engine 3.2.2 · 1 Nov 2026

- The whole-piece view now uses the full width. The label column on the right is reserved only while scrolling, and it shrinks smoothly during auto zoom. Labels near the right edge sit to the left of their dots.

# Chord Glide Engine 3.2.1 · 1 Nov 2026

- Theater mode keeps the stage at its normal height and only makes it wider.
- The version is shown once, at the top of the page. It was also in the footer, which now holds just the About links.

# Chord Glide Engine 3.2 (engine 3.1, file format 3) · 1 Nov 2026

This version changes the layout only. The engine and the piece file format are the same as in 3.1, so saved pieces are unaffected.

- **Theater mode** (button beside the transport, or the T key): the stage spans the full page width and the controls move below it, laid out in columns. The page remembers the choice for next time.
- **Full screen** (button, or the F key): the stage fills the screen. Where the browser refuses real full screen, the stage covers the window instead, and Esc leaves it.
- **How it works, Shortcuts and Version history** moved out of the page into an About window, opened from links in the footer.

# Chord Glide Engine 3.1 (engine 3.1, file format 3) · 1 Nov 2026

This is a hardening pass based on a review of version 3. All the fixes it asked for are in, and the page now works as a file on your computer.

## Fixes
1. **Video lost its last chunk.** `ondataavailable` used to write to the global `recording`, which is cleared before `stop()`. It now writes to the recorder's own captured object, so the final chunk is kept. The preview canvas is hidden again after success, cancel, and when the recorder can't be created. Video and live playback now run to `total + 3.0 s`, matching the audio render's fade and reverb tail.
2. **Highest note is a hard ceiling.** `ceil = W.top`, never higher. In a tight register, the upper voices may sit closer to the bass (`bass + 1`) rather than break the ceiling. The opening spread is also capped at the top. Tested: 16 tight cases across 4 progressions and 4 bass modes, including G4 with bass octave 3 on Bmaj9. No note exceeds the top, and no upper voice goes at or below the bass.
3. **Nearest chord tone only picks chord tones.** It searches `ch.pcs` only. Tested: Dm7 → Cmaj7/D moves the bass to C2.
4. **Newer files and exact reopening.**
   - `normalizePiece` now throws for a `formatVersion` newer than 3. Opening such a file is refused with a message, and the current piece stays as it was.
   - Unknown fields are kept instead of dropped.
   - Saved pieces and piece files include a **realization**: the resolved notes, departure offsets and glide durations for every voice and chord, tagged with the engine version.
   - When a piece is opened, a realization from the **same** engine is dropped, because the settings reproduce it exactly. A realization from a **different** engine plays exactly as saved, with a notice and a "Re-voice with this engine" button.
   - Changing the chords, voicing, motion, timing, or the harmony, voicing or motion seeds re-voices the piece. Sound, view, tempo and name changes keep the saved notes. Undo brings frozen notes back.
   - Versioning rule from now on: bump `ENGINE_VERSION` whenever a voicing can change.
   - Tested: the realization round-trip replays pitches with zero difference. A broken realization is rejected.
5. **MIDI glides are adaptive.**
   - PPQ is now 960.
   - Pitch bend is sent whenever the curve drifts 3 cents or more from the last value sent, walking the curve at 0.5 ms.
   - Measured against the engine every 2 ms, treating each bend value as held until the next (how synths play it): mean 0.4 cents, 99th percentile 3.3 cents, worst 4.75 cents. Version 3.0's worst was 43 cents.
6. **Clear export labels.** MusicXML is labeled "harmonic score; stacked voices merged". MIDI chords is labeled "settled chords; stacked voices merged".
7. **Import ranges match the controls.** Chord length 1.5–12 s, glide 0–5 s, tempo 30–180, detune 0–20 cents, brightness 0.8–12 kHz, highest note G4–C7.

## Runs as a file
- **Direct downloads.** Opened from your computer, every export downloads directly as its own file type, and "Everything" is a .zip.
- **Library.** Pieces go to the browser's own storage.
- **MP3 offline.** The encoder, `lame.min.js`, ships beside the page as a separate, unmodified file, under the LGPL.
- **Fonts.** System fonts only, so no requests to Google.
- **CLI.** `cli/cge-export.js` writes MIDI with glides, MIDI chords and MusicXML from a piece file, and respects saved realizations (`--revoice` to override).

## Verification
- **Engine tests:** 31 pass (24 from version 3, plus 7 new).
- **Browser test** of the page opened as a file: reroll, undo, save, reload, exports and video all work.
  - All 7 exports download as the right file types.
  - MP3 used the encoder beside the page, with no requests to other sites.
  - A piece with notes saved by an older engine plays frozen, re-voices on a voicing change, and comes back with undo.
  - A newer file is refused.
  - Video saves, and its canvas is hidden afterwards.
