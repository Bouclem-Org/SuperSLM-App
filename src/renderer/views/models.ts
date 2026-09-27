import {
  downloadModel,
  getModelDetail,
  listModels,
  onModelProgress,
  pickGguf
} from '../api';
import { reportDebug } from '../core/debug';
import { byId, escapeHtml } from '../core/dom';
import { renderMarkdown } from '../core/markdown';
import { onTabOpen } from '../core/tabs';

const ICON_DOWNLOAD = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/></svg>`;
const ICON_FILE = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`;
const ICON_HEART = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5C6 16.5 3 13 3 9.5A4.5 4.5 0 0 1 7.5 5c1.8 0 3.4 1 4.5 2.6A5.2 5.2 0 0 1 16.5 5 4.5 4.5 0 0 1 21 9.5c0 3.5-3 7-9 11z"/></svg>`;

const compact = new Intl.NumberFormat('en', { notation: 'compact' });
const DEBOUNCE_MS = 300;
const LOAD_TIMEOUT_MS = 15000;
const META_ROWS = 4;

const fmtBytes = (n: number | null): string => {
  if (n === null || !Number.isFinite(n) || n <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
};

const fmtDate = (iso: string): string =>
  iso ? new Date(iso).toLocaleDateString() : '—';

const cleanReadme = (md: string): string =>
  md
    .replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const fileName = (p: string): string => p.split(/[\\/]/).pop() ?? p;

export const mountModels = (root: HTMLElement): void => {
  root.innerHTML = `
    <div class="models">
      <header class="models-head">
        <div>
          <h1 class="page-title">Models</h1>
          <p class="models-sub">Text-generation models on Hugging Face</p>
        </div>
        <div class="models-tools">
          <button class="action-btn" id="btn-local-gguf" type="button">${ICON_FILE}<span>Local .gguf</span></button>
          <div class="sort-toggle" role="group" aria-label="Sort models">
            <button class="sort-btn is-active" data-sort="likes" type="button">Most liked</button>
            <button class="sort-btn" data-sort="downloads" type="button">Most downloaded</button>
          </div>
          <input
            id="model-search"
            class="model-search"
            type="search"
            placeholder="Search text-generation models…"
            autocomplete="off"
          />
        </div>
      </header>
      <p class="model-status" id="model-status" aria-live="polite"></p>
      <ol class="model-list" id="model-list"></ol>
      <div class="model-detail" id="model-detail" hidden></div>
    </div>`;

  const search = byId<HTMLInputElement>('model-search');
  const list = byId<HTMLOListElement>('model-list');
  const status = byId<HTMLParagraphElement>('model-status');
  const detail = byId<HTMLDivElement>('model-detail');
  const localBtn = byId<HTMLButtonElement>('btn-local-gguf');
  const sortBtns = Array.from(root.querySelectorAll<HTMLButtonElement>('.sort-btn'));

  let sort: SuperslmModelSort = 'likes';
  let loadedOnce = false;
  let requestId = 0;
  let timer = 0;
  let detailOpen = false;

  const setStatus = (text: string, isError = false): void => {
    status.textContent = text;
    status.classList.toggle('is-error', isError);
  };

  const renderRows = (models: SuperslmModelSummary[]): void => {
    list.innerHTML = '';
    models.forEach((m, i) => {
      const li = document.createElement('li');
      li.className = 'model-row is-link';
      li.style.setProperty('--i', String(i % META_ROWS));
      li.innerHTML = `
        <span class="model-name">${escapeHtml(m.id)}</span>
        <span class="model-meta">
          <span class="model-stat">${ICON_DOWNLOAD}${compact.format(m.downloads)}</span>
          <span class="model-stat">${ICON_HEART}${compact.format(m.likes)}</span>
        </span>`;
      li.addEventListener('click', () => openDetail(m.id));
      list.appendChild(li);
    });
  };

  const load = async (): Promise<void> => {
    const id = ++requestId;
    setStatus('Loading models…');
    try {
      const models = await listModels(search.value.trim(), sort);
      if (id !== requestId) return;
      setStatus('');
      if (!models.length) {
        setStatus('No models found.');
        list.innerHTML = '';
        return;
      }
      renderRows(models);
    } catch (err) {
      if (id !== requestId) return;
      setStatus('Could not load models — check your connection.', true);
      reportDebug('models.list', err);
    }
  };

  const scheduleLoad = (): void => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void load(), DEBOUNCE_MS);
  };

  const wireDownload = (btn: HTMLButtonElement, modelId: string, file: string): void => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.dl-row');
      if (!row) return;
      btn.disabled = true;
      btn.hidden = true;
      const bar = document.createElement('div');
      bar.className = 'dl-progress';
      bar.innerHTML = `<div class="dl-fill"></div><span class="dl-pct">…</span>`;
      row.appendChild(bar);
      downloadModel(modelId, file)
        .then((res) => {
          if (res.cancelled) {
            bar.remove();
            btn.disabled = false;
            btn.hidden = false;
          }
        })
        .catch((err) => {
          bar.querySelector('.dl-pct')!.textContent = 'failed';
          reportDebug('models.download', err);
        });
    });
  };

  const renderDetail = (d: SuperslmModelDetail): void => {
    detail.innerHTML = `
      <button class="detail-back" id="detail-back" type="button">← Back to list</button>
      <h2 class="page-title">${escapeHtml(d.id)}</h2>
      <div class="about-list">
        <div class="about-row"><dt>Author</dt><dd>${escapeHtml(d.author)}</dd></div>
        <div class="about-row"><dt>Task</dt><dd>${escapeHtml(d.pipeline || '—')}</dd></div>
        <div class="about-row"><dt>Library</dt><dd>${escapeHtml(d.library || '—')}</dd></div>
        <div class="about-row"><dt>Downloads</dt><dd>${compact.format(d.downloads)}</dd></div>
        <div class="about-row"><dt>Likes</dt><dd>${compact.format(d.likes)}</dd></div>
        <div class="about-row"><dt>Updated</dt><dd>${fmtDate(d.updated)}</dd></div>
      </div>
      ${d.files.length ? `
        <h3 class="section-title">GGUF files</h3>
        <ul class="dl-list">
          ${d.files.map((f) => `
            <li class="dl-row" data-file="${escapeHtml(f.name)}">
              <span class="dl-name">${escapeHtml(f.name)}</span>
              <span class="dl-size">${fmtBytes(f.size)}</span>
              <button class="action-btn dl-btn" type="button" data-dl="${escapeHtml(f.name)}">Download</button>
            </li>`).join('')}
        </ul>` : ''}
      <h3 class="section-title">Description</h3>
      <div class="changelog detail-desc">${d.readme ? renderMarkdown(cleanReadme(d.readme)) : '<p>No description available.</p>'}</div>
      ${d.readmeTruncated ? '<p class="detail-more">Showing the beginning of the model card — full text on huggingface.co.</p>' : ''}`;

    byId<HTMLButtonElement>('detail-back').addEventListener('click', closeDetail);
    detail.querySelectorAll<HTMLButtonElement>('.dl-btn').forEach((btn) => {
      wireDownload(btn, d.id, btn.dataset.dl ?? '');
    });
    detail.scrollTop = 0;
  };

  const openDetail = (id: string): void => {
    detailOpen = true;
    list.hidden = true;
    status.hidden = true;
    detail.hidden = false;
    detail.innerHTML = `
      <button class="detail-back" id="detail-back" type="button">← Back to list</button>
      <p class="model-status">Loading…</p>`;
    byId<HTMLButtonElement>('detail-back').addEventListener('click', closeDetail);
    getModelDetail(id)
      .then(renderDetail)
      .catch((err) => {
        detail.innerHTML = `
          <button class="detail-back" id="detail-back" type="button">← Back to list</button>
          <p class="model-status is-error">Could not load model details.</p>`;
        byId<HTMLButtonElement>('detail-back').addEventListener('click', closeDetail);
        reportDebug('models.detail', err);
      });
  };

  const closeDetail = (): void => {
    detailOpen = false;
    detail.hidden = true;
    list.hidden = false;
    status.hidden = false;
  };

  onModelProgress((p) => {
    if (!detailOpen) return;
    const row = detail.querySelector(`[data-file="${CSS.escape(p.file)}"]`);
    if (!row) return;
    const fill = row.querySelector<HTMLElement>('.dl-fill');
    const pct = row.querySelector<HTMLElement>('.dl-pct');
    if (!fill || !pct) return;
    if (p.error) {
      pct.textContent = 'failed';
      return;
    }
    const ratio = p.total > 0 ? Math.min(p.received / p.total, 1) : 0;
    fill.style.width = `${Math.round(ratio * 100)}%`;
    pct.textContent = p.done ? 'done' : p.total > 0 ? `${Math.round(ratio * 100)}%` : fmtBytes(p.received);
    if (p.done) row.querySelector<HTMLButtonElement>('.dl-btn')?.remove();
  });

  localBtn.addEventListener('click', () => {
    pickGguf()
      .then((p) => {
        if (p) setStatus(`Local model set: ${fileName(p)}`);
      })
      .catch((err) => reportDebug('models.pickGguf', err));
  });

  sortBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = (btn.dataset.sort ?? 'likes') as SuperslmModelSort;
      if (next === sort) return;
      sort = next;
      sortBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
      void load();
    });
  });

  search.addEventListener('input', scheduleLoad);
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void load();
  });

  onTabOpen('models', () => {
    if (loadedOnce || detailOpen) return;
    loadedOnce = true;
    window.setTimeout(() => {
      if (requestId === 0 && status.textContent === 'Loading models…') {
        setStatus('Still loading — the Hugging Face API can be slow.', true);
      }
    }, LOAD_TIMEOUT_MS);
    void load();
  });
};
