# Chord Glide 4.2.1 (in progress)

Engine 3.1 and the file formats are unchanged.

- **An Open window in place of the Library panel.** **Open** (beside New and Save, ⌘O / Ctrl+O, or L) opens a window with a sidebar, **Your pieces** and **Examples** (tabs across the top on a phone, where it fills the screen), and **Open a piece file…**. Your pieces can be searched by name and sorted by when they last changed, when they were made, name or size; each row shows when it last changed, its length, its parts and its size. Choosing one shows a preview of its trace in its own look, and when it was made and with which version, when it last changed, which version and engine saved it, its length, parts and voices, sections, chords and timing, size, file format (and which versions open it) and how its notes are voiced, with **Open**, **Download piece file** and **Delete** (press twice). On a phone the details replace the list, with a way back. Arrow keys move through the list, Enter opens and Delete deletes.
- **Asks before replacing unsaved work.** Opening a piece, an example or a piece file, or starting a new piece, used to replace the one you were working on straight away, along with its undo history. Now, if it has changes that aren't saved, Chord Glide asks first: **Save** (into your pieces, then carry on), **Don't save** or **Cancel**. Opening the piece you're working on again offers to go back to the version you last saved. A piece that's never been saved counts as changed only once you've changed it, so moving between untouched examples or new pieces never asks; the draft kept between visits remembers which it is (`unsavedWork()`, `replaceWork()`).
- **Pieces remember the version that made them** (`madeWith`) and the one that last saved them (`app`, as piece files already did). Saving also keeps a few facts beside the piece (`meta`: size, length, parts and voices), so the list needn't build every piece to show them; pieces saved before this are measured while the window is open, a piece at a time.
- **New examples, each teaching one thing:** **First Light** (the voicing and motion engine on its own, from chord names: a note that blooms into twelve voices; format 3, so older versions open it), **Pure Drift** (Just tuning and sections that repeat: the chords sink a comma each time round), **Sketchbook** (written lines that draw: arcs, ramps, accents, and an echo that makes a canon) and **Breathing Room** (space: rests, parts that play in some sections, a pad that swells in, a bell that rings out, and the chime, cello, square and glass tones). With Three Parts and **Bounce of the Spheres**, the full-length showcase, every feature appears somewhere. Each example has a line in the Open window saying what it's for. First Light is what a first visit opens.
- **Lantern Hours, Slow Orbit, Glasshouse and Fold are no longer examples.** (Fold is still in 4.2.) The examples kept as files are numbered in the order they're listed: `1-first-light.json` to `5-bounce-of-the-spheres.json`.
- **The top bar on a phone** is laid out in wrapped lines rather than a grid, so its second line, now with four file buttons, fits on screens 320 pixels wide; Reroll shows only its dice below about 380 pixels.

# Chord Glide 4.2 · 4 Nov 2026

Engine 3.1 is unchanged: a piece in seconds without sections voices exactly as before. File format 5 holds 4.2's features; a piece that doesn't use them is still saved as format 3 or 4, so older versions open it.

