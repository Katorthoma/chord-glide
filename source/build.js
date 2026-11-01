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
 * and writes dist/: a website folder (index.html, the MP3 encoder, licenses, icons, the social
 * preview image and a _headers file with strict security headers) ready for any static host.
 *
 * Link previews (Discord, Slack, iMessage, social sites) need the site's full address for the
 * preview image. Put it in source/site.json as "url", or set SITE_URL for one build:
 *   SITE_URL=https://example.pages.dev node source/build.js
 *
 * These files are the source of truth. Edit them, then rebuild; don't edit the HTML by hand.
 */
const fs = require('fs'), path = require('path');
const here = __dirname, read = f => fs.readFileSync(path.join(here, f), 'utf8');
const head = read('head.html');
if (/fonts\.googleapis|fonts\.gstatic/.test(head)) { console.error('head.html loads external fonts; remove those lines to keep the local copy request-free.'); process.exit(1); }
// the title and tab icon at the top of head.html belong in <head>
const headTags = (head.match(/^<title>[^\n]*\n(?:<link rel="icon"[^\n]*\n)?/) || [''])[0];
// what a page says about itself: search results, link previews, browser colour
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const SITE = { name: 'Chord Glide', color: '#19c6ff',
  description: 'Write chords and hear them as gliding voices. Lock what you like and reroll the rest. Exports WAV, MP3, MIDI (MPE), MusicXML and video. Free and open source, and runs in your browser.',
  imageAlt: 'Chord Glide: glowing voice lines gliding between chords, with the logo and tagline.' };
let siteUrl = process.env.SITE_URL;
if (siteUrl === undefined) { try { siteUrl = JSON.parse(read('site.json')).url; } catch (e) { siteUrl = ''; } }
siteUrl = String(siteUrl || '').trim().replace(/\/+$/, '');
if (siteUrl && !/^https:\/\/[^\s"<>]+$/.test(siteUrl)) { console.error('The site url must start with https:// (got "' + siteUrl + '").'); process.exit(1); }
const meta = (k, v, attr = 'name') => '<meta ' + attr + '="' + k + '" content="' + esc(v) + '">\n';
const about = meta('description', SITE.description) + meta('theme-color', SITE.color);
const social = meta('og:type', 'website', 'property') + meta('og:site_name', SITE.name, 'property') + meta('og:title', SITE.name, 'property')
  + meta('og:description', SITE.description, 'property')
  + (siteUrl ? '<link rel="canonical" href="' + esc(siteUrl + '/') + '">\n' + meta('og:url', siteUrl + '/', 'property')
    + meta('og:image', siteUrl + '/og-image.jpg', 'property') + meta('og:image:type', 'image/jpeg', 'property')
    + meta('og:image:width', '1200', 'property') + meta('og:image:height', '630', 'property') + meta('og:image:alt', SITE.imageAlt, 'property')
    + meta('twitter:card', 'summary_large_image') + meta('twitter:image', siteUrl + '/og-image.jpg') + meta('twitter:image:alt', SITE.imageAlt)
    : meta('twitter:card', 'summary'))
  + meta('twitter:title', SITE.name) + meta('twitter:description', SITE.description);
const page = extraHead => '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
  + headTags + extraHead
  + '<style>html{color-scheme:light}:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font-size:14px}img{max-width:100%}</style>\n'
  + '</head>\n<body>\n' + head.slice(headTags.length) + '<script>\n' + read('engine.js') + read('writers.js') + read('app.js') + '</script>\n</body>\n</html>\n';
const html = page(about);
const out = path.join(here, '..', 'Chord Glide.html');
fs.writeFileSync(out, html);
console.log('wrote ' + out + ' (' + Buffer.byteLength(html) + ' bytes)');
// keep the command-line exporter on exactly the same engine and writers
for (const f of ['engine.js', 'writers.js']) { fs.copyFileSync(path.join(here, f), path.join(here, '..', 'cli', f)); console.log('synced cli/' + f); }

// dist/: the same app as a website folder
const root = path.join(here, '..'), dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'LICENSES'), { recursive: true });
const site = page(about + social + '<link rel="apple-touch-icon" href="apple-touch-icon.png">\n');
fs.writeFileSync(path.join(dist, 'index.html'), site);
fs.copyFileSync(path.join(here, 'apple-touch-icon.png'), path.join(dist, 'apple-touch-icon.png'));
fs.copyFileSync(path.join(here, 'og-image.jpg'), path.join(dist, 'og-image.jpg'));
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
console.log('wrote dist/ (index.html, icons, og-image.jpg, lame.min.js, LICENSE.txt, LICENSES/, _headers)');
if (!siteUrl) console.log('note: no site url set, so link previews will have no image. Add it to source/site.json ("url") or set SITE_URL.');
else console.log('link previews point to ' + siteUrl + '/');
