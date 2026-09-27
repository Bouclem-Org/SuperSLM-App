import {
  getAppInfo,
  getBackendStatus,
  getChangelog,
  getSettings,
  openDevTools,
  patchSettings,
  pickGguf,
  setFullscreen,
  startBackend,
  stopBackend
} from '../api';
import { getDebugEntries, reportDebug, setDebugEnabled } from '../core/debug';
import { byId, escapeHtml } from '../core/dom';
import { renderMarkdown } from '../core/markdown';
import { onTabOpen } from '../core/tabs';

const ICON_GENERAL = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`;
const ICON_THEME = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none"/></svg>`;
const ICON_CHANGELOG = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/></svg>`;
const ICON_DEBUG = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 9a4 4 0 1 1 8 0v5a4 4 0 0 1-8 0z"/><path d="M9 5.5a3 3 0 0 1 6 0"/><path d="M8 10 4.5 8.5M8 14H4M8.5 17.5 5 19M16 10l3.5-1.5M16 14h4M15.5 17.5 19 19"/></svg>`;
const ICON_MODELS = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/></svg>`;

const fileName = (p: string): string => p.split(/[\\/]/).pop() ?? p;

const TEXT_SIZES: { value: number; label: string; hint: string }[] = [
  { value: 0.85, label: 'Compact', hint: 'Denser UI' },
  { value: 1, label: 'Default', hint: 'Standard size' },
  { value: 1.15, label: 'Large', hint: 'Easier to read' },
  { value: 1.3, label: 'XL', hint: 'Biggest text' }
];

const THEMES: { id: SuperslmTheme; label: string; hint: string }[] = [
  { id: 'dark', label: 'Dark', hint: 'Warm grey, low light' },
  { id: 'light', label: 'Light', hint: 'Warm paper, daytime' },
  { id: 'midnight', label: 'Midnight', hint: 'Cool near-black' },
  { id: 'sand', label: 'Sand', hint: 'Warm cream' },
  { id: 'forest', label: 'Forest', hint: 'Dark green tint' }
];

const initMenu = (): void => {
  const items = document.querySelectorAll<HTMLButtonElement>('.settings-item[data-settings]');
  const pages = document.querySelectorAll<HTMLElement>('.settings-page');
  items.forEach((item) => {
    item.addEventListener('click', () => {
      items.forEach((n) => n.classList.toggle('is-active', n === item));
      pages.forEach((p) =>
        p.classList.toggle('is-visible', p.id === `settings-${item.dataset.settings}`)
      );
    });
  });
};

const initGeneral = (): void => {
  getAppInfo()
    .then((info) => {
      byId('set-version').textContent = info.appVersion;
      byId('set-electron').textContent = info.versions.electron ?? '—';
      byId('set-chrome').textContent = info.versions.chrome ?? '—';
      byId('set-platform').textContent = info.platform;
    })
    .catch((err: unknown) => console.error('Failed to load app info:', err));

  const fsBox = byId('opt-fullscreen') as HTMLInputElement;
  getSettings()
    .then((s) => {
      fsBox.checked = s.fullscreen;
    })
    .catch((err: unknown) => console.error('Failed to load settings:', err));

  fsBox.addEventListener('change', () => {
    const on = fsBox.checked;
    patchSettings({ fullscreen: on }).catch((err: unknown) =>
      console.error('Failed to save fullscreen:', err)
    );
    setFullscreen(on).catch((err: unknown) =>
      console.error('Failed to set fullscreen:', err)
    );
  });
};

const initModels = (): void => {
  const label = byId('model-file-label');
  const pickBtn = byId('btn-pick-gguf') as HTMLButtonElement;
  const clearBtn = byId('btn-clear-model') as HTMLButtonElement;
  const confirmBox = byId('opt-confirm-dl') as HTMLInputElement;

  const showPath = (p: string): void => {
    label.textContent = p ? fileName(p) : 'None';
    label.title = p;
    clearBtn.disabled = !p;
  };

  getSettings()
    .then((s) => {
      showPath(s.modelFile);
      confirmBox.checked = s.confirmDownload;
    })
    .catch((err: unknown) => console.error('Failed to load settings:', err));

  pickBtn.addEventListener('click', () => {
    pickGguf()
      .then((p) => {
        if (p) showPath(p);
      })
      .catch((err: unknown) => reportDebug('settings.pickGguf', err));
  });

  clearBtn.addEventListener('click', () => {
    patchSettings({ modelFile: '' })
      .then(() => showPath(''))
      .catch((err: unknown) => console.error('Failed to clear model:', err));
  });

  confirmBox.addEventListener('change', () => {
    patchSettings({ confirmDownload: confirmBox.checked }).catch((err: unknown) =>
      console.error('Failed to save confirm-download:', err)
    );
  });
};

const refreshBackendStatus = (): void => {
  getBackendStatus()
    .then((s) => {
      byId('be-binary').textContent = s.binary ?? 'not found';
      byId('be-running').textContent = s.running ? 'yes' : 'no';
      byId('be-port').textContent = String(s.port);
      byId('be-error').textContent = s.lastError ?? '';
    })
    .catch((err: unknown) => console.error('Failed to load backend status:', err));
};

const initBackend = (): void => {
  byId('btn-be-start').addEventListener('click', () => {
    getSettings()
      .then((s) => startBackend(s.modelFile))
      .then(() => refreshBackendStatus())
      .catch((err: unknown) => {
        reportDebug('backend.start', err);
        refreshBackendStatus();
      });
  });
  byId('btn-be-stop').addEventListener('click', () => {
    stopBackend()
      .then(() => refreshBackendStatus())
      .catch((err: unknown) => console.error('Failed to stop backend:', err));
  });
  refreshBackendStatus();
};

const initDebug = (): void => {
  const dbg = byId('opt-debug') as HTMLInputElement;
  const dt = byId('opt-devtools') as HTMLInputElement;
  const openBtn = byId('btn-devtools') as HTMLButtonElement;
  const listEl = byId('debug-list');

  getSettings()
    .then((s) => {
      dbg.checked = s.debug;
      dt.checked = s.devtools;
    })
    .catch((err: unknown) => console.error('Failed to load settings:', err));

  dbg.addEventListener('change', () => {
    setDebugEnabled(dbg.checked);
    patchSettings({ debug: dbg.checked }).catch((err: unknown) =>
      console.error('Failed to save debug:', err)
    );
  });

  dt.addEventListener('change', () => {
    patchSettings({ devtools: dt.checked }).catch((err: unknown) =>
      console.error('Failed to save devtools:', err)
    );
  });

  openBtn.addEventListener('click', () => {
    openDevTools().catch((err: unknown) => console.error('Failed to open DevTools:', err));
  });

  const renderEntries = (): void => {
    const items = getDebugEntries();
    listEl.innerHTML = items.length
      ? items
          .map(
            (e) => `
        <div class="debug-entry">
          <div class="debug-entry-head">
            <span class="debug-label">${escapeHtml(e.label)}</span>
            <span class="debug-time">${e.time}</span>
          </div>
          <div class="debug-detail">${escapeHtml(e.detail)}</div>
        </div>`
          )
          .join('')
      : '<p class="debug-none">No errors captured yet.</p>';
  };

  document.addEventListener('superslm:debug', renderEntries);
  renderEntries();
};

let changelogLoaded = false;
const loadChangelog = (): void => {
  if (changelogLoaded) return;
  getChangelog()
    .then((md) => {
      byId('changelog-body').innerHTML = renderMarkdown(md);
      changelogLoaded = true;
    })
    .catch((err: unknown) => {
      console.error('Failed to load changelog:', err);
      byId('changelog-body').textContent = 'Could not load changelog.';
    });
};

export const mountSettings = (root: HTMLElement): void => {
  root.innerHTML = `
    <div class="settings">
      <nav class="settings-menu" aria-label="Settings">
        <p class="settings-heading">Settings</p>
        <button class="settings-item is-active" data-settings="general" type="button">
          ${ICON_GENERAL} <span class="nav-text">General</span>
        </button>
        <button class="settings-item" data-settings="models" type="button">
          ${ICON_MODELS} <span class="nav-text">Models</span>
        </button>
        <button class="settings-item" data-settings="theme" type="button">
          ${ICON_THEME} <span class="nav-text">Theme</span>
        </button>
        <button class="settings-item" data-settings="changelog" type="button">
          ${ICON_CHANGELOG} <span class="nav-text">Changelog</span>
        </button>
        <button class="settings-item" data-settings="debug" type="button">
          ${ICON_DEBUG} <span class="nav-text">Debug</span>
        </button>
      </nav>

      <div class="settings-pane">
        <div class="settings-page is-visible" id="settings-general">
          <h2 class="page-title">General</h2>

          <div class="section-group">
            <h3 class="section-title">Window</h3>
            <label class="setting-row">
              <input type="checkbox" id="opt-fullscreen" />
              <span>Fullscreen</span>
              <small>Applies now and on launch</small>
            </label>
          </div>

          <div class="section-group">
            <h3 class="section-title">About</h3>
            <dl class="about-list">
              <div class="about-row"><dt>Version</dt><dd id="set-version">—</dd></div>
              <div class="about-row"><dt>Electron</dt><dd id="set-electron">—</dd></div>
              <div class="about-row"><dt>Chromium</dt><dd id="set-chrome">—</dd></div>
              <div class="about-row"><dt>Platform</dt><dd id="set-platform">—</dd></div>
            </dl>
          </div>
        </div>

        <div class="settings-page" id="settings-models">
          <h2 class="page-title">Models</h2>

          <div class="section-group">
            <h3 class="section-title">Local model</h3>
            <div class="model-source">
              <span class="model-source-path" id="model-file-label">None</span>
              <div class="model-source-btns">
                <button class="action-btn" id="btn-pick-gguf" type="button">Browse .gguf…</button>
                <button class="action-btn" id="btn-clear-model" type="button" disabled>Clear</button>
              </div>
            </div>
          </div>

          <div class="section-group">
            <h3 class="section-title">Downloads</h3>
            <label class="setting-row">
              <input type="checkbox" id="opt-confirm-dl" checked />
              <span>Ask before downloading</span>
              <small>Confirm dialog before saving a file</small>
            </label>
          </div>
        </div>

        <div class="settings-page" id="settings-theme">
          <h2 class="page-title">Theme</h2>
          <div class="theme-options" role="radiogroup" aria-label="Theme">
            ${THEMES.map(
              (t) => `
            <label class="theme-option">
              <input type="radio" name="theme" value="${t.id}" />
              <span>${t.label}</span>
              <small>${t.hint}</small>
            </label>`
            ).join('')}
          </div>

          <div class="section-group">
            <h3 class="section-title">Text size</h3>
            <div class="theme-options" role="radiogroup" aria-label="Text size">
              ${TEXT_SIZES.map(
                (s) => `
              <label class="theme-option">
                <input type="radio" name="textsize" value="${s.value}" />
                <span>${s.label}</span>
                <small>${s.hint}</small>
              </label>`
              ).join('')}
            </div>
          </div>

          <p class="settings-note">Saved to ~/.superslm/settings.json</p>
        </div>

        <div class="settings-page" id="settings-changelog">
          <h2 class="page-title">Changelog</h2>
          <div class="changelog" id="changelog-body"></div>
        </div>

        <div class="settings-page" id="settings-debug">
          <h2 class="page-title">Debug</h2>

          <div class="section-group">
            <h3 class="section-title">Debug output</h3>
            <label class="setting-row">
              <input type="checkbox" id="opt-debug" />
              <span>Enable debug output</span>
              <small>Error codes and details in the UI</small>
            </label>
          </div>

          <div class="section-group">
            <h3 class="section-title">DevTools</h3>
            <label class="setting-row">
              <input type="checkbox" id="opt-devtools" />
              <span>Open DevTools on launch</span>
              <small>Detached window</small>
            </label>
            <button class="action-btn" id="btn-devtools" type="button">Open DevTools now</button>
          </div>

          <div class="section-group">
            <h3 class="section-title">llama.cpp backend</h3>
            <dl class="about-list">
              <div class="about-row"><dt>Binary</dt><dd id="be-binary">—</dd></div>
              <div class="about-row"><dt>Running</dt><dd id="be-running">—</dd></div>
              <div class="about-row"><dt>Port</dt><dd id="be-port">—</dd></div>
            </dl>
            <p class="debug-none" id="be-error"></p>
            <div class="be-btns">
              <button class="action-btn" id="btn-be-start" type="button">Start backend</button>
              <button class="action-btn" id="btn-be-stop" type="button">Stop</button>
            </div>
          </div>

          <div class="section-group">
            <h3 class="section-title">Recent errors</h3>
            <div class="debug-list" id="debug-list"></div>
          </div>
        </div>
      </div>
    </div>`;

  initMenu();
  initGeneral();
  initModels();
  initDebug();
  initBackend();
  onTabOpen('settings', loadChangelog);
};
