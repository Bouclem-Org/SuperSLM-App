# AGENTS.md — LM SuperApp

Guidelines for working on this repository.

## Versioning

- Versions are feature batches: `0.x.y`, one increment per batch (`0.1.9` → `0.1.10` → `0.2.0` — `.10` comes after `.9`, it is not `0.1.0`).
- The user lists the version number and its features; implement exactly that set.
- On every version bump:
  - `package.json` → `"version"` matches.
  - `docs/CHANGELOG.md` → new `## X.Y.Z - <today>` entry at the top, listing every feature/fix the user asked for plus notable technical changes. Keep bullet style short and factual, matching existing entries.
  - `docs/PROJECT.md` → update if architecture, folders, or tooling changed.

## Committing

- Commit only when the user asks; always build (`npm run build`) successfully first.
- Commit message format: `X.Y.Z: short summary of the batch` (see `git log`).
- **Never** add co-author trailers or "Generated with" footers.
- Stage all related files for the version (`git add -A` is fine after reviewing `git status`).

## Build

- `npm run build` = `tsc -p tsconfig.json` (main process) + `tsc -p tsconfig.web.json` (renderer) + esbuild bundle (`--loader:.svg=text`, IIFE, `src/renderer/app.js`).
- Run the app with `npx electron .` (or `npm start`).
- `npm run dist` packages a Windows installer via electron-builder (config in `package.json` → `build`, output in `dist/`).
- `.github/workflows/nightly.yml` builds nightly GitHub prereleases (`nightly-<sha>` tag, version `0.2.0-nightly.<sha>`), skipping nights with no new commits.

## Architecture

Electron app, no frontend framework — vanilla TypeScript + DOM, organized as small single-purpose modules.

**Three layers, one direction:**

1. **Main process** (`src/`) — `main.ts` (window + IPC handlers + downloads + `shell.openExternal`), `preload.ts` (contextBridge → `window.lmsuperapp`), `llamacpp.ts` (llama-server wrapper), `settings.ts` (persistence). The renderer never touches Node directly — everything goes through the bridge, and the main process validates/sanitizes all paths and inputs.
2. **Renderer core** (`src/renderer/core/`) — shared building blocks, one module per concern: `dom` (helpers/escapeHtml), `format`, `select` (custom dropdown), `chats` (sidebar history), `markdown` (md + KaTeX + code-copy + links), `icons` (SVG loader), `debug`, `tabs`. Anything reused by two views lives here, never duplicated.
3. **Views** (`src/renderer/views/`) — one module per tab (`home`, `models`, `chat`, `library`, `finetune`, `settings`), each exporting a `mountX(root)` that renders into its tab and wires listeners. `app.ts` boots: mounts views, `initTabs`, `initTheme`, `fillIcons`, `initSideChats`.

**Styles split the same way** — `styles/base.css` for shell/shared, one file per view (`chat.css`, `models.css`…), all loaded from `index.html`.

**Icons as assets** — `src/renderer/icons/` is the single icon source; esbuild imports `.svg` as text, `icon('name')` returns markup. Never inline SVGs in views or `index.html` (use `data-ico` slots + `fillIcons` for static markup). Root `icons/` holds only the app icon (`icon.ico`/`icon.png`).

**Adding a feature** follows the same shape every time:

- New tab → `views/foo.ts` + `foo.css` + nav entry in `index.html` (+ `data-ico` icon).
- Shared widget/logic → new module in `core/`.
- New IPC → handler in `main.ts` → expose in `preload.ts` → type it in `global.d.ts` → wrap in `api.ts`.
- New persisted option → key in `settings.ts` defaults + `global.d.ts` type.
- Python-side work (finetune etc.) → `src/backend/` (placeholder today).

User data lives outside the repo in `~/.lmsuperapp/` (`settings.json`, `models/`, `chats/`).

## Conventions

- IPC goes through preload only — validate and sanitize paths in the main process (no traversal, no arbitrary file access).
- Strict CSP in `index.html`; external links open via `shell.openExternal`, never in-app.
- Small single-purpose functions, match the existing style; `//TODO(reason):` / `//FIXME(reason):` for gaps.
- Docs (`*.md`) live in `docs/` except root `README.md`, `LICENSE`, `AGENTS.md`.
