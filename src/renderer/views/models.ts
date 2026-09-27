import { listModels } from '../api';
import { byId, escapeHtml } from '../core/dom';
import { onTabOpen } from '../core/tabs';

const ICON_DOWNLOAD = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>`;
const ICON_HEART = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;

const compact = new Intl.NumberFormat('en', { notation: 'compact' });
const DEBOUNCE_MS = 300;

export const mountModels = (root: HTMLElement): void => {
  root.innerHTML = `
    <div class="models">
      <header class="models-head">
        <div>
          <h2 class="page-title">Models</h2>
          <p class="models-sub">Text-generation models on Hugging Face</p>
        </div>
        <div class="models-tools">
          <div class="sort-toggle" role="group" aria-label="Sort models">
            <button class="sort-btn is-active" data-sort="likes" type="button">Most liked</button>
            <button class="sort-btn" data-sort="downloads" type="button">Most downloaded</button>
          </div>
          <input
            id="model-search"
            class="model-search"
            type="search"
            placeholder="Search models…"
            aria-label="Search models"
          />
        </div>
      </header>
      <p class="model-status" id="model-status">Loading…</p>
      <ul class="model-list" id="model-list"></ul>
    </div>`;

  const list = byId('model-list');
  const status = byId('model-status');
  const search = byId('model-search') as HTMLInputElement;
  const sortBtns = root.querySelectorAll<HTMLButtonElement>('.sort-btn[data-sort]');

  let sort: SuperslmModelSort = 'likes';

  const setStatus = (msg: string): void => {
    status.textContent = msg;
    status.hidden = msg === '';
  };

  const row = (m: SuperslmModelSummary): HTMLLIElement => {
    const li = document.createElement('li');
    li.className = 'model-row';
    li.innerHTML = `
      <div class="model-main">
        <span class="model-name">${escapeHtml(m.id)}</span>
        ${m.pipeline && m.pipeline !== 'text-generation' ? `<span class="model-tag">${escapeHtml(m.pipeline)}</span>` : ''}
      </div>
      <div class="model-meta">
        <span title="Downloads">${ICON_DOWNLOAD}${compact.format(m.downloads)}</span>
        <span title="Likes">${ICON_HEART}${compact.format(m.likes)}</span>
      </div>`;
    return li;
  };

  const render = (models: SuperslmModelSummary[]): void => {
    if (!models.length) {
      setStatus('No models found.');
      return;
    }
    setStatus('');
    list.replaceChildren(...models.map(row));
  };

  let loaded = false;
  let request = 0;
  let timer = 0;

  const load = (query: string): void => {
    const id = ++request;
    setStatus('Loading…');
    listModels(query, sort)
      .then((models) => {
        if (id !== request) return;
        render(models);
        loaded = true;
      })
      .catch((err: unknown) => {
        if (id !== request) return;
        console.error('Failed to load models:', err);
        setStatus('Could not load models.');
      });
  };

  onTabOpen('models', () => {
    if (!loaded) load(search.value);
  });

  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => load(search.value), DEBOUNCE_MS);
  });

  sortBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      sort = btn.dataset.sort as SuperslmModelSort;
      sortBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
      load(search.value);
    });
  });
};
