import { getBackendStatus, getSettings, localModels } from '../api';
import { fileName } from '../core/format';
import { onTabOpen, showTab } from '../core/tabs';

const greetingFor = (hour: number): string =>
  hour < 5
    ? 'Up late'
    : hour < 12
      ? 'Good morning'
      : hour < 18
        ? 'Good afternoon'
        : 'Good evening';

export const mountHome = (root: HTMLElement): void => {
  root.innerHTML = `
    <p class="eyebrow" id="greeting">Welcome</p>
    <h1 class="title">LM SuperApp</h1>
    <p class="lede">A desktop home for language models.</p>

    <div class="home-grid">
      <button class="home-tile" type="button" data-go="library">
        <span class="tile-num" id="h-models">—</span>
        <span class="tile-label">Models in library</span>
      </button>
      <button class="home-tile" type="button" data-go="chat">
        <span class="tile-num tile-text" id="h-active">—</span>
        <span class="tile-label">Active model</span>
      </button>
      <button class="home-tile" type="button" data-go="settings">
        <span class="tile-num tile-text" id="h-backend">—</span>
        <span class="tile-label">Backend</span>
      </button>
    </div>

    <div class="meta"><span id="date-line"></span></div>`;

  //TODO(home): "continue last chat" tile + recent downloads once we track activity

  const greetingEl = root.querySelector('#greeting');
  const dateEl = root.querySelector('#date-line');
  if (greetingEl) greetingEl.textContent = greetingFor(new Date().getHours());
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  }

  root.querySelectorAll<HTMLButtonElement>('.home-tile[data-go]').forEach((tile) => {
    tile.addEventListener('click', () => showTab(tile.dataset.go ?? 'home'));
  });

  const refresh = (): void => {
    void Promise.all([localModels(), getSettings(), getBackendStatus()])
      .then(([models, s, be]) => {
        const count = models.length + s.localFiles.length;
        const num = root.querySelector('#h-models');
        const active = root.querySelector('#h-active');
        const backend = root.querySelector('#h-backend');
        if (num) num.textContent = String(count);
        if (active) active.textContent = s.modelFile ? fileName(s.modelFile) : 'none';
        if (backend) {
          backend.textContent = be.running ? (be.ready ? 'running' : 'starting') : 'stopped';
        }
      })
      .catch((err: unknown) => console.error('Failed to load home stats:', err));
  };

  refresh();
  onTabOpen('home', refresh);
};