- **Musical time.** A chord's length can be in bars or beats as well as seconds: `Am:2bar`, `Am:3beat`, `Am:1.5bars`; `Am:6` and `Am:6s` are seconds, and an explicit unit never changes meaning on its own (`itemSeconds()`). The Harmony tab has **Time** (Seconds or Bars), which says how chords without a length of their own are timed: `timing.chordSec` seconds or `timing.chordBars` bars. Switching converts the chord length at the current tempo, so what you hear doesn't change. **Tempo** and **Beats per bar** (`timing.meter`) moved from the Export tab to the Harmony tab, since they now time the music: changing them re-times chords given in bars or beats (and written lines, as before). A piece in seconds is unchanged by either.
- **Sections.** A line in the chords that is only a header in brackets starts a section: a name, then optionally a repeat and a key change in semitones, in any order: `[Intro]`, `[Groove x2]`, `[Lift x2 +2]`. Chords before the first header belong to no section. The progression is expanded when the piece is built: each section's chords, transposed and respelled (flats stay flats: `Bbmaj7` +2 is `Cmaj7`), as many times as it repeats, with pinned voicings moved too; a header that can't be read is reported like an unreadable chord. Each event remembers its section and time through, saved notes keep them, and the score lists the sections as they fall in time (`built.sections`).
- **Plays in.** With sections in the chords, the Harmony tab shows which sections the chosen part plays in, the main part included: All sections (the default, nothing saved), or any of them (`plays` on the part, or on the piece for the main part). Outside them a part rests, coming in and going out by its envelope; a written line starts again at the beginning of each stretch of sections it plays in, repeating to its end if it repeats. A part that sounds throughout (a pad, or the main part) and plays to the end of the music still fades with the closing fade.
- **Text by section.** A line or pattern can play different notes in each section: in its text, `[B]` starts what it plays in section B, and `[A A2]` what it plays in both (`splitBySection()`, `layoutFor()`). Text before any marker plays wherever no marker says otherwise, including outside sections; a section given no text and no text before the markers is a rest. Each stretch of a section starts the part's text again. One melody part can carry a theme in A, a new tune in B and a rising arpeggio in the Build.
- **Key changes move written notes.** In a section with a key change (`[Drop +2]`), a written line plays that many semitones higher, as the chords do; a pattern's chord tones already follow the chords, and its fixed notes (a kick's `C1`) stay where they are.
- **Sections on the player bar.** In a piece with sections, a **Sections** button beside Back to the start lists every stretch of a section as it falls in time (`Groove 1/2 0:04`, with the one playing marked); choosing one jumps there. **Loop the section that's playing** repeats it, going back to its start at its end, and follows the playhead if you jump elsewhere. For listening only, like the volume: neither is saved with the piece.
- The readout under the stage shows the section, and which time through (`Groove 2/2`).
- **Pattern parts** (`preset: 'pattern'`): a cycle of steps that take their notes from the chord sounding as each step starts (`parsePattern()`, `patternNote()`, `buildPattern()`). `R` is the chord's root and `B` its bass note, and `3rd`, `5th` and `7th` its third, fifth and seventh (a sus chord's 3rd is its suspended note; a chord without a 7th gives its 6th, or else its root); `1`, `2`, `3`… are chord tones counting up from the part's lowest note (`from`), on into the next octave; a note name (`C1`) is that note whatever the chord; `'` raises a step an octave and `,` lowers one; `.` holds, `-` rests, and `:2` makes a step two long. It loops from the start of the piece (or of each stretch of sections it plays in) until the music ends, at the part's step length, with the line's envelope, legato, doubling, portamento and vibrato (lines and patterns now share `lineFromSeq()`). A step pushed out of MIDI's range is a rest. The Add menu has **Bass pattern** (`R R'` in eighths from C2) and **Arpeggio** (`1 2 3 4 3 2` in sixteenths from C4); the first tab, renamed Pattern, edits the pattern, step, lowest note and start.
- **Pitch drop** for lines and patterns (`drop: { semis, time }`, on the Motion tab): each note starts that many semitones from its pitch and falls onto it, fast then settling (`EASE.drop`, scheduled as a curve). The Add menu's **Kick** is a pattern of C1 on every beat, falling 36 semitones over 0.12 s, with a short envelope.
- **Echo** (`preset: 'copy'`): another part's notes again, later by some beats (`delay`) and moved by some semitones (`shift`), with its own tone, level and pan and its source's envelope, glides and vibrato (`shiftSub()`). The Add menu's **Echo** copies the chosen part (or the first melody or pattern), a dotted eighth later, 7 dB down, panned left.
- **Slides and loudness per note.** In lines and patterns, `~` before a note slides into it from the note before without a new attack (over the part's portamento, or 80 ms if it has none), and `@` after a note sets how loud it's struck: `G5@0.6` or `G5@60%` (`parseLoud()`). A slid note keeps the loudness the note before was struck at. In saved notes, an event can give a loudness for each voice (`vel`, 0 to 1); a voice given one is struck afresh at that loudness, even straight after another note, so other programs can write accents.
- **Natural decays.** An envelope's decay and release can be **Straight** (as before) or **Natural** (`envelope.curve: 'exp'`): exponential, fast at first and then fading away as strings and bells do, the release reaching −60 dB at its end; drawn and played from 16 points a segment. Existing parts keep Straight; the new Bass pattern, Kick and Arpeggio start Natural.
- **Over time, on the Sound tab.** **Breathe at chord changes** (pads and the main part): the part eases down to its lowest at each chord change and swells back, like strings re-bowing (`breathe: { depth, time }`). **Duck under** another part (every part, the main part included): it dips each time that part strikes a note and recovers over the time set, as pads pump under a kick (`duck: { under, depth, time }`). Both are a shape over the part's level (`dipPoly()`, `shapeParts()`, the part's `mod`), multiplied into its envelope for playback, video and the picture; a part that sounds throughout still fades with the piece.
- **A note's own glide** in written lines: `G4:2/0.4` glides into G4 over 0.4 seconds without a new attack, `/0.4l` in a straight line and `/0.4s` smoothly (otherwise in the part's glide shape), and `/0` jumps; a note can carry cents to a thousandth (`G4-21.506`), and a line can be up to 400,000 characters. Together these can write out any voice exactly: its holds, its jumps and every glide at its own speed.
- The part menu no longer calls every echo "no source" when a piece opens; it looked for the source in the piece's previous build.
- **Notices by kind.** The notices under the chords were all one red line, whether something had gone wrong or not. Each is now its own line, marked by kind: **information** (muted, with an i: the piece is playing saved notes, a chord list is empty), a **warning** (with a ringed !: a line stopped at the most notes a piece can have, chords the voicing rules couldn't place) or an **error** (in the warning color, with a filled !: chords that can't be read). A screen reader hears the kind first.
- **The saved-notes notice says what a change would re-voice.** It said changing the chords re-voices "the piece"; in a piece with parts only the main part is re-voiced, and parts of written notes keep them, so it now says so.
- **A new Guide page, Piece files,** after Engine history: what each file format holds (3, one part; 4, parts; 5, 4.2's features) and which versions open it, the difference between the app, engine and file versions, and the technical detail for programs that write piece files, moved from the end of Engine history.
- **A new Guide page, Parts and sections,** after How it works: time in bars, sections and the Sections button, patterns, what a note can say, echoes, Never stops and the balance, shaping over time, Just tuning and the exports. How it works no longer says MIDI chords and MusicXML carry only the main part.
- **Two new examples in the Library: Bounce of the Spheres and Fold,** written natively: sections, patterns and lines, no saved notes. Bounce (7 KB, from 1.1 MB of saved notes) has 24 voices in 11 parts that never stop, with a sine sub under the bass; Fold (84 KB, from 2.3 MB) has 22 written lines and draws exactly as the original did. Examples can now be kept whole as piece files in `source/examples/`, which the build puts into the page; they open with their own look.
- **File format 5, documented.** The Guide's Piece files page and the README now list what makes a piece format 5. A line with glide times (`/0.4`), more than 12 parts, a line over 20,000 characters, and main-part saved notes with loudness or glide shapes now count too; before, such a piece was saved as format 4, and app 4.1 would have opened it and played it wrongly.
- **Up to 32 parts** besides the main one (was 12), and a main part can play in no section (`plays: []`, silent even in a piece without sections), for a piece whose voices are all written out. The Every voice equal balance counts only voices that sound.
- **Just intonation** (Harmony tab, **Tuning**, `tuning: 'just'`): each chord's notes are tuned as pure ratios from its root (thirds 5/4 and 6/5, fifths 3/2; a 7th over a major third is the harmonic 7/4 and the tritone 11/8, so a pinned harmonic-series voicing rings as the harmonics do), and the root is placed so that a consonant note the chord shares with the one before (its root, fifth, a third, a sixth or its fourth) stays exactly where it was; with none, the root moves by a pure interval from the root before (`justTuning()`). So chords ring without beating, and a progression that comes round can drift like a tide: C Am Dm G sinks a syntonic comma (21.5 cents) each time, and C G Dm Am rises as much. Every part follows the tuning of the chord it's in: the main part and pads, patterns, written lines (a note written with cents keeps them on top) and voices resting on the chords. Equal temperament stays the default and is unchanged.
- **Never stops** (lines and patterns, `nonstop: true`): the part's voices sound from the first moment to the end, as one tone each, the way every voice of a piece of saved notes does: its notes are moves of one held tone with no attack or release, a rest holds the note before it, and wherever the part has nothing to play (outside its sections, before its first note, after its last) its voices join the chords, each gliding to a chord tone in its own register (spread through the range the part plays in, then led to the nearest tone at each change over the piece's glide time; `nonstopSeq()`). An opening single note (`=G4`) gathers them onto it, so every voice blooms out of one note together. The note after a stretch of chords glides in. Its notes still carry vibrato and still make other parts duck under it (`strikes`). In a part with a pitch drop, a slide (`~`) no longer falls, so a kick can hold a sub note between hits.
- **Balance** (Sound tab, `mix`): **Each part on its own** (as before: every part about as loud as the main part, however many voices it has) or **Every voice equal (one sound)** (`mix: 'voices'`): the piece plays as one instrument of all its voices, so a melody doubled on six voices is six times as strong as an echo on one. Part levels still change either.
- **Echoes of some voices:** an echo can copy only its source's first voices (**Voices** on the echo's first tab, `voices` on the part), so one voice can echo a melody that six voices play.
- **Vibrato is drawn.** A line's or pattern's vibrato shows in the picture as it sounds, fading in after each note's delay (`addVibrato()`); before, it was heard but drawn as a flat line.
- **MIDI chords and notes, and MusicXML with every line.** MIDI chords, which carried only the main part's chords, now adds a track for each part: named after it, with a General MIDI instrument for its tone, its notes and how hard each is struck, and a part with a pitch drop (a kick, a tick) on the drum channel as a bass drum (`voiceNotes()`). MusicXML adds a staff for each line, pattern or echo part after the harmonic staff: its first voice, in sixteenths with ties across bar lines, in the treble or bass clef by its register; pads and saved notes stay out of the notation. A part kept at −60 dB (one that only frames the picture) is left out of both. A piece with only its main part exports exactly as before. Checked on Bounce of the Spheres and Fold: well-formed, a staff and track per part, every staff the same number of bars.
- **Echo as a sound setting** (Sound tab, Over time; any part, the main part included): **Echo** (Off, or a sixteenth, eighth, dotted eighth, quarter, dotted quarter or half note at the tempo), **Echo level** (the first repeat), **Repeats** (how much of each repeat carries on to the next, up to 90%) and **Repeats go** (left and right in turn, or where the part is). Each repeat is a little darker. Heard in playback, audio and video but not drawn: for an echo you can see, there's the Echo part (`echo: { time, mix, feedback, pingpong }` on the piece or a part, `addEcho()`). Measured on a single note: repeats exactly a beat apart, each 6 dB down at 50%, and ping-pong repeats as loud in all as repeats in place.
- **Arc glides.** Lines and patterns have a **Glide shape** (Motion tab): Smooth (as before), Straight, or Arc, where each run of slid notes alternates a quarter circle that leaves steeply (`EASE.arcout`) with one that arrives steeply (`EASE.arcin`): `C4 ~E4 ~C4` with a long portamento traces the top half of a circle, within 0.1% of its height. A slide (`~`) may now glide for its whole note (other notes that touch, half), and portamento goes up to 4 s. An event can carry its own glide shape (`ease`), in saved notes too.
- **MIDI with glides** marks each section as it starts (`[Groove 2/2]`) before its chords, writes the piece's beats per bar, names each voice's track after its part (`Bass`, `Kick (pure)`), and gives each part a General MIDI instrument from its tone (`gmProgram()`): a part with a pitch drop is a synth drum, a low saw or square part a synth bass. MIDI chords get the section markers and meter too.
- **The offer to keep time in bars:** adding the first pattern to a piece kept in seconds offers to switch it to bars, converting the chord length at the current tempo, so chords can change on the beat.
- **Glides that meet end to end.** When one glide ended exactly as the next began, rounding could make the two overlap by a hair, which the browser refuses; that voice then stopped following its glides for the rest of the piece (in Bounce of the Spheres, one voice in its last seconds). A glide now ends a microsecond early.
- **A pitch drop keeps to MIDI's range.** A note was checked at its own pitch but not at the top of its fall, so `G9` falling from 36 semitones up started above MIDI 127 (and `C0` dropping from below, under 0), which MIDI can't carry. A note whose fall would start out of range is now reported in the line (`G9 (out of range)`) and plays as a rest, as an out-of-range note always has; in a pattern it rests. A note that slides in doesn't fall, so it isn't held to it. The check is also made after Just tuning, which can move a note by some cents. (`fitsRange()`, `fallOf()`)
- **An echo of a part that sounds throughout waits for its delay.** An echo of a pad or of a part that never stops had no notes to move later, so it sounded from the very start and only its changes of pitch came late; it also ran on past the end by its delay, lengthening the piece. It is now silent until its delay, enters as a pad does, and plays on to the end of the music and fades with its source. The same goes voice by voice: in an echo of saved notes where one voice never rests and another has notes, the held voice waits for the delay too, enters as a pad does whatever the part's envelope, and fades with the piece (`heldV`); an echo of only such voices doesn't lengthen the piece. And an echo copies its source as it plays in its sections: an echo of a pad that plays only in B was heard from near the start, before its source had played at all, and one of a pad in no section was heard though the pad never was; sources are now gated to their sections before they're copied. An echo of only some voices (**Voices**) checks only those voices against MIDI's range: an echo of a line's lower voice two octaves up was left out because the voice it doesn't copy would have gone past 127. In Bounce of the Spheres the two melody echoes now come in at 0.375 and 0.75 s instead of at the start, and the piece ends a second sooner, at 121 s, as the original did. said they carry only the main part's chords. It now says what they leave out: in MusicXML, parts that follow the chords (pads), which are in the audio and both MIDI files; in either, a silent part.
- **The Sections list fits a phone.** On a short screen it opened off the top of the window; the list now shortens to fit above its button, and the page scrolls to show it.
- The app icon and the link-preview image no longer carry embedded file metadata; the images themselves are unchanged.
- Tests: a pitch drop out of range in lines and patterns (G9 up 36, C0 down 36, C1 up 36 still fine; slides exempt); an echo of a pad silent until 2 s at 4 beats and 120 BPM, playing to the end without lengthening the piece; the same for a part that never stops, and for an echo in a section; an echo of saved notes with one held voice and one with notes, and of its held voice alone (the piece stays 8 s); an echo of a pad that plays only in B, and of one in no section; an echo of one voice two octaves up when the other would be out of range. MIDI chords with a track per part (the main part's chords unchanged, a note-on at each note at its pitch, a main-part piece byte for byte as before); MusicXML with a staff per line (the harmonic staff unchanged, clefs, every note once, the same bars); the echo setting (limits, format 5); a note's own glide (smooth, straight, a jump; cents to a thousandth); a silent main part; 32 parts; just intonation (pure thirds and fifths, the comma pump down and up, the harmonic 7th, a 7th never holding the tuning, patterns and lines following it, equal temperament unchanged); a part that never stops (no gates, rests holding, gathering on an opening note, joining the chords on different tones in its range, vibrato); a slide that doesn't fall; an echo of one voice; the Every voice equal balance; text by section in lines and patterns, with the text before the markers outside sections; a key change moving a melody; 3rd, 5th and 7th; arc and straight glides; MIDI markers, meter, part names and instruments; slides and loudness in lines, patterns and saved notes; natural releases; ducking and breathing; patterns (steps, chord tones, octaves, holds and rests, fixed notes, chord changes, out of range); the kick's fall; echoes (later, moved, a missing source); lengths in seconds, bars and beats at a tempo and meter; a piece kept in bars; the file format each feature needs; a piece in seconds unchanged by tempo and meter; section headers, repeats, key changes and respelling; sections in time; parts gated to sections, a line restarting in its section, a held part through the closing fade; saved notes keeping their sections.

# Chord Glide 4.1.3 · 2 Nov 2026

Engine 3.1 and the file formats are unchanged; only the drawing and the auto zoom change.

- **Choose when auto zoom zooms.** The Export tab has an **Auto zoom** setting beside Quality: Automatic, or Custom times, which shows when the view zooms in (starts, ends) and zooms out, starting from the automatic times. Times are typed as m:ss or seconds, and each has a **Now** button that takes the playhead, so you can pause where a zoom should start and press it. The times are kept in order around the one you change, saved with the piece (`view.zoom`: `inStart`, `inEnd`, `outStart`, `outEnd` in seconds, the file still format 3; older versions ignore them), undoable, and used by Auto view on the stage and in rendered and recorded videos. With Automatic, the hint underneath says when the piece will zoom.
- **The automatic zoom in is back to how it was before 4.1:** from the first chord's glide until 1.2 s after it arrives. 4.1 made a piece over a minute long show its whole shape first (4% of its length, up to 6 s) and grouped dense snapshots to find the first chord; with custom times there to hold the whole view as long as you like, the automatic zoom in matches 3.9 again on every piece (checked on the opening piece, the examples, Glass Tide and Bounce of the Spheres). The zoom out keeps 4.1's fixes, so pieces of dense snapshots still end on the whole picture.
- **Fast movement, zoomed out: your choice.** A new setting, in the view menu (the eye on the player bar), in Settings → Trace look and with the video settings on the Export tab (all three are the same setting), saved with the piece like the trace look (`view.trace.busy`), and used on the stage and in videos. **Range** (the default) draws a stretch where a voice moves faster than the picture can show as a faint band between the lowest and highest notes it reaches, with thin edges and no glow, so a bass jumping octaves reads as the octave it covers rather than a solid block or a line through notes it never plays. **Middle** draws one line through the middle (as the first 4.1.3 build did), and **Every move** draws every move, as 4.1.1 and 4.1.2 did. Zoomed in, every move is drawn whichever is chosen. The zoomed view frames bands as well as lines.
- **Settings has pages,** chosen from a sidebar like the Guide's (tabs across the top on narrow screens, arrow keys move between them): **Trace look**, **Interface** and **Name on exports**. It opens on the page you last used.
- **One Export menu.** The seven export buttons are now one **Export** button that opens a menu of the formats, each with its description; choosing one saves it and closes the menu. Arrow keys, Home and End move through it, and Escape or a click elsewhere closes it. Tempo and Video stay where they were.
- **Zoomed out, fast movement reads as a line again.** 4.1.1 drew each zoomed-out line by keeping, in every cell of 1 to 2 pixels, its first, lowest, highest and last points, so that no note could flicker away. On a piece like Bounce of the Spheres, where the bass jumps an octave every quarter beat and the kick dives 36 semitones on every beat, that drew a full-height stroke in nearly every cell: the lower half of the picture became solid blocks, and Firefox struggled to paint them while zooming. Now a stretch where a voice keeps turning back on itself (up and down by a semitone or more, four times or more within about nine cells) is drawn in the busy-movement style above. Elsewhere (holds, single edges, glides, single spikes, the start and end of every note) a cell keeps its first, lowest, highest and last points, which for a line that doesn't turn back is all there is to see. Cells stay fixed in the piece, so the picture is still the same from frame to frame. Zoomed in, nothing is averaged: Bounce's kick drops to C1 as it did in 4.1. Points on a straight line (saved notes repeat a held pitch many times a second) are dropped when the lines are built. Measured on Bounce at 1280 pixels: zoomed out, a frame strokes 17,800 points (4.1: 13,100; 4.1.2: 20,400) and no solid areas; zoomed in, 5,800 (4.1: 12,200).
- **The zoomed view frames what's drawn.** The pitch range the zoomed view frames was measured at about 40 moments across the view, taking the middle of each three so a brief blip couldn't move it (4.1). A kick that dives briefly on every beat counted as a blip every time, so the view fitted C3 to C6 while the dives ran off the bottom of the picture. The range is now taken from the lines as they're drawn over the stretch in view, so everything drawn fits; a move that repeats stays in frame, and the range changes only as something enters or leaves the view, which it eases toward as before. Measured over 10 seconds of Bounce and Glass Tide, the edges of the view don't move.

# Chord Glide 4.1.2 · 2 Nov 2026

Engine 3.1 and the file formats are unchanged; how pieces sound and are voiced is unchanged.

- **Saved notes without chord names.** A piece of saved notes written by another program may leave out each event's `label`; `builtFromRealization()` turned that into the text "undefined", which showed as the chord name in the picture and in videos. A missing label is now no name.
- **Auto zoom on unnamed snapshots.** Auto zoom treats snapshots that share a chord name and follow each other closely as one chord (4.1). Snapshots with no name at all were treated as sharing one, so a whole piece of them counted as a single chord, and the zoom in ran from the start to almost the end (on a 108-second piece, from 4 s to 106 s). Only named snapshots are grouped now; that piece shows the whole for 4.3 s, zooms in over 2 s and zooms out over the last 3 s. Every other piece zooms exactly as in 4.1.1 (checked on the opening piece, the examples, Glass Tide and Bounce of the Spheres). Found by opening a piece saved by another program that writes Chord Glide files.

# Chord Glide 4.1.1 · 2 Nov 2026

Engine 3.1 and file formats 3 and 4 are unchanged; only the drawing changes.

- **Steady lines at any zoom.** The lines were drawn by sampling each voice's pitch every 2 pixels, at moments fixed in the piece but spaced to suit the zoom. While the view held still that was steady, but while auto zoom zoomed in or out the spacing changed every frame, so any detail finer than it (short notes, quick hits, fast edges) was caught in one frame and missed in the next: notes flickered in and out and edges changed slope. Zoomed out, the same sampling turned quick shapes into zigzags and left most short notes out. Each voice's line is now made from its own moves (`pitchMoves()`: holds, jumps and linear glides exactly, eased glides at 120 points a second) and cut where the voice is silent (gain under 0.02), with each edge found exactly, once per build (`voiceLines()`). Zoomed out, it's thinned to cells of 1 to 2 pixels whose sizes are powers of two of a second and whose edges are fixed in the piece; each cell keeps its first, lowest, highest and last points, so no note is lost from sight, and the picture changes only when the zoom passes one of those sizes (three times in a zoom of a piece like Fold, rather than on every frame). The pitch range the zoomed view frames is measured at moments spaced by a power of two of a second too, for the same reason. Measured on Fold (26 voices of saved notes): with the old drawing the drawn lines moved by up to 12 pixels between frames during the zoom out, and now don't move between level changes; a frame takes 1 to 2 ms to draw, as before. Pieces made in the app look the same as before, to within a pixel of framing.
- **What's coming shows past the playhead.** While the view scrolls, the lines used to stop at the playhead, leaving the label column (a sixth of a video's width) empty but for the labels. The next moments of the piece now carry on faintly past the playhead to the right margin, under the labels, fading out toward the edge; they stay within the trace's band, since they aren't framed yet. Labels always have their backing now, so they stay readable over them.
- **The label column fits the piece.** The playhead stood a fixed distance from the right edge, sized for long labels like `A3 +44¢ ×2`. It now stands where the widest label the piece actually shows fits (measured once per build, at moments 0.1 s apart, `labelRoom()`), with the same margin on the right as on the left, and never further in than before. Pieces with short labels gain the most.

