# SuperSLM-App

A desktop superapp for small language models (SLMs), built with Electron.

## Status

Early scaffold. Currently only a **Home** tab exists; the shell is designed to
grow additional tabs (chat, model management, settings) later.

## Stack

- Electron + TypeScript — no framework, no bundler, plain `tsc`
- `src/main.ts` + `src/preload.ts` compile to `out/` (CommonJS)
- `src/renderer/app.ts` compiles in place to `src/renderer/app.js` (plain script)
- `src/renderer/index.html` + `styles.css` are static assets, unchanged by the build

## Architecture

- `src/main.ts` — creates the `BrowserWindow` (sandboxed, context isolation on,
  node integration off), handles the `app:info` IPC call
- `src/preload.ts` — exposes a minimal `window.superslm` API via `contextBridge`
- `src/renderer/index.html` — app shell: sidebar nav + tab sections
- `src/renderer/app.ts` — tab switching, greeting, app info display
- `src/renderer/global.d.ts` — types for `window.superslm`
- `src/renderer/styles.css` — dark warm-grey minimal theme (oklch palette)
- `tsconfig.json` — main/preload compilation; `tsconfig.web.json` — renderer

## Run

```
npm install
npm start    # builds both tsconfigs, then launches electron
```

## Direction

The sidebar nav already contains disabled slots for future tabs. New tabs are
added by creating a `<section class="tab" id="tab-name">` and a matching
`data-tab="name"` nav button.
