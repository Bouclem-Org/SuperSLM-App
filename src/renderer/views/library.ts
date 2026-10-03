import { getSettings, localModels, patchSettings, pickGguf } from '../api';
import { byId, escapeHtml } from '../core/dom';
import { fileName, fmtBytes } from '../core/format';
import { icon } from '../core/icons';
import { onTabOpen } from '../core/tabs';

const ICON_FILE = icon('file');

export const mountLibrary = (root: HTMLElement): void => {
  root.innerHTML = `
    <div class="models">
      <header class="models-head">
        <div>
          <h1 class="page-title">Library</h1>
          <p class="models-sub">Your local models and assets</p>
        </div>
        <div class="models-tools">
          <button class="action-btn" id="btn-add-gguf" type="button">${ICON_FILE}<span>Add .gguf…</span></button>
        </div>
      </header>
      <div class="library-list" id="library-list"></div>
    </div>`;

  const list = byId('library-list');

  const render = (): void => {
    void Promise.all([localModels(), getSettings()])
      .then(([models, s]) => {
        const picked = s.localFiles.map((p) => ({
          name: fileName(p),
          path: p,
          size: 0,
          local: true
        }));
        const downloaded = models.map((m) => ({ ...m, local: false }));
        const items = [...picked, ...downloaded];

        const row = (m: {
          name: string;
          path: string;
          size: number;
          local: boolean;
        }): string => {
          const active = m.path === s.modelFile;
          return `
            <li class="lib-row${active ? ' is-active' : ''}">
              <span class="lib-name" title="${escapeHtml(m.path)}">
                ${escapeHtml(m.name)}${m.local ? ' <span class="lib-tag">file</span>' : ''}
              </span>
              <span class="lib-size">${m.size ? fmtBytes(m.size) : '—'}</span>
              ${
                m.local
                  ? `<button class="action-btn lib-remove" type="button" data-path="${escapeHtml(m.path)}">Remove</button>`
                  : ''
              }
              <button class="action-btn lib-use" type="button" data-path="${escapeHtml(m.path)}"${
                active ? ' disabled' : ''
              }>${active ? 'In use' : 'Use in chat'}</button>
            </li>`;
        };

        list.innerHTML = `
          <h3 class="section-title">Models</h3>
          ${
            items.length
              ? `<ul class="lib-rows">${items.map(row).join('')}</ul>`
              : '<p class="debug-none">No models yet — download one in Models or add a local .gguf.</p>'
          }
          <h3 class="section-title">Finetuned models</h3>
          <p class="debug-none">Nothing here yet.</p>
          <h3 class="section-title">Generated media</h3>
          <p class="debug-none">Nothing here yet.</p>`;

        list.querySelectorAll<HTMLButtonElement>('.lib-use').forEach((btn) => {
          btn.addEventListener('click', () => {
            patchSettings({ modelFile: btn.dataset.path ?? '' })
              .then(render)
              .catch((err: unknown) => console.error('Failed to select model:', err));
          });
        });

        list.querySelectorAll<HTMLButtonElement>('.lib-remove').forEach((btn) => {
          btn.addEventListener('click', () => {
            const path = btn.dataset.path ?? '';
            patchSettings({
              localFiles: s.localFiles.filter((p) => p !== path),
              modelFile: s.modelFile === path ? '' : s.modelFile
            })
              .then(render)
              .catch((err: unknown) => console.error('Failed to remove file:', err));
          });
        });
      })
      .catch((err: unknown) => {
        list.innerHTML = '<p class="model-status is-error">Could not load library.</p>';
        console.error('Failed to load library:', err);
      });
  };

  byId('btn-add-gguf').addEventListener('click', () => {
    pickGguf()
      .then((paths) => {
        if (paths?.length) render();
      })
      .catch((err: unknown) => console.error('Failed to pick files:', err));
  });

  render();
  onTabOpen('library', render);
};
