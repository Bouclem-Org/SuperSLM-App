# SuperSLM-App

A desktop superapp for small language models (SLMs), built with Electron.

## Status

v0.1.1 — Home tab plus a Settings surface (General + Changelog) opened from a
gear button in the sidebar footer. The shell is designed to grow additional
tabs (chat, model management) later.

## Stack

- Electron + TypeScript — no framework, no bundler, plain `tsc`
- `src/main.ts` + `src/preload.ts` compile to `out/` (CommonJS)
- `src/renderer/app.ts` compiles in place to `src/renderer/app.js` (plain script)
- `src/renderer/index.html` + `styles.css` are static assets, unchanged by the build

## Architecture

- `src/main.ts` — creates the `BrowserWindow` (sandboxed, context isolation on,
  node integration off); IPC: `app:info` (versions, platform), `app:changelog`
  (reads `docs/CHANGELOG.md`)
- `src/preload.ts` — exposes `window.superslm` via `contextBridge`
- `src/renderer/index.html` — app shell: sidebar nav, gear button, tab sections
  (`tab-home`, `tab-settings`); settings has its own sub-menu
  (`settings-general`, `settings-changelog`)
- `src/renderer/app.ts` — tab + settings-menu switching, greeting, app info,
  changelog fetch and minimal markdown rendering
- `src/renderer/global.d.ts` — types for `window.superslm`
- `src/renderer/icons/` — shared SVG icon set (stroke style, 24x24)
- `src/renderer/styles.css` — dark warm-grey minimal theme (oklch palette)
- `tsconfig.json` — main/preload; `tsconfig.web.json` — renderer

## Run

```
npm install
npm start    # builds both tsconfigs, then launches electron
```

## Direction

New tabs: add `<section class="tab" id="tab-name">` + a `data-tab="name"` nav
button. New settings pages: add a `data-settings="name"` menu item + a matching
`settings-name` page. The changelog view always reflects `docs/CHANGELOG.md`.
