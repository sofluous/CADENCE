# Cadence

Static browser RSVP reader with chunked playback, local session/Library storage, and text-only document imports.

Serve this directory, for example with Python 3:

```text
python -m http.server 5500 --bind 127.0.0.1
```

Open `http://127.0.0.1:5500/`; stop with Ctrl+C. No build or package installation is configured. Keep the same origin to retain access to browser-local storage; export important content before changing origin or storage contracts. URL imports depend on network/source restrictions; document imports do not provide OCR/layout preservation.

Run `node --check app.js` with Node (validated with 24.14.1). No automated app/build/lint gate is configured; manually verify timing/pause/rewind, responsive chunk fitting, Library persistence, and text/EPUB/PDF/error paths when affected.

`index.html`, `app.js`, and `styles.css` are runtime inputs. `vendor/` contains required local JSZip/PDF.js and PDF worker files; see [parser notes](vendor/README.md). Keep their relative layout intact. No hosting configuration is supplied; review delivery inputs independently of Git ignore rules.

See [AGENTS.md](AGENTS.md) for engineering constraints. Optional full-workspace context lives at `../_docs/README.md`; serving does not depend on it.

Responsive layout regression: `node tests/mobile-layout.cjs` uses installed Windows Edge without packages. Override the executable with `CADENCE_BROWSER`; optionally set `CADENCE_EVIDENCE_DIR` for screenshots. Checks cover portrait/landscape bounds, overlay fit, stable playback geometry, pointer pause and contextual navigation. This does not replace import, storage or accessibility testing.
