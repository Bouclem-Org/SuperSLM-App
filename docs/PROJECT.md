# SuperSLM-App

A desktop superapp for small language models (SLMs), built with Electron.

## Status

v0.1.8 — LM SuperApp. Home dashboard (stat tiles), Models (HF sort + search, detail panel, GGUF downloads to
`~/.superslm/models/`, local .gguf picker), Chat (custom model select,
chat history in `~/.superslm/chats/`, real inference via llama.cpp
backend), Library (local files + downloads), Finetune (placeholder via "+"
menu), and Settings (General, Backend, Theme, Changelog, Debug) via the
sidebar gear. Five themes, text size, fullscreen, debug, devtools,
modelFile, localFiles, confirmDownload, idleStopMinutes and backendBuild
persist to `~/.superslm/settings.json`. App icon in
`assets/` (regenerate via `node scripts/gen-icon.mjs`). `src/llamacpp.ts`
manages `llama-server` on port 8391: spawn, /health polling, OpenAI-style
/v1/chat/completions, idle auto-stop, status/start/stop IPC. Install
button pulls the latest llama.cpp Windows release from GitHub into
`~/.superslm/bin`. Renderer is modular: core/api/views.

## Stack

- Electron + TypeScript, no framework
- `src/*.ts` (main, preload, settings) compile to `out/` via `tsc` (CommonJS)
- `src/renderer/**/*.ts` is type-checked by `tsc` then bundled by **esbuild**
  into `src/renderer/app.js` (IIFE) — ES modules in source, one file served
- `src/renderer/index.html` is the shell; views render their own markup

## Architecture

- `src/main.ts` — `BrowserWindow` (sandboxed, context isolation on, node
  integration off); IPC: `app:info`, `app:changelog`, `settings:get`,
  `settings:patch`, `dialog:pickGguf`, `window:fullscreen`, `window:devtools`,
  `models:list` / `models:detail` / `models:download` (proxies Hugging Face,
  streams files to disk, `models:progress` events), `backend:*`
- `src/llamacpp.ts` — llama.cpp backend: locates `llama-server`, spawns it
  with the selected model on port 8391, reports status
- `src/settings.ts` — `~/.superslm/` init, `settings.json` load/patch
- `src/preload.ts` — exposes `window.superslm` via `contextBridge`
- `src/renderer/api.ts` — typed wrappers over `window.superslm`
- `src/renderer/core/` — `dom.ts` (byId, escapeHtml), `tabs.ts` (router +
  `onTabOpen` lazy hooks), `markdown.ts`, `theme.ts` (apply + persist),
  `debug.ts` (debug flag + recent-error log emitting `superslm:debug`)
- `src/renderer/views/` — `home.ts`, `models.ts`, `chat.ts`, `settings.ts` — each
  `mount(root)` renders markup into its tab section and wires its own events
- `src/renderer/styles/` — `base.css` (theme vars, shell, sidebar, shared),
  `home.css`, `models.css`, `settings.css`
- `src/renderer/icons/` — shared SVG icon set (stroke style, 24x24)
- `src/renderer/global.d.ts` — ambient types: `window.superslm`, settings, models
- `src/renderer/app.ts` — bootstrap: mounts views, initTabs/initTheme, applies
  saved theme, fills footer version

## User storage

`~/.superslm/settings.json` — `{"theme", "fullscreen", "debug", "devtools",
"modelFile", "confirmDownload"}`, created on first run.
`~/.superslm/models/<org>/<name>/` — downloaded GGUF files.
`~/.superslm/bin/` — optional place for `llama-server` binary.

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
