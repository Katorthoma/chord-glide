<img src="source/logo.svg" width="72" height="72" alt="Chord Glide logo">

# Chord Glide 3.9

By Noizgenie. Write chord progressions and hear them as gliding, voice-led textures.

**Use it online: [chord-glide.noizgenie.com](https://chord-glide.noizgenie.com)**

Chord Glide is a single web page. Run it from a file on your computer or host it as a website. It has no accounts, and opened from a file it makes no network requests at all.

## Use it in a browser

1. Keep **`lame.min.js` in the same folder** as the HTML file.
2. Open **`Chord Glide.html`** in Chrome, Edge, Firefox or Safari. Double-clicking it works.
3. Every export downloads straight to your computer: piece file (.json), WAV, MP3, MIDI with glides, MIDI chords, MusicXML and video.

**Notes:**

- **Saving pieces.** The Library keeps pieces in this browser's storage. Some browsers don't keep storage for a page opened straight from a file. When that happens, the Library turns itself off and says so, rather than appearing to save. Either way, **Export → Piece file** always works. Open the file again with **Library → Open a piece file**, which is also how you back up pieces or move them between computers.
- **MP3** needs `lame.min.js` beside the HTML file. If it's missing, MP3 export says so; Chord Glide never fetches it from the internet.
- **Video.** It records in real time, so keep the tab in front while it records. Chrome and Edge save MP4 where they can, otherwise WebM. Firefox saves WebM. Safari saves MP4.
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
```

**What it writes:** `(glides).mid` (one MPE channel per voice, with pitch bend), `(chords).mid` (settled chords only) and `.musicxml` (a harmonic score).

**Saved notes.** If a piece was saved by an older engine, the exporter uses that engine's saved notes so the result matches what you heard. Add `--revoice` to voice the piece again with the current engine.

**Audio and video** come from the HTML page, because rendering them needs a browser's audio engine.

## Working on the code

- **Build.** `source/` holds the real source: `head.html`, `engine.js`, `writers.js` and `app.js`. Edit those, then run `node source/build.js` to rebuild `Chord Glide.html`. The build also copies the engine and writers into `cli/`, so the two never drift, and it refuses a `head.html` that loads external fonts.
- **Engine tests:** `node source/test_engine.js` runs 32 checks.
- **Writer samples:** `node source/test_writers.js [folder]` writes sample MIDI, MusicXML, WAV and ZIP files to that folder (created if needed), or to a temporary folder if you leave it out.
- **Making a release:** `node source/release.js` runs the tests, rebuilds, and writes `releases/chord-glide-<version>.zip` containing only the release files. Use it instead of Finder's Compress, which adds `.DS_Store` files and a `__MACOSX` folder.

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
