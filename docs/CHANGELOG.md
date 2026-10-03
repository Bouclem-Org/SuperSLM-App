# Changelog

## 0.1.8 - 2026-10-03

- Renamed the app to LM SuperApp (window title, sidebar, package name)
- Chat: custom styled model dropdown replacing the ugly native select
- Chat history: conversations auto-save to `~/.superslm/chats/`; sidebar lists them under the nav with a "+ New chat" button — click one to reload it
- Chat layout: centered 960px conversation column, larger 16px bubbles, input and controls scaled up
- Home is now a small dashboard: greeting + tiles for library count, active model, backend status (clickable shortcuts)
- Fixed the "+" More menu vanishing before you can reach it (hover bridge)
- Removed the Models settings page (duplicated by Library); "Ask before downloading" moved to Settings > General

## 0.1.7 - 2026-10-03

- Added Library tab: picked local files (with a `file` badge) + downloaded models, each with size and "Use in chat" / Remove; placeholder sections for finetuned models and generated media
- Local .gguf picking is now multi-select and saves to a `localFiles` list — add from Library, the Models toolbar, or Settings > Models (which manages the list: per-file Remove, Clear all)
- Chat's model selector lists every picked file and downloaded model
- Added a "+" More button in the sidebar — hover or click reveals extra tabs; Finetune is the first (placeholder, not working yet)
- Added backend build choice in Settings > Backend: Vulkan (default, GPU), CUDA 13.4, CUDA 12.4, or CPU — Install downloads that build
- Fixed install assuming CPU: llama.cpp build is now a real setting (`backendBuild`)

## 0.1.6 - 2026-09-27

- Chat works for real: pick a model (downloaded GGUFs + local files) in the Chat tab and send a message — it starts the llama.cpp backend and replies
- Added Backend settings page: llama-server status, start/stop, one-click install (downloads latest llama.cpp Windows release to `~/.superslm/bin`)
- Added Idle shutdown setting: backend stops after 5/10/15 min of inactivity, or never
- Chat keeps conversation history (last 20 messages) per session
- Backend auto-restarts when the selected model changes

## 0.1.5 - 2026-09-27

- Added local GGUF picker (Models toolbar + Settings > Models), saved as `modelFile`
- Added model detail panel: click a model to see metadata, full README description, and GGUF file list with sizes
- Added real downloads: GGUF files save to `~/.superslm/models/<org>/<name>/` with progress bars
- Added "Ask before downloading" setting (`confirmDownload`) — native confirm dialog before saving
- Added Models settings page (local model + download options)
- Added Text size setting under Settings > Theme: Compact / Default / Large / XL (zooms the whole UI, persisted as `fontScale`)
- Started llama.cpp backend: finds `llama-server` in `~/.superslm/bin` or PATH, start/stop/status in Settings > Debug
- Chat shows the currently selected local model
- Upgraded the markdown renderer: tables, code blocks, inline code, italics, numbered lists, blockquotes — used for both model descriptions and the changelog
- README cleaning: strips front-matter, comments, HTML tags, badges, hr lines; truncates long cards at paragraph boundaries
- Fixed Models toolbar wrapping/clipping at all window sizes

## 0.1.4 - 2026-09-27

- Added Chat tab (UI only — sending shows a "not implemented" error, no model yet)
- Added Debug settings page: debug output toggle, DevTools controls, recent error list
- Debug mode shows error codes/details in the UI, including chat errors
- Added `debug` and `devtools` persisted settings; DevTools can open detached on launch

## 0.1.3 - 2026-09-27

- Fixed missing app icon: generated `assets/icon.ico`/`icon.png` (amber mark, pixel "S")
- Added custom themed scrollbars
- Added three new themes: Midnight, Sand, Forest
- Added fullscreen option in Settings > General (applies now and on launch)
- Made the layout adaptive: icon-only sidebar, horizontal settings menu, and wrapped toolbars on small windows

## 0.1.2 - 2026-09-27

- Added theme settings (dark/light) under Settings > Theme
- Added `~/.superslm/` user folder with `settings.json` as a generic settings store
- Enabled Models tab: most liked / most downloaded sorting + search via the Hugging Face API (listing only, no downloads yet)
- Added theme, download, and heart icons
- Restructured the renderer into modules (api, core, views) bundled by esbuild; split styles per view

## 0.1.1 - 2026-09-27

- Added settings menu, opened from a gear button in the bottom-left
- Added changelog view inside settings (rendered from this file)
- Added SVG icon set for navigation and future surfaces
- Added README

## 0.1.0 - 2026-09-27

- Initial scaffold: Electron + TypeScript, vanilla HTML/CSS renderer
- Home tab with sidebar shell, dark grey minimal theme
