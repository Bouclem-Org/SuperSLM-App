import {
  downloadModel,
  getModelDetail,
  listModels,
  onModelProgress,
  openExternal,
  pickGguf
} from '../api';
import { reportDebug } from '../core/debug';
import { byId, escapeHtml } from '../core/dom';
import { fmtBytes } from '../core/format';
import { icon } from '../core/icons';
import { initMdClicks, renderMarkdown, renderMath } from '../core/markdown';
import { onTabOpen } from '../core/tabs';

const ICON_DOWNLOAD = icon('download');
const ICON_FILE = icon('file');
const ICON_HEART = icon('heart');

const compact = new Intl.NumberFormat('en', { notation: 'compact' });
const DEBOUNCE_MS = 300;
const LOAD_TIMEOUT_MS = 15000;
const META_ROWS = 4;

const fmtDate = (iso: string): string =>
  iso ? new Date(iso).toLocaleDateString() : '—';

const cleanReadme = (md: string): string =>
  md
    .replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, (m, t: string, u: string) =>
      /\.pdf([?#]|$)|arxiv\.org\/pdf\//i.test(u) ? m : t
    )
    .replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const ICON_COPY = icon('copy');

const quantOf = (name: string): string | null => {
  const m = /(?:^|[.\-_])(IQ\d_XS|IQ\d|Q\d(?:_K)?_(?:XL|L|M|S|XS)|Q\d_0|Q\d|F16|F32|BF16|FP16|FP8|UD-Q\d[_A-Z]*)(?=[.\-_]|$)/i.exec(
    name
  );
  return m ? m[1].toUpperCase() : null;
};

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
          <!-- TODO(models): filter to GGUF-only models, bookmarks/favorites list -->
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
  initMdClicks(detail, (url) =>
    void openExternal(url).catch((err: unknown) => reportDebug('models.link', err))
  );
  const sortBtns = Array.from(root.querySelectorAll<HTMLButtonElement>('.sort-btn'));

  let sort: LmModelSort = 'likes';
  let loadedOnce = false;
  let requestId = 0;
  let timer = 0;
  let detailOpen = false;

  const setStatus = (text: string, isError = false): void => {
    status.textContent = text;
    status.classList.toggle('is-error', isError);
  };

  const renderRows = (models: LmModelSummary[]): void => {
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

  const wireDownload = (
    btn: HTMLButtonElement,
    modelId: string,
    repo: string,
    file: string
  ): void => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.dl-row');
      if (!row) return;
      btn.disabled = true;
      btn.hidden = true;
      const bar = document.createElement('div');
      bar.className = 'dl-progress';
      bar.innerHTML = `<div class="dl-fill"></div><span class="dl-pct">…</span>`;
      row.appendChild(bar);
      downloadModel(modelId, repo, file)
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

  const renderDetail = (d: LmModelDetail): void => {
    detail.innerHTML = `
      <button class="detail-back" id="detail-back" type="button">← Back to list</button>
      <h2 class="page-title detail-title">
        ${escapeHtml(d.id)}
        <button class="icon-btn detail-copy" id="detail-copy" type="button" aria-label="Copy model name" title="Copy model name">${ICON_COPY}</button>
      </h2>
      <div class="about-list">
        <div class="about-row"><dt>Author</dt><dd>${escapeHtml(d.author)}</dd></div>
        <div class="about-row"><dt>Task</dt><dd>${escapeHtml(d.pipeline || '—')}</dd></div>
        <div class="about-row"><dt>Library</dt><dd>${escapeHtml(d.library || '—')}</dd></div>
        <div class="about-row"><dt>Downloads</dt><dd>${compact.format(d.downloads)}</dd></div>
        <div class="about-row"><dt>Likes</dt><dd>${compact.format(d.likes)}</dd></div>
        <div class="about-row"><dt>Updated</dt><dd>${fmtDate(d.updated)}</dd></div>
      </div>
      ${d.files.length ? `
        <h3 class="section-title">GGUF files${d.files.some((f) => f.repo !== d.id) ? ` <small>(includes ${escapeHtml(d.id)}-GGUF)</small>` : ''}</h3>
        <ul class="dl-list">
          ${d.files.map((f) => {
            const q = quantOf(f.name);
            return `
            <li class="dl-row" data-file="${escapeHtml(f.name)}">
              ${q ? `<span class="dl-quant">${escapeHtml(q)}</span>` : ''}
              <span class="dl-name" title="${escapeHtml(f.repo === d.id ? f.name : `${f.repo}/${f.name}`)}">${escapeHtml(f.name)}</span>
              <span class="dl-size">${fmtBytes(f.size)}</span>
              <button class="action-btn dl-btn" type="button" data-repo="${escapeHtml(f.repo)}" data-dl="${escapeHtml(f.name)}">Download</button>
            </li>`;
          }).join('')}
        </ul>` : ''}
      <h3 class="section-title">Description</h3>
      <div class="changelog detail-desc">${d.readme ? renderMarkdown(cleanReadme(d.readme)) : '<p>No description available.</p>'}</div>
      ${d.readmeTruncated ? '<p class="detail-more">Showing the beginning of the model card — full text on huggingface.co.</p>' : ''}`;

    byId<HTMLButtonElement>('detail-back').addEventListener('click', closeDetail);
    byId<HTMLButtonElement>('detail-copy').addEventListener('click', () => {
      const btn = byId<HTMLButtonElement>('detail-copy');
      void navigator.clipboard.writeText(d.id);
      btn.innerHTML = icon('check');
      btn.classList.add('is-done');
      setTimeout(() => {
        btn.innerHTML = ICON_COPY;
        btn.classList.remove('is-done');
      }, 1200);
    });
    detail.querySelectorAll<HTMLButtonElement>('.dl-btn').forEach((btn) => {
      wireDownload(btn, d.id, btn.dataset.repo ?? d.id, btn.dataset.dl ?? '');
    });
    renderMath(detail);
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
      .then((paths) => {
        if (paths?.length) {
          setStatus(`Added ${paths.length} file${paths.length === 1 ? '' : 's'} to your library.`);
        }
      })
      .catch((err) => reportDebug('models.pickGguf', err));
  });

  sortBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = (btn.dataset.sort ?? 'likes') as LmModelSort;
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