# Chord Glide 4.1 · 2 Nov 2026

Engine 3.1 is unchanged: the main part keeps the same voicing and motion. File format 4 adds parts and a volume shape; a piece without them is still saved as format 3, so older versions open it. (The plan said engine 4.0, but the rule is that the engine version changes only when an existing voicing can change, and none does.)

- **Parts.** `normalizePart()`, `buildPart()` and `buildScore()`: besides its main part, a piece can have up to 12 more, 64 voices in all, each with its own voices, `sound` (tone, level in dB, pan, width, detune) and `envelope`, and a pitch source: `pad` (the chord-following engine with its own voices, voicing and motion), `line` (a written line: `parseLine()`, `buildLine()`) or `notes` (saved notes, where `null` is a rest). The score numbers voices across parts, main first; `pitchAt()` and `pitchMoves()` ask each voice's own part. The chord timeline stays the main part's, for labels, auto zoom, MIDI chords and MusicXML.
- **Seeds per part:** `partSeed()` derives a pad part's voicing, motion and sound seeds from the piece's seeds and the part's id with a stable hash, so adding, removing or reordering parts never rerolls another.
- **Gain over time.** Voices in lines and saved notes have gates (when they sound); `envelopePoints()` turns them into a polyline (attack, decay, sustain, release, each note starting from wherever the last left off; notes that follow each other end 30 ms early, so each is heard as a new note unless the part is legato). `gainAt()` reads it, and `gainMoves()` gives straight-line moves for an AudioParam that replay it exactly. `vibratoMoves()` blooms vibrato into notes long enough to hold it. `volumeAt()` reads the piece's volume shape (straight lines in dB).
- **Playback:** each part's voices use its tone, level, pan and width; the main part's draw their detune and pan from the same random sequence as before, and other parts from their own. Envelopes, vibrato (an LFO on detune) and the volume shape are scheduled with the pitch moves. The Sound tab's live tone change applies to the main part only. Measured: a melody's rests are 40 to 55 dB below its notes, down to the measurement floor. Existing pieces render within the browser's own run-to-run difference of 4.0.5.
- **Drawing:** a voice is drawn only while it sounds, so rests are gaps; resting voices have no dot or label; the status line's range counts sounding voices.
- **Exports:** MIDI with glides carries every part, one channel per voice, and a voice that rests gets a note-off as it stops and a fresh note-on as it starts again (held notes within 5 cents; very fast portamento within 10, where a tick is itself worth several cents). MIDI chords and MusicXML carry the main part, and the export message says so. Files of up to 15 voices split across parts. The command-line exporter builds every part too. For pieces without parts, MIDI and MusicXML are byte-identical to 4.0.5's.
- **Three Parts**, a new example: a pad, a bass line and a melody with rests and vibrato, at 120 BPM. The tests read it from the app's example list.
- Tests: format 3 versus 4, the music's end with a long release, auto zoom on dense saved notes, the main part unchanged by other parts, attack, move, sustain, release, rest and attack again, envelope replay, seeds per part, repeat and legato, saved notes with rests, the volume shape, the voice limit, and MIDI rests.
- **The part bar.** A **Part** menu above the tabs chooses which part the tabs edit (Main by default), with **+ Add** (melody, bass or pad) and a **⋯** menu (name, move earlier or later, duplicate, remove). With an added part chosen, the tabs' own controls that belong to a part (voices and every voicing control, departure order and stagger, tone, detune and width) edit that part, so a pad part has the full Voicing and Motion controls; each tab shows the part's own settings at the top (Harmony becomes Line: the line, with errors explained as you type, step, start, repeat and legato; Voicing becomes Voices: the intervals it's doubled at; Motion: portamento and vibrato; Sound: level, pan and the envelope); and what every part shares (the chords, chord length, glide time and curve, reverb, brightness, volume shape and seeds) sits under a Whole piece heading at the bottom. A new melody or bass line starts from the chords (a chord tone, usually the third, in C5 to B5, or the bass note in C2 to B2, held for each chord, the last note taking exactly what's left). Edits rebuild as you go and are committed for undo when a control is let go; choosing a part changes nothing, and each control writes only its own setting, so a pad part inherits the main part's voicing until it's changed. A part's id is fixed when it's made, so renaming keeps its seeds; a duplicate gets a new id, so a duplicated pad voices differently. Adding is disabled at 12 parts or 64 voices. Pad parts have at least 3 voices, like the main part (a bass and two above it). (An earlier 4.1 build had a separate Parts tab; this replaces it, so the tabs you know edit every part.)
- **Volume shape** on the Sound tab: none, fade in, crescendo, swell or fade out, set for the piece's current length (straight lines in dB); a shape from a file, or for a different length, shows as Custom.
- **Piece files take their format from what they use:** saving writes format 4 when the piece has parts or a volume shape and 3 otherwise, so adding a part to a format-3 piece can't leave a file that older versions would open without its parts.
- **The library and the draft live in IndexedDB.** They were kept in localStorage, which browsers cap at about 5 MB for the whole site, with the library as one string; three large pieces of saved notes (Glass Tide 4.8 MB, Bounce of the Spheres, the Deep Note study) couldn't fit, and the draft of a piece that size failed silently, so a reload could bring back an older draft. Pieces now go in a database (`IDB`), one record each, where browsers allow hundreds of megabytes; a library kept by an older version moves across on first start and is then removed from localStorage. Where IndexedDB isn't available (it's checked with a write and a read-back), localStorage is used as before. Tested served over http and opened from a file: the three pieces and an older library together, saved, reloaded and each opened.
- **A save that fails changes nothing.** The library added the piece and marked it as this piece's entry before storage was asked, and didn't undo that when storage refused: the status said the library was full and also "Saved", the dot turned green, and the piece showed in the list until a reload. Now the library, the piece's entry and the dot change only once storage has kept it.
- **The undo history is capped by size** as well as by count (100 steps, and about 40 million characters), since every step keeps a copy of the piece and a piece of saved notes can be megabytes.
- **From review: safety for parts.** A glide in a file that claims to outlast the piece is scheduled only to the piece's end (a 10⁹-second glide had asked for hundreds of millions of curve points); `pitchMoves()` stops at the end too. A line's note lengths must be finite and from 1/64 to 1024 steps (a 400-digit length had made the piece infinite), notes shorter than 5 ms leave the line out, and lines are stopped at 20,000 notes each and 100,000 together (`LINE_LIMITS`), with a message. The 64-voice limit counts the main part's saved notes, not its voice setting (a 60-voice realization plus a 20-voice pad had built 80 voices).
- **From review: pitches stay in MIDI 0–127.** Unison notes and pinned voicings outside it (such as `=C-1-50` or `=G9+50`) are refused like unreadable chords, and a line note that its doubling would take outside it is reported and plays as a rest of the same length. Before, the app could make saved notes its own check then refused.
- **From review: pad parts keep their resolved notes.** `partRealizations()` saves each pad part's notes with the piece, like the main part's; a pad part saved by another engine plays them exactly (`buildPart()`), and the re-voice button and message cover it. Editing the chords, the main part's voicing or motion (which pad parts inherit), a seed, or re-voicing drops them all; editing one pad part's own voicing or motion drops only its own.
- **From review: mixing.** Every voice's level was shared out over all the voices in the piece, so adding even a silent part turned the others down (a 32-voice pad at −60 dB lowered the main part by 11 dB). Each part is now balanced by its own voice count, so its voice count no longer changes the balance, and the main part's level is exactly as before. With several parts, the mix shares out headroom: every voice is scaled by one over the sum of the parts' levels (as amplitudes, the main part counting as 1), and a soft clip rounds off anything above −3 dBFS and never reaches full scale. A piece with only its main part has neither. Measured: the −60 dB pad now changes the main part by 0.01 dB; Three Parts plays at −12.6 LUFS against −11.5 for Lantern Hours, with 0.04% of samples above −3 dBFS (Lantern Hours: 0.01%); five parts all at 0 dB peak at −3.2 dBFS. Three Parts and new parts start at levels that suit this: bass −5 dB, melody −1 dB. (The browser's compressor isn't used as a limiter: it adds make-up gain, and missed some peaks.)
- **From review: three ends, not one.** The closing fade (`FADE`, inside the 3-second `TAIL`, both now in `engine.js`) used to be on the master, so it also cut short a line's last release. In a piece with lines or saved notes, it's now on the voices that sound throughout (the main part and pads), and those voices' notes end by their own release, at their own level, into the tail. A release only lengthens the piece by what wouldn't fit in the tail (with 0.2 s to spare): a 2.5 s release at the end changes nothing, a 5 s one adds 2.2 s. The held parts' fade still starts where the music ends (`buildScore()` returns `musicEnd` beside `total`), so a long release never holds them at full level past it; the drawing fades there too. (A first fix made the music last until the last release ended, which kept the held chord sounding at full level all that time.) In a piece whose voices all sound throughout, the fade stays on the master, after the compressor, exactly as before. Measured: as a line's last note releases over 2.5 s, it follows its release, not the fade, while the held pad follows the fade.
- **From review: MIDI glides stop where the music does.** `midiWithGlides()` walked each glide tick by tick to its stated end: a file claiming a 10⁹-second glide in a 1-second piece would have taken about 10¹² steps. A glide is now written only until the next change, the note's end or the part's end, and no MIDI event is written after the end of the piece. A glide cut short by the next change jumps to where the next one starts, as playback does.
- **From review: tempo times lines.** The tempo slider didn't rebuild the piece (it used to set only the export tempo), so written lines kept their old timing, and MIDI could be exported at the new tempo from lines built at the old one. It now rebuilds whenever the piece has a line.
- **A steady view in auto zoom.** The zoomed view frames the pitches in its window, measured at 41 points that moved with the playhead, so a brief spike (a kick-like drop, a grace note) was caught in some frames and missed in others, and the view jumped up and down with it. It now measures at fixed moments of the piece, takes each voice's median with its neighbours so a blip at one moment can't move it, skips resting voices, and widens quickly but narrows at a third of the pace. On Glass Tide (24 voices of saved notes with spiky bass), the bottom of the view travelled 39 semitones and changed direction 219 times in 10 seconds; now 0.3 and 5. (4.0.5 did the same; spiky pieces like this one showed it.)
- **Auto zoom on pieces of saved notes.** Auto zoom finds where the first chord settles (to zoom in) and where the last one does (to zoom out) from the piece's chord changes, but a piece saved as notes by another program has a change every few hundredths of a second, so it took the first snapshot for the first chord and the last snapshot, a moment before the end, for the last: Glass Tide zoomed in within a second and never zoomed out (its zoom out ran from 120 s to 120 s), and Bounce of the Spheres zoomed out in 0.1 s. Snapshots under a chord name that follow each other closely now count as one chord; a piece over a minute long shows the whole piece first (4% of its length, up to 6 s); and the zoom out takes at least 3 s, running on into the closing fade if the music moves until the end. Glass Tide and Bounce now show the whole piece for 4.8 s, zoom in over 2 s, and zoom out from about 118 s and 120 s to the end of the fade. Pieces made in the app zoom exactly as before (checked on the opening piece and the examples). This wasn't lost: 4.0.5 did the same with these pieces.
- **The tabs fit from 320 px:** each is as wide as its name, sharing what's left, so a tab can be renamed (Line, Voices) without crowding the others.
- **Guide:** How it works has a new step, Add parts, describing the part bar, and the Sound step mentions the volume shape. Version history has 4.1.

# Chord Glide 4.0.5 · 2 Nov 2026

Engine 3.1 and file format 3 are unchanged: every piece the app has saved voices exactly as before. A hand-written file asking for more than 15 voices or a glide over 5 seconds used to be clamped to those, and now gets what it asks for.

The first of the 4.1 foundations (see `TODO.md`).

- **Pitch accuracy no longer depends on length.** Playback sampled every voice's pitch over the whole piece, 120 times a second up to 120 s and 60 beyond, so fast moves in long pieces were smeared (at 2:30 into a 4-minute piece of saved notes, voices were up to 600 cents off around octave jumps). `pitchMoves()` now builds each voice's schedule from its glides: a glide that is linear in pitch is an exact exponential ramp in frequency, an eased glide is sampled 240 times a second during the glide only, and holds need nothing. Replayed against `pitchAt()`, linear glides and saved notes are exact at any length (tested on 10 minutes of saved notes) and eased glides are within 0.005 cents. It also uses less memory and builds faster (Bounce of the Spheres, 21 voices × 120 s: 120 ms, was 200). Every voice's first second is scheduled before the rest, so only that part has to fit in the lead time. An ordinary piece renders within 48 dB of 4.0.4's audio.
- **Up to 32 voices** in the editor (`MAX_VOICES`); saved notes may still carry up to 64. The voicing engine takes under 60 ms at 32 voices. MIDI with glides splits into files of 15, as before.
- **Glides up to 12 seconds** (was 5).
- **Cents in note names:** `parseNoteOct()` accepts cents after the octave, `D3+33`, `B3-14`, `A4+12.5¢` (up to ±99), in unison notes (`=C4-14`) and pinned voicings (`Emaj9[E2 B3-14 G#4+41]`). `C-1` still means octave −1. MIDI glides carry the cents as bends; MIDI chords and MusicXML round to the nearest note.
- Tests for each, including a replay of the new pitch schedule against `pitchAt()`.

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
