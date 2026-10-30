# Cadence Development

Read [README](README.md) for serving/checks and parser ownership.

- Preserve chunk timing/fit, playback state, local Library/session storage, and text-only import behavior. Current storage uses `cadence-rsvp-state-v2`; inspect migration rules before changing it.
- Runtime inputs are `index.html`, `app.js`, `styles.css`, and `vendor/`. Keep JSZip/PDF.js/worker files together; local parsers are required inputs, not disposable development tools.
- Run `node --check app.js` from this directory. No package, build, lint, or automated regression runner is configured. Syntax does not verify timing, storage, accessibility, or EPUB/PDF imports.
- Follow applicable parent instructions when present; optional local context is `../_docs/README.md`, absent in clones. Normal serving must remain self-contained. Preserve unrelated worktree changes and report unrun checks.
