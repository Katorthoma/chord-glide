#!/usr/bin/env node
/*
 * Builds "Chord Glide.html" (one level up) from the files in this folder:
 *   head.html  — page markup and styles (no external fonts or requests)
 *   engine.js  — chord parser, voicing, motion, timeline
 *   writers.js — ZIP, WAV, MIDI and MusicXML writers
 *   app.js     — the interface, audio, drawing and exports
 *
 *   node source/build.js
 *
 * It also copies engine.js and writers.js into cli/, so the command-line exporter never drifts,
 * and writes dist/: a website folder (index.html, the MP3 encoder, licenses and a _headers file
 * with strict security headers) ready to upload to Cloudflare Pages or any static host.
 *
 * These files are the source of truth. Edit them, then rebuild; don't edit the HTML by hand.
 */
const fs = require('fs'), path = require('path');
const here = __dirname, read = f => fs.readFileSync(path.join(here, f), 'utf8');
const head = read('head.html');
if (/fonts\.googleapis|fonts\.gstatic/.test(head)) { console.error('head.html loads external fonts; remove those lines to keep the local copy request-free.'); process.exit(1); }
// the title and tab icon at the top of head.html belong in <head>
const headTags = (head.match(/^<title>[^\n]*\n(?:<link rel="icon"[^\n]*\n)?/) || [''])[0];
const page = extraHead => '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
  + headTags + extraHead
  + '<style>html{color-scheme:light}:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font-size:14px}img{max-width:100%}</style>\n'
  + '</head>\n<body>\n' + head.slice(headTags.length) + '<script>\n' + read('engine.js') + read('writers.js') + read('app.js') + '</script>\n</body>\n</html>\n';
const html = page('');
const out = path.join(here, '..', 'Chord Glide.html');
fs.writeFileSync(out, html);
console.log('wrote ' + out + ' (' + Buffer.byteLength(html) + ' bytes)');
// keep the command-line exporter on exactly the same engine and writers
for (const f of ['engine.js', 'writers.js']) { fs.copyFileSync(path.join(here, f), path.join(here, '..', 'cli', f)); console.log('synced cli/' + f); }

// dist/: the same app as a website folder
const root = path.join(here, '..'), dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'LICENSES'), { recursive: true });
const site = page('<link rel="apple-touch-icon" href="apple-touch-icon.png">\n');
fs.writeFileSync(path.join(dist, 'index.html'), site);
fs.copyFileSync(path.join(here, 'apple-touch-icon.png'), path.join(dist, 'apple-touch-icon.png'));
fs.copyFileSync(path.join(root, 'lame.min.js'), path.join(dist, 'lame.min.js'));
fs.copyFileSync(path.join(root, 'LICENSE'), path.join(dist, 'LICENSE.txt'));
for (const f of fs.readdirSync(path.join(root, 'LICENSES'))) fs.copyFileSync(path.join(root, 'LICENSES', f), path.join(dist, 'LICENSES', f));
// The only script on the page is the inline one; allow exactly that script (by hash) plus files from this site.
const inline = site.slice(site.indexOf('<script>') + 8, site.lastIndexOf('</script>'));
const hash = require('crypto').createHash('sha256').update(inline, 'utf8').digest('base64');
const csp = ["default-src 'none'", "script-src 'self' 'sha256-" + hash + "'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
  "media-src 'self' blob:", "font-src 'self'", "connect-src 'self'", "manifest-src 'self'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'"].join('; ');
fs.writeFileSync(path.join(dist, '_headers'), [
  '/*',
  '  Content-Security-Policy: ' + csp,
  '  X-Content-Type-Options: nosniff',
  '  X-Frame-Options: DENY',
  '  Referrer-Policy: no-referrer',
  '  Cross-Origin-Opener-Policy: same-origin',
  '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  ''].join('\n'));
console.log('wrote dist/ (index.html, apple-touch-icon.png, lame.min.js, LICENSE.txt, LICENSES/, _headers)');
