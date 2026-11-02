<img src="source/logo.svg" width="72" height="72" alt="Chord Glide logo">

# Chord Glide 4.0.2

By Noizgenie. Write chord progressions and hear them as gliding, voice-led textures.

**Use it online: [chord-glide.noizgenie.com](https://chord-glide.noizgenie.com)**

Chord Glide is a single web page. Run it from a file on your computer or host it as a website. It has no accounts, and opened from a file it makes no network requests at all.

## Use it in a browser

1. Keep **`lame.min.js` in the same folder** as the HTML file.
2. Open **`Chord Glide.html`** in Chrome, Edge, Firefox or Safari. Double-clicking it works.
3. Every export downloads straight to your computer: piece file (.json), WAV, MP3, MIDI with glides, MIDI chords, MusicXML and video.

**Notes:**

- **Saving pieces.** The Library keeps pieces in this browser's storage. Some browsers don't keep storage for a page opened straight from a file. When that happens, the Library turns itself off and says so, rather than appearing to save. Either way, **Export → Piece file** always works. Open the file again with **Library → Open a piece file**, which is also how you back up pieces or move them between computers.
- **Title and artist.** Every exported file carries the piece name as its title. Add an artist name under **Name on exports** in Settings and it's written in too: INFO tags in WAV, ID3 in MP3, iTunes-style tags in MP4, QuickTime tags in MOV, Matroska tags in WebM, a copyright notice in MIDI and the composer in MusicXML. The name is kept in the browser on that device only, never in piece files; leave it empty and no name is written anywhere. Record live videos can't carry it in the file. Videos can also show the artist under the title on screen; the **Artist name under the title** tick box beside Render video controls that for each render (it doesn't change the file's tags).
- **MP3** needs `lame.min.js` beside the HTML file. If it's missing, MP3 export says so; Chord Glide never fetches it from the internet.
- **Video.** **Render video** draws every frame at its exact time and encodes it with the browser's built-in encoder, so nothing stutters or freezes. It saves MP4 (H.264 with AAC audio) or WebM (VP9 with Opus) at 1080p or 1440p, 60 or 30 fps. Where the browser can't encode AAC, the H.264 choice is labelled MOV and saves a QuickTime .mov with H.264 and uncompressed 16-bit audio instead, because QuickTime won't play MP3 or Opus inside an MP4; the .mov plays in QuickTime, VLC and editors, uploads to YouTube, and is about 11 MB a minute larger. Standard quality uses YouTube's recommended bitrates; High doubles them. It needs Chrome, Edge or Safari, and it's fastest with the tab in front. The whole video is held in memory until it's saved, so the Export tab shows the expected size, and anything over 1 GB asks for a second click: a few minutes at 1440p High can need several gigabytes of RAM. **Record live** plays the piece once in real time instead (MP4 or WebM, whichever the browser records), for browsers that can't render.
- **Fonts.** This copy uses your system fonts, so it makes no font requests to Google.

## Put it on the web (Cloudflare Pages or any static host)

`node source/build.js` also writes a **`dist/`** folder: the app as `index.html`, a home-screen icon, the MP3 encoder, the license files, and a `_headers` file of security settings that Cloudflare Pages applies automatically. Those settings only let the page run its own code and load files from its own site, block other sites from embedding it, and send no referrer.

- **Upload by hand:** in the Cloudflare dashboard, create a Pages project and choose to upload assets directly, then drop in the `dist` folder. Or, from Terminal: `npx wrangler pages deploy dist --project-name chord-glide`.
- **Deploy from GitHub:** connect the repository to a Pages project with build command `node source/build.js` and output folder `dist`. Every push then rebuilds the site.

**Link previews.** Discord, Slack, iMessage and social sites show a preview image only if the page gives its full address. Once you know your site's address, put it in `source/site.json`:

```json
{ "url": "https://chord-glide.noizgenie.com" }
```

and rebuild (or, for one build, run `SITE_URL=https://… node source/build.js`). Without it, previews still show the name and description, just no image. The preview image is `source/og-image.jpg` (1200 × 630).

`dist/` is left out of git, because the build recreates it. On another host, upload the same folder; `_headers` is Cloudflare's format, so set equivalent headers there if you want them.

## Export from the command line (MIDI and MusicXML)

This needs Node 18 or later. It has no dependencies and makes no network calls.

```sh
node cli/chord-glide-export.js "My piece.json"            # writes all three formats beside the piece file
node cli/chord-glide-export.js "My piece.json" --midi --out exports
node cli/chord-glide-export.js "My piece.json" --musicxml --tempo 72
node cli/chord-glide-export.js "My piece.json" --artist "Your name"   # adds the artist to the MIDI and MusicXML files
```

**What it writes:** `(glides).mid` (one MPE channel per voice, with pitch bend), `(chords).mid` (settled chords only) and `.musicxml` (a harmonic score).

**Saved notes.** Saved notes marked `"engine": "custom"` (written by hand or by another program) always play exactly as written, in the app and here. Files asking for more than 64 voices, more than an hour of saved notes or notes outside MIDI's range are refused. If a piece was saved by an older engine, the exporter uses that engine's saved notes so the result matches what you heard. Add `--revoice` to voice the piece again with the current engine.

**Audio and video** come from the HTML page, because rendering them needs a browser's audio engine.

## Working on the code

- **Build.** `source/` holds the real source: `head.html`, `engine.js`, `writers.js` and `app.js`. Edit those, then run `node source/build.js` to rebuild `Chord Glide.html`. The build also copies the engine and writers into `cli/`, so the two never drift, and it refuses a `head.html` that loads external fonts.
- **Engine tests:** `node source/test_engine.js` runs 32 checks.
- **Writer tests:** `node source/test_writers.js [folder]` writes sample MIDI, MusicXML, WAV and ZIP files to that folder (created if needed, or a temporary folder if you leave it out), and checks the structure of the MP4 and WebM writers with stand-in data. Real encoding needs a browser, so the three sample videos it writes aren't playable footage.
- **Making a release:** `node source/release.js` runs the engine and writer tests, rebuilds, and writes `releases/chord-glide-<version>.zip` containing only the release files. Use it instead of Finder's Compress, which adds `.DS_Store` files and a `__MACOSX` folder.

## Files

| File | What it is |
|---|---|
| `Chord Glide.html` | The whole app in one file (built from `source/`) |
| `lame.min.js` | MP3 encoder: lamejs 1.2.1 by Alex Zhukov, a JavaScript port of LAME. Separate and unmodified. |
| `LICENSE` | MIT License for Chord Glide's own code |
| `LICENSES/` | The lamejs notice, plus the full LGPL-3.0 and GPL-3.0 texts that its license requires alongside it |
| `cli/` | Command-line exporter, plus the engine and file writers it uses |
| `source/` | Source files, build and release scripts, tests, the logo (`logo.svg`, `apple-touch-icon.png`), the link-preview image (`og-image.jpg`) and `site.json` |
| `dist/` | The website folder the build writes (not in git) |
| `CHANGES.md` | What changed in each version |

## Licensing

- **Chord Glide** is © 2026 Noizgenie, released under the **MIT License** (see `LICENSE`). Anyone may use, change and share the code, including commercially, as long as they keep the copyright notice and license text.
- **lamejs** (`lame.min.js`) is LGPL-3.0 and is not covered by the MIT License. Its notice and the license texts are in `LICENSES/`. It ships as a separate, unmodified file, which is what lets the rest of the project use a different license.

## Putting it on GitHub

Nothing in these files is private: there are no keys, accounts or personal data. Your pieces stay in your browser unless you export them. `.gitignore` keeps piece files, exports, `dist/` and `releases/` out of the repository.
