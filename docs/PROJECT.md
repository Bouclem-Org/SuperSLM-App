# SuperSLM-App

A desktop superapp for small language models (SLMs), built with Electron.

## Status

v0.1.2 — Home tab, Models tab (Hugging Face trending + search), and a Settings
surface (General, Theme, Changelog) opened from the sidebar gear button.
Themes persist to `~/.superslm/settings.json`. Renderer is modular: core/api/views.

## Stack

- Electron + TypeScript, no framework
- `src/*.ts` (main, preload, settings) compile to `out/` via `tsc` (CommonJS)
- `src/renderer/**/*.ts` is type-checked by `tsc` then bundled by **esbuild**
  into `src/renderer/app.js` (IIFE) — ES modules in source, one file served
- `src/renderer/index.html` is the shell; views render their own markup

## Architecture

- `src/main.ts` — `BrowserWindow` (sandboxed, context isolation on, node
  integration off); IPC: `app:info`, `app:changelog`, `settings:get`,
  `settings:patch`, `models:list` (proxies the Hugging Face API)
- `src/settings.ts` — `~/.superslm/` init, `settings.json` load/patch
- `src/preload.ts` — exposes `window.superslm` via `contextBridge`
- `src/renderer/api.ts` — typed wrappers over `window.superslm`
- `src/renderer/core/` — `dom.ts` (byId, escapeHtml), `tabs.ts` (router +
  `onTabOpen` lazy hooks), `markdown.ts`, `theme.ts` (apply + persist)
- `src/renderer/views/` — `home.ts`, `models.ts`, `settings.ts` — each
  `mount(root)` renders markup into its tab section and wires its own events
- `src/renderer/styles/` — `base.css` (theme vars, shell, sidebar, shared),
  `home.css`, `models.css`, `settings.css`
- `src/renderer/icons/` — shared SVG icon set (stroke style, 24x24)
- `src/renderer/global.d.ts` — ambient types: `window.superslm`, settings, models
- `src/renderer/app.ts` — bootstrap: mounts views, initTabs/initTheme, applies
  saved theme, fills footer version

## User storage

`~/.superslm/settings.json` — `{"theme": "dark" | "light"}`, created on first
run. Planned: `~/.superslm/models/<org>/<name>/` for downloaded models.

## Run

```
npm install
npm start    # tsc (main) + tsc typecheck (renderer) + esbuild bundle + electron
```

## Direction

New tab: add an empty `<section class="tab" id="tab-name">`, a `data-tab="name"`
nav button, a `views/name.ts` with `mount(root)`, and mount it in `app.ts`.
New settings page: menu item + page inside `views/settings.ts`. New persisted
setting: extend `SuperslmSettings` in `src/settings.ts` and patch via
`settings:patch`.
